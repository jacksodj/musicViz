# Visualization System - Quick Reference

## Basic Usage

```svelte
<script>
  import VisualizationCanvas from '$lib/components/VisualizationCanvas.svelte';

  let audioData = $state(null);
  let vizType = $state('spectrum');
</script>

<VisualizationCanvas visualizationType={vizType} {audioData} />
```

## Audio Data Format

```javascript
{
  frequencyData: Uint8Array,  // 0-255, frequency magnitudes
  waveformData: Uint8Array    // 0-255, time-domain samples
}
```

## Available Visualizations

| Type | Description | Best For |
|------|-------------|----------|
| `spectrum` | Vertical frequency bars | EDM, Dance, Electronic |
| `waveform` | Time-domain line | Vocals, Acoustic, Classical |

## Switching Visualizations

```javascript
// Reactive - just change the value
visualizationType = 'waveform';
```

## Getting Manager Reference

```svelte
<script>
  let canvasRef;

  $effect(() => {
    const manager = canvasRef?.getManager();
    if (manager) {
      console.log('FPS:', manager.getFps());
    }
  });
</script>

<VisualizationCanvas bind:this={canvasRef} />
```

## Configuration

```javascript
const manager = canvasRef.getManager();
const viz = manager.getActiveVisualization();

// Spectrum Bars
viz.setConfig({
  barCount: 256,      // More bars
  smoothing: 0.8,     // Smoother
  barSpacing: 1       // Tighter spacing
});

// Waveform
viz.setConfig({
  lineWidth: 3,       // Thicker line
  amplification: 2.0, // More dramatic
  glowEffect: true,   // Enable glow
  baseColor: { r: 255, g: 0, b: 255 }  // Magenta
});
```

## Performance Stats

```javascript
const stats = manager.getStats();
/*
{
  fps: 59.8,
  avgFrameTime: 14.2,
  budgetUtilization: 85.2,
  isRunning: true,
  activeType: "spectrum",
  width: 3840,
  height: 2160,
  dpr: 2
}
*/
```

## Testing with Mock Data

```svelte
<script>
  import VisualizationDemo from '$lib/components/VisualizationDemo.svelte';
</script>

<VisualizationDemo />
```

## Creating Custom Visualization

```javascript
// 1. Create class
export class MyViz {
  constructor(ctx) {
    this.ctx = ctx;
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
  }

  resize(w, h, dpr) {
    this.width = w;
    this.height = h;
    this.dpr = dpr;
  }

  update(audioData) {
    // Process data
  }

  render() {
    // Draw
  }

  reset() {
    // Clear state
  }
}

// 2. Register in VisualizationManager.js
this.visualizations = {
  spectrum: new SpectrumBars(ctx),
  waveform: new Waveform(ctx),
  myViz: new MyViz(ctx)  // Add here
};

// 3. Use it
<VisualizationCanvas visualizationType="myViz" />
```

## Common Patterns

### Smooth Transitions
```javascript
this.current += (this.target - this.current) * 0.3;
```

### Pre-calculate Colors
```javascript
constructor() {
  this.colors = Array.from({ length: 128 }, (_, i) => {
    const hue = (i / 128) * 360;
    return `hsl(${hue}, 100%, 50%)`;
  });
}
```

### High DPI Scaling
```javascript
render() {
  const lineWidth = 2 * this.dpr;
  const shadowBlur = 10 * this.dpr;
}
```

### Typed Arrays (Important!)
```javascript
// ✅ Good
this.data = new Float32Array(128);

// ❌ Bad (creates garbage)
this.data = new Array(128);
```

## Performance Tips

1. **Use typed arrays** (Float32Array, Uint8Array)
2. **Pre-calculate** colors, gradients, static values
3. **Batch** similar canvas operations
4. **Minimize** state changes (fillStyle, strokeStyle)
5. **Reuse** arrays and objects
6. **Profile** with Chrome DevTools

## File Locations

```
src/lib/
├── components/
│   ├── VisualizationCanvas.svelte   ← Main component
│   └── VisualizationDemo.svelte     ← Testing/demo
├── services/
│   └── VisualizationManager.js      ← Render loop
├── visualizations/
│   ├── index.js                     ← Exports
│   ├── SpectrumBars.js             ← Frequency viz
│   ├── Waveform.js                 ← Time-domain viz
│   ├── VISUALIZATION_GUIDE.md      ← Full guide
│   └── QUICK_REFERENCE.md          ← This file
└── examples/
    └── IntegrationExample.svelte    ← Integration demo
```

## Troubleshooting

### FPS drops
- Check `stats.budgetUtilization` (should be <90%)
- Profile with DevTools
- Reduce bar count or complexity

### Canvas not resizing
- ResizeObserver should handle automatically
- Check if canvas element has proper CSS

### No visualization showing
- Verify audioData is not null
- Check console for errors
- Ensure visualization type is valid

### Colors wrong at high DPI
- All sizes should scale with `this.dpr`
- Check devicePixelRatio handling

## Example: Full Integration

```svelte
<script>
  import { onMount } from 'svelte';
  import VisualizationCanvas from '$lib/components/VisualizationCanvas.svelte';
  import { AudioAnalyzer } from '$lib/services/AudioAnalyzer.js';

  let audioData = $state(null);
  let vizType = $state('spectrum');
  let analyzer;

  onMount(() => {
    analyzer = new AudioAnalyzer();
    analyzer.initialize();

    analyzer.onDataUpdate((data) => {
      audioData = data;
    });

    analyzer.start();

    return () => analyzer.stop();
  });
</script>

<div class="app">
  <VisualizationCanvas visualizationType={vizType} {audioData} />

  <div class="controls">
    <button onclick={() => vizType = 'spectrum'}>Spectrum</button>
    <button onclick={() => vizType = 'waveform'}>Waveform</button>
  </div>
</div>
```

## See Also

- `VISUALIZATION_GUIDE.md` - Complete developer guide
- `VISUALIZATION_IMPLEMENTATION.md` - Technical implementation details
- `VisualizationDemo.svelte` - Interactive examples
