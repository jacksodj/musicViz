import { SpectrumBars } from '$lib/visualizations/SpectrumBars.js';
import { Waveform } from '$lib/visualizations/Waveform.js';

/**
 * VisualizationManager
 *
 * Manages visualization rendering, animation loop, and FPS tracking.
 * Optimized for 60fps @ 4K resolution.
 */
export class VisualizationManager {
	constructor(ctx) {
		this.ctx = ctx;
		this.width = 0;
		this.height = 0;
		this.dpr = 1;

		// Animation state
		this.isRunning = false;
		this.rafId = null;
		this.lastFrameTime = 0;
		this.frameCount = 0;
		this.fps = 60;
		this.fpsUpdateInterval = 500; // Update FPS every 500ms
		this.lastFpsUpdate = 0;

		// Audio data
		this.audioData = null;

		// Available visualizations
		this.visualizations = {
			spectrum: new SpectrumBars(ctx),
			waveform: new Waveform(ctx)
		};

		// Active visualization
		this.activeType = 'spectrum';
		this.activeVisualization = this.visualizations[this.activeType];

		// FPS callbacks
		this.fpsCallbacks = new Set();

		// Performance monitoring
		this.frameTimes = new Float32Array(60); // Track last 60 frames
		this.frameTimeIndex = 0;
		this.targetFrameTime = 1000 / 60; // 16.67ms for 60fps

		// Bind render loop
		this.render = this.render.bind(this);
	}

	/**
	 * Handle canvas resize
	 */
	handleResize(width, height, dpr) {
		this.width = width;
		this.height = height;
		this.dpr = dpr;

		// Notify all visualizations of resize
		Object.values(this.visualizations).forEach((viz) => {
			viz.resize(width, height, dpr);
		});
	}

	/**
	 * Set active visualization type
	 */
	setVisualizationType(type) {
		if (this.visualizations[type]) {
			this.activeType = type;
			this.activeVisualization = this.visualizations[type];
			this.activeVisualization.reset();
		} else {
			console.warn(`Unknown visualization type: ${type}`);
		}
	}

	/**
	 * Get active visualization
	 */
	getActiveVisualization() {
		return this.activeVisualization;
	}

	/**
	 * Update audio data
	 */
	updateAudioData(audioData) {
		this.audioData = audioData;
	}

	/**
	 * Main render loop
	 */
	render(timestamp) {
		if (!this.isRunning) return;

		// Calculate frame time
		const deltaTime = timestamp - this.lastFrameTime;
		this.lastFrameTime = timestamp;

		// Track frame time for performance monitoring
		this.frameTimes[this.frameTimeIndex] = deltaTime;
		this.frameTimeIndex = (this.frameTimeIndex + 1) % this.frameTimes.length;

		// Update FPS counter
		this.frameCount++;
		if (timestamp - this.lastFpsUpdate >= this.fpsUpdateInterval) {
			const elapsed = timestamp - this.lastFpsUpdate;
			this.fps = (this.frameCount * 1000) / elapsed;
			this.frameCount = 0;
			this.lastFpsUpdate = timestamp;

			// Notify FPS callbacks
			this.fpsCallbacks.forEach((callback) => callback(this.fps));
		}

		// Update active visualization with audio data
		if (this.audioData && this.activeVisualization) {
			this.activeVisualization.update(this.audioData);
		}

		// Render active visualization
		if (this.activeVisualization) {
			this.activeVisualization.render();
		}

		// Performance warning (only in development)
		if (deltaTime > this.targetFrameTime * 1.5 && this.frameCount % 60 === 0) {
			console.warn(
				`Frame time exceeded budget: ${deltaTime.toFixed(2)}ms (target: ${this.targetFrameTime.toFixed(2)}ms)`
			);
		}

		// Schedule next frame
		this.rafId = requestAnimationFrame(this.render);
	}

	/**
	 * Start render loop
	 */
	start() {
		if (this.isRunning) return;

		this.isRunning = true;
		this.lastFrameTime = performance.now();
		this.lastFpsUpdate = this.lastFrameTime;
		this.frameCount = 0;
		this.rafId = requestAnimationFrame(this.render);

		console.log('Visualization started');
	}

	/**
	 * Stop render loop
	 */
	stop() {
		if (!this.isRunning) return;

		this.isRunning = false;
		if (this.rafId !== null) {
			cancelAnimationFrame(this.rafId);
			this.rafId = null;
		}

		console.log('Visualization stopped');
	}

	/**
	 * Subscribe to FPS updates
	 */
	onFpsUpdate(callback) {
		this.fpsCallbacks.add(callback);
		// Return unsubscribe function
		return () => {
			this.fpsCallbacks.delete(callback);
		};
	}

	/**
	 * Get current FPS
	 */
	getFps() {
		return this.fps;
	}

	/**
	 * Get average frame time
	 */
	getAverageFrameTime() {
		let sum = 0;
		let count = 0;
		for (let i = 0; i < this.frameTimes.length; i++) {
			if (this.frameTimes[i] > 0) {
				sum += this.frameTimes[i];
				count++;
			}
		}
		return count > 0 ? sum / count : 0;
	}

	/**
	 * Get performance stats
	 */
	getStats() {
		const avgFrameTime = this.getAverageFrameTime();
		return {
			fps: this.fps,
			avgFrameTime: avgFrameTime,
			isRunning: this.isRunning,
			activeType: this.activeType,
			width: this.width,
			height: this.height,
			dpr: this.dpr,
			budgetUtilization: (avgFrameTime / this.targetFrameTime) * 100
		};
	}

	/**
	 * Register a new visualization type
	 */
	registerVisualization(name, visualizationClass) {
		if (this.visualizations[name]) {
			console.warn(`Visualization '${name}' already exists. Overwriting.`);
		}

		const instance = new visualizationClass(this.ctx);
		instance.resize(this.width, this.height, this.dpr);
		this.visualizations[name] = instance;

		console.log(`Registered visualization: ${name}`);
	}

	/**
	 * Get list of available visualization types
	 */
	getAvailableTypes() {
		return Object.keys(this.visualizations);
	}

	/**
	 * Get configuration for active visualization
	 */
	getConfig() {
		if (this.activeVisualization && typeof this.activeVisualization.getConfig === 'function') {
			return this.activeVisualization.getConfig();
		}
		return null;
	}

	/**
	 * Set configuration for active visualization
	 */
	setConfig(config) {
		if (this.activeVisualization && typeof this.activeVisualization.setConfig === 'function') {
			this.activeVisualization.setConfig(config);
		}
	}

	/**
	 * Cleanup resources
	 */
	destroy() {
		this.stop();
		this.fpsCallbacks.clear();
		this.audioData = null;

		// Reset all visualizations
		Object.values(this.visualizations).forEach((viz) => {
			if (typeof viz.reset === 'function') {
				viz.reset();
			}
		});
	}
}
