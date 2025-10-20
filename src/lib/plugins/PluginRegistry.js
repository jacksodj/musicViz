/**
 * Plugin Registry
 *
 * Central registry for all visualization plugins.
 * Manages registration, validation, and instantiation of plugins.
 */

import { IVisualizationPlugin } from './types.js';

/**
 * PluginRegistry class
 * Singleton that manages all registered plugins
 */
export class PluginRegistry {
  constructor() {
    /** @type {Map<string, typeof IVisualizationPlugin>} */
    this.plugins = new Map();

    /** @type {Map<string, Object>} */
    this.presets = new Map();

    console.log('[PluginRegistry] Initialized');
  }

  /**
   * Register a plugin
   *
   * @param {typeof IVisualizationPlugin} PluginClass - Plugin class (not instance)
   * @throws {Error} If plugin is invalid or ID already registered
   */
  register(PluginClass) {
    // Validate plugin class
    this._validatePlugin(PluginClass);

    // Create temporary instance to get metadata
    const tempInstance = new PluginClass();
    const { id, name } = tempInstance.metadata;

    // Check for duplicate ID
    if (this.plugins.has(id)) {
      console.warn(`[PluginRegistry] Plugin '${id}' already registered. Overwriting.`);
    }

    // Register plugin class
    this.plugins.set(id, PluginClass);

    console.log(`[PluginRegistry] Registered plugin: ${name} (${id})`);
  }

  /**
   * Unregister a plugin
   *
   * @param {string} id - Plugin ID
   * @returns {boolean} True if plugin was unregistered
   */
  unregister(id) {
    if (this.plugins.has(id)) {
      this.plugins.delete(id);
      console.log(`[PluginRegistry] Unregistered plugin: ${id}`);
      return true;
    }
    return false;
  }

  /**
   * Get plugin class by ID
   *
   * @param {string} id - Plugin ID
   * @returns {typeof IVisualizationPlugin|null} Plugin class or null
   */
  get(id) {
    return this.plugins.get(id) || null;
  }

  /**
   * Check if plugin is registered
   *
   * @param {string} id - Plugin ID
   * @returns {boolean}
   */
  has(id) {
    return this.plugins.has(id);
  }

  /**
   * List all registered plugins
   *
   * @returns {Array<Object>} Array of plugin metadata
   */
  list() {
    const pluginList = [];

    for (const [id, PluginClass] of this.plugins.entries()) {
      const instance = new PluginClass();
      pluginList.push({
        ...instance.metadata,
        parameters: instance.parameters
      });
    }

    return pluginList;
  }

  /**
   * Create plugin instance
   *
   * @param {string} id - Plugin ID
   * @param {Object} context - Plugin context
   * @returns {IVisualizationPlugin|null} Plugin instance or null
   */
  createInstance(id, context = {}) {
    const PluginClass = this.get(id);

    if (!PluginClass) {
      console.error(`[PluginRegistry] Plugin '${id}' not found`);
      return null;
    }

    try {
      const instance = new PluginClass();
      instance.initialize(context);
      console.log(`[PluginRegistry] Created instance of '${id}'`);
      return instance;
    } catch (error) {
      console.error(`[PluginRegistry] Failed to create instance of '${id}':`, error);
      return null;
    }
  }

  /**
   * Register a preset
   *
   * @param {Object} preset - Preset configuration
   * @param {string} preset.id - Unique preset ID
   * @param {string} preset.name - Display name
   * @param {string} preset.pluginId - Plugin ID this preset is for
   * @param {Object} preset.config - Parameter values
   */
  registerPreset(preset) {
    if (!preset.id || !preset.pluginId) {
      throw new Error('Preset must have id and pluginId');
    }

    if (!this.has(preset.pluginId)) {
      console.warn(`[PluginRegistry] Plugin '${preset.pluginId}' not registered, but preset '${preset.id}' will be registered anyway`);
    }

    this.presets.set(preset.id, preset);
    console.log(`[PluginRegistry] Registered preset: ${preset.name} (${preset.id})`);
  }

  /**
   * Get preset by ID
   *
   * @param {string} id - Preset ID
   * @returns {Object|null} Preset or null
   */
  getPreset(id) {
    return this.presets.get(id) || null;
  }

  /**
   * Get all presets for a plugin
   *
   * @param {string} pluginId - Plugin ID
   * @returns {Array<Object>} Array of presets
   */
  getPresetsForPlugin(pluginId) {
    const presets = [];
    for (const preset of this.presets.values()) {
      if (preset.pluginId === pluginId) {
        presets.push(preset);
      }
    }
    return presets;
  }

  /**
   * Create plugin instance with preset
   *
   * @param {string} presetId - Preset ID
   * @param {Object} context - Plugin context
   * @returns {IVisualizationPlugin|null} Plugin instance or null
   */
  createInstanceFromPreset(presetId, context = {}) {
    const preset = this.getPreset(presetId);

    if (!preset) {
      console.error(`[PluginRegistry] Preset '${presetId}' not found`);
      return null;
    }

    const instance = this.createInstance(preset.pluginId, context);

    if (instance && preset.config) {
      instance.setConfig(preset.config);
    }

    return instance;
  }

  /**
   * Clear all registered plugins
   */
  clear() {
    this.plugins.clear();
    this.presets.clear();
    console.log('[PluginRegistry] Cleared all plugins and presets');
  }

  /**
   * Get registry statistics
   *
   * @returns {Object} Statistics
   */
  getStats() {
    const pluginList = this.list();
    const canvasCount = pluginList.filter(p => p.type === 'canvas').length;
    const componentCount = pluginList.filter(p => p.type === 'component').length;

    return {
      total: this.plugins.size,
      canvas: canvasCount,
      component: componentCount,
      presets: this.presets.size
    };
  }

  /**
   * Validate plugin class
   * @private
   */
  _validatePlugin(PluginClass) {
    if (typeof PluginClass !== 'function') {
      throw new Error('Plugin must be a class');
    }

    // Create temporary instance for validation
    let instance;
    try {
      instance = new PluginClass();
    } catch (error) {
      throw new Error(`Failed to instantiate plugin: ${error.message}`);
    }

    // Check required properties
    if (!instance.metadata || !instance.metadata.id) {
      throw new Error('Plugin must have metadata.id');
    }

    if (!instance.metadata.name) {
      throw new Error('Plugin must have metadata.name');
    }

    if (!['canvas', 'component'].includes(instance.metadata.type)) {
      throw new Error('Plugin type must be "canvas" or "component"');
    }

    // Check required methods
    const requiredMethods = ['initialize', 'update'];
    for (const method of requiredMethods) {
      if (typeof instance[method] !== 'function') {
        throw new Error(`Plugin must implement ${method}() method`);
      }
    }

    // Canvas plugins should have render method
    if (instance.metadata.type === 'canvas' && typeof instance.render !== 'function') {
      console.warn(`Canvas plugin '${instance.metadata.id}' should implement render() method`);
    }
  }

  /**
   * Load presets from JSON files
   * In a real app, you'd import these dynamically
   *
   * @param {Array<Object>} presetList - Array of preset objects
   */
  loadPresets(presetList) {
    for (const preset of presetList) {
      try {
        this.registerPreset(preset);
      } catch (error) {
        console.error(`[PluginRegistry] Failed to load preset ${preset.id}:`, error);
      }
    }
  }
}

// Export singleton instance
export const pluginRegistry = new PluginRegistry();
