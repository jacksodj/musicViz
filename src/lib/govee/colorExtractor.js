/**
 * Color Extraction Module for Govee Sync
 *
 * Extracts dominant colors from canvas visualizations
 * for syncing with Govee lights.
 *
 * @module govee/colorExtractor
 */

import { rgbToHsv, hsvToRgb } from './types.js';

/**
 * ColorExtractor class handles color extraction from canvas
 */
export class ColorExtractor {
  constructor(options = {}) {
    this.options = {
      sampleRate: options.sampleRate || 30, // Hz
      extractionMode: options.extractionMode || 'zones', // 'dominant', 'average', 'zones'
      zoneCount: options.zoneCount || 4,
      smoothing: options.smoothing || 0.3,
      brightnessBoost: options.brightnessBoost || 1.2,
      saturationBoost: options.saturationBoost || 1.3,
      minBrightness: options.minBrightness || 20,
      maxBrightness: options.maxBrightness || 100
    };

    this.canvas = null;
    this.ctx = null;
    this.offscreenCanvas = null;
    this.offscreenCtx = null;
    this.previousColors = [];
    this.isExtracting = false;
    this.frameCount = 0;
  }

  /**
   * Initialize extractor with canvas element
   * @param {HTMLCanvasElement} canvas - Source canvas
   */
  initialize(canvas) {
    if (!canvas) {
      throw new Error('[ColorExtractor] Canvas element required');
    }

    this.canvas = canvas;

    // Check if this is a WebGL canvas
    this.isWebGL = !!(canvas.getContext('webgl') || canvas.getContext('webgl2') || canvas.getContext('experimental-webgl'));

    // For 2D canvas, get context for reading
    if (!this.isWebGL) {
      this.ctx = canvas.getContext('2d', { willReadFrequently: true });
    }

    // Create smaller offscreen canvas for performance
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCanvas.width = 64; // Small size for fast processing
    this.offscreenCanvas.height = 48;
    this.offscreenCtx = this.offscreenCanvas.getContext('2d', {
      willReadFrequently: true
    });

    // Initialize previous colors for smoothing
    const zoneCount = this.options.extractionMode === 'zones'
      ? this.options.zoneCount
      : 1;

    this.previousColors = Array(zoneCount).fill(null).map(() => ({
      r: 0, g: 0, b: 0
    }));

    console.log('[ColorExtractor] Initialized with canvas:', {
      width: canvas.width,
      height: canvas.height,
      mode: this.options.extractionMode,
      zones: zoneCount,
      isWebGL: this.isWebGL
    });
  }

  /**
   * Extract colors from current canvas frame
   * @returns {import('./types.js').RGBColor[]} Array of colors
   */
  extractColors() {
    if (!this.canvas) {
      console.warn('[ColorExtractor] Not initialized');
      return this.previousColors;
    }

    this.frameCount++;

    try {
      // For WebGL canvas, read pixels directly from framebuffer
      if (this.isWebGL) {
        const gl = this.canvas.getContext('webgl') || this.canvas.getContext('webgl2');
        if (!gl) {
          console.warn('[ColorExtractor] Failed to get WebGL context');
          return this.previousColors;
        }

        // Read pixels from WebGL framebuffer
        const pixels = new Uint8Array(this.canvas.width * this.canvas.height * 4);
        gl.readPixels(0, 0, this.canvas.width, this.canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

        // Create ImageData and draw to offscreen canvas
        const imageData = new ImageData(
          new Uint8ClampedArray(pixels.buffer),
          this.canvas.width,
          this.canvas.height
        );

        // Scale down to offscreen canvas
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.canvas.width;
        tempCanvas.height = this.canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.putImageData(imageData, 0, 0);

        // Draw scaled version to offscreen canvas
        this.offscreenCtx.drawImage(
          tempCanvas,
          0, 0,
          tempCanvas.width, tempCanvas.height,
          0, 0,
          this.offscreenCanvas.width,
          this.offscreenCanvas.height
        );
      } else {
        // For 2D canvas, draw directly
        if (!this.ctx) {
          console.warn('[ColorExtractor] No 2D context');
          return this.previousColors;
        }

        this.offscreenCtx.drawImage(
          this.canvas,
          0, 0,
          this.canvas.width, this.canvas.height,
          0, 0,
          this.offscreenCanvas.width,
          this.offscreenCanvas.height
        );
      }

      // Debug: Check what we're actually sampling
      if (this.frameCount % 30 === 0) {
        const testData = this.offscreenCtx.getImageData(0, 0, 10, 10);

        // Check multiple points across the canvas
        const centerX = Math.floor(this.offscreenCanvas.width / 2);
        const centerY = Math.floor(this.offscreenCanvas.height / 2);
        const centerData = this.offscreenCtx.getImageData(centerX, centerY, 1, 1).data;

        const sample = {
          topLeft: {r: testData.data[0], g: testData.data[1], b: testData.data[2]},
          center: {r: centerData[0], g: centerData[1], b: centerData[2]},
          canvasSize: `${this.canvas.width}x${this.canvas.height}`,
          offscreenSize: `${this.offscreenCanvas.width}x${this.offscreenCanvas.height}`
        };
        console.log('[ColorExtractor] Canvas sample at frame', this.frameCount, sample);
      }

      // Extract based on mode
      let colors;
      switch (this.options.extractionMode) {
        case 'dominant':
          colors = [this.extractDominantColor()];
          break;
        case 'average':
          colors = [this.extractAverageColor()];
          break;
        case 'zones':
          colors = this.extractZoneColors();
          break;
        default:
          colors = this.previousColors;
      }

      // Apply smoothing
      colors = this.applySmoothing(colors);

      // Apply color enhancements
      colors = this.enhanceColors(colors);

      // Store for next frame smoothing
      this.previousColors = colors;

      return colors;
    } catch (error) {
      console.error('[ColorExtractor] Extraction failed:', error);
      return this.previousColors;
    }
  }

  /**
   * Extract dominant color using color quantization
   * @private
   */
  extractDominantColor() {
    const imageData = this.offscreenCtx.getImageData(
      0, 0,
      this.offscreenCanvas.width,
      this.offscreenCanvas.height
    );

    const pixels = imageData.data;
    const colorMap = new Map();

    // Sample pixels and count colors (simplified quantization)
    for (let i = 0; i < pixels.length; i += 16) { // Sample every 4th pixel
      const r = Math.floor(pixels[i] / 32) * 32; // Quantize to reduce colors
      const g = Math.floor(pixels[i + 1] / 32) * 32;
      const b = Math.floor(pixels[i + 2] / 32) * 32;
      const a = pixels[i + 3];

      if (a > 128) { // Skip transparent pixels
        const key = `${r},${g},${b}`;
        colorMap.set(key, (colorMap.get(key) || 0) + 1);
      }
    }

    // Find most common color
    let maxCount = 0;
    let dominantColor = { r: 0, g: 0, b: 0 };

    for (const [colorKey, count] of colorMap.entries()) {
      if (count > maxCount) {
        maxCount = count;
        const [r, g, b] = colorKey.split(',').map(Number);
        dominantColor = { r, g, b };
      }
    }

    return dominantColor;
  }

  /**
   * Extract average color
   * @private
   */
  extractAverageColor() {
    const imageData = this.offscreenCtx.getImageData(
      0, 0,
      this.offscreenCanvas.width,
      this.offscreenCanvas.height
    );

    const pixels = imageData.data;
    let r = 0, g = 0, b = 0;
    let count = 0;

    for (let i = 0; i < pixels.length; i += 4) {
      const alpha = pixels[i + 3];
      if (alpha > 128) { // Skip transparent pixels
        r += pixels[i];
        g += pixels[i + 1];
        b += pixels[i + 2];
        count++;
      }
    }

    if (count === 0) {
      return { r: 0, g: 0, b: 0 };
    }

    return {
      r: Math.round(r / count),
      g: Math.round(g / count),
      b: Math.round(b / count)
    };
  }

  /**
   * Extract colors from zones
   * @private
   */
  extractZoneColors() {
    const colors = [];
    const zoneWidth = this.offscreenCanvas.width / this.options.zoneCount;

    for (let z = 0; z < this.options.zoneCount; z++) {
      const x = Math.floor(z * zoneWidth);
      const width = Math.floor(zoneWidth);

      const imageData = this.offscreenCtx.getImageData(
        x, 0,
        width, this.offscreenCanvas.height
      );

      const pixels = imageData.data;
      let r = 0, g = 0, b = 0;
      let count = 0;

      // Calculate average for this zone
      for (let i = 0; i < pixels.length; i += 8) { // Sample every other pixel
        const alpha = pixels[i + 3];
        if (alpha > 128) {
          r += pixels[i];
          g += pixels[i + 1];
          b += pixels[i + 2];
          count++;
        }
      }

      if (count > 0) {
        colors.push({
          r: Math.round(r / count),
          g: Math.round(g / count),
          b: Math.round(b / count)
        });
      } else {
        colors.push({ r: 0, g: 0, b: 0 });
      }
    }

    return colors;
  }

  /**
   * Apply temporal smoothing to colors
   * @private
   */
  applySmoothing(colors) {
    const smoothing = this.options.smoothing;

    return colors.map((color, i) => {
      const prev = this.previousColors[i];
      if (!prev) return color;

      return {
        r: Math.round(prev.r * smoothing + color.r * (1 - smoothing)),
        g: Math.round(prev.g * smoothing + color.g * (1 - smoothing)),
        b: Math.round(prev.b * smoothing + color.b * (1 - smoothing))
      };
    });
  }

  /**
   * Enhance colors for better light output
   * @private
   */
  enhanceColors(colors) {
    return colors.map(color => {
      // Convert to HSV for manipulation
      const hsv = rgbToHsv(color);

      // Boost saturation
      hsv.s = Math.min(100, hsv.s * this.options.saturationBoost);

      // Boost and clamp brightness
      hsv.v = Math.max(
        this.options.minBrightness,
        Math.min(
          this.options.maxBrightness,
          hsv.v * this.options.brightnessBoost
        )
      );

      // Convert back to RGB
      return hsvToRgb(hsv);
    });
  }

  /**
   * Get colors for specific audio features
   * @param {Object} audioFeatures - Audio analysis features
   * @returns {import('./types.js').RGBColor[]}
   */
  getAudioReactiveColors(audioFeatures = {}) {
    const baseColors = this.extractColors();

    if (!audioFeatures || Object.keys(audioFeatures).length === 0) {
      return baseColors;
    }

    // Modulate colors based on audio
    return baseColors.map(color => {
      const hsv = rgbToHsv(color);

      // Modulate brightness with energy
      if (audioFeatures.energy !== undefined) {
        hsv.v = Math.min(100, hsv.v * (0.5 + audioFeatures.energy * 0.5));
      }

      // Shift hue slightly with pitch
      if (audioFeatures.pitch !== undefined) {
        hsv.h = (hsv.h + audioFeatures.pitch * 30) % 360;
      }

      // Pulse saturation with beat
      if (audioFeatures.isBeat) {
        hsv.s = Math.min(100, hsv.s * 1.5);
        hsv.v = Math.min(100, hsv.v * 1.3);
      }

      return hsvToRgb(hsv);
    });
  }

  /**
   * Start continuous extraction
   * @param {Function} callback - Called with extracted colors
   */
  startExtraction(callback) {
    if (this.isExtracting) {
      console.warn('[ColorExtractor] Already extracting');
      return;
    }

    this.isExtracting = true;
    const interval = 1000 / this.options.sampleRate;

    const extract = () => {
      if (!this.isExtracting) return;

      const colors = this.extractColors();
      if (callback) {
        callback(colors);
      }

      setTimeout(extract, interval);
    };

    extract();
    console.log(`[ColorExtractor] Started extraction at ${this.options.sampleRate}Hz`);
  }

  /**
   * Stop continuous extraction
   */
  stopExtraction() {
    this.isExtracting = false;
    console.log('[ColorExtractor] Stopped extraction');
  }

  /**
   * Get extraction statistics
   */
  getStats() {
    return {
      frameCount: this.frameCount,
      mode: this.options.extractionMode,
      sampleRate: this.options.sampleRate,
      isExtracting: this.isExtracting
    };
  }

  /**
   * Reset extractor state
   */
  reset() {
    this.previousColors = this.previousColors.map(() => ({
      r: 0, g: 0, b: 0
    }));
    this.frameCount = 0;
  }
}