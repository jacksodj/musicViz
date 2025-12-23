<script>
  import {
    queue,
    currentIndex,
    currentQueueTrack,
    upcomingTracks,
    removeFromQueue,
    playAtIndex,
    clearQueue,
    shuffleQueue,
    repeatMode,
    cycleRepeatMode
  } from '$lib/stores/queueStore.js';

  let { onClose = () => {} } = $props();

  function handlePlayTrack(index) {
    playAtIndex(index);
  }

  function handleRemoveTrack(index) {
    removeFromQueue(index);
  }

  function formatDuration(ms) {
    if (!ms) return '0:00';
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function getRepeatIcon(mode) {
    if (mode === 'one') {
      return 'M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2V9h-1l-2 1v1h1.5v4H13z';
    }
    return 'M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z';
  }
</script>

<div class="queue-panel">
  <div class="queue-header">
    <h2>Queue</h2>
    <div class="queue-actions">
      <button
        class="queue-action-btn"
        class:active={$repeatMode !== 'off'}
        onclick={cycleRepeatMode}
        title={`Repeat: ${$repeatMode}`}
      >
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d={getRepeatIcon($repeatMode)}/>
        </svg>
      </button>
      <button
        class="queue-action-btn"
        onclick={shuffleQueue}
        title="Shuffle"
      >
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
        </svg>
      </button>
      <button
        class="queue-action-btn"
        onclick={clearQueue}
        title="Clear Queue"
      >
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
        </svg>
      </button>
      <button class="close-btn" onclick={onClose} aria-label="Close queue">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>
    </div>
  </div>

  <div class="queue-content">
    {#if $queue.length === 0}
      <div class="empty-queue">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/>
        </svg>
        <p>Queue is empty</p>
        <span>Browse music and add songs to the queue</span>
      </div>
    {:else}
      <!-- Now Playing -->
      {#if $currentQueueTrack}
        <div class="now-playing-section">
          <h3 class="section-label">Now Playing</h3>
          <div class="track-row now-playing">
            {#if $currentQueueTrack.album?.images?.[0]?.url}
              <img src={$currentQueueTrack.album.images[0].url} alt="" class="track-art" />
            {:else}
              <div class="track-art placeholder">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                </svg>
              </div>
            {/if}
            <div class="track-info">
              <span class="track-name">{$currentQueueTrack.name}</span>
              <span class="track-artist">{$currentQueueTrack.artists?.[0]?.name || 'Unknown'}</span>
            </div>
            <div class="playing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      {/if}

      <!-- Up Next -->
      {#if $upcomingTracks.length > 0}
        <div class="up-next-section">
          <h3 class="section-label">Up Next ({$upcomingTracks.length})</h3>
          <div class="track-list">
            {#each $upcomingTracks as track, i}
              {@const actualIndex = $currentIndex + 1 + i}
              <div class="track-row">
                <button class="track-main" onclick={() => handlePlayTrack(actualIndex)}>
                  {#if track.album?.images?.[0]?.url}
                    <img src={track.album.images[0].url} alt="" class="track-art" />
                  {:else}
                    <div class="track-art placeholder">
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                      </svg>
                    </div>
                  {/if}
                  <div class="track-info">
                    <span class="track-name">{track.name}</span>
                    <span class="track-artist">{track.artists?.[0]?.name || 'Unknown'}</span>
                  </div>
                  <span class="track-duration">{formatDuration(track.duration_ms)}</span>
                </button>
                <button
                  class="remove-btn"
                  onclick={() => handleRemoveTrack(actualIndex)}
                  title="Remove from queue"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                  </svg>
                </button>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .queue-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: rgba(0, 0, 0, 0.95);
    backdrop-filter: blur(20px);
    color: white;
  }

  .queue-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .queue-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #4fc3f7;
  }

  .queue-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .queue-action-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.05);
    border: none;
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .queue-action-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.8);
  }

  .queue-action-btn.active {
    background: rgba(79, 195, 247, 0.2);
    color: #4fc3f7;
  }

  .queue-action-btn svg {
    width: 18px;
    height: 18px;
  }

  .close-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    transition: all 0.2s ease;
    margin-left: 0.5rem;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    color: white;
  }

  .close-btn svg {
    width: 18px;
    height: 18px;
  }

  .queue-content {
    flex: 1;
    overflow-y: auto;
    padding: 1rem 1.5rem;
  }

  .empty-queue {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    text-align: center;
    color: rgba(255, 255, 255, 0.4);
  }

  .empty-queue svg {
    width: 64px;
    height: 64px;
    margin-bottom: 1rem;
    opacity: 0.3;
  }

  .empty-queue p {
    font-size: 1.1rem;
    margin: 0 0 0.5rem 0;
    color: rgba(255, 255, 255, 0.6);
  }

  .empty-queue span {
    font-size: 0.9rem;
  }

  .section-label {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: rgba(255, 255, 255, 0.4);
    margin: 0 0 0.75rem 0;
  }

  .now-playing-section {
    margin-bottom: 1.5rem;
  }

  .up-next-section {
    margin-bottom: 1rem;
  }

  .track-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .track-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    border-radius: 8px;
    transition: background 0.2s ease;
  }

  .track-row:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .track-row.now-playing {
    background: rgba(79, 195, 247, 0.1);
    border: 1px solid rgba(79, 195, 247, 0.2);
  }

  .track-main {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    background: none;
    border: none;
    color: white;
    cursor: pointer;
    text-align: left;
    padding: 0;
  }

  .track-art {
    width: 44px;
    height: 44px;
    border-radius: 6px;
    object-fit: cover;
    flex-shrink: 0;
  }

  .track-art.placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.3);
  }

  .track-art.placeholder svg {
    width: 22px;
    height: 22px;
  }

  .track-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .track-name {
    font-weight: 500;
    font-size: 0.95rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .track-artist {
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.5);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .track-duration {
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.4);
    margin-right: 0.5rem;
  }

  .remove-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.3);
    cursor: pointer;
    transition: all 0.2s ease;
    opacity: 0;
  }

  .track-row:hover .remove-btn {
    opacity: 1;
  }

  .remove-btn:hover {
    color: #ff6b6b;
  }

  .remove-btn svg {
    width: 16px;
    height: 16px;
  }

  .playing-indicator {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 16px;
    padding-right: 0.5rem;
  }

  .playing-indicator span {
    width: 3px;
    background: #4fc3f7;
    border-radius: 1px;
    animation: playing 0.8s ease-in-out infinite;
  }

  .playing-indicator span:nth-child(1) {
    height: 60%;
    animation-delay: 0s;
  }

  .playing-indicator span:nth-child(2) {
    height: 100%;
    animation-delay: 0.2s;
  }

  .playing-indicator span:nth-child(3) {
    height: 40%;
    animation-delay: 0.4s;
  }

  @keyframes playing {
    0%, 100% {
      transform: scaleY(0.5);
    }
    50% {
      transform: scaleY(1);
    }
  }
</style>
