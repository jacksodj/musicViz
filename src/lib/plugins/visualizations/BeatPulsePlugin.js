/**
 * Beat Pulse Plugin
 *
 * Full-screen pulsing visualization that responds to beat data.
 * Wraps the BeatPulse Svelte component.
 */

import { ComponentPlugin } from '../types.js';
import BeatPulse from '$lib/components/visualizations/BeatPulse.svelte';

export class BeatPulsePlugin extends ComponentPlugin {
  constructor() {
    super();

    // Plugin metadata
    this.metadata = {
      id: 'beat-pulse',
      name: 'Beat Pulse',
      author: 'musicViz',
      version: '1.0.0',
      description: 'Full-screen pulsing visualization synced to beat data',
      type: 'component'
    };

    // Configurable parameters
    this.parameters = {
      bpm: {
        type: 'number',
        default: 120,
        min: 60,
        max: 200,
        step: 1,
        label: 'BPM',
        description: 'Beats per minute'
      },
      intensity: {
        type: 'number',
        default: 0.8,
        min: 0,
        max: 1,
        step: 0.1,
        label: 'Intensity',
        description: 'Pulse intensity (0-1)'
      },
      colorSeed: {
        type: 'number',
        default: 0,
        min: 0,
        max: 1000,
        step: 0.1,
        label: 'Color Seed',
        description: 'Seed for color generation'
      }
    };

    // Set Svelte component
    this.component = BeatPulse;

    // Initialize props with defaults
    this.props = {
      bpm: this.parameters.bpm.default,
      isPlaying: false,
      intensity: this.parameters.intensity.default,
      colorSeed: this.parameters.colorSeed.default
    };

    // Internal state
    this.config = {
      bpm: this.parameters.bpm.default,
      intensity: this.parameters.intensity.default,
      colorSeed: this.parameters.colorSeed.default
    };
  }

  /**
   * Initialize plugin
   */
  initialize(context) {
    super.initialize(context);
    console.log('[BeatPulsePlugin] Initialized');
  }

  /**
   * Update plugin with new data
   */
  update(data) {
    // Extract BPM from music data or use configured value
    const bpm = data.music.available ? data.music.bpm : this.config.bpm;

    // Extract playback state
    const isPlaying = data.playback.isPlaying;

    // Update color seed based on time (slow evolution)
    const colorSeed = this.config.colorSeed + (data.timing.timestamp / 10000);

    // Update props
    this.props = {
      bpm,
      isPlaying,
      intensity: this.config.intensity,
      colorSeed
    };
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
    if (config.bpm !== undefined) {
      this.config.bpm = Math.max(
        this.parameters.bpm.min,
        Math.min(this.parameters.bpm.max, config.bpm)
      );
    }

    if (config.intensity !== undefined) {
      this.config.intensity = Math.max(
        this.parameters.intensity.min,
        Math.min(this.parameters.intensity.max, config.intensity)
      );
    }

    if (config.colorSeed !== undefined) {
      this.config.colorSeed = config.colorSeed;
    }

    console.log('[BeatPulsePlugin] Config updated:', this.config);
  }

  /**
   * Get props to pass to Svelte component
   */
  getProps() {
    return this.props;
  }

  /**
   * Clean up resources
   */
  destroy() {
    console.log('[BeatPulsePlugin] Destroyed');
  }
}
