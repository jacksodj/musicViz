/**
 * SpectrumBars Visualization
 *
 * Renders frequency spectrum as vertical bars with color gradient.
 * Optimized for 4K @ 60Hz performance.
 */
export class SpectrumBars {
	constructor(ctx) {
		this.ctx = ctx;
		this.width = 0;
		this.height = 0;
		this.dpr = 1;

		// Configuration
		this.barCount = 128; // Number of frequency bars
		this.barSpacing = 2; // Pixels between bars
		this.smoothing = 0.7; // Smoothing factor (0-1, higher = smoother)
		this.minDb = -90; // Minimum decibel level
		this.maxDb = -10; // Maximum decibel level

		// State arrays (reused to avoid GC)
		this.currentValues = new Float32Array(this.barCount);
		this.targetValues = new Float32Array(this.barCount);
		this.colors = new Array(this.barCount);

		// Pre-calculate colors for performance
		this.precalculateColors();
	}

	/**
	 * Pre-calculate color gradient for all bars
	 * Low frequencies = Red, Mid = Green, High = Blue
	 */
	precalculateColors() {
		for (let i = 0; i < this.barCount; i++) {
			const t = i / (this.barCount - 1);

			// Create smooth gradient across frequency spectrum
			let r, g, b;

			if (t < 0.5) {
				// Red to Green (low to mid frequencies)
				const segment = t * 2;
				r = Math.floor(255 * (1 - segment));
				g = Math.floor(255 * segment);
				b = 0;
			} else {
				// Green to Blue (mid to high frequencies)
				const segment = (t - 0.5) * 2;
				r = 0;
				g = Math.floor(255 * (1 - segment));
				b = Math.floor(255 * segment);
			}

			this.colors[i] = `rgb(${r}, ${g}, ${b})`;
		}
	}

	/**
	 * Handle canvas resize
	 */
	resize(width, height, dpr) {
		this.width = width;
		this.height = height;
		this.dpr = dpr;
	}

	/**
	 * Update with new audio data
	 * @param {Object} audioData - { frequencyData: Uint8Array, waveformData: Uint8Array }
	 */
	update(audioData) {
		if (!audioData || !audioData.frequencyData) {
			return;
		}

		const frequencyData = audioData.frequencyData;
		const dataLength = frequencyData.length;

		// Map frequency data to bar count
		// Group multiple frequency bins into single bars
		const binsPerBar = Math.floor(dataLength / this.barCount);

		for (let i = 0; i < this.barCount; i++) {
			let sum = 0;
			const startBin = i * binsPerBar;
			const endBin = Math.min(startBin + binsPerBar, dataLength);

			// Average frequency bins for this bar
			for (let j = startBin; j < endBin; j++) {
				sum += frequencyData[j];
			}

			// Normalize to 0-1 range
			const average = sum / (endBin - startBin);
			this.targetValues[i] = average / 255;

			// Apply exponential scaling for better visual dynamics
			this.targetValues[i] = Math.pow(this.targetValues[i], 1.5);
		}
	}

	/**
	 * Render the visualization
	 */
	render() {
		const ctx = this.ctx;
		const width = this.width;
		const height = this.height;

		// Clear canvas with black background
		ctx.fillStyle = '#000000';
		ctx.fillRect(0, 0, width, height);

		// Calculate bar width
		const totalSpacing = this.barSpacing * (this.barCount - 1) * this.dpr;
		const availableWidth = width - totalSpacing;
		const barWidth = availableWidth / this.barCount;

		if (barWidth < 1) {
			// Too many bars for this width, skip rendering
			return;
		}

		// Smooth transitions between frames
		for (let i = 0; i < this.barCount; i++) {
			this.currentValues[i] += (this.targetValues[i] - this.currentValues[i]) * (1 - this.smoothing);
		}

		// Render bars
		for (let i = 0; i < this.barCount; i++) {
			const barHeight = this.currentValues[i] * height;
			const x = i * (barWidth + this.barSpacing * this.dpr);
			const y = height - barHeight;

			// Draw bar
			ctx.fillStyle = this.colors[i];
			ctx.fillRect(x, y, barWidth, barHeight);

			// Add subtle glow effect for active bars
			if (this.currentValues[i] > 0.1) {
				ctx.shadowBlur = 10 * this.dpr;
				ctx.shadowColor = this.colors[i];
				ctx.fillRect(x, y, barWidth, barHeight);
				ctx.shadowBlur = 0;
			}
		}

		// Add reflection effect at bottom
		this.renderReflection(width, height, barWidth);
	}

	/**
	 * Render subtle reflection effect
	 */
	renderReflection(width, height, barWidth) {
		const ctx = this.ctx;
		const reflectionHeight = height * 0.3;
		const reflectionAlpha = 0.3;

		ctx.save();
		ctx.globalAlpha = reflectionAlpha;
		ctx.translate(0, height);
		ctx.scale(1, -1);

		// Create gradient mask for reflection
		const gradient = ctx.createLinearGradient(0, 0, 0, reflectionHeight);
		gradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
		gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

		ctx.globalCompositeOperation = 'source-atop';
		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, width, reflectionHeight);

		ctx.restore();
	}

	/**
	 * Reset visualization state
	 */
	reset() {
		this.currentValues.fill(0);
		this.targetValues.fill(0);
	}

	/**
	 * Get configuration for tweaking
	 */
	getConfig() {
		return {
			barCount: this.barCount,
			barSpacing: this.barSpacing,
			smoothing: this.smoothing,
			minDb: this.minDb,
			maxDb: this.maxDb
		};
	}

	/**
	 * Update configuration
	 */
	setConfig(config) {
		if (config.barCount !== undefined && config.barCount !== this.barCount) {
			this.barCount = config.barCount;
			this.currentValues = new Float32Array(this.barCount);
			this.targetValues = new Float32Array(this.barCount);
			this.colors = new Array(this.barCount);
			this.precalculateColors();
		}

		if (config.barSpacing !== undefined) this.barSpacing = config.barSpacing;
		if (config.smoothing !== undefined) this.smoothing = config.smoothing;
		if (config.minDb !== undefined) this.minDb = config.minDb;
		if (config.maxDb !== undefined) this.maxDb = config.maxDb;
	}
}
