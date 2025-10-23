/**
 * Govee LAN Device Discovery Module
 *
 * Implements UDP multicast discovery protocol for Govee devices
 * on the local network.
 *
 * @module govee/discovery
 */

import { DEFAULT_CONFIG, LAN_MSG_TYPE } from './types.js';

/**
 * GoveeDiscovery class handles device discovery via UDP multicast
 */
export class GoveeDiscovery {
  /**
   * @param {import('./types.js').GoveeDiscoveryOptions} options
   */
  constructor(options = {}) {
    this.options = {
      timeout: options.timeout || DEFAULT_CONFIG.DISCOVERY_TIMEOUT,
      multicastGroup: options.multicastGroup || DEFAULT_CONFIG.MULTICAST_GROUP,
      discoveryPort: options.discoveryPort || DEFAULT_CONFIG.DISCOVERY_PORT,
      responsePort: options.responsePort || DEFAULT_CONFIG.RESPONSE_PORT,
      broadcast: options.broadcast || false
    };

    this.devices = new Map();
    this.discoveryInProgress = false;
    this.socket = null;
  }

  /**
   * Discover Govee devices on the local network
   * @returns {Promise<Map<string, import('./types.js').GoveeDevice>>}
   */
  async discover() {
    if (this.discoveryInProgress) {
      console.log('[GoveeDiscovery] Discovery already in progress');
      return this.devices;
    }

    this.discoveryInProgress = true;
    this.devices.clear();

    console.log('[GoveeDiscovery] Starting device discovery...');
    console.log('[GoveeDiscovery] Options:', this.options);

    try {
      // Check if we're in Tauri environment
      // First try to import Tauri directly
      try {
        await import('@tauri-apps/api/core');
        console.log('[GoveeDiscovery] Tauri environment detected');
        return await this.discoverViaTauri();
      } catch (e) {
        // Not in Tauri or import failed
        console.log('[GoveeDiscovery] Tauri not available, using browser mode');
        return await this.discoverViaBrowser();
      }
    } finally {
      this.discoveryInProgress = false;
    }
  }

  /**
   * Discover devices using Tauri backend
   * @private
   */
  async discoverViaTauri() {
    try {
      const { invoke } = await import('@tauri-apps/api/core');

      // Call Rust backend for UDP discovery
      const response = await invoke('govee_discover_devices', {
        timeout: this.options.timeout,
        multicastGroup: this.options.multicastGroup,
        discoveryPort: this.options.discoveryPort,
        responsePort: this.options.responsePort
      });

      // Parse response and populate devices map
      if (response && Array.isArray(response)) {
        response.forEach(device => {
          this.devices.set(device.id, device);
        });
      }

      console.log(`[GoveeDiscovery] Found ${this.devices.size} devices via Tauri`);
      return this.devices;
    } catch (error) {
      console.error('[GoveeDiscovery] Tauri discovery failed:', error);
      throw error;
    }
  }

  /**
   * Discover devices using browser APIs (limited functionality)
   * This would require a WebSocket bridge server or similar
   * @private
   */
  async discoverViaBrowser() {
    console.warn('[GoveeDiscovery] Browser discovery requires WebSocket bridge');

    // Always return mock devices for testing
    // In production, this would connect to a WebSocket bridge
    return this.getMockDevices();
  }

  /**
   * Get mock devices for development
   * @private
   */
  getMockDevices() {
    const mockDevices = [
      {
        id: 'AA:BB:CC:DD:EE:01',
        name: 'Living Room Strip',
        model: 'H6159',
        ip: '192.168.1.100',
        lanApiEnabled: true,
        online: true,
        state: {
          on: true,
          brightness: 75,
          color: { r: 255, g: 128, b: 0 },
          colorTemperature: 4000,
          mode: 'normal'
        },
        capabilities: {
          powerControl: true,
          brightnessControl: true,
          colorControl: true,
          colorTemperatureControl: true,
          colorTemperatureRange: { min: 2000, max: 9000 },
          modes: ['normal', 'music', 'scene'],
          musicMode: true
        }
      },
      {
        id: 'AA:BB:CC:DD:EE:02',
        name: 'TV Backlight',
        model: 'H6199',
        ip: '192.168.1.101',
        lanApiEnabled: true,
        online: true,
        state: {
          on: false,
          brightness: 50,
          color: { r: 0, g: 0, b: 255 },
          colorTemperature: 5000,
          mode: 'normal'
        },
        capabilities: {
          powerControl: true,
          brightnessControl: true,
          colorControl: true,
          colorTemperatureControl: true,
          colorTemperatureRange: { min: 2000, max: 9000 },
          modes: ['normal', 'music', 'scene', 'diy'],
          musicMode: true
        }
      }
    ];

    mockDevices.forEach(device => {
      this.devices.set(device.id, device);
    });

    console.log(`[GoveeDiscovery] Loaded ${this.devices.size} mock devices`);
    return this.devices;
  }

  /**
   * Parse discovery response message
   * @param {Buffer|ArrayBuffer} message - Raw message data
   * @param {string} fromAddress - Source IP address
   * @private
   */
  parseDiscoveryResponse(message, fromAddress) {
    try {
      // Convert to string and parse JSON
      const data = typeof message === 'string'
        ? message
        : new TextDecoder().decode(message);

      const response = JSON.parse(data);

      if (response.msg && response.msg.cmd === LAN_MSG_TYPE.SCAN_RESPONSE) {
        const deviceData = response.msg.data;
        const device = {
          id: deviceData.device,
          name: deviceData.deviceName || 'Unknown Device',
          model: deviceData.sku || 'Unknown',
          ip: fromAddress,
          lanApiEnabled: true,
          online: deviceData.onOff !== undefined,
          state: {
            on: deviceData.onOff === 1,
            brightness: deviceData.brightness || 0,
            color: deviceData.color || { r: 255, g: 255, b: 255 },
            colorTemperature: deviceData.colorTemInKelvin || 5000,
            mode: deviceData.mode || 'normal'
          },
          capabilities: {
            powerControl: true,
            brightnessControl: true,
            colorControl: true,
            colorTemperatureControl: !!deviceData.colorTemInKelvin,
            colorTemperatureRange: { min: 2000, max: 9000 },
            modes: deviceData.modes || ['normal'],
            musicMode: deviceData.musicMode || false
          }
        };

        return device;
      }
    } catch (error) {
      console.error('[GoveeDiscovery] Failed to parse response:', error);
    }

    return null;
  }

  /**
   * Create discovery message
   * @private
   */
  createDiscoveryMessage() {
    return JSON.stringify({
      msg: {
        cmd: LAN_MSG_TYPE.SCAN,
        data: {
          account_topic: 'reserve'
        }
      }
    });
  }

  /**
   * Get discovered device by ID
   * @param {string} deviceId - Device ID
   * @returns {import('./types.js').GoveeDevice|null}
   */
  getDevice(deviceId) {
    return this.devices.get(deviceId) || null;
  }

  /**
   * Get all discovered devices
   * @returns {import('./types.js').GoveeDevice[]}
   */
  getAllDevices() {
    return Array.from(this.devices.values());
  }

  /**
   * Clear discovered devices
   */
  clearDevices() {
    this.devices.clear();
  }
}