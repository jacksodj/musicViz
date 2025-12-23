<script>
  import { onMount } from 'svelte';
  import { getNavidromeApi } from '$lib/services/NavidromeApi.js';
  import { navidromePlayerStore } from '$lib/stores/navidromePlayerStore.js';
  import { addToQueue, addNext } from '$lib/stores/queueStore.js';

  let api = $state(null);
  let searchQuery = $state('');
  let searchResults = $state({ artists: [], albums: [], songs: [] });
  let recentAlbums = $state([]);
  let isSearching = $state(false);
  let isLoadingRecent = $state(true);
  let searchTimeout = null;
  let activeTab = $state('songs'); // 'songs' | 'albums' | 'artists'

  // Props
  let { onClose = () => {} } = $props();

  onMount(async () => {
    try {
      api = getNavidromeApi();
      api.initialize();

      // Load recent albums
      const albums = await api.getRecentAlbums(12);
      recentAlbums = albums.map(a => api.normalizeAlbum(a));
    } catch (error) {
      console.error('[NavidromeBrowser] Failed to initialize:', error);
    } finally {
      isLoadingRecent = false;
    }
  });

  async function handleSearch() {
    if (!searchQuery.trim()) {
      searchResults = { artists: [], albums: [], songs: [] };
      return;
    }

    isSearching = true;

    try {
      const results = await api.search(searchQuery);
      searchResults = {
        artists: results.artist || [],
        albums: (results.album || []).map(a => api.normalizeAlbum(a)),
        songs: (results.song || []).map(s => api.normalizeTrack(s))
      };
    } catch (error) {
      console.error('[NavidromeBrowser] Search failed:', error);
    } finally {
      isSearching = false;
    }
  }

  function handleSearchInput() {
    // Debounce search
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    searchTimeout = setTimeout(handleSearch, 300);
  }

  async function playTrack(track) {
    try {
      await navidromePlayerStore.playTrack(track);
    } catch (error) {
      console.error('[NavidromeBrowser] Failed to play track:', error);
    }
  }

  async function playAlbum(album, startIndex = 0) {
    try {
      // Fetch full album with songs if needed
      let songs = album.songs;
      if (!songs || songs.length === 0) {
        const fullAlbum = await api.getAlbum(album.id);
        songs = (fullAlbum.song || []).map(s => api.normalizeTrack(s));
      }

      if (songs.length > 0) {
        await navidromePlayerStore.playTracks(songs, startIndex);
      }
    } catch (error) {
      console.error('[NavidromeBrowser] Failed to play album:', error);
    }
  }

  function handleAddToQueue(track) {
    addToQueue(track);
  }

  function handlePlayNext(track) {
    addNext(track);
  }

  function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
</script>

<div class="browser">
  <div class="browser-header">
    <h2>Browse Music</h2>
    <button class="close-btn" onclick={onClose} aria-label="Close browser">
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
      </svg>
    </button>
  </div>

  <div class="search-container">
    <div class="search-input-wrapper">
      <svg class="search-icon" viewBox="0 0 24 24" fill="currentColor">
        <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
      </svg>
      <input
        type="search"
        bind:value={searchQuery}
        oninput={handleSearchInput}
        placeholder="Search tracks, albums, artists..."
        class="search-input"
      />
      {#if isSearching}
        <div class="search-spinner"></div>
      {/if}
    </div>
  </div>

  {#if searchQuery.trim()}
    <!-- Search Results -->
    <div class="tabs">
      <button
        class="tab"
        class:active={activeTab === 'songs'}
        onclick={() => activeTab = 'songs'}
      >
        Songs ({searchResults.songs.length})
      </button>
      <button
        class="tab"
        class:active={activeTab === 'albums'}
        onclick={() => activeTab = 'albums'}
      >
        Albums ({searchResults.albums.length})
      </button>
      <button
        class="tab"
        class:active={activeTab === 'artists'}
        onclick={() => activeTab = 'artists'}
      >
        Artists ({searchResults.artists.length})
      </button>
    </div>

    <div class="results">
      {#if activeTab === 'songs'}
        {#if searchResults.songs.length === 0}
          <p class="empty-message">No songs found</p>
        {:else}
          <div class="track-list">
            {#each searchResults.songs as track}
              <div class="track-row">
                <button class="track-main" onclick={() => playTrack(track)}>
                  {#if track.album.images[0]?.url}
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
                    <span class="track-artist">{track.artists[0]?.name}</span>
                  </div>
                  <span class="track-duration">{formatDuration(track.duration_ms)}</span>
                </button>
                <div class="track-actions">
                  <button class="action-btn" onclick={() => handlePlayNext(track)} title="Play Next">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6 18V6h2v12H6zm3.5-6l8.5 6V6l-8.5 6z"/>
                    </svg>
                  </button>
                  <button class="action-btn" onclick={() => handleAddToQueue(track)} title="Add to Queue">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                    </svg>
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      {:else if activeTab === 'albums'}
        {#if searchResults.albums.length === 0}
          <p class="empty-message">No albums found</p>
        {:else}
          <div class="album-grid">
            {#each searchResults.albums as album}
              <button class="album-card" onclick={() => playAlbum(album)}>
                {#if album.coverArtUrl}
                  <img src={album.coverArtUrl} alt="" class="album-art" />
                {:else}
                  <div class="album-art placeholder">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z"/>
                    </svg>
                  </div>
                {/if}
                <div class="album-info">
                  <span class="album-name">{album.name}</span>
                  <span class="album-artist">{album.artist}</span>
                </div>
              </button>
            {/each}
          </div>
        {/if}
      {:else if activeTab === 'artists'}
        {#if searchResults.artists.length === 0}
          <p class="empty-message">No artists found</p>
        {:else}
          <div class="artist-list">
            {#each searchResults.artists as artist}
              <div class="artist-row">
                <div class="artist-avatar">
                  {artist.name.charAt(0).toUpperCase()}
                </div>
                <span class="artist-name">{artist.name}</span>
                <span class="artist-albums">{artist.albumCount || 0} albums</span>
              </div>
            {/each}
          </div>
        {/if}
      {/if}
    </div>
  {:else}
    <!-- Recent Albums -->
    <div class="section">
      <h3 class="section-title">Recently Added</h3>
      {#if isLoadingRecent}
        <div class="loading">
          <div class="spinner"></div>
          <p>Loading...</p>
        </div>
      {:else if recentAlbums.length === 0}
        <p class="empty-message">No albums found</p>
      {:else}
        <div class="album-grid">
          {#each recentAlbums as album}
            <button class="album-card" onclick={() => playAlbum(album)}>
              {#if album.coverArtUrl}
                <img src={album.coverArtUrl} alt="" class="album-art" />
              {:else}
                <div class="album-art placeholder">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z"/>
                  </svg>
                </div>
              {/if}
              <div class="album-info">
                <span class="album-name">{album.name}</span>
                <span class="album-artist">{album.artist}</span>
              </div>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .browser {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: rgba(0, 0, 0, 0.95);
    backdrop-filter: blur(20px);
    color: white;
  }

  .browser-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .browser-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #4fc3f7;
  }

  .close-btn {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    color: white;
  }

  .close-btn svg {
    width: 20px;
    height: 20px;
  }

  .search-container {
    padding: 1rem 1.5rem;
  }

  .search-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-icon {
    position: absolute;
    left: 1rem;
    width: 20px;
    height: 20px;
    color: rgba(255, 255, 255, 0.4);
  }

  .search-input {
    width: 100%;
    padding: 0.875rem 1rem 0.875rem 3rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    color: white;
    font-size: 1rem;
    transition: all 0.2s ease;
  }

  .search-input::placeholder {
    color: rgba(255, 255, 255, 0.3);
  }

  .search-input:focus {
    outline: none;
    border-color: #4fc3f7;
    background: rgba(79, 195, 247, 0.1);
  }

  .search-spinner {
    position: absolute;
    right: 1rem;
    width: 20px;
    height: 20px;
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-top-color: #4fc3f7;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .tabs {
    display: flex;
    gap: 0.5rem;
    padding: 0 1.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .tab {
    padding: 0.75rem 1rem;
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s ease;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
  }

  .tab:hover {
    color: rgba(255, 255, 255, 0.8);
  }

  .tab.active {
    color: #4fc3f7;
    border-bottom-color: #4fc3f7;
  }

  .results,
  .section {
    flex: 1;
    overflow-y: auto;
    padding: 1rem 1.5rem;
  }

  .section-title {
    margin: 0 0 1rem 0;
    font-size: 1rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.7);
  }

  .empty-message {
    text-align: center;
    color: rgba(255, 255, 255, 0.4);
    padding: 2rem;
  }

  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    color: rgba(255, 255, 255, 0.5);
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid rgba(255, 255, 255, 0.1);
    border-top-color: #4fc3f7;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: 1rem;
  }

  /* Track List */
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
    width: 48px;
    height: 48px;
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
    width: 24px;
    height: 24px;
  }

  .track-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .track-name {
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .track-artist {
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.5);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .track-duration {
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.4);
    margin-right: 0.5rem;
  }

  .track-actions {
    display: flex;
    gap: 0.25rem;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .track-row:hover .track-actions {
    opacity: 1;
  }

  .action-btn {
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
  }

  .action-btn:hover {
    background: rgba(79, 195, 247, 0.3);
    color: #4fc3f7;
  }

  .action-btn svg {
    width: 18px;
    height: 18px;
  }

  /* Album Grid */
  .album-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 1rem;
  }

  .album-card {
    display: flex;
    flex-direction: column;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    padding: 0.75rem;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
  }

  .album-card:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(79, 195, 247, 0.3);
    transform: translateY(-2px);
  }

  .album-art {
    width: 100%;
    aspect-ratio: 1;
    border-radius: 8px;
    object-fit: cover;
    margin-bottom: 0.75rem;
  }

  .album-art.placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.3);
  }

  .album-art.placeholder svg {
    width: 40%;
    height: 40%;
  }

  .album-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .album-name {
    font-weight: 500;
    font-size: 0.9rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .album-artist {
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.5);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Artist List */
  .artist-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .artist-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem;
    border-radius: 8px;
    transition: background 0.2s ease;
  }

  .artist-row:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .artist-avatar {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(79, 195, 247, 0.2);
    border-radius: 50%;
    font-size: 1.25rem;
    font-weight: 600;
    color: #4fc3f7;
  }

  .artist-name {
    flex: 1;
    font-weight: 500;
  }

  .artist-albums {
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.4);
  }

  @media (max-width: 480px) {
    .album-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
