/**
 * Plugin Framework Type Definitions
 *
 * Inspired by ProjectM/Milkdrop architecture, this defines a unified
 * plugin interface for music visualizations.
 */

/**
 * @typedef {'canvas' | 'component'} PluginType
 * - canvas: Renders to 2D canvas context (like SpectrumBars, Waveform)
 * - component: Svelte component wrapper (like BeatPulse)
 */

/**
 * @typedef {Object} PluginMetadata
 * @property {string} id - Unique plugin identifier (kebab-case)
 * @property {string} name - Display name
 * @property {string} author - Plugin author
 * @property {string} version - Semantic version (e.g., "1.0.0")
 * @property {string} description - Brief description
 * @property {PluginType} type - Plugin type (canvas or component)
 */

/**
 * @typedef {Object} PluginParameter
 * @property {'number' | 'boolean' | 'color' | 'select'} type - Parameter type
 * @property {any} default - Default value
 * @property {number} [min] - Minimum value (for number type)
 * @property {number} [max] - Maximum value (for number type)
 * @property {number} [step] - Step value (for number type)
 * @property {Array<{value: any, label: string}>} [options] - Options (for select type)
 * @property {string} [label] - Display label
 * @property {string} [description] - Parameter description
 */

/**
 * @typedef {Object.<string, PluginParameter>} PluginParameters
 * Map of parameter name to parameter definition
 */

/**
 * Unified data interface provided to all plugins
 *
 * @typedef {Object} UnifiedPluginData
 * @property {AudioData} audio - Real-time audio data (if available)
 * @property {MusicData} music - Music analysis data (mock or real)
 * @property {PlaybackData} playback - Playback state
 * @property {TimingData} timing - Timing information
 */

/**
 * Real-time audio data from Web Audio API
 *
 * @typedef {Object} AudioData
 * @property {Uint8Array} frequencyData - FFT frequency domain data (0-255)
 * @property {Uint8Array} waveformData - Time domain waveform data (0-255)
 * @property {number} energy - Overall energy level (0-1)
 * @property {boolean} available - Whether audio data is available
 */

/**
 * Music analysis data (Spotify API or mock data)
 *
 * @typedef {Object} MusicData
 * @property {number} bpm - Beats per minute
 * @property {number} tempo - Same as bpm (for compatibility)
 * @property {Array<AnalysisInterval>} beats - Beat intervals
 * @property {Array<AnalysisInterval>} bars - Bar intervals
 * @property {Array<AnalysisSegment>} segments - Segment intervals with timbre/pitch
 * @property {Array<AnalysisSection>} sections - Section intervals
 * @property {boolean} available - Whether music data is available
 */

/**
 * @typedef {Object} AnalysisInterval
 * @property {number} start - Start time in seconds
 * @property {number} duration - Duration in seconds
 * @property {number} [confidence] - Confidence level (0-1)
 */

/**
 * @typedef {Object} AnalysisSegment
 * @property {number} start - Start time in seconds
 * @property {number} duration - Duration in seconds
 * @property {number} [confidence] - Confidence level (0-1)
 * @property {number} [loudness_start] - Loudness at start (dB)
 * @property {number} [loudness_max] - Maximum loudness (dB)
 * @property {Array<number>} [timbre] - 12-dimensional timbre vector
 * @property {Array<number>} [pitches] - 12-dimensional pitch vector
 */

/**
 * @typedef {Object} AnalysisSection
 * @property {number} start - Start time in seconds
 * @property {number} duration - Duration in seconds
 * @property {number} [confidence] - Confidence level (0-1)
 * @property {number} [loudness] - Average loudness (dB)
 * @property {number} [tempo] - Tempo (BPM)
 * @property {number} [key] - Musical key (0-11)
 * @property {number} [mode] - Major (1) or minor (0)
 * @property {number} [time_signature] - Time signature (e.g., 4)
 */

/**
 * Playback state information
 *
 * @typedef {Object} PlaybackData
 * @property {boolean} isPlaying - Whether music is currently playing
 * @property {number} position - Current position in milliseconds
 * @property {number} duration - Track duration in milliseconds
 * @property {TrackInfo|null} track - Current track information
 */

/**
 * @typedef {Object} TrackInfo
 * @property {string} id - Spotify track ID
 * @property {string} name - Track name
 * @property {Array<{name: string}>} artists - Track artists
 * @property {Object} album - Album information
 * @property {string} album.name - Album name
 * @property {Array<{url: string}>} [album.images] - Album artwork images
 */

/**
 * Timing information for animations
 *
 * @typedef {Object} TimingData
 * @property {number} timestamp - Current performance timestamp (ms)
 * @property {number} deltaTime - Time since last frame (ms)
 * @property {number} fps - Current frames per second
 */

/**
 * Plugin context provided during initialization
 *
 * @typedef {Object} PluginContext
 * @property {CanvasRenderingContext2D} [ctx] - Canvas 2D context (for canvas plugins)
 * @property {number} [width] - Canvas width in pixels (for canvas plugins)
 * @property {number} [height] - Canvas height in pixels (for canvas plugins)
 * @property {number} [dpr] - Device pixel ratio (for canvas plugins)
 * @property {HTMLElement} [container] - Container element (for component plugins)
 */

/**
 * Base plugin interface that all plugins must implement
 *
 * @interface IVisualizationPlugin
 */
export class IVisualizationPlugin {
  /**
   * Plugin metadata
   * @type {PluginMetadata}
   */
  metadata = {
    id: 'base-plugin',
    name: 'Base Plugin',
    author: 'Unknown',
    version: '1.0.0',
    description: 'Base plugin interface',
    type: 'canvas'
  };

  /**
   * Configurable parameters
   * @type {PluginParameters}
   */
  parameters = {};

  /**
   * Initialize the plugin with context
   * @param {PluginContext} context - Plugin context
   * @returns {void|Promise<void>}
   */
  initialize(context) {
    throw new Error('initialize() must be implemented');
  }

  /**
   * Update plugin state with new data
   * @param {UnifiedPluginData} data - Unified plugin data
   * @returns {void}
   */
  update(data) {
    throw new Error('update() must be implemented');
  }

  /**
   * Render the visualization
   * Required for canvas plugins, optional for component plugins
   * @returns {void}
   */
  render() {
    // Optional for component plugins
  }

  /**
   * Clean up resources
   * @returns {void|Promise<void>}
   */
  destroy() {
    // Optional cleanup
  }

  /**
   * Get current configuration
   * @returns {Object.<string, any>} Current parameter values
   */
  getConfig() {
    return {};
  }

  /**
   * Set configuration
   * @param {Object.<string, any>} config - New parameter values
   * @returns {void}
   */
  setConfig(config) {
    // Optional configuration
  }

  /**
   * Handle canvas resize (canvas plugins only)
   * @param {number} width - New width in pixels
   * @param {number} height - New height in pixels
   * @param {number} dpr - Device pixel ratio
   * @returns {void}
   */
  resize(width, height, dpr) {
    // Optional for canvas plugins
  }
}

/**
 * Canvas plugin base class
 * Extends IVisualizationPlugin with canvas-specific functionality
 */
export class CanvasPlugin extends IVisualizationPlugin {
  constructor() {
    super();
    this.metadata.type = 'canvas';
    this.canvas = null;  // Store canvas element instead of context
    this.ctx = null;     // Will get fresh context when needed
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
  }

  /**
   * Initialize canvas plugin
   * @param {PluginContext} context
   */
  initialize(context) {
    this.canvas = context.canvas;  // Store canvas element
    this.ctx = context.ctx;        // Store initial context (may become stale)
    this.width = context.width || 0;
    this.height = context.height || 0;
    this.dpr = context.dpr || 1;

    // Get fresh context if canvas is available but ctx is not
    if (this.canvas && !this.ctx && !this.canvas.id?.startsWith('milkdrop-')) {
      this.ctx = this.canvas.getContext('2d');
    }
  }

  /**
   * Get current 2D context (fresh)
   * @returns {CanvasRenderingContext2D|null}
   */
  getContext() {
    // Always get fresh context from canvas if available
    if (this.canvas) {
      const freshCtx = this.canvas.getContext('2d');
      if (freshCtx) {
        this.ctx = freshCtx;
      }
    }
    return this.ctx;
  }

  /**
   * Handle canvas resize
   * @param {number} width
   * @param {number} height
   * @param {number} dpr
   */
  resize(width, height, dpr) {
    this.width = width;
    this.height = height;
    this.dpr = dpr;
  }
}

/**
 * Component plugin base class
 * Extends IVisualizationPlugin with Svelte component functionality
 */
export class ComponentPlugin extends IVisualizationPlugin {
  constructor() {
    super();
    this.metadata.type = 'component';
    this.component = null; // Svelte component class
    this.props = {}; // Props to pass to component
  }

  /**
   * Initialize component plugin
   * @param {PluginContext} context
   */
  initialize(context) {
    this.container = context.container;
  }

  /**
   * Get Svelte component to render
   * @returns {SvelteComponent|null}
   */
  getComponent() {
    return this.component;
  }

  /**
   * Get props to pass to component
   * @returns {Object}
   */
  getProps() {
    return this.props;
  }
}

/**
 * Preset configuration
 *
 * @typedef {Object} PluginPreset
 * @property {string} id - Unique preset identifier
 * @property {string} name - Display name
 * @property {string} pluginId - ID of the plugin this preset is for
 * @property {string} [description] - Preset description
 * @property {Object.<string, any>} config - Parameter values
 */

export {};
