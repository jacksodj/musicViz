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
      return { frequencyData, waveformData };
    }

    // Generate beat-synced data
    const beatInterval = (60 / bpm) * 1000; // ms per beat
    const beatProgress = (timestamp % beatInterval) / beatInterval;
    const beatEnergy = Math.max(0, 1 - beatProgress * 2); // Quick decay

    // Frequency data (bass to treble)
    for (let i = 0; i < bufferLength; i++) {
      const freq = i / bufferLength;

      // Bass frequencies (0-0.2) - pulse with beat
      if (freq < 0.2) {
        const bassEnergy = beatEnergy * 0.8 + 0.2;
        frequencyData[i] = Math.floor(
          bassEnergy * 200 * (1 - freq * 2) + Math.random() * 20
        );
      }
      // Mid frequencies (0.2-0.6) - more stable
      else if (freq < 0.6) {
        frequencyData[i] = Math.floor(
          120 * (1 - freq) + beatEnergy * 50 + Math.random() * 30
        );
      }
      // High frequencies (0.6-1.0) - lower energy
      else {
        frequencyData[i] = Math.floor(
          60 * (1 - freq) + Math.random() * 40
        );
      }
    }

    // Waveform data
    const waveFreq = 0.05;
    for (let i = 0; i < fftSize; i++) {
      const t = (timestamp / 1000 + i / fftSize) * waveFreq;
      const wave = Math.sin(t * Math.PI * 2) * (0.5 + beatEnergy * 0.5);
      waveformData[i] = Math.floor((wave * 0.8 + 0.5) * 255);
    }

    return { frequencyData, waveformData };
  }
}
