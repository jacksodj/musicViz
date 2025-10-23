/**
 * Govee Manager - Main Integration Module
 *
 * Provides unified interface for Govee device control,
 * synchronization with visualizations, and light show management.
 *
 * @module govee/GoveeManager
 */

import { GoveeDiscovery } from './discovery.js';
import { GoveeLanApi } from './lanApi.js';
import { ColorExtractor } from './colorExtractor.js';
import { DEFAULT_CONFIG, LAN_CMD } from './types.js';

/**
 * Main Govee integration manager
 */
export class GoveeManager {
  constructor(options = {}) {
    this.options = {
      apiKey: options.apiKey || null,
      useLanApi: options.useLanApi !== false, // Default to true
      discoveryTimeout: options.discoveryTimeout || DEFAULT_CONFIG.DISCOVERY_TIMEOUT,
      syncOptions: options.syncOptions || {}
    };

    // Initialize modules
    this.discovery = new GoveeDiscovery({
      timeout: this.options.discoveryTimeout
    });

    this.lanApi = new GoveeLanApi();
    this.colorExtractor = new ColorExtractor(this.options.syncOptions);

    // State
    this.devices = new Map();
    this.activeDevices = new Set();
    this.syncEnabled = false;
    this.currentCanvas = null;

    // Sync state
    this.lastColors = [];
    this.beatDetector = null;
    this.latencyCompensation = options.latencyCompensation || DEFAULT_CONFIG.LATENCY_COMPENSATION;

    console.log('[GoveeManager] Initialized with options:', this.options);
  }

  /**
   * Initialize and discover devices
   * @returns {Promise<Map<string, import('./types.js').GoveeDevice>>}
   */
  async initialize() {
    console.log('[GoveeManager] Initializing...');

    // Discover devices on network
    this.devices = await this.discovery.discover();

    console.log(`[GoveeManager] Found ${this.devices.size} devices`);

    // Set all devices as active by default
    for (const device of this.devices.values()) {
      if (device.online && device.lanApiEnabled) {
        this.activeDevices.add(device.id);
      }
    }

    return this.devices;
  }

  /**
   * Get all discovered devices
   * @returns {import('./types.js').GoveeDevice[]}
   */
  getDevices() {
    return Array.from(this.devices.values());
  }

  /**
   * Get active devices
   * @returns {import('./types.js').GoveeDevice[]}
   */
  getActiveDevices() {
    return Array.from(this.activeDevices)
      .map(id => this.devices.get(id))
      .filter(Boolean);
  }

  /**
   * Set device active state
   * @param {string} deviceId - Device ID
   * @param {boolean} active - Active state
   */
  setDeviceActive(deviceId, active) {
    if (active) {
      this.activeDevices.add(deviceId);
    } else {
      this.activeDevices.delete(deviceId);
    }

    console.log(`[GoveeManager] Device ${deviceId} active: ${active}`);
  }

  /**
   * Control device power
   * @param {string} deviceId - Device ID
   * @param {boolean} on - Power state
   * @returns {Promise<boolean>}
   */
  async setPower(deviceId, on) {
    const device = this.devices.get(deviceId);
    if (!device) {
      console.error(`[GoveeManager] Device ${deviceId} not found`);
      return false;
    }

    const success = await this.lanApi.setPower(device.ip, deviceId, on);
    if (success && device.state) {
      device.state.on = on;
    }

    return success;
  }

  /**
   * Set device brightness
   * @param {string} deviceId - Device ID
   * @param {number} brightness - Brightness (0-100)
   * @returns {Promise<boolean>}
   */
  async setBrightness(deviceId, brightness) {
    const device = this.devices.get(deviceId);
    if (!device) {
      console.error(`[GoveeManager] Device ${deviceId} not found`);
      return false;
    }

    const success = await this.lanApi.setBrightness(device.ip, deviceId, brightness);
    if (success && device.state) {
      device.state.brightness = brightness;
    }

    return success;
  }

  /**
   * Set device color
   * @param {string} deviceId - Device ID
   * @param {import('./types.js').RGBColor} color - RGB color
   * @returns {Promise<boolean>}
   */
  async setColor(deviceId, color) {
    const device = this.devices.get(deviceId);
    if (!device) {
      console.error(`[GoveeManager] Device ${deviceId} not found`);
      return false;
    }

    const success = await this.lanApi.setColor(device.ip, deviceId, color);
    if (success && device.state) {
      device.state.color = color;
    }

    return success;
  }

  /**
   * Set color for all active devices
   * @param {import('./types.js').RGBColor} color - RGB color
   * @returns {Promise<boolean[]>}
   */
  async setAllColors(color) {
    const commands = this.getActiveDevices().map(device => ({
      ip: device.ip,
      id: device.id,
      command: {
        cmd: LAN_CMD.COLORWC,
        data: { color }
      }
    }));

    return this.lanApi.sendBatch(commands);
  }

  /**
   * Set colors for zones (multiple devices)
   * @param {import('./types.js').RGBColor[]} colors - Array of colors
   * @returns {Promise<boolean[]>}
   */
  async setZoneColors(colors) {
    const devices = this.getActiveDevices();
    const commands = [];

    devices.forEach((device, index) => {
      const colorIndex = index % colors.length;
      commands.push({
        ip: device.ip,
        id: device.id,
        command: {
          cmd: LAN_CMD.COLORWC,
          data: { color: colors[colorIndex] }
        }
      });
    });

    return this.lanApi.sendBatch(commands);
  }

  /**
   * Start syncing with canvas visualization
   * @param {HTMLCanvasElement} canvas - Canvas element
   * @param {Object} options - Sync options
   */
  startSync(canvas, options = {}) {
    if (this.syncEnabled) {
      console.warn('[GoveeManager] Sync already enabled');
      return;
    }

    if (!canvas) {
      console.error('[GoveeManager] Canvas required for sync');
      return;
    }

    console.log('[GoveeManager] Starting sync with canvas:', {
      element: canvas.tagName,
      width: canvas.width,
      height: canvas.height,
      contextType: canvas.getContext('2d') ? '2d' : canvas.getContext('webgl') ? 'webgl' : 'unknown'
    });

    this.currentCanvas = canvas;
    this.colorExtractor.initialize(canvas);

    // Start color extraction
    this.colorExtractor.startExtraction(async (colors) => {
      // Apply latency compensation
      setTimeout(async () => {
        // Check if we have beat information
        const audioFeatures = this.getAudioFeatures();
        const enhancedColors = audioFeatures
          ? this.colorExtractor.getAudioReactiveColors(audioFeatures)
          : colors;

        console.log('[GoveeManager] Extracted colors:', enhancedColors);

        // Send colors to devices
        await this.setZoneColors(enhancedColors);
        this.lastColors = enhancedColors;
      }, this.latencyCompensation);
    });

    this.syncEnabled = true;
    console.log('[GoveeManager] Sync started');
  }

  /**
   * Stop syncing
   */
  stopSync() {
    if (!this.syncEnabled) {
      return;
    }

    this.colorExtractor.stopExtraction();
    this.syncEnabled = false;
    this.currentCanvas = null;

    console.log('[GoveeManager] Sync stopped');
  }

  /**
   * Set beat detector for audio reactive features
   * @param {Object} beatDetector - Beat detector instance
   */
  setBeatDetector(beatDetector) {
    this.beatDetector = beatDetector;
    console.log('[GoveeManager] Beat detector set');
  }

  /**
   * Get current audio features
   * @private
   */
  getAudioFeatures() {
    if (!this.beatDetector) {
      return null;
    }

    // This would interface with your audio analysis
    // For now, return mock data
    return {
      energy: Math.random(),
      pitch: Math.random(),
      isBeat: Math.random() > 0.9
    };
  }

  /**
   * Apply preset scene to all devices
   * @param {string} sceneName - Scene name
   */
  async applyScene(sceneName) {
    const scenes = {
      rainbow: async () => {
        const colors = [
          { r: 255, g: 0, b: 0 },    // Red
          { r: 255, g: 127, b: 0 },  // Orange
          { r: 255, g: 255, b: 0 },  // Yellow
          { r: 0, g: 255, b: 0 },    // Green
          { r: 0, g: 0, b: 255 },    // Blue
          { r: 75, g: 0, b: 130 },   // Indigo
          { r: 148, g: 0, b: 211 }   // Violet
        ];
        await this.setZoneColors(colors);
      },
      party: async () => {
        // Rapid color changes
        const interval = setInterval(async () => {
          const randomColor = {
            r: Math.floor(Math.random() * 256),
            g: Math.floor(Math.random() * 256),
            b: Math.floor(Math.random() * 256)
          };
          await this.setAllColors(randomColor);
        }, 500);

        // Stop after 10 seconds
        setTimeout(() => clearInterval(interval), 10000);
      },
      chill: async () => {
        const colors = [
          { r: 0, g: 100, b: 200 },   // Cool blue
          { r: 0, g: 150, b: 150 },   // Teal
        ];
        await this.setZoneColors(colors);
        await this.setBrightnessAll(40);
      },
      sunset: async () => {
        const colors = [
          { r: 255, g: 94, b: 77 },   // Coral
          { r: 255, g: 154, b: 0 },   // Orange
          { r: 255, g: 206, b: 84 },  // Yellow
        ];
        await this.setZoneColors(colors);
      }
    };

    const sceneFunction = scenes[sceneName];
    if (sceneFunction) {
      await sceneFunction();
      console.log(`[GoveeManager] Applied scene: ${sceneName}`);
    } else {
      console.warn(`[GoveeManager] Unknown scene: ${sceneName}`);
    }
  }

  /**
   * Set brightness for all active devices
   * @param {number} brightness - Brightness (0-100)
   */
  async setBrightnessAll(brightness) {
    const promises = this.getActiveDevices().map(device =>
      this.setBrightness(device.id, brightness)
    );
    return Promise.all(promises);
  }

  /**
   * Turn all devices on/off
   * @param {boolean} on - Power state
   */
  async setPowerAll(on) {
    const promises = this.getActiveDevices().map(device =>
      this.setPower(device.id, on)
    );
    return Promise.all(promises);
  }

  /**
   * Get sync statistics
   */
  getSyncStats() {
    return {
      syncEnabled: this.syncEnabled,
      activeDevices: this.activeDevices.size,
      extractorStats: this.colorExtractor.getStats(),
      lastColors: this.lastColors,
      latencyCompensation: this.latencyCompensation
    };
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.stopSync();
    this.devices.clear();
    this.activeDevices.clear();
    console.log('[GoveeManager] Destroyed');
  }
}

// Export singleton instance
export const goveeManager = new GoveeManager();