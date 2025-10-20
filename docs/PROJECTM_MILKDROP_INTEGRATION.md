# ProjectM/Milkdrop Integration Design

## Executive Summary

This document outlines the design for adding ProjectM/Milkdrop `.milk` preset compatibility to musicViz. This would enable musicViz to load and render the thousands of existing Milkdrop visualizations while maintaining compatibility with our native plugin system.

**Estimated Complexity:** High (3-4 weeks for MVP)

**Key Benefits:**
- Access to 8000+ existing presets (Milkdrop MegaPack)
- Well-established visualization language
- Rich community of preset creators
- Mature ecosystem with proven patterns

## Background

### What is Milkdrop?

Milkdrop (created by Ryan Geiss in 2001) is a music visualization plugin for Winamp that uses mathematical equations and pixel shaders to create dynamic visualizations synchronized to music.

### What is ProjectM?

ProjectM (2003) is an open-source, cross-platform reimplementation of Milkdrop using OpenGL/C++, licensed under GNU LGPL. It maintains compatibility with Milkdrop's `.milk` preset format.

### Existing JavaScript Implementations

Two major WebGL implementations exist:

1. **Butterchurn** (https://github.com/jberg/butterchurn)
   - Most mature and actively maintained
   - Full WebGL implementation
   - Available on npm: `butterchurn` + `butterchurn-presets`
   - Used in Winamp for Web and other projects
   - Excellent .milk parser and preset loader

2. **Milkshake** (https://github.com/gattis/milkshake)
   - Earlier WebGL implementation
   - Less actively maintained
   - Provides reference implementation

## Milkdrop Preset Format

### File Structure

A `.milk` file is a text-based configuration file with this structure:

```ini
MILKDROP_PRESET_VERSION=201

# Base parameters
fRating=3.0
fGammaAdj=2.0
fDecay=0.98
fVideoEchoZoom=1.0
fVideoEchoAlpha=0.5
...

# Waveform settings
nWaveMode=0
bTexWrap=1
bDarkenCenter=0
...

# Per-frame equations
per_frame_1=wave_r = 0.5 + 0.5*sin(time*1.324);
per_frame_2=wave_g = 0.5 + 0.5*sin(time*1.778);
per_frame_3=wave_b = 0.5 + 0.5*sin(time*2.443);
per_frame_4=zoom = 1 + 0.1*sin(time*0.613);
per_frame_5=rot = rot + 0.01*bass;

# Per-pixel equations (evaluated on a grid)
per_pixel_1=zoom = zoom + 0.05*bass_att;
per_pixel_2=rot = rot + 0.03*sin(time*0.5);
per_pixel_3=dx = dx + 0.01*sin(rad*5 + time*2);
per_pixel_4=dy = dy + 0.01*cos(rad*5 + time*2);

# Custom warp shader (HLSL/Cg)
[preset00]
warp_1=`shader_body {
warp_2=`  float2 uv2 = uv - 0.5;
warp_3=`  float d = length(uv2);
warp_4=`  uv = uv + uv2 * d * 0.5;
warp_5=`  ret = tex2D(sampler_main, uv);
warp_6=`}
warp_7=`

# Composite shader (HLSL/Cg)
comp_1=`shader_body {
comp_2=`  float4 bass_col = float4(1,0,0,1);
comp_3=`  ret = lerp(ret, bass_col, bass*0.5);
comp_4=`}
```

### Execution Model

**Initialization:**
1. Parse `.milk` file parameters
2. Compile per-frame equations to JavaScript
3. Compile per-pixel equations to JavaScript or shader
4. Compile custom warp/comp shaders to GLSL

**Per Frame (60fps):**
1. Execute per-frame equations (JavaScript)
   - Updates global variables (zoom, rot, wave_r, etc.)
   - Can read audio variables (bass, mid, treb, beat)
2. Execute per-pixel equations (Grid: default 32×24)
   - Updates warp grid coordinates (dx, dy)
   - Can use spatial variables (x, y, rad, ang)
3. Apply warp shader (GLSL)
   - Distorts previous frame using warp grid
4. Draw waveforms and shapes (if enabled)
5. Apply composite shader (GLSL)
   - Blends effects, applies colors, etc.
6. Apply decay and other post-effects

### Available Variables

**Audio Analysis:**
- `bass`, `mid`, `treb` - Current frequency band levels (0-1)
- `bass_att`, `mid_att`, `treb_att` - Attenuated versions (smoothed)
- `beat` - Current beat detection level

**Timing:**
- `time` - Elapsed time in seconds
- `fps` - Current frames per second
- `frame` - Frame counter

**Spatial (per-pixel only):**
- `x`, `y` - Normalized coordinates (0-1)
- `rad` - Distance from center
- `ang` - Angle from center

**User Variables:**
- `q1` through `q32` - Custom variables passed between equation stages
- `monitor` - Debug output variable

**Built-in Parameters:**
- `zoom` - Zoom level
- `rot` - Rotation amount
- `cx`, `cy` - Center coordinates
- `dx`, `dy` - Warp displacement
- `sx`, `sy` - Stretch factors
- `wave_r`, `wave_g`, `wave_b`, `wave_a` - Waveform color
- Many more...

### Shader Language

Custom shaders use HLSL/Cg syntax (similar to GLSL):
- Must be translated to GLSL for WebGL
- Access to texture samplers
- Can read all preset variables
- Standard shader uniforms available

## Integration Approaches

### Option 1: Use Butterchurn Library (Recommended)

**Pros:**
- Mature, battle-tested codebase
- Full preset compatibility
- Active maintenance
- npm package with TypeScript types
- Includes 200+ curated presets

**Cons:**
- External dependency (~500KB)
- Different architecture than our plugin system
- May have features we don't need
- Requires adapter layer

**Implementation:**
```javascript
import butterchurn from 'butterchurn';
import butterchurnPresets from 'butterchurn-presets';

// Create visualizer
const visualizer = butterchurn.createVisualizer(audioContext, canvas, {
  width: 1920,
  height: 1080,
  pixelRatio: window.devicePixelRatio
});

// Load preset
const presets = butterchurnPresets.getPresets();
visualizer.loadPreset(presets['Geiss - Cauldron'], 0.0);

// In animation loop
visualizer.render();
```

### Option 2: Build Custom Parser/Renderer

**Pros:**
- Full control over implementation
- Tight integration with our plugin system
- Only include features we need
- Educational value

**Cons:**
- Significant development time (3-4 weeks)
- Need to handle edge cases
- Ongoing maintenance burden
- Potential compatibility issues

**Components Needed:**
1. `.milk` file parser
2. Equation compiler (text → JS/GLSL)
3. WebGL renderer
4. Warp grid system
5. Shader compiler/translator
6. Preset manager

### Option 3: Hybrid Approach (Recommended)

Use Butterchurn's parser but integrate with our plugin system:

**Pros:**
- Leverage proven parsing logic
- Keep our plugin architecture
- Gradual migration path
- Can customize rendering

**Cons:**
- Still depends on Butterchurn partially
- Requires understanding their internals
- May need to fork if deep customization needed

## Recommended Architecture

### Phase 1: Butterchurn Integration (1-2 weeks)

Create a **MilkdropPlugin** that wraps Butterchurn:

```javascript
// src/lib/plugins/visualizations/MilkdropPlugin.js
import { CanvasPlugin } from '../types.js';
import butterchurn from 'butterchurn';
import butterchurnPresets from 'butterchurn-presets';

export class MilkdropPlugin extends CanvasPlugin {
  constructor(presetName) {
    super();

    this.metadata = {
      id: `milkdrop-${presetName}`,
      name: `Milkdrop: ${presetName}`,
      author: 'Milkdrop Community',
      version: '1.0.0',
      description: 'Milkdrop preset visualization',
      type: 'canvas'
    };

    this.presetName = presetName;
    this.visualizer = null;
    this.audioContext = null;
  }

  initialize(context) {
    super.initialize(context);

    // Create audio context if needed
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }

    // Create Butterchurn visualizer
    this.visualizer = butterchurn.createVisualizer(
      this.audioContext,
      context.canvas,
      {
        width: context.width,
        height: context.height,
        pixelRatio: context.dpr
      }
    );

    // Load preset
    const presets = butterchurnPresets.getPresets();
    const preset = presets[this.presetName];
    if (preset) {
      this.visualizer.loadPreset(preset, 0.0);
    }
  }

  update(data) {
    // Butterchurn handles its own audio analysis via Web Audio API
    // We may need to sync our audio data with their analyzer

    // Store our data for potential custom integrations
    this.data = data;
  }

  render() {
    if (this.visualizer) {
      this.visualizer.render();
    }
  }

  resize(width, height, dpr) {
    super.resize(width, height, dpr);
    if (this.visualizer) {
      this.visualizer.setRendererSize(width, height);
    }
  }

  destroy() {
    if (this.visualizer) {
      this.visualizer.destroy();
      this.visualizer = null;
    }
  }
}
```

### Phase 2: Plugin Registry Integration (2-3 days)

Auto-register popular Milkdrop presets:

```javascript
// src/lib/plugins/milkdrop/index.js
import { MilkdropPlugin } from './MilkdropPlugin.js';
import butterchurnPresets from 'butterchurn-presets';

export function registerMilkdropPresets(registry) {
  const presets = butterchurnPresets.getPresets();
  const featured = [
    'Geiss - Cauldron',
    'Martin - king of vice',
    'Rovastar - Solarization',
    'Flexi - mindblob [mash-up]',
    'Unchained - Alien Insect',
    // ... more featured presets
  ];

  featured.forEach(name => {
    const presetData = presets[name];
    const id = `milkdrop-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

    registry.register(id, () => new MilkdropPlugin(name));
  });
}
```

### Phase 3: Preset Browser UI (3-4 days)

Add UI for browsing and loading Milkdrop presets:

```svelte
<!-- src/lib/components/MilkdropBrowser.svelte -->
<script>
  import { pluginRegistry } from '$lib/plugins/PluginRegistry.js';
  import butterchurnPresets from 'butterchurn-presets';

  let { onSelectPreset } = $props();
  let presets = $state([]);
  let searchTerm = $state('');
  let selectedCategory = $state('all');

  onMount(() => {
    const allPresets = butterchurnPresets.getPresets();
    presets = Object.keys(allPresets).map(name => ({
      name,
      author: name.split('-')[0].trim(),
      rating: allPresets[name].rating || 3
    }));
  });

  const filteredPresets = $derived(
    presets.filter(p =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );
</script>

<div class="milkdrop-browser">
  <input
    type="text"
    bind:value={searchTerm}
    placeholder="Search presets..."
  />

  <div class="preset-grid">
    {#each filteredPresets as preset}
      <button
        class="preset-card"
        onclick={() => onSelectPreset(preset.name)}
      >
        <div class="preset-name">{preset.name}</div>
        <div class="preset-author">{preset.author}</div>
        <div class="preset-rating">
          {'★'.repeat(Math.round(preset.rating))}
        </div>
      </button>
    {/each}
  </div>
</div>
```

### Phase 4: Audio Integration (2-3 days)

Currently, Butterchurn uses Web Audio API's AnalyserNode. We need to:

1. **Option A:** Pass our existing audio data to Butterchurn
2. **Option B:** Share the same AnalyserNode between systems
3. **Option C:** Let Butterchurn handle its own audio (simplest)

**Recommended: Option C** for MVP, then explore integration later.

## Data Mapping

### musicViz → Milkdrop Variable Mapping

```javascript
// Map our UnifiedPluginData to Milkdrop variables
function mapToMilkdropVariables(data) {
  return {
    // Audio bands
    bass: calculateBass(data.audio.frequencyData),
    mid: calculateMid(data.audio.frequencyData),
    treb: calculateTreb(data.audio.frequencyData),

    // BPM / timing
    time: data.timing.timestamp / 1000,
    fps: data.timing.fps,

    // Beat detection (need to implement)
    beat: detectBeat(data.music.beats, data.playback.position),
  };
}

function calculateBass(freqData) {
  if (!freqData || freqData.length === 0) return 0;
  const bassRange = freqData.slice(0, Math.floor(freqData.length * 0.1));
  const sum = bassRange.reduce((a, b) => a + b, 0);
  return sum / (bassRange.length * 255);
}
```

## Technical Challenges

### 1. Audio Context Management

**Challenge:** Butterchurn expects its own AudioContext and AnalyserNode.

**Solutions:**
- Let Butterchurn create its own context (easy, may have sync issues)
- Share our SpotifyPlayer's audio node (complex, tighter integration)
- Create a unified audio pipeline (ideal, most work)

### 2. Canvas Ownership

**Challenge:** Our PluginManager creates the canvas, but Butterchurn wants control.

**Solutions:**
- Pass canvas to Butterchurn in initialize() (already in design above)
- Let Butterchurn create canvas, position it via CSS (messy)
- Use offscreen canvas and copy pixels (performance hit)

### 3. Performance

**Challenge:** Milkdrop presets can be GPU-intensive, especially with complex shaders.

**Solutions:**
- Monitor FPS and warn if dropping below 30fps
- Provide quality settings (reduce resolution, disable effects)
- Implement preset rating/complexity system
- Allow users to create "performance" vs "quality" profiles

### 4. Preset Compatibility

**Challenge:** Not all `.milk` features are supported by Butterchurn.

**Solutions:**
- Document known limitations
- Provide compatibility badge in preset browser
- Fall back gracefully when features aren't supported
- Contribute fixes back to Butterchurn project

## Implementation Timeline

### Week 1: Foundation
- [ ] Day 1-2: Add Butterchurn dependencies, basic integration
- [ ] Day 3-4: Create MilkdropPlugin base class
- [ ] Day 5: Test with 5-10 simple presets

### Week 2: Integration
- [ ] Day 1-2: Register featured presets in plugin system
- [ ] Day 3-4: Audio pipeline integration
- [ ] Day 5: Performance testing and optimization

### Week 3: UI & Polish
- [ ] Day 1-3: Build preset browser UI
- [ ] Day 4: Add preset search/filtering
- [ ] Day 5: Create preset categories/ratings

### Week 4: Testing & Docs
- [ ] Day 1-2: Test 100+ presets for compatibility
- [ ] Day 3: Write documentation
- [ ] Day 4: Create preset author attribution system
- [ ] Day 5: Final testing and bug fixes

## Future Enhancements

### Custom Preset Loading
Allow users to load their own `.milk` files:

```javascript
// Upload .milk file
async function loadCustomPreset(file) {
  const text = await file.text();
  const preset = butterchurn.parsePreset(text);
  visualizer.loadPreset(preset, 0.0);
}
```

### Preset Transitions
Smooth transitions between presets:

```javascript
// Blend between presets over 2 seconds
visualizer.loadPreset(newPreset, 2.0);
```

### Preset Editor
Build a visual preset editor:
- Live equation editing
- Parameter sliders
- Shader code editor
- Real-time preview

### Native Preset Format
Create a musicViz-native format inspired by Milkdrop but simpler:

```json
{
  "version": "1.0",
  "name": "My Preset",
  "author": "You",
  "equations": {
    "perFrame": [
      "zoom = 1 + 0.1 * bass",
      "rot = rot + 0.01 * mid"
    ],
    "perPixel": [
      "d = length(uv - 0.5)",
      "uv = uv + normalize(uv) * d * bass * 0.1"
    ]
  },
  "parameters": {
    "decay": 0.98,
    "gamma": 2.0
  }
}
```

## Dependencies

```json
{
  "dependencies": {
    "butterchurn": "^3.0.0",
    "butterchurn-presets": "^3.0.0"
  }
}
```

**Bundle Size Impact:**
- butterchurn: ~350KB (minified)
- butterchurn-presets: ~200KB (minified, includes 200+ presets)
- **Total:** ~550KB additional bundle size

## Resources

### Documentation
- [Milkdrop Preset Authoring Guide](https://www.geisswerks.com/milkdrop/milkdrop_preset_authoring.html) - Official spec by Ryan Geiss
- [Butterchurn GitHub](https://github.com/jberg/butterchurn) - WebGL implementation
- [ProjectM GitHub](https://github.com/projectM-visualizer/projectm) - C++ implementation

### Preset Packs
- [Cream of the Crop](https://github.com/projectM-visualizer/presets-cream-of-the-crop) - Curated best presets (~200)
- [Milkdrop MegaPack](https://www.getmusicbee.com/addons/visualizer/416/milkdrop-megapack-8265-presets/) - 8265 presets
- [ProjectM Classic](https://github.com/projectM-visualizer/presets-projectm-classic) - 4200 presets

### Community
- Winamp/Milkdrop Forums
- ProjectM GitHub Discussions
- Geiss Forums (historical)

## Conclusion

Integrating Milkdrop preset support via Butterchurn is a high-value feature that would:
- Instantly provide thousands of high-quality visualizations
- Tap into decades of community creativity
- Establish musicViz as a serious visualization platform
- Provide educational value for understanding music visualization

The hybrid approach (Butterchurn for Phase 1, potential custom implementation later) balances rapid development with long-term flexibility.

**Recommendation:** Start with Phase 1 (Butterchurn integration) as a 1-2 week project to validate the approach and user interest before committing to deeper integration work.
