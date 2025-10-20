<script>
  import { onMount, onDestroy } from 'svelte';
  import { playerStore } from '$lib/stores/playerStore.js';

  // Reactive references to store state using Svelte 5 syntax
  let state = $derived(playerStore.state);
  let currentTrackInfo = $derived(playerStore.currentTrackInfo);
  let progress = $derived(playerStore.progress);
  let hasNextTrack = $derived(playerStore.hasNextTrack);
  let hasPreviousTrack = $derived(playerStore.hasPreviousTrack);

  // Local state
  let isDraggingProgress = $state(false);
  let isDraggingVolume = $state(false);
  let localVolume = $state(100);
  let positionUpdateInterval = null;

  // Format time from milliseconds to MM:SS
  function formatTime(ms) {
    if (!ms || isNaN(ms)) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  // Handle play/pause toggle
  async function handleTogglePlay() {
    try {
      await playerStore.togglePlay();
    } catch (error) {
      console.error('Toggle play failed:', error);
    }
  }

  // Handle next track
  async function handleNextTrack() {
    try {
      await playerStore.nextTrack();
    } catch (error) {
      console.error('Next track failed:', error);
    }
  }

  // Handle previous track
  async function handlePreviousTrack() {
    try {
      await playerStore.previousTrack();
    } catch (error) {
      console.error('Previous track failed:', error);
    }
  }

  // Handle volume change
  async function handleVolumeChange(e) {
    const volume = parseFloat(e.target.value) / 100;
    localVolume = e.target.value;
    try {
      await playerStore.setVolume(volume);
    } catch (error) {
      console.error('Volume change failed:', error);
    }
  }

  // Handle progress bar click/drag
  async function handleProgressChange(e) {
    if (!state.duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newPosition = Math.floor(percentage * state.duration);

    try {
      await playerStore.seek(newPosition);
    } catch (error) {
      console.error('Seek failed:', error);
    }
  }

  // Initialize volume from store
  $effect(() => {
    if (!isDraggingVolume) {
      localVolume = state.volume * 100;
    }
  });

  onMount(() => {
    // Update position every second when playing
    positionUpdateInterval = setInterval(() => {
      if (state.isPlaying && !isDraggingProgress) {
        // Position is already updated by the player state
      }
    }, 1000);
  });

  onDestroy(() => {
    if (positionUpdateInterval) {
      clearInterval(positionUpdateInterval);
    }
  });
</script>

<div class="player-controls">
  {#if state.error}
    <div class="error-banner">
      <span>{state.error}</span>
      <button onclick={() => playerStore.clearError()} class="close-error">×</button>
    </div>
  {/if}

  <div class="player-container">
    <!-- Track Info -->
    <div class="track-info">
      {#if currentTrackInfo}
        {#if currentTrackInfo.albumArt}
          <img
            src={currentTrackInfo.albumArt}
            alt={currentTrackInfo.album}
            class="album-art"
          />
        {:else}
          <div class="album-art-placeholder">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
            </svg>
          </div>
        {/if}
        <div class="track-details">
          <div class="track-name">{currentTrackInfo.name}</div>
          <div class="track-artist">{currentTrackInfo.artists}</div>
        </div>
      {:else}
        <div class="album-art-placeholder">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
          </svg>
        </div>
        <div class="track-details">
          <div class="track-name">No track playing</div>
          <div class="track-artist">Start playing music on Spotify</div>
        </div>
      {/if}
    </div>

    <!-- Playback Controls -->
    <div class="playback-controls">
      <div class="control-buttons">
        <button
          onclick={handlePreviousTrack}
          disabled={!hasPreviousTrack || !state.isReady}
          class="control-btn"
          aria-label="Previous track"
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
          </svg>
        </button>

        <button
          onclick={handleTogglePlay}
          disabled={!state.isReady}
          class="control-btn play-btn"
          aria-label={state.isPlaying ? 'Pause' : 'Play'}
        >
          {#if state.isPlaying}
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
            </svg>
          {:else}
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
          {/if}
        </button>

        <button
          onclick={handleNextTrack}
          disabled={!hasNextTrack || !state.isReady}
          class="control-btn"
          aria-label="Next track"
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
          </svg>
        </button>
      </div>

      <!-- Progress Bar -->
      <div class="progress-container">
        <span class="time-label">{formatTime(state.position)}</span>
        <div
          class="progress-bar"
          onclick={handleProgressChange}
          onmousedown={() => isDraggingProgress = true}
          onmouseup={() => isDraggingProgress = false}
          role="slider"
          tabindex="0"
          aria-valuemin="0"
          aria-valuemax={state.duration}
          aria-valuenow={state.position}
        >
          <div class="progress-bg">
            <div class="progress-fill" style="width: {progress}%"></div>
          </div>
        </div>
        <span class="time-label">{formatTime(state.duration)}</span>
      </div>
    </div>

    <!-- Volume Control -->
    <div class="volume-control">
      <svg viewBox="0 0 24 24" fill="currentColor" class="volume-icon">
        {#if localVolume > 50}
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
        {:else if localVolume > 0}
          <path d="M7 9v6h4l5 5V4l-5 5H7z"/>
        {:else}
          <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
        {/if}
      </svg>
      <input
        type="range"
        min="0"
        max="100"
        value={localVolume}
        oninput={handleVolumeChange}
        onmousedown={() => isDraggingVolume = true}
        onmouseup={() => isDraggingVolume = false}
        class="volume-slider"
        aria-label="Volume"
      />
    </div>
  </div>
</div>

<style>
  .player-controls {
    width: 100%;
    background: rgba(0, 0, 0, 0.95);
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    padding: 1rem;
  }

  .error-banner {
    background: rgba(255, 107, 107, 0.2);
    border: 1px solid rgba(255, 107, 107, 0.4);
    border-radius: 8px;
    padding: 0.75rem 1rem;
    margin-bottom: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: #ff6b6b;
    font-size: 0.9rem;
  }

  .close-error {
    background: none;
    border: none;
    color: #ff6b6b;
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }

  .close-error:hover {
    color: #ff8787;
  }

  .player-container {
    display: grid;
    grid-template-columns: 1fr 2fr 1fr;
    gap: 2rem;
    align-items: center;
    max-width: 1400px;
    margin: 0 auto;
  }

  /* Track Info */
  .track-info {
    display: flex;
    align-items: center;
    gap: 1rem;
    min-width: 0;
  }

  .album-art {
    width: 60px;
    height: 60px;
    border-radius: 4px;
    object-fit: cover;
    flex-shrink: 0;
  }

  .album-art-placeholder {
    width: 60px;
    height: 60px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.3);
    flex-shrink: 0;
  }

  .album-art-placeholder svg {
    width: 32px;
    height: 32px;
  }

  .track-details {
    min-width: 0;
    flex: 1;
  }

  .track-name {
    color: white;
    font-weight: 600;
    font-size: 1rem;
    margin-bottom: 0.25rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .track-artist {
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.875rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Playback Controls */
  .playback-controls {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .control-buttons {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 1rem;
  }

  .control-btn {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .control-btn:hover:not(:disabled) {
    color: white;
    background: rgba(255, 255, 255, 0.1);
  }

  .control-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .control-btn svg {
    width: 24px;
    height: 24px;
  }

  .play-btn {
    background: #1db954;
    color: white;
    width: 48px;
    height: 48px;
  }

  .play-btn:hover:not(:disabled) {
    background: #1ed760;
    transform: scale(1.05);
  }

  .play-btn svg {
    width: 28px;
    height: 28px;
  }

  /* Progress Bar */
  .progress-container {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .time-label {
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.75rem;
    min-width: 40px;
    text-align: center;
  }

  .progress-bar {
    flex: 1;
    cursor: pointer;
    padding: 0.5rem 0;
  }

  .progress-bg {
    width: 100%;
    height: 4px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
    overflow: hidden;
    position: relative;
  }

  .progress-fill {
    height: 100%;
    background: #1db954;
    border-radius: 2px;
    transition: width 0.1s linear;
  }

  .progress-bar:hover .progress-bg {
    height: 6px;
  }

  .progress-bar:hover .progress-fill {
    background: #1ed760;
  }

  /* Volume Control */
  .volume-control {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    justify-self: end;
  }

  .volume-icon {
    width: 24px;
    height: 24px;
    color: rgba(255, 255, 255, 0.7);
  }

  .volume-slider {
    width: 100px;
    height: 4px;
    -webkit-appearance: none;
    appearance: none;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
    outline: none;
    cursor: pointer;
  }

  .volume-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    background: #1db954;
    border-radius: 50%;
    cursor: pointer;
  }

  .volume-slider::-moz-range-thumb {
    width: 12px;
    height: 12px;
    background: #1db954;
    border-radius: 50%;
    cursor: pointer;
    border: none;
  }

  .volume-slider:hover::-webkit-slider-thumb {
    background: #1ed760;
  }

  .volume-slider:hover::-moz-range-thumb {
    background: #1ed760;
  }

  /* Responsive */
  @media (max-width: 1024px) {
    .player-container {
      grid-template-columns: 1fr;
      gap: 1.5rem;
    }

    .volume-control {
      justify-self: center;
    }
  }

  @media (max-width: 640px) {
    .player-controls {
      padding: 0.75rem;
    }

    .album-art,
    .album-art-placeholder {
      width: 48px;
      height: 48px;
    }

    .track-name {
      font-size: 0.9rem;
    }

    .track-artist {
      font-size: 0.8rem;
    }

    .volume-slider {
      width: 80px;
    }
  }
</style>
