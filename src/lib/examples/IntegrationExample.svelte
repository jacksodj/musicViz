<script>
	/**
	 * Integration Example
	 *
	 * Shows how to connect AudioAnalyzer service with VisualizationCanvas.
	 * This is a reference implementation for the main app.
	 */

	import { onMount, onDestroy } from 'svelte';
	import VisualizationCanvas from '$lib/components/VisualizationCanvas.svelte';
	// import { AudioAnalyzer } from '$lib/services/AudioAnalyzer.js';

	let visualizationType = $state('spectrum');
	let audioData = $state(null);
	let audioAnalyzer = $state(null);
	let isActive = $state(false);

	/**
	 * Initialize audio analyzer
	 * NOTE: Uncomment when AudioAnalyzer is ready
	 */
	async function initializeAudio() {
		try {
			// Example initialization - adjust based on actual AudioAnalyzer API
			// audioAnalyzer = new AudioAnalyzer();
			// await audioAnalyzer.initialize();

			// Subscribe to audio data updates
			// audioAnalyzer.onDataUpdate((data) => {
			//   audioData = data;
			// });

			// Start analysis
			// await audioAnalyzer.start();
			// isActive = true;

			console.log('Audio analyzer initialized (placeholder)');
		} catch (error) {
			console.error('Failed to initialize audio:', error);
		}
	}

	/**
	 * Stop audio analyzer
	 */
	function stopAudio() {
		if (audioAnalyzer) {
			// audioAnalyzer.stop();
			isActive = false;
		}
	}

	/**
	 * Cleanup
	 */
	onDestroy(() => {
		stopAudio();
	});

	/**
	 * Expected AudioAnalyzer API:
	 *
	 * class AudioAnalyzer {
	 *   constructor()
	 *   async initialize()
	 *   async start()
	 *   stop()
	 *   onDataUpdate(callback)
	 * }
	 *
	 * Data format:
	 * {
	 *   frequencyData: Uint8Array,
	 *   waveformData: Uint8Array
	 * }
	 */
</script>

<div class="integration-example">
	<VisualizationCanvas {visualizationType} {audioData} />

	<div class="controls">
		<button onclick={initializeAudio} disabled={isActive}>
			Start Audio
		</button>
		<button onclick={stopAudio} disabled={!isActive}>
			Stop Audio
		</button>

		<select bind:value={visualizationType}>
			<option value="spectrum">Spectrum Bars</option>
			<option value="waveform">Waveform</option>
		</select>
	</div>
</div>

<style>
	.integration-example {
		width: 100%;
		height: 100vh;
		position: relative;
	}

	.controls {
		position: absolute;
		bottom: 20px;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		gap: 10px;
		padding: 15px;
		background: rgba(0, 0, 0, 0.8);
		border-radius: 10px;
	}

	button,
	select {
		padding: 10px 20px;
		background: #333;
		color: #fff;
		border: 1px solid #555;
		border-radius: 5px;
		cursor: pointer;
	}

	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
