/**
 * Spectrum Bars Plugin
 *
 * Frequency spectrum visualization with vertical bars and color gradient.
 * Adapts the existing SpectrumBars visualization to the plugin interface.
 */

import { CanvasPlugin } from '../types.js';
import { SpectrumBars } from '$lib/visualizations/SpectrumBars.js';

export class SpectrumBarsPlugin extends CanvasPlugin {
  constructor() {
    super();

    // Plugin metadata
    this.metadata = {
      id: 'spectrum-bars',
      name: 'Spectrum Bars',
      author: 'musicViz',
      version: '1.0.0',
      description: 'Frequency spectrum visualization with vertical bars',
      type: 'canvas'
    };

    // Configurable parameters
    this.parameters = {
      barCount: {
        type: 'number',
        default: 128,
        min: 32,
        max: 256,
        step: 1,
        label: 'Bar Count',
        description: 'Number of frequency bars'
      },
      barSpacing: {
        type: 'number',
        default: 2,
        min: 0,
        max: 10,
        step: 1,
        label: 'Bar Spacing',
        description: 'Spacing between bars in pixels'
      },
      smoothing: {
        type: 'number',
        default: 0.7,
        min: 0,
        max: 1,
        step: 0.1,
        label: 'Smoothing',
        description: 'Smoothing factor (higher = smoother)'
      }
    };

    // Internal visualization instance
    this.visualization = null;
  }

  /**
   * Initialize plugin
   */
  initialize(context) {
    console.log('[SpectrumBarsPlugin] initialize() called with context:', context);
    super.initialize(context);

    console.log('[SpectrumBarsPlugin] After super.initialize():');
    console.log('  - canvas:', this.canvas);
    console.log('  - width:', this.width, 'height:', this.height);
    console.log('  - dpr:', this.dpr);

    // Get fresh context
    const ctx = this.getContext();
    console.log('[SpectrumBarsPlugin] Got context:', ctx);
    console.log('  - Context valid:', !!ctx);
    if (ctx) {
      console.log('  - Canvas from context:', ctx.canvas);
      console.log('  - Canvas dimensions:', ctx.canvas?.width, 'x', ctx.canvas?.height);
    }

    // Create SpectrumBars instance with fresh context
    this.visualization = new SpectrumBars(ctx);
    this.visualization.resize(this.width, this.height, this.dpr);

    // Apply default config
    this.visualization.setConfig({
      barCount: this.parameters.barCount.default,
      barSpacing: this.parameters.barSpacing.default,
      smoothing: this.parameters.smoothing.default
    });

    console.log('[SpectrumBarsPlugin] Initialized with visualization:', !!this.visualization);
  }

  /**
   * Update plugin with new data
   */
  update(data) {
    if (!this.visualization) return;

    // Use audio data if available, otherwise generate mock data
    let audioData;
    if (data.audio.available && data.audio.frequencyData.length > 0) {
      audioData = {
        frequencyData: data.audio.frequencyData,
        waveformData: data.audio.waveformData
      };
    } else {
      // Generate mock audio data for testing
      const mockData = this._generateMockAudioData(
        data.timing.timestamp,
        data.music.bpm,
        data.playback.isPlaying
      );
      audioData = mockData;
    }

    // Update visualization
    this.visualization.update(audioData);
  }

  /**
   * Render visualization
   */
  render() {
    if (!this.renderCount) {
      this.renderCount = 0;
    }
    this.renderCount++;

    if (this.renderCount <= 5 || this.renderCount % 100 === 0) {
      console.log(`[SpectrumBarsPlugin] render() call #${this.renderCount}`);
    }

    if (this.visualization) {
      // Update context in case canvas was recreated
      const freshCtx = this.getContext();

      if (this.renderCount <= 5) {
        console.log(`[SpectrumBarsPlugin] Fresh context:`, !!freshCtx);
        if (freshCtx && freshCtx.canvas) {
          console.log(`  - Canvas dimensions: ${freshCtx.canvas.width}x${freshCtx.canvas.height}`);
          console.log(`  - Canvas in DOM:`, document.body.contains(freshCtx.canvas));
        }
      }

      if (freshCtx) {
        this.visualization.ctx = freshCtx;
      } else {
        console.warn('[SpectrumBarsPlugin] No fresh context available!');
      }

      try {
        this.visualization.render();
        if (this.renderCount === 5) {
          console.log('[SpectrumBarsPlugin] First 5 renders completed successfully');
        }
      } catch (error) {
        console.error('[SpectrumBarsPlugin] Render error:', error);
      }
    } else {
      if (this.renderCount <= 5) {
        console.warn('[SpectrumBarsPlugin] No visualization instance!');
      }
    }
  }

  /**
   * Handle canvas resize
   */
  resize(width, height, dpr) {
    super.resize(width, height, dpr);
    if (this.visualization) {
      this.visualization.resize(width, height, dpr);
    }
  }

  /**
   * Get current configuration
   */
  getConfig() {
    if (this.visualization) {
      return this.visualization.getConfig();
    }
    return {};
  }

  /**
   * Set configuration
   */
  setConfig(config) {
    if (this.visualization) {
      this.visualization.setConfig(config);
      console.log('[SpectrumBarsPlugin] Config updated:', config);
    }
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.visualization) {
      this.visualization.reset();
      this.visualization = null;
    }
    console.log('[SpectrumBarsPlugin] Destroyed');
  }

  /**
   * Generate mock audio data for testing
   * @private
   */
  _generateMockAudioData(timestamp, bpm = 120, isPlaying = false) {
    const fftSize = 2048;
    const bufferLength = fftSize / 2;
    const frequencyData = new Uint8Array(bufferLength);
    const waveformData = new Uint8Array(fftSize);

    if (!isPlaying) {
      // Return silent data when not playing
      frequencyData.fill(0);
      waveformData.fill(128); // Center line for waveform
      return { frequencyData, waveformData };
    }

    // Generate more realistic beat-synced data
    const beatInterval = (60 / bpm) * 1000; // ms per beat
    const beatProgress = (timestamp % beatInterval) / beatInterval;

    // Create different beat patterns
    const measureProgress = (timestamp % (beatInterval * 4)) / (beatInterval * 4);
    const isKick = beatProgress < 0.1; // Kick drum on beat
    const isSnare = (beatProgress > 0.45 && beatProgress < 0.55); // Snare on off-beat

    // Energy envelope with more realistic ADSR
    const attack = 0.05;
    const decay = 0.15;
    const sustain = 0.7;
    const release = 0.3;

    let beatEnergy;
    if (beatProgress < attack) {
      beatEnergy = beatProgress / attack;
    } else if (beatProgress < attack + decay) {
      beatEnergy = 1 - ((beatProgress - attack) / decay) * (1 - sustain);
    } else if (beatProgress < 1 - release) {
      beatEnergy = sustain;
    } else {
      beatEnergy = sustain * ((1 - beatProgress) / release);
    }

    // Add some variation to make it more interesting
    const variation = Math.sin(timestamp / 2000) * 0.3 + 0.7;
    beatEnergy *= variation;

    // Frequency data with more realistic spectrum
    for (let i = 0; i < bufferLength; i++) {
      const freq = i / bufferLength;
      let value = 0;

      // Sub-bass (0-0.05) - strong on kick
      if (freq < 0.05 && isKick) {
        value = 200 + Math.random() * 55;
      }
      // Bass (0.05-0.15) - pulse with beat
      else if (freq < 0.15) {
        const bassEnergy = beatEnergy * 0.9 + 0.1;
        value = bassEnergy * 180 * (1 - (freq - 0.05) / 0.1) + Math.random() * 30;
      }
      // Low-mid (0.15-0.3) - snare frequencies
      else if (freq < 0.3) {
        const snareEnergy = isSnare ? 0.8 : 0.3;
        value = (100 * snareEnergy + beatEnergy * 60) * (1 - (freq - 0.15) / 0.15) + Math.random() * 40;
      }
      // Mid (0.3-0.5) - melodic content
      else if (freq < 0.5) {
        // Simulate some harmonic content
        const harmonic = Math.sin(freq * 20 + timestamp / 500) * 30;
        value = (80 + harmonic) * (1 - (freq - 0.3) / 0.2) * variation + Math.random() * 30;
      }
      // High-mid (0.5-0.7) - presence
      else if (freq < 0.7) {
        value = 60 * (1 - (freq - 0.5) / 0.2) * variation + Math.random() * 35;
      }
      // High (0.7-1.0) - air/sparkle
      else {
        value = 40 * (1 - freq) + Math.random() * 30;
      }

      // Apply overall energy modulation
      value *= (0.7 + measureProgress * 0.3);

      // Clamp to valid range
      frequencyData[i] = Math.floor(Math.max(0, Math.min(255, value)));
    }

    // More realistic waveform data
    for (let i = 0; i < fftSize; i++) {
      const t = i / fftSize;

      // Mix multiple frequencies for complex waveform
      const fundamental = Math.sin(t * Math.PI * 2 * 4) * beatEnergy;
      const harmonic1 = Math.sin(t * Math.PI * 2 * 8) * beatEnergy * 0.5;
      const harmonic2 = Math.sin(t * Math.PI * 2 * 12) * beatEnergy * 0.25;
      const noise = (Math.random() - 0.5) * 0.1;

      // Combine and add some envelope shaping
      const wave = (fundamental + harmonic1 + harmonic2 + noise) * 0.8;

      // Convert to 0-255 range with center at 128
      waveformData[i] = Math.floor((wave + 1) * 127.5);
    }

    return { frequencyData, waveformData };
  }
}
