/**
 * Waveform Plugin
 *
 * Time-domain waveform visualization with mirror effect.
 * Adapts the existing Waveform visualization to the plugin interface.
 */

import { CanvasPlugin } from '../types.js';
import { Waveform } from '$lib/visualizations/Waveform.js';

export class WaveformPlugin extends CanvasPlugin {
  constructor() {
    super();

    // Plugin metadata
    this.metadata = {
      id: 'waveform',
      name: 'Waveform',
      author: 'musicViz',
      version: '1.0.0',
      description: 'Time-domain waveform visualization with mirror effect',
      type: 'canvas'
    };

    // Configurable parameters
    this.parameters = {
      lineWidth: {
        type: 'number',
        default: 2,
        min: 1,
        max: 10,
        step: 1,
        label: 'Line Width',
        description: 'Thickness of waveform line'
      },
      smoothing: {
        type: 'number',
        default: 0.5,
        min: 0,
        max: 1,
        step: 0.1,
        label: 'Smoothing',
        description: 'Smoothing factor (higher = smoother)'
      },
      amplification: {
        type: 'number',
        default: 1.5,
        min: 0.5,
        max: 3,
        step: 0.1,
        label: 'Amplification',
        description: 'Amplitude multiplier for better visibility'
      },
      mirrorEffect: {
        type: 'boolean',
        default: true,
        label: 'Mirror Effect',
        description: 'Enable top/bottom mirror'
      },
      glowEffect: {
        type: 'boolean',
        default: true,
        label: 'Glow Effect',
        description: 'Enable glow effect'
      }
    };

    // Internal visualization instance
    this.visualization = null;
  }

  /**
   * Initialize plugin
   */
  initialize(context) {
    console.log('[WaveformPlugin] initialize() called with context:', context);
    super.initialize(context);

    console.log('[WaveformPlugin] After super.initialize():');
    console.log('  - canvas:', this.canvas);
    console.log('  - width:', this.width, 'height:', this.height);
    console.log('  - dpr:', this.dpr);

    // Get fresh context
    const ctx = this.getContext();
    console.log('[WaveformPlugin] Got context:', ctx);
    console.log('  - Context valid:', !!ctx);
    if (ctx) {
      console.log('  - Canvas from context:', ctx.canvas);
      console.log('  - Canvas dimensions:', ctx.canvas?.width, 'x', ctx.canvas?.height);
    }

    // Create Waveform instance with fresh context
    this.visualization = new Waveform(ctx);
    this.visualization.resize(this.width, this.height, this.dpr);

    // Apply default config
    this.visualization.setConfig({
      lineWidth: this.parameters.lineWidth.default,
      smoothing: this.parameters.smoothing.default,
      amplification: this.parameters.amplification.default,
      mirrorEffect: this.parameters.mirrorEffect.default,
      glowEffect: this.parameters.glowEffect.default
    });

    console.log('[WaveformPlugin] Initialized with visualization:', !!this.visualization);
  }

  /**
   * Update plugin with new data
   */
  update(data) {
    if (!this.visualization) return;

    // Use audio data if available, otherwise generate mock data
    let audioData;
    if (data.audio.available && data.audio.waveformData.length > 0) {
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
      console.log(`[WaveformPlugin] render() call #${this.renderCount}`);
    }

    if (this.visualization) {
      // Update context in case canvas was recreated
      const freshCtx = this.getContext();

      if (this.renderCount <= 5) {
        console.log(`[WaveformPlugin] Fresh context:`, !!freshCtx);
        if (freshCtx && freshCtx.canvas) {
          console.log(`  - Canvas dimensions: ${freshCtx.canvas.width}x${freshCtx.canvas.height}`);
          console.log(`  - Canvas in DOM:`, document.body.contains(freshCtx.canvas));
        }
      }

      if (freshCtx) {
        this.visualization.ctx = freshCtx;
      } else {
        console.warn('[WaveformPlugin] No fresh context available!');
      }

      try {
        this.visualization.render();
        if (this.renderCount === 5) {
          console.log('[WaveformPlugin] First 5 renders completed successfully');
        }
      } catch (error) {
        console.error('[WaveformPlugin] Render error:', error);
      }
    } else {
      if (this.renderCount <= 5) {
        console.warn('[WaveformPlugin] No visualization instance!');
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
      console.log('[WaveformPlugin] Config updated:', config);
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
    console.log('[WaveformPlugin] Destroyed');
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

    // More realistic waveform data (time domain)
    for (let i = 0; i < fftSize; i++) {
      const t = i / fftSize;

      // Mix multiple frequencies for complex waveform
      const fundamental = Math.sin(t * Math.PI * 2 * 4) * beatEnergy;
      const harmonic1 = Math.sin(t * Math.PI * 2 * 8) * beatEnergy * 0.5;
      const harmonic2 = Math.sin(t * Math.PI * 2 * 12) * beatEnergy * 0.25;
      const noise = (Math.random() - 0.5) * 0.1;

      // Add kick transient
      let transient = 0;
      if (isKick && t < 0.05) {
        transient = Math.sin(t * Math.PI * 2 * 60) * (1 - t / 0.05) * 0.5;
      }

      // Add snare hit
      if (isSnare && t < 0.1) {
        transient += (Math.random() - 0.5) * (1 - t / 0.1) * 0.4;
      }

      // Combine and add some envelope shaping
      const wave = (fundamental + harmonic1 + harmonic2 + noise + transient) * 0.8;

      // Convert to 0-255 range with center at 128
      waveformData[i] = Math.floor(Math.max(0, Math.min(255, (wave + 1) * 127.5)));
    }

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

    return { frequencyData, waveformData };
  }
}
