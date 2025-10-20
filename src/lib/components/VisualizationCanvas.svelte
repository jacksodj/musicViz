<script>
	import { onMount, onDestroy } from 'svelte';
	import { VisualizationManager } from '$lib/services/VisualizationManager.js';

	let canvas = $state(null);
	let visualizationManager = $state(null);
	let fps = $state(0);
	let isRunning = $state(false);

	// Props
	let { visualizationType = 'spectrum', audioData = null, manager = $bindable(null) } = $props();

	/**
	 * Handle canvas resize to maintain proper resolution at any screen size
	 */
	function handleResize() {
		if (!canvas) return;

		const dpr = window.devicePixelRatio || 1;
		const rect = canvas.getBoundingClientRect();

		// Set display size (CSS pixels)
		canvas.style.width = rect.width + 'px';
		canvas.style.height = rect.height + 'px';

		// Set actual size in memory (scaled for HiDPI)
		canvas.width = rect.width * dpr;
		canvas.height = rect.height * dpr;

		// Notify visualization manager of resize
		if (visualizationManager) {
			visualizationManager.handleResize(canvas.width, canvas.height, dpr);
		}
	}

	/**
	 * Initialize visualization system
	 */
	onMount(() => {
		if (!canvas) return;

		const ctx = canvas.getContext('2d', {
			alpha: false, // Opaque canvas for better performance
			desynchronized: true // Hint for better performance
		});

		if (!ctx) {
			console.error('Failed to get 2D context');
			return;
		}

		// Create visualization manager
		visualizationManager = new VisualizationManager(ctx);
		manager = visualizationManager; // Expose to parent

		// Set initial size
		handleResize();

		// Start render loop
		visualizationManager.start();
		isRunning = true;

		// Setup resize observer for efficient resize handling
		const resizeObserver = new ResizeObserver(() => {
			handleResize();
		});
		resizeObserver.observe(canvas);

		// Cleanup
		return () => {
			resizeObserver.disconnect();
			if (visualizationManager) {
				visualizationManager.stop();
			}
		};
	});

	// React to visualization type changes
	$effect(() => {
		if (visualizationManager) {
			visualizationManager.setVisualizationType(visualizationType);
		}
	});

	// Update audio data
	$effect(() => {
		if (visualizationManager && audioData) {
			visualizationManager.updateAudioData(audioData);
		}
	});

	// Subscribe to FPS updates
	$effect(() => {
		if (visualizationManager) {
			const unsubscribe = visualizationManager.onFpsUpdate((newFps) => {
				fps = newFps;
			});

			return () => {
				if (unsubscribe) unsubscribe();
			};
		}
	});

	// Expose manager for parent components
	export function getManager() {
		return visualizationManager;
	}
</script>

<div class="visualization-container">
	<canvas bind:this={canvas} class="visualization-canvas"></canvas>

	<div class="stats-overlay">
		<div class="stat">
			<span class="label">FPS:</span>
			<span class="value" class:low={fps < 30} class:medium={fps >= 30 && fps < 55}>
				{fps.toFixed(1)}
			</span>
		</div>
		<div class="stat">
			<span class="label">Mode:</span>
			<span class="value">{visualizationType}</span>
		</div>
		<div class="stat">
			<span class="label">Status:</span>
			<span class="value" class:active={isRunning}>
				{isRunning ? 'Running' : 'Stopped'}
			</span>
		</div>
	</div>
</div>

<style>
	.visualization-container {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
		background: #000;
	}

	.visualization-canvas {
		display: block;
		width: 100%;
		height: 100%;
		image-rendering: auto;
		image-rendering: crisp-edges;
		image-rendering: pixelated;
	}

	.stats-overlay {
		position: absolute;
		top: 10px;
		right: 10px;
		display: flex;
		flex-direction: column;
		gap: 5px;
		background: rgba(0, 0, 0, 0.7);
		padding: 10px;
		border-radius: 5px;
		font-family: monospace;
		font-size: 12px;
		color: #fff;
		pointer-events: none;
		user-select: none;
	}

	.stat {
		display: flex;
		gap: 10px;
	}

	.label {
		color: #888;
	}

	.value {
		color: #0f0;
		font-weight: bold;
	}

	.value.low {
		color: #f00;
	}

	.value.medium {
		color: #ff0;
	}

	.value.active {
		color: #0f0;
	}
</style>
