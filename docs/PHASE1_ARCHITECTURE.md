# Phase 1 MVP Architecture - macOS Local Testing

**Version:** 1.0
**Date:** October 19, 2025
**Platform:** macOS Development/Testing
**Target:** Proof of concept for audio visualization pipeline

---

## Table of Contents
1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Component Design](#component-design)
4. [Data Flow](#data-flow)
5. [Technology Stack](#technology-stack)
6. [Implementation Plan](#implementation-plan)
7. [HUMAN Tasks](#human-tasks)
8. [Testing Strategy](#testing-strategy)
9. [Success Criteria](#success-criteria)

---

## Overview

Phase 1 focuses on establishing the core audio visualization pipeline on macOS. This provides a rapid development environment for testing audio analysis and visualization concepts before deploying to Nvidia Shield Pro.

### Goals
- Capture system audio from streaming services
- Perform real-time spectral analysis (FFT)
- Render basic visualizations (spectrum bars, waveform)
- Achieve 60 FPS at native resolution
- Build foundation for future visualization complexity

### Non-Goals (Deferred to Later Phases)
- Streaming service SDK integration
- Metadata fetching (artist, album, lyrics)
- Complex visualizations (particles, radial patterns)
- Machine learning/self-evolution
- Android TV deployment

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        macOS System Layer                        │
│  ┌──────────────────┐              ┌────────────────────┐       │
│  │ Streaming Service│              │   Audio Routing    │       │
│  │ (Spotify/Tidal/  │──────────────▶│   (BlackHole)     │       │
│  │ Apple Music)     │   Audio Out  │                    │       │
│  └──────────────────┘              └────────┬───────────┘       │
│                                              │                   │
└──────────────────────────────────────────────┼───────────────────┘
                                               │ System Audio
                                               │ Loopback
┌──────────────────────────────────────────────┼───────────────────┐
│                     musicViz Application                         │
│                                              │                   │
│  ┌───────────────────────────────────────────▼────────────────┐ │
│  │              Audio Input Module (Web Audio API)            │ │
│  │  - getUserMedia() or navigator.mediaDevices                │ │
│  │  - AudioContext setup                                       │ │
│  │  - Input node configuration                                 │ │
│  └────────────────────────┬────────────────────────────────────┘ │
│                           │ AudioBuffer                          │
│  ┌────────────────────────▼────────────────────────────────────┐ │
│  │           Audio Analysis Module (Rust + WASM)              │ │
│  │  ┌──────────────────┐  ┌─────────────────┐                 │ │
│  │  │ AnalyserNode     │  │ Time Domain     │                 │ │
│  │  │ (FFT)            │  │ Waveform        │                 │ │
│  │  │ - 2048 samples   │  │ Extraction      │                 │ │
│  │  │ - Frequency bins │  │                 │                 │ │
│  │  └────────┬─────────┘  └────────┬────────┘                 │ │
│  └───────────┼──────────────────────┼──────────────────────────┘ │
│              │ Frequency Data       │ Waveform Data             │
│  ┌───────────▼──────────────────────▼──────────────────────────┐ │
│  │              State Management (Svelte Stores)               │ │
│  │  - audioData: { frequencies, waveform, volume }             │ │
│  │  - visualizationState: { mode, params }                     │ │
│  │  - debugInfo: { fps, latency, peakFreq }                    │ │
│  └────────────────────────┬────────────────────────────────────┘ │
│                           │ Reactive Updates                     │
│  ┌────────────────────────▼────────────────────────────────────┐ │
│  │           Visualization Render Engine (WebGL)              │ │
│  │  ┌──────────────────┐  ┌─────────────────┐                 │ │
│  │  │ Spectrum Bars    │  │ Waveform        │                 │ │
│  │  │ Renderer         │  │ Renderer        │                 │ │
│  │  │ - Vertex shader  │  │ - Line drawing  │                 │ │
│  │  │ - Fragment shader│  │ - Smoothing     │                 │ │
│  │  └────────┬─────────┘  └────────┬────────┘                 │ │
│  └───────────┼──────────────────────┼──────────────────────────┘ │
│              │                      │                            │
│  ┌───────────▼──────────────────────▼──────────────────────────┐ │
│  │                 Canvas/WebGL Output                         │ │
│  │  - 60 FPS render loop                                       │ │
│  │  - Double buffering                                         │ │
│  │  - Adaptive resolution                                      │ │
│  └─────────────────────────┬───────────────────────────────────┘ │
│                            │                                     │
│  ┌─────────────────────────▼───────────────────────────────────┐ │
│  │                    UI Overlay (Svelte)                      │ │
│  │  - Debug info (FPS, frequency peaks, volume)                │ │
│  │  - Controls overlay (show/hide with Space)                  │ │
│  │  - Keyboard shortcuts handler                               │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ Display Output│
                    │ (macOS Screen)│
                    └───────────────┘
```

---

## Component Design

### 1. Audio Input Module

**Location:** `src/lib/audio/AudioCapture.js`

**Responsibilities:**
- Request microphone/system audio permission
- Configure Web Audio API context
- Create audio input stream from system audio (BlackHole)
- Handle audio device selection
- Manage audio stream lifecycle (start/stop/pause)

**Key APIs:**
```javascript
class AudioCapture {
  constructor()
  async initialize()              // Setup AudioContext
  async requestPermission()       // Get mic/system audio access
  async start()                   // Begin capturing audio
  stop()                          // Stop audio capture
  getAudioContext()               // Return AudioContext for analysis
  getInputStream()                // Return MediaStream
}
```

**Configuration:**
```javascript
const audioConfig = {
  sampleRate: 48000,              // Match streaming service quality
  channelCount: 2,                // Stereo
  echoCancellation: false,        // We want pure audio
  noiseSuppression: false,        // No processing
  autoGainControl: false          // Preserve dynamics
};
```

**Challenges:**
- Web Audio API may require user gesture to start
- Browser security restrictions on audio capture
- Ensuring BlackHole device is selected

---

### 2. Audio Analysis Module

**Location:** `src/lib/audio/AudioAnalyzer.js` + `src-tauri/src/audio_analysis.rs`

**Responsibilities:**
- Perform FFT analysis on incoming audio
- Extract frequency bands (sub-bass to brilliance)
- Calculate volume/RMS levels
- Extract time-domain waveform data
- Smooth and normalize data for visualization

**Architecture:**
```
JavaScript (Web Audio API)
    │
    ├─▶ AnalyserNode (FFT)
    │   - frequencyBinCount: 1024
    │   - fftSize: 2048
    │   - smoothingTimeConstant: 0.8
    │
    └─▶ ScriptProcessorNode (optional for custom processing)

Optional Rust Backend (Phase 1b)
    └─▶ High-performance FFT (rustfft)
    └─▶ Custom audio feature extraction
```

**Frequency Bands:**
```javascript
const FREQUENCY_BANDS = {
  subBass:    { min: 20,    max: 60    },  // Feel it
  bass:       { min: 60,    max: 250   },  // Kick, bass
  lowMid:     { min: 250,   max: 500   },  // Warmth
  mid:        { min: 500,   max: 2000  },  // Vocals, guitars
  highMid:    { min: 2000,  max: 4000  },  // Presence
  presence:   { min: 4000,  max: 6000  },  // Clarity
  brilliance: { min: 6000,  max: 20000 }   // Air, shimmer
};
```

**Key APIs:**
```javascript
class AudioAnalyzer {
  constructor(audioContext)
  connect(sourceNode)             // Connect to audio source
  getFrequencyData()              // Returns Float32Array of frequencies
  getWaveformData()               // Returns Float32Array of waveform
  getVolume()                     // Returns RMS volume (0-1)
  getFrequencyBands()             // Returns object with band levels
  disconnect()
}
```

**Data Output Format:**
```javascript
{
  frequencies: Float32Array(1024),  // Raw FFT bins
  waveform: Float32Array(2048),     // Time domain
  volume: 0.0-1.0,                  // RMS level
  bands: {
    subBass: 0.0-1.0,
    bass: 0.0-1.0,
    // ... etc
  },
  peakFrequency: 440.0,             // Hz
  timestamp: performance.now()
}
```

---

### 3. Visualization Render Engine

**Location:** `src/lib/visualizations/`

#### 3.1 Spectrum Bars Renderer

**File:** `src/lib/visualizations/SpectrumBars.svelte`

**Features:**
- 64-128 vertical bars representing frequency bins
- Logarithmic frequency spacing
- Smooth interpolation between frames
- Gradient colors based on intensity
- Decay/fall-off animation

**Rendering Approach:**
- **Canvas 2D** for Phase 1 simplicity
- **WebGL** upgrade in Phase 2 for performance

**Visual Parameters:**
```javascript
const spectrumConfig = {
  barCount: 64,                    // Number of bars
  barWidth: 0.8,                   // Width ratio (0-1)
  barSpacing: 0.2,                 // Gap between bars
  smoothing: 0.7,                  // Interpolation smoothing
  decay: 0.9,                      // Fall-off rate
  minHeight: 0.02,                 // Minimum bar height
  colorScheme: 'gradient',         // gradient | solid | rainbow
  colors: {
    low: '#4c1d95',                // Purple (bass)
    mid: '#7c3aed',                // Violet (mids)
    high: '#a78bfa'                // Light purple (highs)
  }
};
```

**Rendering Logic:**
```javascript
function renderSpectrumBars(ctx, frequencyData, config) {
  const barWidth = canvas.width / config.barCount;

  for (let i = 0; i < config.barCount; i++) {
    // Map logarithmically to frequency bins
    const binIndex = logScale(i, config.barCount, frequencyData.length);
    const value = frequencyData[binIndex];

    // Smooth transition
    const smoothedValue = smoothedValues[i] * config.smoothing +
                          value * (1 - config.smoothing);
    smoothedValues[i] = smoothedValue;

    // Calculate bar height
    const barHeight = smoothedValue * canvas.height;

    // Draw bar
    ctx.fillStyle = getColorForFrequency(i, config.barCount);
    ctx.fillRect(
      i * barWidth,
      canvas.height - barHeight,
      barWidth * config.barWidth,
      barHeight
    );
  }
}
```

#### 3.2 Waveform Renderer

**File:** `src/lib/visualizations/Waveform.svelte`

**Features:**
- Dual-channel stereo visualization
- Mirror/symmetrical mode
- Smooth line interpolation
- Trail effects (historical waveform)

**Visual Parameters:**
```javascript
const waveformConfig = {
  style: 'mirror',                 // mirror | dual | mono
  lineWidth: 2,                    // Line thickness
  smoothing: 0.5,                  // Line smoothing
  amplitude: 0.8,                  // Height multiplier
  color: '#7c3aed',               // Waveform color
  trailLength: 0,                  // Phase 1: no trails
  backgroundColor: '#0f0f0f'       // Dark background
};
```

**Rendering Logic:**
```javascript
function renderWaveform(ctx, waveformData, config) {
  ctx.beginPath();
  ctx.lineWidth = config.lineWidth;
  ctx.strokeStyle = config.color;

  const centerY = canvas.height / 2;
  const sliceWidth = canvas.width / waveformData.length;

  for (let i = 0; i < waveformData.length; i++) {
    const v = waveformData[i] * config.amplitude;
    const y = centerY + (v * centerY);
    const x = i * sliceWidth;

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }

  ctx.stroke();

  // Mirror mode: draw reflection
  if (config.style === 'mirror') {
    ctx.save();
    ctx.scale(1, -1);
    ctx.translate(0, -canvas.height);
    ctx.stroke();
    ctx.restore();
  }
}
```

---

### 4. State Management

**Location:** `src/lib/stores/`

**Svelte Stores Architecture:**

```javascript
// src/lib/stores/audioStore.js
import { writable, derived } from 'svelte/store';

export const audioData = writable({
  frequencies: new Float32Array(1024),
  waveform: new Float32Array(2048),
  volume: 0,
  bands: {},
  peakFrequency: 0,
  timestamp: 0
});

export const isAudioActive = writable(false);
export const audioPermissionGranted = writable(false);

// Derived store for volume meter
export const volumeLevel = derived(
  audioData,
  $audioData => $audioData.volume
);
```

```javascript
// src/lib/stores/visualizationStore.js
import { writable } from 'svelte/store';

export const visualizationMode = writable('spectrum'); // spectrum | waveform | both

export const visualizationParams = writable({
  spectrum: {
    barCount: 64,
    smoothing: 0.7,
    decay: 0.9,
    colorScheme: 'gradient'
  },
  waveform: {
    style: 'mirror',
    lineWidth: 2,
    smoothing: 0.5
  }
});
```

```javascript
// src/lib/stores/debugStore.js
import { writable, derived } from 'svelte/store';

export const debugInfo = writable({
  fps: 0,
  frameTime: 0,
  audioLatency: 0,
  peakFrequency: 0,
  avgVolume: 0,
  droppedFrames: 0
});

export const showDebugOverlay = writable(true); // Show by default in Phase 1
```

**Store Update Pattern:**
```javascript
// Called from render loop
function updateAudioData(analysisResult) {
  audioData.update(current => ({
    ...current,
    ...analysisResult,
    timestamp: performance.now()
  }));
}
```

---

### 5. UI Layer

**Location:** `src/routes/+page.svelte` (main app), `src/lib/components/`

#### Component Structure

```
src/
├── routes/
│   └── +page.svelte              # Main application page
└── lib/
    ├── components/
    │   ├── VisualizationCanvas.svelte   # Main render canvas
    │   ├── DebugOverlay.svelte          # FPS, audio metrics
    │   ├── ControlOverlay.svelte        # Settings (hidden by default)
    │   └── PermissionRequest.svelte     # Audio permission UI
    ├── audio/
    │   ├── AudioCapture.js
    │   └── AudioAnalyzer.js
    ├── visualizations/
    │   ├── SpectrumBars.svelte
    │   └── Waveform.svelte
    └── stores/
        ├── audioStore.js
        ├── visualizationStore.js
        └── debugStore.js
```

#### Main App Layout (`+page.svelte`)

```svelte
<script>
  import { onMount } from 'svelte';
  import VisualizationCanvas from '$lib/components/VisualizationCanvas.svelte';
  import DebugOverlay from '$lib/components/DebugOverlay.svelte';
  import ControlOverlay from '$lib/components/ControlOverlay.svelte';
  import PermissionRequest from '$lib/components/PermissionRequest.svelte';
  import { audioPermissionGranted, isAudioActive } from '$lib/stores/audioStore';
  import { showDebugOverlay } from '$lib/stores/debugStore';

  let showControls = false;

  function handleKeydown(event) {
    switch(event.key) {
      case ' ':  // Space - toggle playback
        event.preventDefault();
        toggleAudio();
        break;
      case 'Escape':  // Hide controls
        showControls = false;
        break;
      case 'd':  // Toggle debug
      case 'D':
        showDebugOverlay.update(v => !v);
        break;
      case 'c':  // Show controls
      case 'C':
        showControls = !showControls;
        break;
      case 'f':  // Fullscreen
      case 'F':
        toggleFullscreen();
        break;
    }
  }

  onMount(() => {
    // Setup keyboard listeners
    window.addEventListener('keydown', handleKeydown);

    return () => {
      window.removeEventListener('keydown', handleKeydown);
    };
  });
</script>

<svelte:window on:keydown={handleKeydown} />

<main class="app-container">
  {#if !$audioPermissionGranted}
    <PermissionRequest />
  {:else}
    <VisualizationCanvas />

    {#if $showDebugOverlay}
      <DebugOverlay />
    {/if}

    {#if showControls}
      <ControlOverlay bind:visible={showControls} />
    {/if}
  {/if}
</main>

<style>
  .app-container {
    width: 100vw;
    height: 100vh;
    margin: 0;
    padding: 0;
    overflow: hidden;
    background: #0f0f0f;
  }
</style>
```

#### Debug Overlay Component

```svelte
<!-- src/lib/components/DebugOverlay.svelte -->
<script>
  import { debugInfo } from '$lib/stores/debugStore';
  import { audioData } from '$lib/stores/audioStore';
</script>

<div class="debug-overlay">
  <div class="debug-section">
    <h3>Performance</h3>
    <p>FPS: {$debugInfo.fps.toFixed(1)}</p>
    <p>Frame Time: {$debugInfo.frameTime.toFixed(2)}ms</p>
    <p>Dropped Frames: {$debugInfo.droppedFrames}</p>
  </div>

  <div class="debug-section">
    <h3>Audio</h3>
    <p>Volume: {($audioData.volume * 100).toFixed(1)}%</p>
    <p>Peak Frequency: {$audioData.peakFrequency.toFixed(0)} Hz</p>
    <p>Latency: {$debugInfo.audioLatency.toFixed(1)}ms</p>
  </div>

  <div class="debug-section">
    <h3>Frequency Bands</h3>
    {#each Object.entries($audioData.bands) as [name, level]}
      <div class="band-meter">
        <span>{name}</span>
        <div class="meter-bar">
          <div class="meter-fill" style="width: {level * 100}%"></div>
        </div>
      </div>
    {/each}
  </div>

  <div class="debug-section">
    <h3>Controls</h3>
    <p><kbd>Space</kbd> - Play/Pause</p>
    <p><kbd>D</kbd> - Toggle Debug</p>
    <p><kbd>C</kbd> - Controls</p>
    <p><kbd>F</kbd> - Fullscreen</p>
  </div>
</div>

<style>
  .debug-overlay {
    position: fixed;
    top: 10px;
    right: 10px;
    background: rgba(0, 0, 0, 0.8);
    border: 1px solid #7c3aed;
    border-radius: 8px;
    padding: 15px;
    color: #fff;
    font-family: monospace;
    font-size: 12px;
    max-width: 300px;
    z-index: 1000;
    backdrop-filter: blur(10px);
  }

  .debug-section {
    margin-bottom: 15px;
  }

  .debug-section h3 {
    color: #a78bfa;
    margin: 0 0 8px 0;
    font-size: 14px;
  }

  .debug-section p {
    margin: 4px 0;
  }

  kbd {
    background: #333;
    border: 1px solid #555;
    border-radius: 3px;
    padding: 2px 6px;
    font-size: 11px;
  }

  .band-meter {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 4px 0;
  }

  .band-meter span {
    width: 80px;
    font-size: 11px;
  }

  .meter-bar {
    flex: 1;
    height: 12px;
    background: #333;
    border-radius: 6px;
    overflow: hidden;
  }

  .meter-fill {
    height: 100%;
    background: linear-gradient(90deg, #4c1d95, #7c3aed, #a78bfa);
    transition: width 0.1s ease-out;
  }
</style>
```

---

### 6. Main Render Loop

**Location:** `src/lib/components/VisualizationCanvas.svelte`

```svelte
<script>
  import { onMount, onDestroy } from 'svelte';
  import { audioData, isAudioActive } from '$lib/stores/audioStore';
  import { debugInfo } from '$lib/stores/debugStore';
  import { visualizationMode } from '$lib/stores/visualizationStore';
  import AudioCapture from '$lib/audio/AudioCapture';
  import AudioAnalyzer from '$lib/audio/AudioAnalyzer';

  let canvas;
  let ctx;
  let audioCapture;
  let audioAnalyzer;
  let animationFrameId;

  let lastFrameTime = 0;
  let frameCount = 0;
  let fpsUpdateTime = 0;

  onMount(async () => {
    // Setup canvas
    ctx = canvas.getContext('2d', { alpha: false });
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Initialize audio
    audioCapture = new AudioCapture();
    await audioCapture.initialize();
    await audioCapture.start();

    audioAnalyzer = new AudioAnalyzer(audioCapture.getAudioContext());
    audioAnalyzer.connect(audioCapture.getInputStream());

    isAudioActive.set(true);

    // Start render loop
    animationFrameId = requestAnimationFrame(renderLoop);
  });

  onDestroy(() => {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
    if (audioAnalyzer) {
      audioAnalyzer.disconnect();
    }
    if (audioCapture) {
      audioCapture.stop();
    }
    window.removeEventListener('resize', resizeCanvas);
  });

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function renderLoop(timestamp) {
    // Calculate FPS
    const deltaTime = timestamp - lastFrameTime;
    lastFrameTime = timestamp;
    frameCount++;

    if (timestamp - fpsUpdateTime > 1000) {
      debugInfo.update(d => ({ ...d, fps: frameCount }));
      frameCount = 0;
      fpsUpdateTime = timestamp;
    }

    // Get audio data
    const analysis = {
      frequencies: audioAnalyzer.getFrequencyData(),
      waveform: audioAnalyzer.getWaveformData(),
      volume: audioAnalyzer.getVolume(),
      bands: audioAnalyzer.getFrequencyBands(),
      peakFrequency: audioAnalyzer.getPeakFrequency(),
      timestamp: timestamp
    };

    // Update store
    audioData.set(analysis);

    // Clear canvas
    ctx.fillStyle = '#0f0f0f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Render visualizations based on mode
    const mode = $visualizationMode;

    if (mode === 'spectrum' || mode === 'both') {
      renderSpectrum(ctx, analysis.frequencies);
    }

    if (mode === 'waveform' || mode === 'both') {
      renderWaveform(ctx, analysis.waveform);
    }

    // Update debug info
    debugInfo.update(d => ({
      ...d,
      frameTime: deltaTime,
      peakFrequency: analysis.peakFrequency
    }));

    // Continue loop
    animationFrameId = requestAnimationFrame(renderLoop);
  }

  function renderSpectrum(ctx, frequencies) {
    // Import and use SpectrumBars rendering logic
    // ... (implementation from section 3.1)
  }

  function renderWaveform(ctx, waveform) {
    // Import and use Waveform rendering logic
    // ... (implementation from section 3.2)
  }
</script>

<canvas bind:this={canvas}></canvas>

<style>
  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
```

---

## Data Flow

### Startup Sequence

```
1. User launches app
   └─▶ App loads (+page.svelte)

2. Check audio permission
   └─▶ Show PermissionRequest if not granted
   └─▶ User clicks "Allow Audio Access"

3. AudioCapture.initialize()
   └─▶ Create AudioContext
   └─▶ Request getUserMedia() for system audio
   └─▶ User selects BlackHole device (or default)

4. AudioCapture.start()
   └─▶ Begin audio stream
   └─▶ Connect to AudioAnalyzer

5. Start render loop
   └─▶ requestAnimationFrame(renderLoop)

6. Render loop begins
   └─▶ 60 FPS visualization active
```

### Runtime Data Flow (Per Frame)

```
┌─────────────────────────────────────────────────────┐
│ Streaming Service (Spotify/Tidal/Apple Music)      │
│ Playing audio at 44.1kHz-192kHz                     │
└─────────────────┬───────────────────────────────────┘
                  │ Audio Output
                  ▼
┌─────────────────────────────────────────────────────┐
│ BlackHole (Virtual Audio Device)                    │
│ Loopback: System Audio → musicViz                   │
└─────────────────┬───────────────────────────────────┘
                  │ System Audio Input
                  ▼
┌─────────────────────────────────────────────────────┐
│ Web Audio API - MediaStreamSource                   │
│ AudioContext (sampleRate: 48000)                    │
└─────────────────┬───────────────────────────────────┘
                  │ AudioBuffer (continuous)
                  ▼
┌─────────────────────────────────────────────────────┐
│ AnalyserNode (FFT)                                  │
│ - fftSize: 2048                                     │
│ - getFloatFrequencyData() → Float32Array(1024)      │
│ - getFloatTimeDomainData() → Float32Array(2048)     │
└─────────────────┬───────────────────────────────────┘
                  │ Every frame (~16ms @ 60fps)
                  ▼
┌─────────────────────────────────────────────────────┐
│ AudioAnalyzer.getFrequencyData()                    │
│ - Raw FFT bins                                      │
│ - Frequency band extraction                         │
│ - Volume calculation                                │
│ - Peak frequency detection                          │
└─────────────────┬───────────────────────────────────┘
                  │ Processed audio data
                  ▼
┌─────────────────────────────────────────────────────┐
│ Svelte Store Update (audioData)                     │
│ - Reactive updates to all subscribers               │
└─────────────────┬───────────────────────────────────┘
                  │ Store change triggers re-render
                  ▼
┌─────────────────────────────────────────────────────┐
│ Render Loop (requestAnimationFrame)                 │
│ 1. Clear canvas                                     │
│ 2. Render spectrum bars                             │
│ 3. Render waveform                                  │
│ 4. Update debug overlay                             │
└─────────────────┬───────────────────────────────────┘
                  │ GPU compositing
                  ▼
┌─────────────────────────────────────────────────────┐
│ Display Output (60 FPS)                             │
└─────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Frontend
- **Framework:** Svelte 5 + SvelteKit
- **Build Tool:** Vite 6
- **Styling:** CSS3 (custom) or Tailwind CSS (optional)
- **Graphics:** Canvas 2D API (Phase 1), WebGL 2.0 (Phase 2+)

### Audio Processing
- **Primary:** Web Audio API
  - AudioContext
  - AnalyserNode (FFT)
  - MediaStreamSource
- **Future:** Rust/WASM audio processing (Phase 1b if needed)

### Desktop Runtime
- **Platform:** Tauri v2
- **Language:** Rust 1.70+
- **Target:** macOS 12+ (Intel + Apple Silicon)

### Development Tools
- **IDE:** VS Code (recommended)
- **Browser DevTools:** Safari/Chrome Inspector
- **Audio Routing:** BlackHole 2ch
- **Version Control:** Git

### External Dependencies
```json
{
  "dependencies": {
    "@tauri-apps/api": "^2.0.0",
    "svelte": "^5.0.0"
  },
  "devDependencies": {
    "@sveltejs/kit": "^2.9.0",
    "@sveltejs/adapter-static": "^3.0.6",
    "@tauri-apps/cli": "^2.0.0",
    "vite": "^6.0.3"
  }
}
```

---

## Implementation Plan

### Week 1: Foundation

#### Day 1-2: Project Setup & Audio Capture
- [ ] Initialize Tauri + SvelteKit project structure
- [ ] Configure Tauri for macOS development
- [ ] Implement AudioCapture module
- [ ] Test system audio input with BlackHole
- [ ] Verify audio permission flow

**Deliverable:** Audio input working, visible in browser console

#### Day 3-4: Audio Analysis
- [ ] Implement AudioAnalyzer module
- [ ] Setup AnalyserNode with FFT
- [ ] Extract frequency and waveform data
- [ ] Calculate frequency bands
- [ ] Test with sample music

**Deliverable:** Real-time audio data in console

#### Day 5-7: Basic Visualization
- [ ] Create VisualizationCanvas component
- [ ] Implement spectrum bars renderer
- [ ] Implement waveform renderer
- [ ] Setup render loop (60 FPS target)
- [ ] Basic color scheme

**Deliverable:** Working visualizations responding to audio

### Week 2: Polish & Debug Tools

#### Day 8-10: State Management & UI
- [ ] Setup Svelte stores
- [ ] Create debug overlay component
- [ ] Implement keyboard controls
- [ ] Add control overlay (basic settings)
- [ ] Permission request UI

**Deliverable:** Complete UI with debug info

#### Day 11-12: Performance Optimization
- [ ] Profile render loop performance
- [ ] Optimize FFT processing
- [ ] Implement smoothing and interpolation
- [ ] Reduce memory allocations
- [ ] Test at various resolutions

**Deliverable:** Solid 60 FPS at 1080p and 4K

#### Day 13-14: Testing & Documentation
- [ ] Test with different streaming services
- [ ] Test with various music genres
- [ ] Document known issues
- [ ] Create user testing guide
- [ ] Prepare demo video

**Deliverable:** Phase 1 MVP ready for demo

---

## HUMAN Tasks

### 🚨 CRITICAL - Must Complete Before Development

#### 1. System Audio Setup (macOS)
**Estimated Time:** 15-30 minutes

**Steps:**
```bash
# Install BlackHole via Homebrew
brew install blackhole-2ch

# Configure Audio MIDI Setup:
1. Open "Audio MIDI Setup" (Applications > Utilities)
2. Click "+" in bottom left → "Create Multi-Output Device"
3. Check both:
   - Your speakers/headphones (for hearing audio)
   - BlackHole 2ch (for capturing audio)
4. Right-click Multi-Output Device → "Use This Device For Sound Output"
5. Set Multi-Output as System Default Output

# Test:
- Play music from Spotify/Tidal/Apple Music
- You should hear audio through speakers
- BlackHole should appear as input device in musicViz
```

**Alternative (simpler but silent):**
```
1. Set BlackHole 2ch as System Output
2. Use audio monitoring software (e.g., Audio Hijack) to route audio to speakers
```

**Troubleshooting:**
- If no audio: Check Multi-Output Device has correct devices checked
- If musicViz can't capture: Verify browser has microphone permission
- If latency issues: Reduce buffer size in Audio MIDI Setup

---

#### 2. Streaming Service Accounts
**Estimated Time:** 5-10 minutes per service

**Required:**
- At least ONE of the following:
  - [ ] Tidal subscription (Hi-Fi or Hi-Fi Plus recommended)
  - [ ] Spotify Premium
  - [ ] Apple Music subscription
  - [ ] Amazon Music HD/Ultra HD

**Setup:**
1. Sign up / log in to streaming service
2. Download desktop app (or use web player)
3. Test playback to ensure audio works
4. Verify audio is routed through BlackHole

**Recommended for Testing:**
- Use Hi-Fi/Lossless tier for best quality
- Download a variety of test tracks (different genres, dynamics)

---

#### 3. Development Environment
**Estimated Time:** 30-45 minutes

**Checklist:**
- [ ] Install Homebrew (if not already installed)
  ```bash
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  ```

- [ ] Install Rust
  ```bash
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  source $HOME/.cargo/env
  ```

- [ ] Install Node.js
  ```bash
  brew install node
  node --version  # Should be 18+
  ```

- [ ] Install Xcode Command Line Tools
  ```bash
  xcode-select --install
  ```

- [ ] Clone musicViz repository
  ```bash
  cd ~/Code/musicViz
  npm install
  ```

- [ ] Verify Tauri works
  ```bash
  npm run tauri dev
  ```

---

#### 4. Browser Permissions
**Estimated Time:** 2 minutes

**When you first run the app:**
1. Browser will request microphone permission
2. Click "Allow" to grant access
3. Select "BlackHole 2ch" or "Multi-Output Device" as input
4. Verify audio is being captured (check debug overlay)

**Note:** You may need to grant permission separately for:
- Safari
- Chrome
- Firefox (if testing cross-browser)

---

### 🔧 OPTIONAL - Recommended for Better Testing

#### 5. Install Multiple Streaming Apps
**Estimated Time:** 15 minutes

This allows testing across different services:
- [ ] Tidal Desktop: https://tidal.com/download
- [ ] Spotify Desktop: https://www.spotify.com/download
- [ ] Apple Music: Pre-installed (Music app)
- [ ] Amazon Music: https://music.amazon.com/apps

**Why:** Different services may have different audio characteristics, compression, or quality levels.

---

#### 6. Test Music Library
**Estimated Time:** 20-30 minutes

Create playlists with varied music for testing:

**Bass-Heavy:**
- Electronic/EDM tracks
- Hip-hop with strong sub-bass
- Tests low-frequency visualization

**Vocal-Focused:**
- Acoustic tracks
- Jazz vocals
- Tests mid-frequency clarity

**Full-Spectrum:**
- Orchestral music
- Rock/metal
- Tests entire frequency range

**Dynamic Range:**
- Classical music (quiet → loud)
- Tests visualization responsiveness to dynamics

---

#### 7. Performance Monitoring Tools
**Estimated Time:** 10 minutes

**Install/Setup:**
- [ ] Activity Monitor (built-in) - Monitor CPU/GPU usage
- [ ] Safari Web Inspector - Profile JavaScript performance
- [ ] Chrome DevTools - Alternative profiling

**Usage:**
- Monitor GPU usage during visualization
- Check for memory leaks during long sessions
- Profile render loop performance

---

### 📋 Testing Checklist (HUMAN Verification Required)

Once development is complete, you will need to verify:

#### Visual Quality
- [ ] Spectrum bars respond smoothly to audio
- [ ] No visual glitches or tearing
- [ ] Colors are pleasant and distinguishable
- [ ] Waveform displays correctly in stereo
- [ ] 60 FPS maintained during playback

#### Audio Accuracy
- [ ] Bass notes trigger low-frequency bars
- [ ] High notes trigger high-frequency bars
- [ ] Volume changes affect visualization intensity
- [ ] No audio dropouts or glitches
- [ ] Audio-visual sync is tight (<50ms)

#### User Experience
- [ ] Keyboard shortcuts work as expected
- [ ] Debug overlay displays accurate info
- [ ] Fullscreen mode works
- [ ] App starts without errors
- [ ] Permission flow is clear

#### Cross-Service Testing
- [ ] Works with Spotify
- [ ] Works with Tidal
- [ ] Works with Apple Music
- [ ] Works with Amazon Music
- [ ] (Test at least 2 services)

---

### 🎯 Decision Points (HUMAN Input Needed)

During development, you may need to decide on:

#### 1. Visual Style Direction
**Question:** What color scheme feels right?
- Option A: Purple/violet gradient (current plan)
- Option B: Rainbow spectrum (classic visualizer)
- Option C: Monochrome (minimalist)
- Option D: Dynamic (changes with genre)

**When:** During Week 1, Day 5-7

---

#### 2. Spectrum Bar Count
**Question:** How many bars look best?
- 32 bars: Simpler, chunkier look
- 64 bars: Balanced (current plan)
- 128 bars: More detailed, smoother

**When:** During Week 1, Day 6

**Test:** Try each and see which feels most responsive

---

#### 3. Waveform Style
**Question:** Which waveform visualization is preferred?
- Mirror (symmetrical reflection)
- Dual (left/right channels separate)
- Mono (single waveform)
- Circular (radial waveform)

**When:** During Week 1, Day 7

---

#### 4. Performance Trade-offs
**Question:** If performance is borderline at 4K:
- Reduce bar count?
- Lower to 30 FPS?
- Reduce smoothing/effects?
- Use simpler rendering?

**When:** During Week 2, Day 11-12 (performance optimization)

---

## Testing Strategy

### Unit Testing
**Scope:** Phase 1 - Manual testing only
**Automated Tests:** Deferred to Phase 2

**Manual Test Cases:**

1. **Audio Input**
   - [ ] Permission request appears
   - [ ] Audio device selection works
   - [ ] Input level meters show signal
   - [ ] No audio when streaming service paused

2. **Audio Analysis**
   - [ ] FFT data updates at 60 FPS
   - [ ] Frequency bands match audio content
   - [ ] Volume meter accurate
   - [ ] Peak frequency detection reasonable

3. **Visualization**
   - [ ] Spectrum bars render correctly
   - [ ] Waveform renders correctly
   - [ ] Smooth transitions between values
   - [ ] No flickering or artifacts

4. **Performance**
   - [ ] Maintains 60 FPS at 1080p
   - [ ] Maintains 60 FPS at 4K
   - [ ] CPU usage reasonable (<30%)
   - [ ] GPU usage reasonable (<60%)
   - [ ] Memory usage stable (<500MB)

5. **UI/Controls**
   - [ ] All keyboard shortcuts work
   - [ ] Debug overlay accurate
   - [ ] Fullscreen toggle works
   - [ ] Window resize handles gracefully

### Integration Testing

**Cross-Service Testing:**
- Test with Spotify → Verify visualization responds
- Test with Tidal → Verify visualization responds
- Test with Apple Music → Verify visualization responds
- Compare: Do different services produce different visuals? (They should based on compression/quality)

**Genre Testing:**
- Electronic → Emphasizes bass frequencies
- Classical → Tests dynamic range
- Rock → Tests full spectrum
- Jazz → Tests mid-range and subtlety

### Performance Benchmarking

**Target Metrics:**
- FPS: 60 (min: 55, drops allowed: <5% of frames)
- Frame Time: <16.67ms
- Audio Latency: <50ms
- Memory: <500MB
- CPU: <30% on M1 Mac mini

**Test Scenarios:**
1. 1080p display, 60 minutes playback
2. 4K display, 60 minutes playback
3. Window resize during playback
4. Fullscreen toggle during playback
5. Multiple app switches

---

## Success Criteria

### Phase 1 MVP is complete when:

✅ **Core Functionality:**
- [ ] System audio captured from streaming service
- [ ] FFT analysis running at 60 FPS
- [ ] Spectrum bars visualizing frequency data
- [ ] Waveform visualizing time-domain data
- [ ] Debug overlay showing real-time metrics

✅ **Performance:**
- [ ] Maintains 60 FPS at 1080p resolution
- [ ] Maintains 55+ FPS at 4K resolution
- [ ] Audio-visual latency <50ms
- [ ] No memory leaks over 1-hour session

✅ **User Experience:**
- [ ] App launches without errors
- [ ] Audio permission flow is clear
- [ ] Keyboard controls work reliably
- [ ] Visualization responds to different music types

✅ **Code Quality:**
- [ ] Modular architecture
- [ ] Clear component boundaries
- [ ] Commented code for complex algorithms
- [ ] Git commits with clear messages

✅ **Documentation:**
- [ ] HUMAN tasks documented
- [ ] Known issues listed
- [ ] Setup instructions tested
- [ ] Demo video recorded

---

## Known Limitations (Phase 1)

### Out of Scope:
- ❌ No streaming service metadata integration
- ❌ No lyrics display
- ❌ No album artwork
- ❌ No machine learning
- ❌ No preference saving
- ❌ No Android TV deployment
- ❌ No advanced visualizations (particles, 3D)

### Planned Improvements (Future Phases):
- Phase 2: Add circular/radial patterns, particle systems
- Phase 3: Integrate metadata, lyrics, artist imagery
- Phase 4: Implement self-evolution and preference learning
- Phase 5: Deploy to Android TV / Nvidia Shield Pro

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Browser audio permission denied | Medium | High | Clear UI instructions, fallback messaging |
| BlackHole audio routing complex | Medium | High | Detailed HUMAN task documentation, screenshots |
| Performance below 60 FPS at 4K | Medium | Medium | Early profiling, fallback to 30 FPS or lower resolution |
| Web Audio API latency issues | Low | Medium | Buffer size tuning, profiling |
| Streaming service audio quality varies | High | Low | Test with multiple services, document differences |
| Canvas 2D performance insufficient | Low | Medium | Early WebGL prototype if needed |

---

## Next Steps After Phase 1

Once Phase 1 is validated:

1. **Demo & Feedback:**
   - Record demo video
   - Show to potential users
   - Gather feedback on visual appeal

2. **Phase 2 Planning:**
   - Prioritize next visualizations
   - Plan WebGL migration
   - Design particle system

3. **Technical Debt:**
   - Add unit tests
   - Refactor if needed
   - Optimize hot paths

4. **Documentation:**
   - Update architecture docs
   - Create API documentation
   - Write contribution guide

---

## Appendix A: Keyboard Shortcuts (Phase 1)

| Key | Action |
|-----|--------|
| `Space` | Toggle audio playback (start/stop capture) |
| `D` | Toggle debug overlay |
| `C` | Show/hide control overlay |
| `F` | Toggle fullscreen |
| `Escape` | Hide overlays / exit fullscreen |
| `1` | Switch to spectrum mode |
| `2` | Switch to waveform mode |
| `3` | Switch to both mode |
| `+` / `=` | Increase bar count (spectrum) |
| `-` / `_` | Decrease bar count (spectrum) |

---

## Appendix B: File Structure

```
musicViz/
├── src/
│   ├── routes/
│   │   └── +page.svelte              # Main app entry
│   ├── lib/
│   │   ├── audio/
│   │   │   ├── AudioCapture.js       # System audio input
│   │   │   └── AudioAnalyzer.js      # FFT analysis
│   │   ├── components/
│   │   │   ├── VisualizationCanvas.svelte
│   │   │   ├── DebugOverlay.svelte
│   │   │   ├── ControlOverlay.svelte
│   │   │   └── PermissionRequest.svelte
│   │   ├── visualizations/
│   │   │   ├── SpectrumBars.svelte
│   │   │   └── Waveform.svelte
│   │   ├── stores/
│   │   │   ├── audioStore.js
│   │   │   ├── visualizationStore.js
│   │   │   └── debugStore.js
│   │   └── utils/
│   │       ├── colorUtils.js         # Color mapping
│   │       └── mathUtils.js          # Smoothing, interpolation
│   └── app.html                      # HTML template
├── src-tauri/
│   ├── src/
│   │   └── main.rs                   # Tauri backend (minimal Phase 1)
│   ├── Cargo.toml
│   └── tauri.conf.json              # Tauri configuration
├── static/
│   └── favicon.png
├── package.json
├── vite.config.js
├── svelte.config.js
├── MVP_REQUIREMENTS.md
├── PHASE1_ARCHITECTURE.md           # This document
└── README.md
```

---

**End of Phase 1 Architecture Document**
