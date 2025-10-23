/**
 * Govee Integration Type Definitions
 *
 * @module govee/types
 */

/**
 * @typedef {Object} GoveeDevice
 * @property {string} id - Device ID (MAC address format)
 * @property {string} name - Device friendly name
 * @property {string} model - Device model number
 * @property {string} ip - Device IP address (for LAN API)
 * @property {boolean} lanApiEnabled - Whether LAN API is enabled
 * @property {boolean} online - Device online status
 * @property {GoveeDeviceState} state - Current device state
 * @property {GoveeCapabilities} capabilities - Device capabilities
 */

/**
 * @typedef {Object} GoveeDeviceState
 * @property {boolean} on - Power state
 * @property {number} brightness - Brightness (0-100)
 * @property {RGBColor} color - Current color
 * @property {number} colorTemperature - Color temperature in Kelvin
 * @property {string} mode - Current mode/scene
 */

/**
 * @typedef {Object} GoveeCapabilities
 * @property {boolean} powerControl - Can turn on/off
 * @property {boolean} brightnessControl - Can adjust brightness
 * @property {boolean} colorControl - Can set RGB color
 * @property {boolean} colorTemperatureControl - Can set color temperature
 * @property {Object} colorTemperatureRange - Min/max color temperature
 * @property {string[]} modes - Available modes/scenes
 * @property {boolean} musicMode - Supports music sync
 */

/**
 * @typedef {Object} RGBColor
 * @property {number} r - Red (0-255)
 * @property {number} g - Green (0-255)
 * @property {number} b - Blue (0-255)
 */

/**
 * @typedef {Object} HSVColor
 * @property {number} h - Hue (0-360)
 * @property {number} s - Saturation (0-100)
 * @property {number} v - Value/Brightness (0-100)
 */

/**
 * @typedef {Object} GoveeCommand
 * @property {string} cmd - Command type ('turn', 'brightness', 'color', 'colorTem')
 * @property {Object} data - Command data
 */

/**
 * @typedef {Object} GoveeDiscoveryOptions
 * @property {number} timeout - Discovery timeout in ms (default 5000)
 * @property {string} multicastGroup - Multicast group IP (default '239.255.255.250')
 * @property {number} discoveryPort - Discovery port (default 4001)
 * @property {number} responsePort - Response port (default 4002)
 * @property {boolean} broadcast - Use broadcast instead of multicast
 */

/**
 * @typedef {Object} GoveeSyncOptions
 * @property {number} sampleRate - Color sampling rate in Hz (default 30)
 * @property {string} extractionMode - 'dominant' | 'average' | 'zones'
 * @property {number} smoothing - Smoothing factor (0-1, default 0.3)
 * @property {number} latencyCompensation - Latency compensation in ms
 * @property {number} brightnessBoost - Brightness multiplier (default 1.0)
 * @property {boolean} beatReactive - React to beat detection
 */

/**
 * @typedef {Object} GoveeScene
 * @property {string} id - Scene ID
 * @property {string} name - Scene name
 * @property {GoveeKeyframe[]} keyframes - Animation keyframes
 * @property {number} duration - Total duration in ms
 * @property {boolean} loop - Whether to loop
 */

/**
 * @typedef {Object} GoveeKeyframe
 * @property {number} time - Time in ms
 * @property {RGBColor} color - Color at this keyframe
 * @property {number} brightness - Brightness at this keyframe
 * @property {string} transition - Transition type ('linear', 'ease', 'step')
 */

/**
 * LAN API Message Types
 */
export const LAN_MSG_TYPE = {
  SCAN: 'scan',
  SCAN_RESPONSE: 'devStatus',
  STATUS: 'devStatus',
  STATUS_UPDATE: 'statusUpdate'
};

/**
 * LAN API Commands (these go directly in msg.cmd)
 */
export const LAN_CMD = {
  TURN: 'turn',
  BRIGHTNESS: 'brightness',
  COLORWC: 'colorwc'  // Color and color temperature combined
};

/**
 * Cloud API Endpoints
 */
export const CLOUD_API = {
  BASE_URL: 'https://developer-api.govee.com/v1',
  DEVICES: '/devices',
  CONTROL: '/devices/control',
  STATE: '/devices/state'
};

/**
 * Default Configuration
 */
export const DEFAULT_CONFIG = {
  DISCOVERY_TIMEOUT: 5000,
  MULTICAST_GROUP: '239.255.255.250',
  DISCOVERY_PORT: 4001,
  RESPONSE_PORT: 4002,
  CONTROL_PORT: 4003,
  MAX_RETRIES: 3,
  RETRY_DELAY: 500,
  RATE_LIMIT_DELAY: 600, // 100 requests per minute = 600ms between requests
  COLOR_SAMPLE_RATE: 30,
  SMOOTHING_FACTOR: 0.3,
  LATENCY_COMPENSATION: 50
};

/**
 * Convert RGB to HSV
 * @param {RGBColor} rgb - RGB color
 * @returns {HSVColor} HSV color
 */
export function rgbToHsv(rgb) {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === r) {
      h = ((g - b) / delta) % 6;
    } else if (max === g) {
      h = (b - r) / delta + 2;
    } else {
      h = (r - g) / delta + 4;
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }

  const s = max === 0 ? 0 : Math.round((delta / max) * 100);
  const v = Math.round(max * 100);

  return { h, s, v };
}

/**
 * Convert HSV to RGB
 * @param {HSVColor} hsv - HSV color
 * @returns {RGBColor} RGB color
 */
export function hsvToRgb(hsv) {
  const h = hsv.h / 360;
  const s = hsv.s / 100;
  const v = hsv.v / 100;

  let r, g, b;

  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  switch (i % 6) {
    case 0: [r, g, b] = [v, t, p]; break;
    case 1: [r, g, b] = [q, v, p]; break;
    case 2: [r, g, b] = [p, v, t]; break;
    case 3: [r, g, b] = [p, q, v]; break;
    case 4: [r, g, b] = [t, p, v]; break;
    case 5: [r, g, b] = [v, p, q]; break;
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
}