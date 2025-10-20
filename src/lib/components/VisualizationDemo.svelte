<script>
	import VisualizationCanvas from '$lib/components/VisualizationCanvas.svelte';

	/**
	 * Example component showing how to use the VisualizationCanvas
	 *
	 * This demonstrates:
	 * 1. Switching between visualization types
	 * 2. Passing audio data to visualizations
	 * 3. Generating mock audio data for testing
	 */

	let visualizationType = $state('spectrum');
	let audioData = $state(null);
	let canvasComponent = $state(null);
	let isGeneratingMockData = $state(false);
	let mockDataInterval = $state(null);

	/**
	 * Generate mock audio data for testing without real audio input
	 */
	function generateMockAudioData() {
		// Create mock frequency data (128 bins)
		const frequencyData = new Uint8Array(128);
		for (let i = 0; i < frequencyData.length; i++) {
			// Simulate frequency spectrum with some randomness
			const baseValue = Math.sin(Date.now() / 1000 + i * 0.1) * 50 + 100;
			const noise = Math.random() * 50;
			frequencyData[i] = Math.max(0, Math.min(255, baseValue + noise));
		}

		// Create mock waveform data (1024 samples)
		const waveformData = new Uint8Array(1024);
		for (let i = 0; i < waveformData.length; i++) {
			// Simulate sine wave with some harmonics
			const t = (Date.now() / 100 + i) * 0.05;
			const wave = Math.sin(t) * 0.5 + Math.sin(t * 2) * 0.25 + Math.sin(t * 3) * 0.125;
			waveformData[i] = Math.floor((wave + 1) * 127.5);
		}

		return { frequencyData, waveformData };
	}

	/**
	 * Start generating mock audio data
	 */
	function startMockData() {
		if (isGeneratingMockData) return;

		isGeneratingMockData = true;
		mockDataInterval = setInterval(() => {
			audioData = generateMockAudioData();
		}, 16); // ~60fps
	}

	/**
	 * Stop generating mock audio data
	 */
	function stopMockData() {
		if (!isGeneratingMockData) return;

		isGeneratingMockData = false;
		if (mockDataInterval) {
			clearInterval(mockDataInterval);
			mockDataInterval = null;
		}
	}

	/**
	 * Switch visualization type
	 */
	function switchVisualization(type) {
		visualizationType = type;
	}

	/**
	 * Cleanup on component destroy
	 */
	import { onDestroy } from 'svelte';
	onDestroy(() => {
		stopMockData();
	});
</script>

<div class="demo-container">
	<div class="visualization-wrapper">
		<VisualizationCanvas bind:this={canvasComponent} {visualizationType} {audioData} />
	</div>

	<div class="controls">
		<div class="control-group">
			<h3>Visualization Type</h3>
			<div class="button-group">
				<button
					class:active={visualizationType === 'spectrum'}
					onclick={() => switchVisualization('spectrum')}
				>
					Spectrum Bars
				</button>
				<button
					class:active={visualizationType === 'waveform'}
					onclick={() => switchVisualization('waveform')}
				>
					Waveform
				</button>
			</div>
		</div>

		<div class="control-group">
			<h3>Mock Audio Data</h3>
			<div class="button-group">
				<button class:active={isGeneratingMockData} onclick={startMockData} disabled={isGeneratingMockData}>
					Start
				</button>
				<button onclick={stopMockData} disabled={!isGeneratingMockData}>
					Stop
				</button>
			</div>
		</div>

		<div class="control-group">
			<h3>Instructions</h3>
			<p class="instructions">
				This is a demo of the visualization system. Click "Start" to generate mock audio data
				and see the visualizations in action. Switch between visualization types to see different
				rendering styles.
			</p>
			<p class="instructions">
				In production, replace the mock data generation with real audio data from the AudioAnalyzer service.
			</p>
		</div>
	</div>
</div>

<style>
	.demo-container {
		width: 100%;
		height: 100vh;
		display: flex;
		flex-direction: column;
		background: #000;
		color: #fff;
	}

	.visualization-wrapper {
		flex: 1;
		position: relative;
		overflow: hidden;
	}

	.controls {
		background: rgba(20, 20, 20, 0.95);
		padding: 20px;
		display: flex;
		gap: 30px;
		border-top: 1px solid #333;
	}

	.control-group {
		flex: 1;
	}

	.control-group h3 {
		margin: 0 0 10px 0;
		font-size: 14px;
		font-weight: bold;
		text-transform: uppercase;
		color: #888;
	}

	.button-group {
		display: flex;
		gap: 10px;
	}

	button {
		padding: 10px 20px;
		background: #333;
		color: #fff;
		border: 1px solid #555;
		border-radius: 5px;
		cursor: pointer;
		font-size: 14px;
		transition: all 0.2s;
	}

	button:hover:not(:disabled) {
		background: #444;
		border-color: #666;
	}

	button.active {
		background: #0066cc;
		border-color: #0088ff;
	}

	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.instructions {
		font-size: 12px;
		line-height: 1.5;
		color: #aaa;
		margin: 5px 0;
	}

	@media (max-width: 768px) {
		.controls {
			flex-direction: column;
		}
	}
</style>
