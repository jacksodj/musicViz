/**
 * Govee LAN API Communication Module
 *
 * Handles direct communication with Govee devices via UDP
 * for low-latency local control.
 *
 * @module govee/lanApi
 */

import { LAN_CMD, LAN_MSG_TYPE, DEFAULT_CONFIG } from './types.js';

/**
 * GoveeLanApi class handles LAN API communication
 */
export class GoveeLanApi {
  constructor() {
    this.retryCount = DEFAULT_CONFIG.MAX_RETRIES;
    this.retryDelay = DEFAULT_CONFIG.RETRY_DELAY;
  }

  /**
   * Send command to device via LAN API
   * @param {string} deviceIp - Device IP address
   * @param {string} deviceId - Device ID (MAC address)
   * @param {import('./types.js').GoveeCommand} command - Command to send
   * @returns {Promise<boolean>} Success status
   */
  async sendCommand(deviceIp, deviceId, command) {
    console.log(`[GoveeLanApi] Sending command to ${deviceId} at ${deviceIp}:`, command);

    const message = this.buildCommandMessage(deviceId, command);

    try {
      // Check if Tauri is available
      try {
        await import('@tauri-apps/api/core');
        // Use Tauri backend for UDP
        return await this.sendViaTauri(deviceIp, message);
      } catch (e) {
        // Browser fallback
        return await this.sendViaBrowser(deviceIp, message);
      }
    } catch (error) {
      console.error('[GoveeLanApi] Command failed:', error);
      throw error;
    }
  }

  /**
   * Turn device on/off
   * @param {string} deviceIp - Device IP address
   * @param {string} deviceId - Device ID
   * @param {boolean} on - Power state
   * @returns {Promise<boolean>}
   */
  async setPower(deviceIp, deviceId, on) {
    return this.sendCommand(deviceIp, deviceId, {
      cmd: LAN_CMD.TURN,
      data: {
        value: on ? 1 : 0
      }
    });
  }

  /**
   * Set device brightness
   * @param {string} deviceIp - Device IP address
   * @param {string} deviceId - Device ID
   * @param {number} brightness - Brightness (0-100)
   * @returns {Promise<boolean>}
   */
  async setBrightness(deviceIp, deviceId, brightness) {
    // Ensure brightness is within valid range
    brightness = Math.max(0, Math.min(100, brightness));

    return this.sendCommand(deviceIp, deviceId, {
      cmd: LAN_CMD.BRIGHTNESS,
      data: {
        value: brightness
      }
    });
  }

  /**
   * Set device color
   * @param {string} deviceIp - Device IP address
   * @param {string} deviceId - Device ID
   * @param {import('./types.js').RGBColor} color - RGB color
   * @returns {Promise<boolean>}
   */
  async setColor(deviceIp, deviceId, color) {
    // Ensure color values are within valid range
    const r = Math.max(0, Math.min(255, Math.round(color.r)));
    const g = Math.max(0, Math.min(255, Math.round(color.g)));
    const b = Math.max(0, Math.min(255, Math.round(color.b)));

    return this.sendCommand(deviceIp, deviceId, {
      cmd: LAN_CMD.COLORWC,
      data: {
        color: {
          r,
          g,
          b
        }
      }
    });
  }

  /**
   * Set device color temperature
   * @param {string} deviceIp - Device IP address
   * @param {string} deviceId - Device ID
   * @param {number} temperature - Color temperature in Kelvin (2000-9000)
   * @returns {Promise<boolean>}
   */
  async setColorTemperature(deviceIp, deviceId, temperature) {
    // Ensure temperature is within valid range
    temperature = Math.max(2000, Math.min(9000, Math.round(temperature)));

    return this.sendCommand(deviceIp, deviceId, {
      cmd: LAN_CMD.COLORWC,
      data: {
        colorTemInKelvin: temperature
      }
    });
  }

  /**
   * Get device status
   * @param {string} deviceIp - Device IP address
   * @param {string} deviceId - Device ID
   * @returns {Promise<import('./types.js').GoveeDeviceState|null>}
   */
  async getStatus(deviceIp, deviceId) {
    const message = JSON.stringify({
      msg: {
        cmd: LAN_MSG_TYPE.STATUS,
        data: {
          device: deviceId
        }
      }
    });

    try {
      let response;
      try {
        await import('@tauri-apps/api/core');
        response = await this.sendViaTauri(deviceIp, message, true);
      } catch (e) {
        response = await this.sendViaBrowser(deviceIp, message, true);
      }

      if (response) {
        return this.parseStatusResponse(response);
      }
    } catch (error) {
      console.error('[GoveeLanApi] Failed to get status:', error);
    }

    return null;
  }

  /**
   * Build command message
   * @private
   */
  buildCommandMessage(deviceId, command) {
    // Commands are sent directly without device field or wrapper
    // Format: {"msg":{"cmd":"turn","data":{"value":1}}}
    const message = {
      msg: {
        cmd: command.cmd,
        data: command.data
      }
    };

    return JSON.stringify(message);
  }

  /**
   * Parse status response
   * @private
   */
  parseStatusResponse(response) {
    try {
      const data = typeof response === 'string'
        ? JSON.parse(response)
        : response;

      if (data.msg && data.msg.cmd === LAN_MSG_TYPE.STATUS_UPDATE) {
        const status = data.msg.data;
        return {
          on: status.onOff === 1,
          brightness: status.brightness || 0,
          color: status.color || { r: 255, g: 255, b: 255 },
          colorTemperature: status.colorTemInKelvin || 5000,
          mode: status.mode || 'normal'
        };
      }
    } catch (error) {
      console.error('[GoveeLanApi] Failed to parse status:', error);
    }

    return null;
  }

  /**
   * Send via Tauri backend
   * @private
   */
  async sendViaTauri(deviceIp, message, expectResponse = false) {
    const { invoke } = await import('@tauri-apps/api/core');

    return invoke('govee_send_lan_command', {
      deviceIp,
      message,
      expectResponse,
      port: DEFAULT_CONFIG.CONTROL_PORT
    });
  }

  /**
   * Send via browser (requires WebSocket bridge)
   * @private
   */
  async sendViaBrowser(deviceIp, message, expectResponse = false) {
    if (import.meta.env.DEV) {
      // Simulate success in development
      console.log(`[GoveeLanApi] Mock send to ${deviceIp}:`, message);
      return true;
    }

    console.warn('[GoveeLanApi] Browser sending requires WebSocket bridge');
    return false;
  }

  /**
   * Send batch commands with minimal delay
   * @param {Array<{ip: string, id: string, command: import('./types.js').GoveeCommand}>} commands
   * @returns {Promise<boolean[]>}
   */
  async sendBatch(commands) {
    const results = [];

    for (const { ip, id, command } of commands) {
      try {
        const success = await this.sendCommand(ip, id, command);
        results.push(success);

        // Small delay between commands to avoid overwhelming devices
        await this.delay(50);
      } catch (error) {
        console.error(`[GoveeLanApi] Batch command failed for ${id}:`, error);
        results.push(false);
      }
    }

    return results;
  }

  /**
   * Helper delay function
   * @private
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}