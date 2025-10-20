/**
 * @typedef {Object} AudioData
 * @property {Uint8Array} frequencyData - Frequency domain data (0-255)
 * @property {Uint8Array} waveformData - Time domain data (0-255)
 */

/**
 * @typedef {Object} VisualizationConfig
 * @property {number} [barCount] - Number of bars for spectrum visualization
 * @property {number} [barSpacing] - Spacing between bars in pixels
 * @property {number} [smoothing] - Smoothing factor (0-1)
 * @property {number} [lineWidth] - Line width for waveform
 * @property {number} [amplification] - Amplification factor
 * @property {boolean} [mirrorEffect] - Enable mirror effect
 * @property {boolean} [glowEffect] - Enable glow effect
 * @property {ColorRGB} [baseColor] - Base color for visualization
 */

/**
 * @typedef {Object} ColorRGB
 * @property {number} r - Red component (0-255)
 * @property {number} g - Green component (0-255)
 * @property {number} b - Blue component (0-255)
 */

/**
 * @typedef {Object} PerformanceStats
 * @property {number} fps - Current frames per second
 * @property {number} avgFrameTime - Average frame time in milliseconds
 * @property {boolean} isRunning - Whether render loop is running
 * @property {string} activeType - Active visualization type name
 * @property {number} width - Canvas width in pixels
 * @property {number} height - Canvas height in pixels
 * @property {number} dpr - Device pixel ratio
 * @property {number} budgetUtilization - Frame time budget utilization percentage
 */

/**
 * @typedef {Object} IVisualization
 * @property {function(number, number, number): void} resize - Handle canvas resize
 * @property {function(AudioData): void} update - Update with new audio data
 * @property {function(): void} render - Render the visualization
 * @property {function(): void} reset - Reset visualization state
 * @property {function(): VisualizationConfig} [getConfig] - Get current configuration
 * @property {function(VisualizationConfig): void} [setConfig] - Set configuration
 */

export {};
