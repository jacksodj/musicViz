// Navidrome player state management using Svelte stores
// Mirrors the interface of playerStore.js for consistency

import { writable, derived } from 'svelte/store';
import { NavidromePlayer } from '$lib/services/NavidromePlayer.js';

// Create writable store for player state
const state = writable({
  // Playback state
  isPlaying: false,
  isPaused: true,

  // Current track info
  currentTrack: null,

  // Playback position
  position: 0,
  duration: 0,

  // Volume (0.0 to 1.0)
  volume: 1.0,

  // Player status
  isReady: false,
  isInitializing: false,

  // Error handling
  error: null,

  // Queue info
  nextTracks: [],
  previousTracks: []
});

// Derived stores
const progress = derived(state, $state => {
  if ($state.duration === 0) return 0;
  return ($state.position / $state.duration) * 100;
});

const hasNextTrack = derived(state, $state => {
  return $state.nextTracks && $state.nextTracks.length > 0;
});

const hasPreviousTrack = derived(state, $state => {
  return $state.previousTracks && $state.previousTracks.length > 0;
});

const currentTrackInfo = derived(state, $state => {
  if (!$state.currentTrack) return null;

  return {
    name: $state.currentTrack.name,
    artists: $state.currentTrack.artists?.map(a => a.name).join(', ') || 'Unknown Artist',
    album: $state.currentTrack.album?.name || 'Unknown Album',
    albumArt: $state.currentTrack.album?.images?.[0]?.url,
    duration: $state.currentTrack.duration_ms,
    id: $state.currentTrack.id
  };
});

class NavidromePlayerStore {
  // Player instance
  navidromePlayer = null;

  // Expose stores
  state = state;
  progress = progress;
  hasNextTrack = hasNextTrack;
  hasPreviousTrack = hasPreviousTrack;
  currentTrackInfo = currentTrackInfo;

  /**
   * Initialize the Navidrome Player
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.navidromePlayer) {
      console.log('[navidromePlayerStore] Player already initialized');
      return;
    }

    try {
      state.update(s => ({ ...s, isInitializing: true, error: null }));

      // Create new player instance
      this.navidromePlayer = new NavidromePlayer();

      // Set up event listeners
      this.setupEventListeners();

      // Initialize player
      await this.navidromePlayer.initialize();

      state.update(s => ({
        ...s,
        isReady: true,
        isInitializing: false
      }));

      console.log('[navidromePlayerStore] Player initialized');
    } catch (error) {
      console.error('[navidromePlayerStore] Failed to initialize:', error);
      state.update(s => ({
        ...s,
        error: error.message,
        isInitializing: false
      }));
      throw error;
    }
  }

  /**
   * Set up event listeners for player events
   */
  setupEventListeners() {
    if (!this.navidromePlayer) return;

    // State changes
    this.navidromePlayer.on('state_changed', (playerState) => {
      state.update(s => ({
        ...s,
        isPaused: playerState.paused,
        isPlaying: !playerState.paused,
        position: playerState.position,
        duration: playerState.duration,
        currentTrack: playerState.track,
        nextTracks: playerState.nextTracks || [],
        previousTracks: playerState.previousTracks || [],
        volume: playerState.volume !== undefined ? playerState.volume : s.volume
      }));
    });

    // Ready event
    this.navidromePlayer.on('ready', () => {
      state.update(s => ({
        ...s,
        isReady: true
      }));
      console.log('[navidromePlayerStore] Player ready');
    });

    // Error events
    this.navidromePlayer.on('playback_error', ({ message }) => {
      state.update(s => ({
        ...s,
        error: `Playback error: ${message}`
      }));
    });

    // Volume change
    this.navidromePlayer.on('volume_changed', ({ volume }) => {
      state.update(s => ({
        ...s,
        volume
      }));
    });
  }

  /**
   * Play a single track
   * @param {object} track - Normalized track object
   */
  async playTrack(track) {
    if (!this.navidromePlayer) {
      throw new Error('Player not initialized');
    }

    try {
      await this.navidromePlayer.playTrack(track);
      state.update(s => ({ ...s, error: null }));
    } catch (error) {
      console.error('[navidromePlayerStore] Failed to play track:', error);
      state.update(s => ({ ...s, error: error.message }));
      throw error;
    }
  }

  /**
   * Play multiple tracks starting from index
   * @param {Array} tracks
   * @param {number} startIndex
   */
  async playTracks(tracks, startIndex = 0) {
    if (!this.navidromePlayer) {
      throw new Error('Player not initialized');
    }

    try {
      await this.navidromePlayer.playTracks(tracks, startIndex);
      state.update(s => ({ ...s, error: null }));
    } catch (error) {
      console.error('[navidromePlayerStore] Failed to play tracks:', error);
      state.update(s => ({ ...s, error: error.message }));
      throw error;
    }
  }

  /**
   * Resume playback
   */
  async play() {
    if (!this.navidromePlayer) {
      throw new Error('Player not initialized');
    }

    try {
      await this.navidromePlayer.play();
      state.update(s => ({ ...s, error: null }));
    } catch (error) {
      console.error('[navidromePlayerStore] Failed to play:', error);
      state.update(s => ({ ...s, error: error.message }));
      throw error;
    }
  }

  /**
   * Pause playback
   */
  async pause() {
    if (!this.navidromePlayer) {
      throw new Error('Player not initialized');
    }

    try {
      await this.navidromePlayer.pause();
      state.update(s => ({ ...s, error: null }));
    } catch (error) {
      console.error('[navidromePlayerStore] Failed to pause:', error);
      state.update(s => ({ ...s, error: error.message }));
      throw error;
    }
  }

  /**
   * Toggle play/pause
   */
  async togglePlay() {
    if (!this.navidromePlayer) {
      throw new Error('Player not initialized');
    }

    try {
      await this.navidromePlayer.togglePlay();
      state.update(s => ({ ...s, error: null }));
    } catch (error) {
      console.error('[navidromePlayerStore] Failed to toggle play:', error);
      state.update(s => ({ ...s, error: error.message }));
      throw error;
    }
  }

  /**
   * Skip to next track
   */
  async nextTrack() {
    if (!this.navidromePlayer) {
      throw new Error('Player not initialized');
    }

    try {
      await this.navidromePlayer.nextTrack();
      state.update(s => ({ ...s, error: null }));
    } catch (error) {
      console.error('[navidromePlayerStore] Failed to skip:', error);
      state.update(s => ({ ...s, error: error.message }));
      throw error;
    }
  }

  /**
   * Skip to previous track
   */
  async previousTrack() {
    if (!this.navidromePlayer) {
      throw new Error('Player not initialized');
    }

    try {
      await this.navidromePlayer.previousTrack();
      state.update(s => ({ ...s, error: null }));
    } catch (error) {
      console.error('[navidromePlayerStore] Failed to go back:', error);
      state.update(s => ({ ...s, error: error.message }));
      throw error;
    }
  }

  /**
   * Set volume
   * @param {number} volume - 0.0 to 1.0
   */
  async setVolume(volume) {
    if (!this.navidromePlayer) {
      throw new Error('Player not initialized');
    }

    try {
      await this.navidromePlayer.setVolume(volume);
      state.update(s => ({ ...s, error: null }));
    } catch (error) {
      console.error('[navidromePlayerStore] Failed to set volume:', error);
      state.update(s => ({ ...s, error: error.message }));
      throw error;
    }
  }

  /**
   * Seek to position
   * @param {number} positionMs
   */
  async seek(positionMs) {
    if (!this.navidromePlayer) {
      throw new Error('Player not initialized');
    }

    try {
      await this.navidromePlayer.seek(positionMs);
      state.update(s => ({ ...s, error: null }));
    } catch (error) {
      console.error('[navidromePlayerStore] Failed to seek:', error);
      state.update(s => ({ ...s, error: error.message }));
      throw error;
    }
  }

  /**
   * Get audio element for visualization
   * @returns {HTMLAudioElement | null}
   */
  getAudioElement() {
    return this.navidromePlayer?.getAudioElement() || null;
  }

  /**
   * Disconnect and clean up
   */
  async disconnect() {
    if (this.navidromePlayer) {
      await this.navidromePlayer.disconnect();
      this.navidromePlayer = null;

      // Reset state
      state.set({
        isPlaying: false,
        isPaused: true,
        currentTrack: null,
        position: 0,
        duration: 0,
        volume: 1.0,
        isReady: false,
        isInitializing: false,
        error: null,
        nextTracks: [],
        previousTracks: []
      });
    }
  }

  /**
   * Clear error
   */
  clearError() {
    state.update(s => ({ ...s, error: null }));
  }
}

// Export singleton instance
export const navidromePlayerStore = new NavidromePlayerStore();

// Export stores directly for $ syntax in components
export {
  state as navidromePlayerState,
  progress as navidromePlayerProgress,
  hasNextTrack as navidromeHasNextTrack,
  hasPreviousTrack as navidromeHasPreviousTrack,
  currentTrackInfo as navidromeCurrentTrackInfo
};
