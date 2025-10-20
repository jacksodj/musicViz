# Visualization System Guide

## Architecture Overview

The visualization system consists of three main components:

1. **VisualizationCanvas.svelte** - Svelte component that manages the canvas element and lifecycle
2. **VisualizationManager.js** - Service that handles render loop, FPS tracking, and visualization switching
3. **Visualization Classes** - Individual visualization implementations (SpectrumBars, Waveform, etc.)

## Audio Data Format

Visualizations receive audio data in the following format:

```javascript
{
  frequencyData: Uint8Array,  // Frequency domain data (0-255)
  waveformData: Uint8Array    // Time domain data (0-255)
}
```

- `frequencyData`: Array of frequency magnitudes from FFT analysis
- `waveformData`: Array of time-domain audio samples

## Creating a New Visualization

### Step 1: Create Visualization Class

Create a new file in `src/lib/visualizations/YourVisualization.js`:

```javascript
export class YourVisualization {
  constructor(ctx) {
    this.ctx = ctx;
    this.width = 0;
    this.height = 0;
    this.dpr = 1;

    // Initialize your state here
    // Use typed arrays for performance (Float32Array, Uint8Array)
    this.state = new Float32Array(128);
  }

  /**
   * Handle canvas resize
   */
  resize(width, height, dpr) {
    this.width = width;
    this.height = height;
    this.dpr = dpr;
  }

  /**
   * Update with new audio data
   */
  update(audioData) {
    if (!audioData) return;

    // Process frequencyData and/or waveformData
    const { frequencyData, waveformData } = audioData;

    // Update your visualization state
  }

  /**
   * Render the visualization
   */
  render() {
    const ctx = this.ctx;

    // Clear canvas
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, this.width, this.height);

    // Draw your visualization
  }

  /**
   * Reset visualization state
   */
  reset() {
    this.state.fill(0);
  }

  /**
   * Get configuration (optional)
   */
  getConfig() {
    return {
      // Return current configuration
    };
  }

  /**
   * Set configuration (optional)
   */
  setConfig(config) {
    // Apply configuration changes
  }
}
```

### Step 2: Register Visualization

Add your visualization to the VisualizationManager:

```javascript
import { YourVisualization } from '$lib/visualizations/YourVisualization.js';

// In VisualizationManager constructor
this.visualizations = {
  spectrum: new SpectrumBars(ctx),
  waveform: new Waveform(ctx),
  yourViz: new YourVisualization(ctx)  // Add here
};
```

### Step 3: Update Index Exports

Add to `src/lib/visualizations/index.js`:

```javascript
export { YourVisualization } from './YourVisualization.js';

export const VISUALIZATION_TYPES = {
  SPECTRUM: 'spectrum',
  WAVEFORM: 'waveform',
  YOUR_VIZ: 'yourViz'  // Add here
};
```

### Step 4: Use in Components

```svelte
<VisualizationCanvas visualizationType="yourViz" {audioData} />
```

## Performance Best Practices

### 1. Minimize Garbage Collection

❌ **Bad:**
```javascript
render() {
  const data = new Float32Array(128);  // Creates new array every frame!
  // ...
}
```

✅ **Good:**
```javascript
constructor(ctx) {
  this.data = new Float32Array(128);  // Create once
}

render() {
  // Reuse this.data
}
```

### 2. Batch Canvas Operations

❌ **Bad:**
```javascript
for (let i = 0; i < 100; i++) {
  ctx.fillStyle = colors[i];  // Change state 100 times
  ctx.fillRect(x, y, w, h);
}
```

✅ **Good:**
```javascript
// Group operations by style
ctx.fillStyle = 'red';
for (let i = 0; i < redBars.length; i++) {
  ctx.fillRect(x, y, w, h);
}
```

### 3. Use Typed Arrays

✅ **Always use typed arrays for numeric data:**
- `Float32Array` for decimal values
- `Uint8Array` for 0-255 values
- `Uint32Array` for large integers

### 4. Minimize Math Operations

❌ **Bad:**
```javascript
for (let i = 0; i < 1000; i++) {
  const angle = (i / 1000) * Math.PI * 2;  // Repeated division
  // ...
}
```

✅ **Good:**
```javascript
const step = (Math.PI * 2) / 1000;  // Calculate once
for (let i = 0; i < 1000; i++) {
  const angle = i * step;
  // ...
}
```

### 5. Pre-calculate Static Values

✅ **Calculate colors, positions, etc. in constructor or resize:**

```javascript
constructor(ctx) {
  this.colors = [];
  this.precalculateColors();
}

precalculateColors() {
  for (let i = 0; i < 128; i++) {
    this.colors[i] = `rgb(${r}, ${g}, ${b})`;
  }
}
```

### 6. Optimize Canvas Settings

```javascript
const ctx = canvas.getContext('2d', {
  alpha: false,         // No transparency = faster
  desynchronized: true  // Hint for better performance
});
```

### 7. Use RequestAnimationFrame Wisely

✅ **Let VisualizationManager handle the render loop**
- Don't create your own RAF loops in visualizations
- Trust the manager to call `update()` and `render()`

## Frame Time Budget

Target: **16.67ms per frame** (60fps)

Budget breakdown example:
- Canvas clear: ~0.5ms
- Audio data processing: ~2ms
- Visualization render: ~10ms
- Browser overhead: ~4ms
- **Total: ~16.5ms** ✅

Monitor performance:
```javascript
const stats = visualizationManager.getStats();
console.log('Frame time:', stats.avgFrameTime, 'ms');
console.log('Budget utilization:', stats.budgetUtilization, '%');
```

## High DPI Support

The system automatically handles high DPI displays:

```javascript
resize(width, height, dpr) {
  this.width = width;    // Actual canvas pixels
  this.height = height;  // Actual canvas pixels
  this.dpr = dpr;        // Device pixel ratio

  // Scale line widths and sizes
  this.lineWidth = 2 * dpr;
}
```

## Debugging Tips

### 1. Monitor FPS

The stats overlay shows real-time FPS. Watch for drops below 55fps.

### 2. Profile with DevTools

```javascript
render() {
  performance.mark('render-start');

  // Your rendering code

  performance.mark('render-end');
  performance.measure('render', 'render-start', 'render-end');
}
```

### 3. Test at 4K Resolution

Set your canvas size to test performance:
```javascript
canvas.width = 3840;
canvas.height = 2160;
```

## Common Patterns

### Smooth Transitions

```javascript
update(audioData) {
  // Smooth transition between values
  const smoothing = 0.7;
  this.current += (this.target - this.current) * (1 - smoothing);
}
```

### Color Gradients

```javascript
// Create gradient once
constructor(ctx) {
  this.gradient = ctx.createLinearGradient(0, 0, width, 0);
  this.gradient.addColorStop(0, 'red');
  this.gradient.addColorStop(0.5, 'yellow');
  this.gradient.addColorStop(1, 'blue');
}

// Use in render
render() {
  this.ctx.fillStyle = this.gradient;
}
```

### Symmetry/Mirror Effects

```javascript
render() {
  ctx.save();

  // Draw top half
  this.drawHalf(1);

  // Mirror for bottom half
  ctx.translate(0, this.height);
  ctx.scale(1, -1);
  this.drawHalf(-1);

  ctx.restore();
}
```

## Examples

See existing implementations:
- **SpectrumBars.js** - Frequency bars with gradient
- **Waveform.js** - Time-domain with mirror effect

## Testing

Test your visualization with mock data:

```javascript
import { VisualizationDemo } from '$lib/components/VisualizationDemo.svelte';

// Use the demo component to test with generated audio data
```
