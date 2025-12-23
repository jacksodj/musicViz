<script>
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';

  // Components
  import SourceSelector from '$lib/components/SourceSelector.svelte';
  import SpotifyConnect from '$lib/components/SpotifyConnect.svelte';
  import NavidromeConnect from '$lib/components/NavidromeConnect.svelte';
  import NavidromeBrowser from '$lib/components/NavidromeBrowser.svelte';
  import NavidromeQueue from '$lib/components/NavidromeQueue.svelte';
  import PlayerControls from '$lib/components/PlayerControls.svelte';
  import PluginManager from '$lib/components/PluginManager.svelte';
  import GoveeControl from '$lib/components/GoveeControl.svelte';

  // Source store
  import { audioSource, isSourceSelected, clearSource } from '$lib/stores/sourceStore.js';

  // Spotify stores
  import { isAuthenticated, checkExistingAuth } from '$lib/stores/authStore.js';
  import { playerStore, playerState } from '$lib/stores/playerStore.js';

  // Navidrome stores
  import { isNavidromeAuthenticated, checkExistingNavidromeAuth } from '$lib/stores/navidromeAuthStore.js';
  import { navidromePlayerStore, navidromePlayerState } from '$lib/stores/navidromePlayerStore.js';

  // Services
  import { analysisStore, hasAnalysis, beats, analysisError } from '$lib/stores/analysisStore.js';
  import { spotifyAnalysisService } from '$lib/services/SpotifyAnalysisService.js';
  import { setupNavidromeAudioIntegration } from '$lib/services/AudioIntegration.js';
  import { initializePluginSystem, pluginRegistry } from '$lib/plugins/index.js';
  import { testKeyring } from '$lib/utils/testKeyring.js';

  // Player state
  let playerInitialized = $state(false);
  let initializingPlayer = $state(false);
  let initError = $state(null);
  let currentTrackId = $state(null);
  let currentPluginId = $state('beat-pulse');
  let availablePlugins = $state([]);
  let visualizationCanvas = $state(null);
  let navidromeAudioIntegration = $state(null);

  // UI state
  let showMenu = $state(false);
  let showBrowser = $state(false);
  let showQueue = $state(false);
  let showControls = $state(true);
  let hideControlsTimeout = null;
  let lastInteractionTime = $state(Date.now());

  // Derived: current player state based on source
  const currentPlayerState = $derived(
    $audioSource === 'navidrome' ? $navidromePlayerState : $playerState
  );

  // Derived: is authenticated for current source
  const isCurrentSourceAuthenticated = $derived(
    $audioSource === 'spotify' ? $isAuthenticated :
    $audioSource === 'navidrome' ? $isNavidromeAuthenticated :
    false
  );

  // Initialize player when authenticated (for current source)
  $effect(() => {
    if (isCurrentSourceAuthenticated && !playerInitialized && !initializingPlayer) {
      initializePlayer();
    }
  });

  // Track change detection - fetch analysis when track changes (Spotify only)
  $effect(() => {
    if ($audioSource !== 'spotify') return;

    const track = $playerState.currentTrack;
    const trackId = track?.id;

    if (trackId && trackId !== currentTrackId) {
      console.log(`[+page] Track changed: ${track.name} by ${track.artists[0]?.name}`);
      currentTrackId = trackId;
      fetchAnalysis(trackId);

      if ($playerState.nextTracks && $playerState.nextTracks.length > 0) {
        prefetchNextTracks($playerState.nextTracks);
      }
    }
  });

  async function initializePlayer() {
    initializingPlayer = true;
    initError = null;

    try {
      if ($audioSource === 'spotify') {
        console.log('Initializing Spotify Web Playback SDK...');
        await playerStore.initialize();
        console.log('Spotify player initialized successfully');
      } else if ($audioSource === 'navidrome') {
        console.log('Initializing Navidrome player...');
        await navidromePlayerStore.initialize();

        // Set up audio integration for visualization
        const player = navidromePlayerStore.navidromePlayer;
        if (player) {
          navidromeAudioIntegration = await setupNavidromeAudioIntegration(player);
        }

        console.log('Navidrome player initialized successfully');
      }

      playerInitialized = true;
    } catch (error) {
      console.error('Failed to initialize player:', error);
      initError = error.message;
    } finally {
      initializingPlayer = false;
    }
  }

  async function fetchAnalysis(trackId) {
    try {
      analysisStore.setLoading(true);

      const accessToken = await playerStore.spotifyPlayer?.getAccessToken();

      if (!accessToken) {
        console.warn('[+page] No access token available for analysis');
        analysisStore.setError('No access token available');
        return;
      }

      console.log(`[+page] Fetching analysis for track ${trackId}`);
      const analysis = await spotifyAnalysisService.getAnalysis(trackId, accessToken);

      analysisStore.setAnalysis(trackId, analysis);

      console.log(`[+page] Analysis loaded - ${analysis.beats?.length} beats, ${analysis.segments?.length} segments`);
    } catch (error) {
      console.error('[+page] Failed to fetch analysis:', error);

      if (error.message.includes('Forbidden')) {
        analysisStore.setError('Audio analysis not available (requires Spotify Premium)');
      } else if (error.message.includes('Unauthorized')) {
        analysisStore.setError('Token expired - please reconnect');
      } else {
        analysisStore.setError(error.message);
      }
    }
  }

  async function prefetchNextTracks(nextTracks) {
    try {
      const tokenData = await invoke('get_spotify_token');
      const accessToken = tokenData.access_token;

      spotifyAnalysisService.prefetchQueue(nextTracks, accessToken);
    } catch (error) {
      console.warn('[+page] Failed to prefetch next tracks:', error);
    }
  }

  function handleInteraction() {
    lastInteractionTime = Date.now();
    showControls = true;

    if (hideControlsTimeout) {
      clearTimeout(hideControlsTimeout);
    }

    if (currentPlayerState.isPlaying) {
      hideControlsTimeout = setTimeout(() => {
        showControls = false;
      }, 3000);
    }
  }

  // Auto-hide controls when playing
  $effect(() => {
    if (currentPlayerState.isPlaying) {
      handleInteraction();
    } else {
      showControls = true;
      if (hideControlsTimeout) {
        clearTimeout(hideControlsTimeout);
      }
    }
  });

  // Categorize plugins
  const categorizedPlugins = $derived.by(() => {
    const native = [];
    const milkdrop = [];

    for (const plugin of availablePlugins) {
      if (plugin.id.startsWith('milkdrop-')) {
        milkdrop.push(plugin);
      } else {
        native.push(plugin);
      }
    }

    return { native, milkdrop };
  });

  function handleSwitchSource() {
    // Disconnect current player
    if ($audioSource === 'spotify' && playerInitialized) {
      playerStore.disconnect();
    } else if ($audioSource === 'navidrome' && playerInitialized) {
      navidromePlayerStore.disconnect();
      if (navidromeAudioIntegration) {
        navidromeAudioIntegration.disconnect();
        navidromeAudioIntegration = null;
      }
    }

    // Reset player state
    playerInitialized = false;
    initializingPlayer = false;
    initError = null;
    currentTrackId = null;

    // Clear source to show selector
    clearSource();
    showMenu = false;
  }

  onMount(async () => {
    window.testKeyring = testKeyring;
    console.log('[+page] Keyring test available. Run: testKeyring()');

    // Check for existing authentication based on selected source
    if ($audioSource === 'spotify') {
      console.log('[+page] Checking for existing Spotify authentication...');
      const hasExistingAuth = await checkExistingAuth();
      if (hasExistingAuth) {
        console.log('[+page] Restored existing Spotify authentication');
      }
    } else if ($audioSource === 'navidrome') {
      console.log('[+page] Checking for existing Navidrome authentication...');
      const hasExistingAuth = await checkExistingNavidromeAuth();
      if (hasExistingAuth) {
        console.log('[+page] Restored existing Navidrome authentication');
      }
    }

    // Initialize plugin system
    initializePluginSystem();
    availablePlugins = pluginRegistry.list();

    // Listen for mouse movement to show controls
    const handleMouseMove = () => handleInteraction();
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('click', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('click', handleMouseMove);
    };
  });

  onDestroy(async () => {
    if (hideControlsTimeout) {
      clearTimeout(hideControlsTimeout);
    }
    if (playerInitialized) {
      if ($audioSource === 'spotify') {
        await playerStore.disconnect();
      } else if ($audioSource === 'navidrome') {
        await navidromePlayerStore.disconnect();
        if (navidromeAudioIntegration) {
          navidromeAudioIntegration.disconnect();
        }
      }
    }
    analysisStore.clear();
  });
</script>

<main>
  {#if !$isSourceSelected}
    <!-- Source Selection -->
    <SourceSelector />
  {:else if $audioSource === 'spotify' && !$isAuthenticated}
    <!-- Spotify Login -->
    <SpotifyConnect />
  {:else if $audioSource === 'navidrome' && !$isNavidromeAuthenticated}
    <!-- Navidrome Login -->
    <NavidromeConnect />
  {:else}
    <!-- Main App -->
    <div class="app-container">
      <!-- Full-screen visualization -->
      {#if playerInitialized}
        <PluginManager
          pluginId={currentPluginId}
          width="100%"
          height="100vh"
          canvasRef={(canvas) => visualizationCanvas = canvas}
        />
      {/if}

      <!-- Govee Light Control -->
      <GoveeControl
        canvas={visualizationCanvas}
        isPlaying={currentPlayerState.isPlaying}
      />

      <!-- Navidrome Browser Panel -->
      {#if $audioSource === 'navidrome' && showBrowser}
        <div class="side-panel left">
          <NavidromeBrowser onClose={() => showBrowser = false} />
        </div>
      {/if}

      <!-- Navidrome Queue Panel -->
      {#if $audioSource === 'navidrome' && showQueue}
        <div class="side-panel right">
          <NavidromeQueue onClose={() => showQueue = false} />
        </div>
      {/if}

      <!-- Overlay UI -->
      <div class="overlay-ui" class:controls-hidden={!showControls}>
        <!-- Top bar -->
        <div class="top-bar">
          <h1 class="app-title">musicViz</h1>

          <div class="top-actions">
            {#if $audioSource === 'navidrome'}
              <button
                class="top-btn"
                class:active={showBrowser}
                onclick={() => { showBrowser = !showBrowser; showQueue = false; handleInteraction(); }}
                aria-label="Browse music"
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                </svg>
              </button>

              <button
                class="top-btn"
                class:active={showQueue}
                onclick={() => { showQueue = !showQueue; showBrowser = false; handleInteraction(); }}
                aria-label="Queue"
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/>
                </svg>
              </button>
            {/if}

            <button
              class="hamburger-btn"
              onclick={() => { showMenu = !showMenu; handleInteraction(); }}
              aria-label="Menu"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                {#if showMenu}
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                {:else}
                  <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
                {/if}
              </svg>
            </button>
          </div>
        </div>

        <!-- Slide-in menu -->
        {#if showMenu}
          <div class="menu-panel">
            <h3 class="menu-title">Visualizations</h3>
            <div class="menu-content">
              <!-- Native visualizations -->
              {#if categorizedPlugins.native.length > 0}
                <div class="category-label">Native</div>
                {#each categorizedPlugins.native as plugin}
                  <button
                    class="viz-option"
                    class:active={currentPluginId === plugin.id}
                    onclick={() => {
                      currentPluginId = plugin.id;
                      showMenu = false;
                      handleInteraction();
                    }}
                  >
                    <div class="viz-name">{plugin.name}</div>
                    <div class="viz-author">{plugin.author}</div>
                  </button>
                {/each}
              {/if}

              <!-- Milkdrop presets -->
              {#if categorizedPlugins.milkdrop.length > 0}
                <div class="category-label milkdrop">Milkdrop Classics</div>
                {#each categorizedPlugins.milkdrop as plugin}
                  <button
                    class="viz-option milkdrop"
                    class:active={currentPluginId === plugin.id}
                    onclick={() => {
                      currentPluginId = plugin.id;
                      showMenu = false;
                      handleInteraction();
                    }}
                  >
                    <div class="viz-name">{plugin.name}</div>
                    <div class="viz-author">{plugin.author}</div>
                  </button>
                {/each}
              {/if}

              <!-- Switch Source -->
              <div class="category-label">Audio Source</div>
              <button
                class="viz-option source-switch"
                onclick={handleSwitchSource}
              >
                <div class="viz-name">Switch Audio Source</div>
                <div class="viz-author">Currently: {$audioSource === 'spotify' ? 'Spotify' : 'Navidrome'}</div>
              </button>
            </div>
          </div>
        {/if}

        <!-- Center status messages -->
        {#if initializingPlayer}
          <div class="center-message">
            <div class="status-card">
              <div class="spinner"></div>
              <p>Initializing {$audioSource === 'spotify' ? 'Spotify' : 'Navidrome'} player...</p>
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
        {:else if playerInitialized && !currentPlayerState.isPlaying && !currentPlayerState.currentTrack}
          <div class="center-message">
            <div class="instructions-card">
              <h2>Ready to visualize!</h2>
              {#if $audioSource === 'spotify'}
                <ol>
                  <li>Click the play button below</li>
                  <li>Or start playing from any Spotify device</li>
                  <li>Watch the music come to life!</li>
                </ol>
              {:else}
                <ol>
                  <li>Click the search icon to browse music</li>
                  <li>Select a song or album to play</li>
                  <li>Watch the music come to life!</li>
                </ol>
              {/if}
              <p class="hint">
                {#if $audioSource === 'spotify'}
                  Analysis data loads automatically when tracks play
                {:else}
                  Real-time audio analysis powers the visualizations
                {/if}
              </p>
            </div>
          </div>
        {/if}

        <!-- Bottom player controls -->
        {#if playerInitialized}
          <div class="bottom-controls">
            <PlayerControls compact={true} source={$audioSource} />
          </div>
        {/if}
      </div>
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

  .app-container::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #0a0a0a 0%, #000000 100%);
    z-index: 0;
  }

  /* Side panels for Navidrome */
  .side-panel {
    position: fixed;
    top: 0;
    bottom: 0;
    width: 380px;
    max-width: 90vw;
    z-index: 200;
    animation: slideInPanel 0.3s ease;
  }

  .side-panel.left {
    left: 0;
  }

  .side-panel.right {
    right: 0;
  }

  @keyframes slideInPanel {
    from {
      opacity: 0;
      transform: translateX(-20px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .side-panel.right {
    animation-name: slideInPanelRight;
  }

  @keyframes slideInPanelRight {
    from {
      opacity: 0;
      transform: translateX(20px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
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

  .overlay-ui.controls-hidden .top-bar,
  .overlay-ui.controls-hidden .bottom-controls {
    opacity: 0;
    pointer-events: none;
  }

  .overlay-ui > * {
    pointer-events: auto;
  }

  .top-bar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px 20px;
    transition: opacity 0.3s ease;
    z-index: 100;
  }

  .app-title {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
    color: rgba(255, 255, 255, 0.4);
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
    transition: color 0.3s ease;
  }

  .top-bar:hover .app-title {
    color: rgba(255, 255, 255, 0.7);
  }

  .top-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .top-btn {
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.6);
    transition: all 0.3s ease;
  }

  .top-btn:hover {
    background: rgba(0, 0, 0, 0.7);
    border-color: rgba(79, 195, 247, 0.5);
    color: #4fc3f7;
  }

  .top-btn.active {
    background: rgba(79, 195, 247, 0.2);
    border-color: #4fc3f7;
    color: #4fc3f7;
  }

  .top-btn svg {
    width: 22px;
    height: 22px;
  }

  .hamburger-btn {
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.8);
    transition: all 0.3s ease;
  }

  .hamburger-btn:hover {
    background: rgba(0, 0, 0, 0.7);
    border-color: rgba(29, 185, 84, 0.5);
    color: #1db954;
  }

  .hamburger-btn svg {
    width: 24px;
    height: 24px;
  }

  .menu-panel {
    position: fixed;
    top: 70px;
    right: 20px;
    width: 320px;
    max-height: calc(100vh - 150px);
    background: rgba(0, 0, 0, 0.95);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
    animation: slideIn 0.3s ease;
    overflow-y: auto;
    z-index: 1000;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .menu-title {
    margin: 0 0 15px 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: #1db954;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .menu-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .viz-option {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 12px 16px;
    text-align: left;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .viz-option:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(29, 185, 84, 0.3);
  }

  .viz-option.active {
    background: rgba(29, 185, 84, 0.2);
    border-color: #1db954;
  }

  .viz-option.source-switch {
    border-color: rgba(79, 195, 247, 0.3);
  }

  .viz-option.source-switch:hover {
    background: rgba(79, 195, 247, 0.1);
    border-color: rgba(79, 195, 247, 0.5);
  }

  .viz-name {
    color: white;
    font-weight: 600;
    font-size: 0.95rem;
    margin-bottom: 4px;
  }

  .viz-author {
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.8rem;
  }

  .category-label {
    margin-top: 16px;
    margin-bottom: 8px;
    font-size: 0.75rem;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.4);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    padding-left: 4px;
  }

  .category-label:first-child {
    margin-top: 0;
  }

  .category-label.milkdrop {
    color: rgba(221, 160, 221, 0.6);
  }

  .viz-option.milkdrop {
    border-left: 2px solid rgba(221, 160, 221, 0.3);
  }

  .viz-option.milkdrop:hover {
    border-left-color: rgba(221, 160, 221, 0.6);
    background: rgba(221, 160, 221, 0.1);
  }

  .viz-option.milkdrop.active {
    background: rgba(221, 160, 221, 0.2);
    border-color: plum;
  }

  .center-message {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 50;
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

  .bottom-controls {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 0;
    transition: opacity 0.3s ease, transform 0.3s ease;
    z-index: 100;
  }

  .controls-hidden .bottom-controls {
    transform: translateY(100%);
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
      font-size: 1.2rem;
    }

    .top-bar {
      padding: 12px 15px;
    }

    .side-panel {
      width: 100%;
      max-width: 100%;
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
