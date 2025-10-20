# Audio Analysis Setup Guide

## Overview

The Web Audio API integration provides real-time FFT-based audio analysis for visualization at 60fps.

## Architecture

```
Spotify Web Playback SDK (HTMLAudioElement)
    ↓
AudioIntegration (connects components)
    ↓
AudioAnalyzer (Web Audio API + FFT)
    ↓
audioStore (Svelte stores)
    ↓
Visualization Components (spectrum, waveform, etc.)
```

## Quick Start

### 1. In your main app component:

```javascript
import { onMount, onDestroy } from 'svelte';
import { SpotifyPlayer } from '$lib/services/SpotifyPlayer.js';
import { setupAudioIntegration } from '$lib/services/AudioIntegration.js';

let spotifyPlayer;
let audioIntegration;

onMount(async () => {
  // Initialize Spotify player first
  spotifyPlayer = new SpotifyPlayer();
  await spotifyPlayer.initialize();

  // Set up audio analysis
  audioIntegration = await setupAudioIntegration(spotifyPlayer);
});

onDestroy(() => {
  audioIntegration?.disconnect();
  spotifyPlayer?.disconnect();
});
```

### 2. In your visualization components:

```javascript
import {
  spectrumBars,
  waveformData,
  frequencyBands,
  audioFeatures,
  bassEnergy,
  trebleEnergy
} from '$lib/stores/audioStore.js';

// Use in your component
$: spectrum = $spectrumBars;  // 64 bars, 0-1 range
$: waveform = $waveformData;  // 1024 samples, -1 to 1 range
$: bass = $bassEnergy;        // Bass level, 0-1
```

## FFT Configuration

### Current Settings (AudioAnalyzer.js)

- **FFT Size**: 2048 samples
  - Provides 1024 frequency bins
  - Good balance between frequency resolution and time resolution
  - Processing time: ~2-3ms on modern hardware

- **Smoothing**: 0.8 (AnalyserNode) + 0.7 (temporal)
  - Reduces jitter and visual noise
  - Still responsive to quick changes

- **Frequency Range**: 20 Hz - 20 kHz (human hearing)
  - Min dB: -90
  - Max dB: -10

### Why 2048?

- **1024 would be**: Faster but less frequency detail
- **2048 is**: Sweet spot for music visualization
- **4096 would be**: More detail but slower, may impact 60fps target

## Frequency Band Mapping

The analyzer divides the spectrum into 7 perceptually-relevant bands:

| Band | Frequency Range | Musical Content |
|------|----------------|-----------------|
| Sub-Bass | 20-60 Hz | Kick drum, bass foundation |
| Bass | 60-250 Hz | Bass guitar, low toms |
| Low-Mid | 250-500 Hz | Low vocals, guitar body |
| Mid | 500-2000 Hz | Vocals, most instruments |
| High-Mid | 2000-4000 Hz | Vocal clarity, guitar |
| Presence | 4000-6000 Hz | Vocal presence, cymbals |
| Brilliance | 6000-20000 Hz | Air, shimmer, cymbals |

Access via: `$frequencyBands.bass`, `$frequencyBands.mid`, etc.

## Spectrum Bars

- **Count**: 64 bars (configurable via `SPECTRUM_BAR_COUNT`)
- **Distribution**: Logarithmic (matches human hearing)
  - More bars for lower frequencies
  - Fewer bars for higher frequencies
- **Values**: Normalized 0-1 range
- **Update Rate**: 60fps via requestAnimationFrame

## Performance Considerations

### Frame Budget (4K @ 60Hz = 16.67ms)

Typical breakdown:
- Audio callback: 1-2ms
- FFT computation: 2-3ms
- Feature extraction: 1ms
- Store updates: <0.5ms
- **Total audio analysis**: ~4-6ms (leaves 10-12ms for rendering)

### Optimization Tips

1. **Typed Arrays**: Pre-allocated, no GC pressure
2. **Smoothing**: Applied in-place, no allocations
3. **Bin Mappings**: Pre-calculated on init
4. **requestAnimationFrame**: Natural 60fps sync

### Monitoring Performance

```javascript
import { analysisMetadata } from '$lib/stores/audioStore.js';

$: {
  const timeSinceLastUpdate = performance.now() - $analysisMetadata.lastUpdate;
  if (timeSinceLastUpdate > 20) {
    console.warn('Audio analysis is lagging');
  }
}
```

## Data Flow

### Every Frame (60fps):

1. AudioAnalyzer reads from AnalyserNode
2. Applies FFT (Web Audio API, hardware-accelerated)
3. Smooths frequency data (reduces jitter)
4. Extracts 7 frequency bands
5. Generates 64 logarithmic spectrum bars
6. Calculates audio features (volume, bass, mid, treble)
7. Normalizes waveform data
8. Calls store update callback
9. Svelte stores trigger reactive updates
10. Visualization components re-render

Total: ~5-7ms

## Available Data in Stores

### spectrumBars
- **Type**: Float32Array(64)
- **Range**: 0-1
- **Use**: Spectrum bar visualization

### waveformData
- **Type**: Float32Array(1024)
- **Range**: -1 to 1
- **Use**: Waveform/oscilloscope visualization

### frequencyBands
- **Type**: Object with 7 bands
- **Range**: 0-1 per band
- **Use**: Band-specific effects, EQ display

### audioFeatures
- **Type**: Object {volume, bass, mid, treble}
- **Range**: 0-1 per feature
- **Use**: Global audio-reactive effects

### Derived Stores

- `bassEnergy`: Average of sub-bass + bass
- `trebleEnergy`: Average of presence + brilliance
- `audioData`: Combined object of all data
- `isAnalyzing`: Boolean, true when analysis is active

## Integration with Spotify

The AudioIntegration module handles connection to Spotify Web Playback SDK:

1. Waits for Spotify player to be ready
2. Locates the HTMLAudioElement created by SDK
3. Connects it to Web Audio API AnalyserNode
4. Starts analysis loop
5. Updates stores on every frame

### Important Notes

- Audio context requires user interaction to start (browser security)
- The integration automatically resumes on first click/keypress
- Spotify SDK creates audio element after `ready` event
- Analysis continues even when player is paused (shows silence)

## Troubleshooting

### No audio data / all zeros

1. Check if Spotify player is actually playing
2. Verify audio context state: `audioIntegration.getAnalyzer().getState()`
3. Check browser console for errors
4. Ensure user interaction occurred (click/keypress)

### Low frame rate

1. Check `analysisMetadata.lastUpdate` frequency
2. Reduce FFT_SIZE to 1024
3. Reduce SPECTRUM_BAR_COUNT to 32
4. Disable smoothing (set to 0)

### Jittery visualization

1. Increase smoothing factor (currently 0.7)
2. Increase SMOOTHING_TIME_CONSTANT (currently 0.8)
3. Add additional smoothing in visualization layer

## Future Enhancements

- Beat detection (onset detection)
- Tempo estimation
- Stereo analysis (separate L/R channels)
- Spectral centroid, flux
- Dynamic range compression
- Rust-based FFT for better performance
