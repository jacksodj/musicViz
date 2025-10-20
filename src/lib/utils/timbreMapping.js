// Timbre to Visual Properties Mapping
// Maps 12-dimensional timbre vector to colors, shapes, and visual properties

/**
 * Normalize a value from a range to 0-1
 * @param {number} value - Input value
 * @param {number} min - Minimum of range
 * @param {number} max - Maximum of range
 * @returns {number} Normalized value (0-1)
 */
function normalize(value, min = -50, max = 50) {
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

/**
 * Map timbre vector to HSL color
 * Timbre is a 12-dimensional vector roughly centered around 0
 * Values typically range from -50 to +50
 *
 * @param {Array<number>} timbreVector - 12-dimensional timbre array
 * @returns {string} HSL color string
 */
export function timbreToColor(timbreVector) {
  if (!timbreVector || timbreVector.length !== 12) {
    return 'hsl(200, 50%, 50%)'; // Default blue
  }

  // Map timbre dimensions to color components
  // Dimensions 0-3 → Hue (0-360°)
  const hueAvg = (timbreVector[0] + timbreVector[1] + timbreVector[2] + timbreVector[3]) / 4;
  const hue = normalize(hueAvg, -50, 50) * 360;

  // Dimensions 4-7 → Saturation (40-100%)
  const satAvg = (timbreVector[4] + timbreVector[5] + timbreVector[6] + timbreVector[7]) / 4;
  const saturation = normalize(satAvg, -50, 50) * 60 + 40;

  // Dimensions 8-11 → Lightness (30-70%)
  const lightAvg = (timbreVector[8] + timbreVector[9] + timbreVector[10] + timbreVector[11]) / 4;
  const lightness = normalize(lightAvg, -50, 50) * 40 + 30;

  return `hsl(${Math.round(hue)}, ${Math.round(saturation)}%, ${Math.round(lightness)}%)`;
}

/**
 * Map timbre vector to RGB color
 * @param {Array<number>} timbreVector - 12-dimensional timbre array
 * @returns {Object} {r, g, b} object with values 0-255
 */
export function timbreToRGB(timbreVector) {
  if (!timbreVector || timbreVector.length !== 12) {
    return { r: 100, g: 150, b: 200 };
  }

  // Map different timbre dimensions to RGB channels
  const r = normalize(timbreVector[0] + timbreVector[3] + timbreVector[6], -150, 150) * 255;
  const g = normalize(timbreVector[1] + timbreVector[4] + timbreVector[7], -150, 150) * 255;
  const b = normalize(timbreVector[2] + timbreVector[5] + timbreVector[8], -150, 150) * 255;

  return {
    r: Math.round(r),
    g: Math.round(g),
    b: Math.round(b)
  };
}

/**
 * Map timbre to brightness/intensity (0-1)
 * Uses the magnitude of the timbre vector
 *
 * @param {Array<number>} timbreVector - 12-dimensional timbre array
 * @returns {number} Brightness value 0-1
 */
export function timbreToBrightness(timbreVector) {
  if (!timbreVector || timbreVector.length !== 12) {
    return 0.5;
  }

  // Calculate magnitude of timbre vector
  const magnitude = Math.sqrt(
    timbreVector.reduce((sum, val) => sum + val * val, 0)
  );

  // Normalize to 0-1 (typical magnitude is 0-200)
  return normalize(magnitude, 0, 200);
}

/**
 * Map timbre to visual complexity/detail (0-1)
 * Uses variance in timbre components
 *
 * @param {Array<number>} timbreVector - 12-dimensional timbre array
 * @returns {number} Complexity value 0-1
 */
export function timbreToComplexity(timbreVector) {
  if (!timbreVector || timbreVector.length !== 12) {
    return 0.5;
  }

  // Calculate variance
  const mean = timbreVector.reduce((sum, val) => sum + val, 0) / 12;
  const variance = timbreVector.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / 12;
  const stdDev = Math.sqrt(variance);

  // Normalize (typical std dev is 0-50)
  return normalize(stdDev, 0, 50);
}

/**
 * Map timbre to particle count for particle visualizations
 * @param {Array<number>} timbreVector - 12-dimensional timbre array
 * @param {number} minCount - Minimum particle count
 * @param {number} maxCount - Maximum particle count
 * @returns {number} Number of particles to render
 */
export function timbreToParticleCount(timbreVector, minCount = 50, maxCount = 500) {
  const complexity = timbreToComplexity(timbreVector);
  const brightness = timbreToBrightness(timbreVector);

  // Combine complexity and brightness
  const density = (complexity * 0.6 + brightness * 0.4);

  return Math.round(minCount + density * (maxCount - minCount));
}

/**
 * Map timbre to rotation speed (radians per second)
 * @param {Array<number>} timbreVector - 12-dimensional timbre array
 * @returns {number} Rotation speed in radians/second
 */
export function timbreToRotationSpeed(timbreVector) {
  if (!timbreVector || timbreVector.length !== 12) {
    return 0;
  }

  // Use first few dimensions for rotation direction and speed
  const rotationFactor = (timbreVector[0] + timbreVector[1]) / 2;

  // Map to -π to +π radians/second
  return normalize(rotationFactor, -50, 50) * 2 * Math.PI - Math.PI;
}

/**
 * Map timbre to scale factor for sizing visualizations
 * @param {Array<number>} timbreVector - 12-dimensional timbre array
 * @param {number} baseScale - Base scale value
 * @returns {number} Scale multiplier
 */
export function timbreToScale(timbreVector, baseScale = 1.0) {
  const brightness = timbreToBrightness(timbreVector);

  // Scale from 0.5x to 2x based on brightness
  return baseScale * (0.5 + brightness * 1.5);
}

/**
 * Create a color palette from segment timbre
 * Returns an array of complementary colors based on the timbre
 *
 * @param {Array<number>} timbreVector - 12-dimensional timbre array
 * @param {number} colorCount - Number of colors to generate
 * @returns {Array<string>} Array of HSL color strings
 */
export function timbreToPalette(timbreVector, colorCount = 5) {
  if (!timbreVector || timbreVector.length !== 12) {
    return ['hsl(200, 50%, 50%)'];
  }

  const baseColor = timbreToColor(timbreVector);
  const [h, s, l] = baseColor.match(/\d+/g).map(Number);

  const palette = [baseColor];

  // Generate complementary colors by rotating hue
  for (let i = 1; i < colorCount; i++) {
    const hueShift = (360 / colorCount) * i;
    const newHue = (h + hueShift) % 360;
    palette.push(`hsl(${Math.round(newHue)}, ${s}%, ${l}%)`);
  }

  return palette;
}

/**
 * Interpolate between two timbre-derived colors
 * @param {Array<number>} timbre1 - First timbre vector
 * @param {Array<number>} timbre2 - Second timbre vector
 * @param {number} t - Interpolation factor (0-1)
 * @returns {string} Interpolated HSL color
 */
export function interpolateTimbreColors(timbre1, timbre2, t) {
  if (!timbre1 || !timbre2) {
    return 'hsl(200, 50%, 50%)';
  }

  // Interpolate timbre vectors
  const interpolatedTimbre = timbre1.map((val, i) =>
    val * (1 - t) + timbre2[i] * t
  );

  return timbreToColor(interpolatedTimbre);
}

/**
 * Get visual properties object from timbre
 * Convenience function that returns all mapped properties at once
 *
 * @param {Array<number>} timbreVector - 12-dimensional timbre array
 * @returns {Object} Object with all visual properties
 */
export function getTimbreVisuals(timbreVector) {
  return {
    color: timbreToColor(timbreVector),
    rgb: timbreToRGB(timbreVector),
    brightness: timbreToBrightness(timbreVector),
    complexity: timbreToComplexity(timbreVector),
    particleCount: timbreToParticleCount(timbreVector),
    rotationSpeed: timbreToRotationSpeed(timbreVector),
    scale: timbreToScale(timbreVector),
    palette: timbreToPalette(timbreVector)
  };
}
