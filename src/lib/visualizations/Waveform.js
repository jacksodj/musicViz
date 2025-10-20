/**
 * Waveform Visualization
 *
 * Renders time-domain waveform with mirror effect.
 * Optimized for 4K @ 60Hz performance.
 */
export class Waveform {
	constructor(ctx) {
		this.ctx = ctx;
		this.width = 0;
		this.height = 0;
		this.dpr = 1;
		this.renderCount = 0;
		console.log('[Waveform] Constructor called with ctx:', !!ctx);

		// Configuration
		this.lineWidth = 2; // Line thickness
		this.smoothing = 0.5; // Smoothing factor (0-1)
		this.amplification = 1.5; // Amplify waveform for better visibility
		this.mirrorEffect = true; // Enable top/bottom mirror
		this.glowEffect = true; // Enable glow

		// State arrays (reused to avoid GC)
		this.currentWaveform = null;
		this.targetWaveform = null;
		this.smoothedWaveform = null;

		// Color based on amplitude
		this.baseColor = { r: 0, g: 200, b: 255 }; // Cyan base color
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
		if (!audioData || !audioData.waveformData) {
			return;
		}

		this.targetWaveform = audioData.waveformData;

		// Initialize smoothed waveform on first update
		if (!this.smoothedWaveform || this.smoothedWaveform.length !== this.targetWaveform.length) {
			this.smoothedWaveform = new Float32Array(this.targetWaveform.length);
			for (let i = 0; i < this.targetWaveform.length; i++) {
				this.smoothedWaveform[i] = this.targetWaveform[i];
			}
		}

		// Smooth the waveform data
		for (let i = 0; i < this.targetWaveform.length; i++) {
			this.smoothedWaveform[i] +=
				(this.targetWaveform[i] - this.smoothedWaveform[i]) * (1 - this.smoothing);
		}
	}

	/**
	 * Render the visualization
	 */
	render() {
		this.renderCount++;

		const ctx = this.ctx;

		if (!ctx) {
			console.error('[Waveform] No context available!');
			return;
		}

		// Get actual canvas dimensions from the context's canvas
		const canvas = ctx.canvas;
		if (!canvas) {
			console.error('[Waveform] Context has no canvas!');
			return;
		}

		// Use actual canvas dimensions, not stored values
		const width = canvas.width;
		const height = canvas.height;

		if (this.renderCount <= 5 || this.renderCount % 100 === 0) {
			console.log(`[Waveform] render() #${this.renderCount}`);
			console.log('  - ctx valid:', !!ctx);
			console.log('  - canvas:', canvas);
			console.log('  - actual canvas width:', width, 'height:', height);
			console.log('  - stored width:', this.width, 'stored height:', this.height);
			console.log('  - canvas in DOM:', document.body.contains(canvas));
			console.log('  - smoothedWaveform:', this.smoothedWaveform ? this.smoothedWaveform.length : null);
		}

		if (width === 0 || height === 0) {
			console.warn('[Waveform] Canvas has zero dimensions, skipping render');
			return;
		}

		try {
			// Clear canvas with black background
			ctx.fillStyle = '#000000';
			ctx.fillRect(0, 0, width, height);

			if (this.renderCount <= 5) {
				console.log(`[Waveform] Successfully cleared canvas`);
			}

			if (!this.smoothedWaveform || this.smoothedWaveform.length === 0) {
				if (this.renderCount <= 5) {
					console.log('[Waveform] No smoothed waveform data yet');
				}
				return;
			}

		const centerY = height / 2;
		const waveformData = this.smoothedWaveform;
		const bufferLength = waveformData.length;
		const sliceWidth = width / bufferLength;

		// Calculate average amplitude for dynamic coloring
		let totalAmplitude = 0;
		for (let i = 0; i < bufferLength; i++) {
			const normalized = (waveformData[i] - 128) / 128;
			totalAmplitude += Math.abs(normalized);
		}
		const avgAmplitude = totalAmplitude / bufferLength;

		// Dynamic color based on amplitude
		const intensity = Math.min(avgAmplitude * 3, 1);
		const r = Math.floor(this.baseColor.r * intensity);
		const g = Math.floor(this.baseColor.g * intensity + (255 - this.baseColor.g) * (1 - intensity));
		const b = Math.floor(this.baseColor.b);

		const lineColor = `rgb(${r}, ${g}, ${b})`;

		// Render main waveform
		this.renderWaveformLine(ctx, waveformData, bufferLength, sliceWidth, centerY, lineColor, 1, height, width);

		// Render mirror effect
		if (this.mirrorEffect) {
			this.renderWaveformLine(ctx, waveformData, bufferLength, sliceWidth, centerY, lineColor, -1, height, width);
		}

		// Render center line
		ctx.strokeStyle = 'rgba(100, 100, 100, 0.3)';
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(0, centerY);
		ctx.lineTo(width, centerY);
		ctx.stroke();

			if (this.renderCount === 5) {
				console.log('[Waveform] First 5 renders completed successfully');
			}
		} catch (error) {
			console.error('[Waveform] Render error:', error);
			console.error('[Waveform] Error stack:', error.stack);
		}
	}

	/**
	 * Render a waveform line
	 * @param {CanvasRenderingContext2D} ctx
	 * @param {Float32Array|Uint8Array} data
	 * @param {number} length
	 * @param {number} sliceWidth
	 * @param {number} centerY
	 * @param {string} color
	 * @param {number} direction - 1 for normal, -1 for mirror
	 * @param {number} height - Actual canvas height
	 * @param {number} width - Actual canvas width
	 */
	renderWaveformLine(ctx, data, length, sliceWidth, centerY, color, direction, height, width) {
		const maxAmplitude = (height / 2) * 0.8; // Use 80% of half height

		// Setup line style (no dpr scaling needed since we're using actual canvas pixels)
		ctx.lineWidth = this.lineWidth;
		ctx.strokeStyle = color;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';

		// Add glow effect
		if (this.glowEffect) {
			ctx.shadowBlur = 15;
			ctx.shadowColor = color;
		}

		// Draw waveform
		ctx.beginPath();

		let x = 0;
		for (let i = 0; i < length; i++) {
			// Normalize to -1 to 1 range
			const normalized = ((data[i] - 128) / 128) * this.amplification;

			// Calculate y position
			const y = centerY + normalized * maxAmplitude * direction;

			if (i === 0) {
				ctx.moveTo(x, y);
			} else {
				ctx.lineTo(x, y);
			}

			x += sliceWidth;
		}

		ctx.stroke();

		// Reset shadow
		if (this.glowEffect) {
			ctx.shadowBlur = 0;
		}

		// Add subtle fill for better visibility
		if (direction === 1) {
			ctx.globalAlpha = 0.1;
			ctx.fillStyle = color;
			ctx.lineTo(width, centerY);
			ctx.lineTo(0, centerY);
			ctx.closePath();
			ctx.fill();
			ctx.globalAlpha = 1.0;
		}
	}

	/**
	 * Reset visualization state
	 */
	reset() {
		this.currentWaveform = null;
		this.targetWaveform = null;
		this.smoothedWaveform = null;
	}

	/**
	 * Get configuration for tweaking
	 */
	getConfig() {
		return {
			lineWidth: this.lineWidth,
			smoothing: this.smoothing,
			amplification: this.amplification,
			mirrorEffect: this.mirrorEffect,
			glowEffect: this.glowEffect,
			baseColor: { ...this.baseColor }
		};
	}

	/**
	 * Update configuration
	 */
	setConfig(config) {
		if (config.lineWidth !== undefined) this.lineWidth = config.lineWidth;
		if (config.smoothing !== undefined) this.smoothing = config.smoothing;
		if (config.amplification !== undefined) this.amplification = config.amplification;
		if (config.mirrorEffect !== undefined) this.mirrorEffect = config.mirrorEffect;
		if (config.glowEffect !== undefined) this.glowEffect = config.glowEffect;
		if (config.baseColor !== undefined) this.baseColor = { ...config.baseColor };
	}
}
