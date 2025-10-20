# musicViz Plugin API Documentation

## Overview

The musicViz plugin framework provides a unified interface for creating music visualizations inspired by ProjectM/Milkdrop. Plugins receive real-time music data and render visualizations using either Canvas 2D or Svelte components.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Plugin Manager                          │
│  - Lifecycle management (load/destroy)                      │
│  - Animation loop (60fps)                                   │
│  - Context creation (Canvas/Component)                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Plugin Data Adapter                       │
│  - Aggregates data from multiple sources                    │
│  - Creates UnifiedPluginData interface                      │
│  - Provides mock data when needed                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Your Plugin                            │
│  - Receives UnifiedPluginData each frame                    │
│  - Renders visualization (Canvas or Component)              │
│  - Configurable parameters                                  │
└─────────────────────────────────────────────────────────────┘
```

## Plugin Types

### Canvas Plugin
Renders directly to a 2D canvas context at 60fps.

**Best for:**
- High-performance visualizations
- Particle systems, waveforms, frequency bars
- Direct pixel manipulation
- WebGL effects

**Example:** SpectrumBars, Waveform

### Component Plugin
Wraps a Svelte component for reactive UI-based visualizations.

**Best for:**
- DOM-based animations
- CSS transitions/transforms
- Complex UI interactions
- Reactive state management

**Example:** BeatPulse

## Unified Data Interface

Every plugin receives `UnifiedPluginData` in its `update()` method:

```javascript
{
  audio: {
    frequencyData: Uint8Array,  // FFT frequency domain (0-255)
    waveformData: Uint8Array,   // Time domain waveform (0-255)
    energy: number,             // Overall energy level (0-1)
    available: boolean          // Whether audio data is available
  },

  music: {
    bpm: number,                // Beats per minute
    tempo: number,              // Same as bpm
    beats: [                    // Beat intervals
      {start: number, duration: number, confidence: number}
    ],
    bars: [...],                // Bar intervals (4 beats)
    segments: [                 // Segments with timbre/pitch data
      {
        start: number,
        duration: number,
        loudness_start: number,
        loudness_max: number,
        timbre: [12 numbers],   // Timbre vector
        pitches: [12 numbers]   // Pitch vector
      }
    ],
    sections: [...],            // Section intervals
    available: boolean
  },

  playback: {
    isPlaying: boolean,
    position: number,           // Milliseconds
    duration: number,           // Milliseconds
    track: {                    // Current track info
      id: string,
      name: string,
      artists: [{name: string}],
      album: {name: string, images: [{url: string}]}
    }
  },

  timing: {
    timestamp: number,          // Performance timestamp (ms)
    deltaTime: number,          // Time since last frame (ms)
    fps: number                 // Current frames per second
  }
}
```

## Creating a Canvas Plugin

### Step 1: Create the Plugin Class

```javascript
// src/lib/plugins/visualizations/MyCanvasPlugin.js
import { CanvasPlugin } from '../types.js';

export class MyCanvasPlugin extends CanvasPlugin {
  constructor() {
    super();

    // Plugin metadata
    this.metadata = {
      id: 'my-canvas-plugin',
      name: 'My Canvas Plugin',
      author: 'Your Name',
      version: '1.0.0',
      description: 'A custom canvas visualization',
      type: 'canvas'
    };

    // Configurable parameters
    this.parameters = {
      sensitivity: {
        type: 'number',
        default: 1.0,
        min: 0.1,
        max: 5.0,
        step: 0.1,
        label: 'Sensitivity',
        description: 'How sensitive to audio changes'
      },
      color: {
        type: 'color',
        default: '#1db954',
        label: 'Primary Color',
        description: 'Main visualization color'
      }
    };

    // Internal state
    this.config = {
      sensitivity: this.parameters.sensitivity.default,
      color: this.parameters.color.default
    };
  }

  /**
   * Initialize with canvas context
   */
  initialize(context) {
    super.initialize(context);
    console.log('[MyCanvasPlugin] Initialized with canvas:', this.width, 'x', this.height);
  }

  /**
   * Update with new data (called every frame at 60fps)
   */
  update(data) {
    // Store data for rendering
    this.data = data;
  }

  /**
   * Render to canvas (called every frame at 60fps)
   */
  render() {
    if (!this.ctx || !this.data) return;

    const { ctx, width, height } = this;
    const { audio, music, playback } = this.data;

    // Clear canvas
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, width, height);

    // Only draw when playing
    if (!playback.isPlaying) return;

    // Example: Draw frequency bars
    if (audio.available && audio.frequencyData.length > 0) {
      const barCount = 64;
      const barWidth = width / barCount;
      const sensitivity = this.config.sensitivity;

      ctx.fillStyle = this.config.color;

      for (let i = 0; i < barCount; i++) {
        const dataIndex = Math.floor(i * audio.frequencyData.length / barCount);
        const value = audio.frequencyData[dataIndex] / 255;
        const barHeight = value * height * sensitivity;

        ctx.fillRect(
          i * barWidth,
          height - barHeight,
          barWidth - 2,
          barHeight
        );
      }
    }
  }

  /**
   * Handle canvas resize
   */
  resize(width, height, dpr) {
    super.resize(width, height, dpr);
    console.log('[MyCanvasPlugin] Resized to:', width, 'x', height);
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Set configuration
   */
  setConfig(config) {
    if (config.sensitivity !== undefined) {
      this.config.sensitivity = Math.max(
        this.parameters.sensitivity.min,
        Math.min(this.parameters.sensitivity.max, config.sensitivity)
      );
    }

    if (config.color !== undefined) {
      this.config.color = config.color;
    }

    console.log('[MyCanvasPlugin] Config updated:', this.config);
  }

  /**
   * Clean up resources
   */
  destroy() {
    console.log('[MyCanvasPlugin] Destroyed');
  }
}
```

### Step 2: Register the Plugin

```javascript
// src/lib/plugins/index.js
import { MyCanvasPlugin } from './visualizations/MyCanvasPlugin.js';

export function initializePluginSystem() {
  // Register your plugin
  pluginRegistry.register('my-canvas-plugin', MyCanvasPlugin);

  // Optional: Create presets
  pluginRegistry.registerPreset({
    id: 'my-canvas-sensitive',
    name: 'My Canvas (Sensitive)',
    pluginId: 'my-canvas-plugin',
    description: 'High sensitivity version',
    config: {
      sensitivity: 2.5,
      color: '#ff0000'
    }
  });
}
```

## Creating a Component Plugin

### Step 1: Create the Svelte Component

```svelte
<!-- src/lib/components/visualizations/MyComponent.svelte -->
<script>
  let { bpm = 120, isPlaying = false, intensity = 1.0 } = $props();

  // Reactive pulse animation based on BPM
  $effect(() => {
    if (isPlaying) {
      const beatsPerMs = bpm / 60000;
      // Update animation...
    }
  });
</script>

<div class="my-visualization" class:playing={isPlaying}>
  <div class="pulse" style="--intensity: {intensity}"></div>
  <div class="bpm-display">{Math.round(bpm)} BPM</div>
</div>

<style>
  .my-visualization {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: radial-gradient(circle, rgba(29,185,84,0.2), black);
  }

  .pulse {
    width: 200px;
    height: 200px;
    border-radius: 50%;
    background: rgba(29, 185, 84, 0.5);
    animation: pulse 1s infinite;
  }

  .playing .pulse {
    animation-duration: calc(60s / var(--bpm, 120));
  }

  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 0.5; }
    50% { transform: scale(calc(1 + var(--intensity, 1) * 0.5)); opacity: 0.8; }
  }

  .bpm-display {
    position: absolute;
    bottom: 20px;
    color: white;
    font-size: 2rem;
  }
</style>
```

### Step 2: Create the Plugin Class

```javascript
// src/lib/plugins/visualizations/MyComponentPlugin.js
import { ComponentPlugin } from '../types.js';
import MyComponent from '$lib/components/visualizations/MyComponent.svelte';

export class MyComponentPlugin extends ComponentPlugin {
  constructor() {
    super();

    this.metadata = {
      id: 'my-component-plugin',
      name: 'My Component Plugin',
      author: 'Your Name',
      version: '1.0.0',
      description: 'A Svelte component visualization',
      type: 'component'
    };

    this.parameters = {
      intensity: {
        type: 'number',
        default: 1.0,
        min: 0.1,
        max: 2.0,
        step: 0.1,
        label: 'Intensity',
        description: 'Animation intensity'
      }
    };

    // Set Svelte component
    this.component = MyComponent;

    // Initialize props
    this.props = {
      bpm: 120,
      isPlaying: false,
      intensity: this.parameters.intensity.default
    };

    this.config = {
      intensity: this.parameters.intensity.default
    };
  }

  initialize(context) {
    super.initialize(context);
    console.log('[MyComponentPlugin] Initialized');
  }

  /**
   * Update props based on incoming data
   */
  update(data) {
    const bpm = data.music.available ? data.music.bpm : 120;
    const isPlaying = data.playback.isPlaying;

    this.props = {
      bpm,
      isPlaying,
      intensity: this.config.intensity
    };
  }

  /**
   * Get props to pass to Svelte component
   */
  getProps() {
    return this.props;
  }

  getConfig() {
    return { ...this.config };
  }

  setConfig(config) {
    if (config.intensity !== undefined) {
      this.config.intensity = Math.max(
        this.parameters.intensity.min,
        Math.min(this.parameters.intensity.max, config.intensity)
      );
    }
  }

  destroy() {
    console.log('[MyComponentPlugin] Destroyed');
  }
}
```

### Step 3: Register the Plugin

Same as Canvas plugin - add to `initializePluginSystem()`.

## Working with Audio Data

### Frequency Data (FFT)
```javascript
update(data) {
  if (data.audio.available) {
    const freq = data.audio.frequencyData;

    // Get bass energy (low frequencies)
    const bassStart = 0;
    const bassEnd = Math.floor(freq.length * 0.1);
    let bassSum = 0;
    for (let i = bassStart; i < bassEnd; i++) {
      bassSum += freq[i];
    }
    const bassEnergy = bassSum / (bassEnd - bassStart) / 255;

    // Use bass energy for visualization
    this.bassScale = 1 + bassEnergy * 2;
  }
}
```

### Beat Detection
```javascript
update(data) {
  if (data.music.available) {
    const currentTime = data.playback.position / 1000; // Convert to seconds

    // Find current beat
    const currentBeat = data.music.beats.find(beat =>
      currentTime >= beat.start &&
      currentTime < beat.start + beat.duration
    );

    if (currentBeat) {
      const beatProgress = (currentTime - currentBeat.start) / currentBeat.duration;
      const beatIntensity = Math.max(0, 1 - beatProgress * 2); // Quick decay

      // Use beat intensity for flash effects
      this.flashIntensity = beatIntensity;
    }
  }
}
```

### Timbre and Pitch (Advanced)
```javascript
update(data) {
  if (data.music.available && data.music.segments.length > 0) {
    const currentTime = data.playback.position / 1000;

    // Find current segment
    const segment = data.music.segments.find(seg =>
      currentTime >= seg.start &&
      currentTime < seg.start + seg.duration
    );

    if (segment) {
      // Timbre dimensions (12D vector)
      // [0] = brightness/darkness
      // [1] = acoustic/electric
      // [2-11] = other timbral qualities
      const brightness = segment.timbre[0];

      // Pitch classes (12D vector, 0-1 for each chromatic pitch)
      // Represents which notes are present
      const dominantPitch = segment.pitches.indexOf(Math.max(...segment.pitches));

      // Use for color selection or effects
      this.hue = (dominantPitch / 12) * 360;
      this.brightness = brightness;
    }
  }
}
```

## Parameter Types

The plugin system supports several parameter types for user configuration:

```javascript
this.parameters = {
  // Number slider
  speed: {
    type: 'number',
    default: 1.0,
    min: 0.1,
    max: 5.0,
    step: 0.1,
    label: 'Speed',
    description: 'Animation speed multiplier'
  },

  // Boolean toggle
  showBpm: {
    type: 'boolean',
    default: true,
    label: 'Show BPM',
    description: 'Display BPM counter'
  },

  // Color picker
  primaryColor: {
    type: 'color',
    default: '#1db954',
    label: 'Primary Color',
    description: 'Main visualization color'
  },

  // Dropdown select
  mode: {
    type: 'select',
    default: 'bars',
    options: [
      { value: 'bars', label: 'Bar Graph' },
      { value: 'circle', label: 'Circular' },
      { value: 'wave', label: 'Wave Form' }
    ],
    label: 'Visualization Mode',
    description: 'How to display the data'
  }
};
```

## Preset System

Presets allow you to save parameter configurations:

```javascript
// Define preset
pluginRegistry.registerPreset({
  id: 'spectrum-rainbow',
  name: 'Rainbow Spectrum',
  pluginId: 'spectrum-bars',
  description: 'Colorful spectrum visualization',
  config: {
    barCount: 128,
    smoothing: 0.8,
    colorMode: 'rainbow',
    sensitivity: 1.5
  }
});

// Use preset
pluginManager.loadPreset('spectrum-rainbow');
```

## Performance Best Practices

### Canvas Plugins
1. **Minimize state changes** - Group `fillStyle`, `strokeStyle` changes
2. **Use requestAnimationFrame** - Already handled by PluginManager
3. **Clear efficiently** - Use `fillRect()` with alpha for trails
4. **Batch operations** - Draw multiple shapes before style changes
5. **Avoid expensive operations** - No complex math in inner loops

### Component Plugins
1. **Avoid reactive subscriptions in loops** - Use props
2. **Use CSS transforms** - Faster than top/left positioning
3. **Leverage GPU acceleration** - Use `transform`, `opacity`
4. **Minimize DOM updates** - Let Svelte handle diffing
5. **Use `$effect` carefully** - Avoid infinite loops

## Mock Data

When audio data isn't available, the system provides mock data:

```javascript
// Check availability
if (data.audio.available) {
  // Use real FFT data
} else {
  // Use mock or music analysis data
  const beatEnergy = calculateBeatEnergy(data.music, data.playback);
}

// Music analysis is always available (real or mock)
const bpm = data.music.bpm; // Always has a value
```

## Debugging Tips

1. **Console logging** in lifecycle methods:
```javascript
initialize(context) {
  console.log('[MyPlugin] Initialized', context);
}

update(data) {
  console.log('[MyPlugin] Update', data.playback.isPlaying);
}
```

2. **DevTools are enabled** - Right-click → Inspect in production builds

3. **Check data availability**:
```javascript
if (!data.audio.available) {
  console.warn('Audio data not available, using music analysis');
}
```

4. **Monitor FPS**:
```javascript
update(data) {
  if (data.timing.fps < 50) {
    console.warn('Low FPS detected:', data.timing.fps);
  }
}
```

## Example Plugins

### Minimal Canvas Plugin
```javascript
import { CanvasPlugin } from '../types.js';

export class MinimalPlugin extends CanvasPlugin {
  constructor() {
    super();
    this.metadata = {
      id: 'minimal',
      name: 'Minimal',
      author: 'You',
      version: '1.0.0',
      description: 'Minimal example',
      type: 'canvas'
    };
  }

  initialize(context) {
    super.initialize(context);
  }

  update(data) {
    this.energy = data.audio.available ? data.audio.energy : 0;
  }

  render() {
    const { ctx, width, height } = this;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#1db954';
    const size = 100 + this.energy * 200;
    ctx.fillRect(
      width / 2 - size / 2,
      height / 2 - size / 2,
      size,
      size
    );
  }

  destroy() {}
}
```

## API Reference

### Base Classes
- `IVisualizationPlugin` - Interface all plugins implement
- `CanvasPlugin` - Base for canvas plugins
- `ComponentPlugin` - Base for component plugins

### Plugin Registry
```javascript
import { pluginRegistry } from '$lib/plugins/PluginRegistry.js';

// Register plugin
pluginRegistry.register(id, PluginClass);

// Get plugin
const PluginClass = pluginRegistry.get(id);

// Create instance
const instance = pluginRegistry.createInstance(id, context);

// List all plugins
const plugins = pluginRegistry.list();

// Register preset
pluginRegistry.registerPreset(preset);

// Get preset
const preset = pluginRegistry.getPreset(id);

// List presets
const presets = pluginRegistry.listPresets();
```

### Plugin Data Adapter
```javascript
import { pluginDataAdapter } from '$lib/plugins/PluginDataAdapter.js';

// Create unified data (handled by PluginManager)
const data = pluginDataAdapter.createUnifiedData({
  playerState,
  analysis,
  audioData,
  timestamp,
  fps
});
```

## Next Steps

1. **Study existing plugins**: Check `src/lib/plugins/visualizations/`
2. **Create a test plugin**: Start with a simple canvas visualization
3. **Experiment with data**: Try different audio/music data combinations
4. **Share your plugin**: Consider contributing back to the project

## Future Enhancements

- WebGL support for advanced shaders
- ProjectM/Milkdrop preset compatibility
- Plugin marketplace/sharing
- Real-time parameter UI controls
- Plugin hot-reloading in dev mode
