<script>
  import { onMount, onDestroy } from 'svelte';
  import SpotifyConnect from '$lib/components/SpotifyConnect.svelte';
  import PlayerControls from '$lib/components/PlayerControls.svelte';
  import VisualizationCanvas from '$lib/components/VisualizationCanvas.svelte';
  import DebugOverlay from '$lib/components/DebugOverlay.svelte';
  import { isAuthenticated } from '$lib/stores/authStore.js';
  import { playerStore } from '$lib/stores/playerStore.js';
  import { setupAudioIntegration } from '$lib/services/AudioIntegration.js';
  import {
    spectrumBars,
    waveformData,
    isAnalyzing
  } from '$lib/stores/audioStore.js';

  let playerInitialized = $state(false);
  let initializingPlayer = $state(false);
  let initError = $state(null);
  let audioIntegration = $state(null);
  let visualizationType = $state('spectrum'); // 'spectrum' or 'waveform'
  let showDebug = $state(false);
  let visualizationManager = $state(null);

  // Audio data for visualization
  let audioData = $derived.by(() => {
    if (!$isAnalyzing || !$spectrumBars || !$waveformData) return null;

    return {
      frequencyData: $spectrumBars,
      waveformData: $waveformData
    };
  });

  // Initialize player when authenticated
  $effect(() => {
    if ($isAuthenticated && !playerInitialized && !initializingPlayer) {
      initializePlayer();
    }
  });

  async function initializePlayer() {
    initializingPlayer = true;
    initError = null;

    try {
      console.log('Initializing Spotify Web Playback SDK...');
      await playerStore.initialize();
      playerInitialized = true;
      console.log('Spotify player initialized successfully');

      // Setup audio integration after player is ready
      await setupAudio();
    } catch (error) {
      console.error('Failed to initialize player:', error);
      initError = error.message;
    } finally {
      initializingPlayer = false;
    }
  }

  async function setupAudio() {
    try {
      console.log('Setting up audio integration...');
      // Pass the SpotifyPlayer instance, not the raw Spotify.Player
      audioIntegration = await setupAudioIntegration(playerStore.spotifyPlayer);
      console.log('Audio integration ready');
    } catch (error) {
      console.error('Failed to setup audio integration:', error);
    }
  }

  function toggleVisualization() {
    visualizationType = visualizationType === 'spectrum' ? 'waveform' : 'spectrum';
  }

  onDestroy(async () => {
    // Clean up
    if (audioIntegration) {
      audioIntegration.disconnect();
    }
    if (playerInitialized) {
      await playerStore.disconnect();
    }
  });
</script>

<main>
  {#if !$isAuthenticated}
    <SpotifyConnect />
  {:else}
    <div class="app-container">
      <!-- Full-screen visualization canvas -->
      {#if playerInitialized && audioData}
        <VisualizationCanvas
          {visualizationType}
          {audioData}
          bind:manager={visualizationManager}
        />
      {:else}
        <div class="no-viz-bg"></div>
      {/if}

      <!-- Overlay UI -->
      <div class="overlay-ui">
        <!-- Top controls -->
        <div class="top-controls">
          <h1 class="app-title">musicViz</h1>
          <div class="controls-group">
            <button class="icon-btn" onclick={toggleVisualization} title="Toggle visualization">
              {visualizationType === 'spectrum' ? '🎵' : '🌊'}
            </button>
            <button class="icon-btn" onclick={() => showDebug = !showDebug} title="Toggle debug">
              📊
            </button>
          </div>
        </div>

        <!-- Center status messages -->
        {#if initializingPlayer}
          <div class="center-message">
            <div class="status-card">
              <div class="spinner"></div>
              <p>Initializing Spotify player...</p>
            </div>
          </div>
        {:else if initError}
          <div class="center-message">
            <div class="status-card error">
              <p>Failed to initialize player: {initError}</p>
              <button onclick={initializePlayer} class="retry-btn">
                Retry
              </button>
            </div>
          </div>
        {:else if playerInitialized && !playerStore.state.isPlaying && !playerStore.state.currentTrack}
          <div class="center-message">
            <div class="instructions-card">
              <h2>Ready to visualize!</h2>
              <ol>
                <li>Open Spotify on any device</li>
                <li>Start playing a song</li>
                <li>Watch the music come to life!</li>
              </ol>
              <p class="hint">
                Press {visualizationType === 'spectrum' ? '🌊' : '🎵'} to switch visualizations
              </p>
            </div>
          </div>
        {/if}

        <!-- Bottom player controls -->
        {#if playerInitialized}
          <div class="bottom-controls">
            <PlayerControls />
          </div>
        {/if}
      </div>

      <!-- Debug overlay -->
      {#if showDebug && playerInitialized}
        <DebugOverlay
          bind:visible={showDebug}
          position="top-right"
          manager={visualizationManager}
        />
      {/if}
    </div>
  {/if}
</main>

<style>
  main {
    width: 100%;
    height: 100vh;
    margin: 0;
    padding: 0;
    overflow: hidden;
    background: #000;
  }

  .app-container {
    position: relative;
    width: 100%;
    height: 100vh;
    overflow: hidden;
  }

  .no-viz-bg {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 100%);
  }

  .overlay-ui {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    pointer-events: none;
    z-index: 10;
  }

  .overlay-ui > * {
    pointer-events: auto;
  }

  /* Top controls */
  .top-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 30px;
    background: linear-gradient(180deg, rgba(0, 0, 0, 0.7) 0%, transparent 100%);
  }

  .app-title {
    font-size: 2rem;
    font-weight: 700;
    margin: 0;
    background: linear-gradient(135deg, #1db954 0%, #1ed760 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    text-shadow: 0 0 30px rgba(29, 185, 84, 0.3);
  }

  .controls-group {
    display: flex;
    gap: 12px;
  }

  .icon-btn {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: none;
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    color: white;
    font-size: 1.5rem;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .icon-btn:hover {
    background: rgba(29, 185, 84, 0.3);
    transform: scale(1.1);
    box-shadow: 0 0 20px rgba(29, 185, 84, 0.5);
  }

  /* Center messages */
  .center-message {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }

  .status-card {
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    padding: 2rem 3rem;
    text-align: center;
    max-width: 500px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }

  .status-card p {
    margin: 0;
    font-size: 1.2rem;
    color: white;
  }

  .status-card.error {
    border-color: rgba(255, 107, 107, 0.3);
  }

  .status-card.error p {
    color: #ff6b6b;
    margin-bottom: 1.5rem;
  }

  .instructions-card {
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(29, 185, 84, 0.3);
    border-radius: 20px;
    padding: 2.5rem 3rem;
    max-width: 500px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }

  .instructions-card h2 {
    margin: 0 0 1.5rem 0;
    font-size: 2rem;
    background: linear-gradient(135deg, #1db954 0%, #1ed760 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .instructions-card ol {
    text-align: left;
    margin: 1.5rem 0;
    padding-left: 1.5rem;
  }

  .instructions-card li {
    color: rgba(255, 255, 255, 0.9);
    margin-bottom: 1rem;
    font-size: 1.1rem;
    line-height: 1.6;
  }

  .hint {
    margin-top: 1.5rem;
    padding: 1rem;
    background: rgba(29, 185, 84, 0.1);
    border-left: 3px solid #1db954;
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.8);
    font-size: 0.95rem;
  }

  /* Bottom controls */
  .bottom-controls {
    padding: 0 20px 20px 20px;
    background: linear-gradient(0deg, rgba(0, 0, 0, 0.7) 0%, transparent 100%);
  }

  .retry-btn {
    background: #1db954;
    color: white;
    border: none;
    border-radius: 24px;
    padding: 0.75rem 2rem;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .retry-btn:hover {
    background: #1ed760;
    transform: translateY(-2px);
    box-shadow: 0 5px 20px rgba(29, 185, 84, 0.4);
  }

  .spinner {
    width: 48px;
    height: 48px;
    border: 4px solid rgba(255, 255, 255, 0.1);
    border-top: 4px solid #1db954;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1.5rem auto;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 768px) {
    .app-title {
      font-size: 1.5rem;
    }

    .top-controls {
      padding: 15px 20px;
    }

    .icon-btn {
      width: 40px;
      height: 40px;
      font-size: 1.2rem;
    }

    .status-card,
    .instructions-card {
      padding: 1.5rem 2rem;
      margin: 0 20px;
    }

    .instructions-card h2 {
      font-size: 1.5rem;
    }

    .instructions-card li {
      font-size: 1rem;
    }
  }
</style>
