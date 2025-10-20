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
    super.initialize(context);

    // Get fresh context
    const ctx = this.getContext();

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

    console.log('[WaveformPlugin] Initialized');
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
    if (this.visualization) {
      // Update context in case canvas was recreated
      const freshCtx = this.getContext();
      if (freshCtx) {
        this.visualization.ctx = freshCtx;
      }
      this.visualization.render();
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
      return { frequencyData, waveformData };
    }

    // Generate beat-synced data
    const beatInterval = (60 / bpm) * 1000; // ms per beat
    const beatProgress = (timestamp % beatInterval) / beatInterval;
    const beatEnergy = Math.max(0, 1 - beatProgress * 2); // Quick decay

    // Waveform data (time domain)
    const waveFreq = 0.05; // Wave frequency
    for (let i = 0; i < fftSize; i++) {
      const t = (timestamp / 1000 + i / fftSize) * waveFreq;

      // Mix multiple frequencies for more interesting waveform
      const wave1 = Math.sin(t * Math.PI * 2);
      const wave2 = Math.sin(t * Math.PI * 2 * 2.5) * 0.3;
      const wave3 = Math.sin(t * Math.PI * 2 * 0.5) * 0.2;

      const combined = (wave1 + wave2 + wave3) * (0.5 + beatEnergy * 0.5);
      waveformData[i] = Math.floor((combined * 0.8 + 0.5) * 255);
    }

    // Frequency data (optional, for compatibility)
    for (let i = 0; i < bufferLength; i++) {
      const freq = i / bufferLength;
      if (freq < 0.2) {
        frequencyData[i] = Math.floor(beatEnergy * 200 + Math.random() * 20);
      } else {
        frequencyData[i] = Math.floor(100 * (1 - freq) + Math.random() * 30);
      }
    }

    return { frequencyData, waveformData };
  }
}
