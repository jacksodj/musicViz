/**
 * Plugin Index
 *
 * Exports all plugins and provides utility function to register them all.
 */

import { pluginRegistry } from './PluginRegistry.js';
import { BeatPulsePlugin } from './visualizations/BeatPulsePlugin.js';
import { SpectrumBarsPlugin } from './visualizations/SpectrumBarsPlugin.js';
import { WaveformPlugin } from './visualizations/WaveformPlugin.js';
import { MilkdropPlugin } from './visualizations/MilkdropPlugin.js';
import butterchurnPresets from 'butterchurn-presets';

// Export all plugins
export { BeatPulsePlugin, SpectrumBarsPlugin, WaveformPlugin, MilkdropPlugin };

// Export plugin registry and adapter
export { pluginRegistry } from './PluginRegistry.js';
export { pluginDataAdapter } from './PluginDataAdapter.js';

// Native plugins
export const NATIVE_PLUGINS = [
  BeatPulsePlugin,
  SpectrumBarsPlugin,
  WaveformPlugin
];

// Featured Milkdrop presets to include
export const FEATURED_MILKDROP_PRESETS = [
  'Geiss - Cauldron - painterly 2',
  'Martin - king of vice',
  'Rovastar - Solarization',
  'Flexi - mindblob [mash-up]',
  'Unchained - Alien Insect',
  'Rovastar & Geiss - Dedicated To The Sherwin',
  'Zylot - Crosshair Dimension (Geiss Layered Mix)',
  'Geiss - Cosmic Dust',
  'Flexi + martin - WTF',
  'Aderrasi - Silken Strings',
];

// All plugins (native + milkdrop will be registered dynamically)
export const ALL_PLUGINS = NATIVE_PLUGINS;

/**
 * Register all native plugins
 */
export function registerNativePlugins() {
  console.log('[Plugins] Registering native plugins...');

  for (const PluginClass of NATIVE_PLUGINS) {
    try {
      pluginRegistry.register(PluginClass);
    } catch (error) {
      console.error(`[Plugins] Failed to register native plugin:`, error);
    }
  }

  const stats = pluginRegistry.getStats();
  console.log(`[Plugins] Registered ${stats.total} native plugins`);
}

/**
 * Register Milkdrop presets
 */
export function registerMilkdropPresets() {
  console.log('[Plugins] Registering Milkdrop presets...');

  try {
    const allPresets = butterchurnPresets.getPresets();
    const availableNames = Object.keys(allPresets);

    console.log(`[Plugins] Found ${availableNames.length} total presets available`);

    // Log first 20 preset names for debugging
    console.log('[Plugins] Sample preset names:', availableNames.slice(0, 20));

    let registered = 0;

    // Register first 15 presets as featured (or use FEATURED list if names match)
    const presetsToRegister = FEATURED_MILKDROP_PRESETS.filter(name => allPresets[name])
      .concat(availableNames.filter(name => !FEATURED_MILKDROP_PRESETS.includes(name)))
      .slice(0, 15);

    for (const presetName of presetsToRegister) {
      const presetData = allPresets[presetName];
      if (presetData) {
        // Dynamically create a plugin class for this preset
        class DynamicMilkdropPlugin extends MilkdropPlugin {
          constructor() {
            super(presetData, presetName);
          }
        }

        // Register using the standard registry method
        pluginRegistry.register(DynamicMilkdropPlugin);
        registered++;
      }
    }

    console.log(`[Plugins] Registered ${registered} Milkdrop presets`);
  } catch (error) {
    console.error('[Plugins] Failed to register Milkdrop presets:', error);
  }
}

/**
 * Load presets from preset files
 */
export function loadPresets() {
  const presets = [
    // Beat Pulse presets
    {
      id: 'beat-pulse-default',
      name: 'Beat Pulse (Default)',
      pluginId: 'beat-pulse',
      config: {
        bpm: 120,
        intensity: 0.8,
        colorSeed: 0
      }
    },
    {
      id: 'beat-pulse-intense',
      name: 'Beat Pulse (Intense)',
      pluginId: 'beat-pulse',
      config: {
        bpm: 140,
        intensity: 1.0,
        colorSeed: 100
      }
    },
    {
      id: 'beat-pulse-chill',
      name: 'Beat Pulse (Chill)',
      pluginId: 'beat-pulse',
      config: {
        bpm: 90,
        intensity: 0.5,
        colorSeed: 500
      }
    },

    // Spectrum Bars presets
    {
      id: 'spectrum-bars-default',
      name: 'Spectrum Bars (Default)',
      pluginId: 'spectrum-bars',
      config: {
        barCount: 128,
        barSpacing: 2,
        smoothing: 0.7
      }
    },
    {
      id: 'spectrum-bars-dense',
      name: 'Spectrum Bars (Dense)',
      pluginId: 'spectrum-bars',
      config: {
        barCount: 256,
        barSpacing: 1,
        smoothing: 0.8
      }
    },
    {
      id: 'spectrum-bars-minimal',
      name: 'Spectrum Bars (Minimal)',
      pluginId: 'spectrum-bars',
      config: {
        barCount: 64,
        barSpacing: 4,
        smoothing: 0.5
      }
    },

    // Waveform presets
    {
      id: 'waveform-default',
      name: 'Waveform (Default)',
      pluginId: 'waveform',
      config: {
        lineWidth: 2,
        smoothing: 0.5,
        amplification: 1.5,
        mirrorEffect: true,
        glowEffect: true
      }
    },
    {
      id: 'waveform-bold',
      name: 'Waveform (Bold)',
      pluginId: 'waveform',
      config: {
        lineWidth: 4,
        smoothing: 0.3,
        amplification: 2.0,
        mirrorEffect: true,
        glowEffect: true
      }
    },
    {
      id: 'waveform-clean',
      name: 'Waveform (Clean)',
      pluginId: 'waveform',
      config: {
        lineWidth: 1,
        smoothing: 0.7,
        amplification: 1.0,
        mirrorEffect: false,
        glowEffect: false
      }
    }
  ];

  pluginRegistry.loadPresets(presets);
  console.log(`[Plugins] Loaded ${presets.length} presets`);
}

/**
 * Initialize plugin system
 * Registers all plugins and loads presets
 */
export function initializePluginSystem() {
  registerNativePlugins();
  registerMilkdropPresets();
  loadPresets();

  const stats = pluginRegistry.getStats();
  console.log(`[Plugins] Plugin system initialized: ${stats.total} plugins, ${stats.presets} presets`);
}
