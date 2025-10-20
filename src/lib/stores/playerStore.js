// Player state management using Svelte stores
// Manages Spotify Web Playback SDK state

import { writable, derived } from 'svelte/store';
import { SpotifyPlayer } from '$lib/services/SpotifyPlayer.js';

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

  // Device info
  deviceId: null,

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
    artists: $state.currentTrack.artists.map(a => a.name).join(', '),
    album: $state.currentTrack.album.name,
    albumArt: $state.currentTrack.album.images[0]?.url,
    duration: $state.currentTrack.duration_ms,
    uri: $state.currentTrack.uri
  };
});

class PlayerStore {
  // Player instance
  spotifyPlayer = null;
  player = null; // Direct reference to Spotify.Player

  // Expose stores
  state = state;
  progress = progress;
  hasNextTrack = hasNextTrack;
  hasPreviousTrack = hasPreviousTrack;
  currentTrackInfo = currentTrackInfo;

  /**
   * Initialize the Spotify Player
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.spotifyPlayer) {
      console.log('Player already initialized');
      return;
    }

    try {
      state.update(s => ({ ...s, isInitializing: true, error: null }));

      // Create new player instance
      this.spotifyPlayer = new SpotifyPlayer();

      // Set up event listeners
      this.setupEventListeners();

      // Initialize player
      const deviceId = await this.spotifyPlayer.initialize();
      this.player = this.spotifyPlayer.player; // Store reference

      state.update(s => ({
        ...s,
        deviceId,
        isReady: true,
        isInitializing: false
      }));

      console.log('Player store initialized with device ID:', deviceId);

      // Transfer playback to this device
      await this.transferPlayback(false);
    } catch (error) {
      console.error('Failed to initialize player store:', error);
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
    if (!this.spotifyPlayer) return;

    // State changes
    this.spotifyPlayer.on('state_changed', (playerState) => {
      console.log('[playerStore] Received state_changed:', playerState);
      console.log('[playerStore] Current track:', playerState.track);

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
    this.spotifyPlayer.on('ready', ({ device_id }) => {
      state.update(s => ({
        ...s,
        deviceId: device_id,
        isReady: true
      }));
      console.log('Player ready event received in store');
    });

    // Not ready event
    this.spotifyPlayer.on('not_ready', () => {
      state.update(s => ({
        ...s,
        isReady: false
      }));
      console.log('Player not ready event received in store');
    });

    // Error events
    this.spotifyPlayer.on('auth_error', ({ message }) => {
      state.update(s => ({
        ...s,
        error: `Authentication error: ${message}`
      }));
    });

    this.spotifyPlayer.on('playback_error', ({ message }) => {
      state.update(s => ({
        ...s,
        error: `Playback error: ${message}`
      }));
    });

    // Volume change
    this.spotifyPlayer.on('volume_changed', ({ volume }) => {
      state.update(s => ({
        ...s,
        volume
      }));
    });
  }

  /**
   * Transfer playback to this device
   * @param {boolean} play - Start playing immediately
   * @returns {Promise<void>}
   */
  async transferPlayback(play = false) {
    if (!this.spotifyPlayer) {
      throw new Error('Player not initialized');
    }

    try {
      await this.spotifyPlayer.transferPlayback(play);
    } catch (error) {
      console.error('Failed to transfer playback:', error);
      state.update(s => ({ ...s, error: error.message }));
      throw error;
    }
  }

  /**
   * Play/Resume playback
   * @returns {Promise<void>}
   */
  async play() {
    if (!this.spotifyPlayer) {
      throw new Error('Player not initialized');
    }

    try {
      await this.spotifyPlayer.play();
      state.update(s => ({ ...s, error: null }));
    } catch (error) {
      console.error('Failed to play:', error);
      state.update(s => ({ ...s, error: error.message }));
      throw error;
    }
  }

  /**
   * Pause playback
   * @returns {Promise<void>}
   */
  async pause() {
    if (!this.spotifyPlayer) {
      throw new Error('Player not initialized');
    }

    try {
      await this.spotifyPlayer.pause();
      state.update(s => ({ ...s, error: null }));
    } catch (error) {
      console.error('Failed to pause:', error);
      state.update(s => ({ ...s, error: error.message }));
      throw error;
    }
  }

  /**
   * Start playback with specific content
   * @param {Object} options - Playback options
   * @returns {Promise<void>}
   */
  async startPlayback(options = {}) {
    if (!this.spotifyPlayer) {
      throw new Error('Player not initialized');
    }

    try {
      await this.spotifyPlayer.startPlayback(options);
      state.update(s => ({ ...s, error: null }));
    } catch (error) {
      console.error('Failed to start playback:', error);
      state.update(s => ({ ...s, error: error.message }));
      throw error;
    }
  }

  /**
   * Toggle play/pause
   * If no music is playing, tries to resume recent playback or prompts to select content
   * @returns {Promise<void>}
   */
  async togglePlay() {
    if (!this.spotifyPlayer) {
      throw new Error('Player not initialized');
    }

    try {
      // Check current state
      const currentState = await this.spotifyPlayer.getCurrentState();

      // If no playback state, try to start playback with empty options
      // This will resume the user's most recent playback context
      if (!currentState) {
        console.log('No active playback - starting playback with last context');
        await this.spotifyPlayer.startPlayback({});
      } else {
        // Normal toggle when playback exists
        await this.spotifyPlayer.togglePlay();
      }

      state.update(s => ({ ...s, error: null }));
    } catch (error) {
      console.error('Failed to toggle play:', error);
      state.update(s => ({ ...s, error: error.message }));
      throw error;
    }
  }

  /**
   * Skip to next track
   * @returns {Promise<void>}
   */
  async nextTrack() {
    if (!this.spotifyPlayer) {
      throw new Error('Player not initialized');
    }

    try {
      await this.spotifyPlayer.nextTrack();
      state.update(s => ({ ...s, error: null }));
    } catch (error) {
      console.error('Failed to skip to next track:', error);
      state.update(s => ({ ...s, error: error.message }));
      throw error;
    }
  }

  /**
   * Skip to previous track
   * @returns {Promise<void>}
   */
  async previousTrack() {
    if (!this.spotifyPlayer) {
      throw new Error('Player not initialized');
    }

    try {
      await this.spotifyPlayer.previousTrack();
      state.update(s => ({ ...s, error: null }));
    } catch (error) {
      console.error('Failed to skip to previous track:', error);
      state.update(s => ({ ...s, error: error.message }));
      throw error;
    }
  }

  /**
   * Set volume (0.0 to 1.0)
   * @param {number} volume - Volume level
   * @returns {Promise<void>}
   */
  async setVolume(volume) {
    if (!this.spotifyPlayer) {
      throw new Error('Player not initialized');
    }

    try {
      await this.spotifyPlayer.setVolume(volume);
      state.update(s => ({ ...s, error: null }));
    } catch (error) {
      console.error('Failed to set volume:', error);
      state.update(s => ({ ...s, error: error.message }));
      throw error;
    }
  }

  /**
   * Seek to position in track
   * @param {number} positionMs - Position in milliseconds
   * @returns {Promise<void>}
   */
  async seek(positionMs) {
    if (!this.spotifyPlayer) {
      throw new Error('Player not initialized');
    }

    try {
      await this.spotifyPlayer.seek(positionMs);
      state.update(s => ({ ...s, error: null }));
    } catch (error) {
      console.error('Failed to seek:', error);
      state.update(s => ({ ...s, error: error.message }));
      throw error;
    }
  }

  /**
   * Get device ID
   * @returns {string|null}
   */
  getDeviceId() {
    let deviceId = null;
    state.subscribe(s => deviceId = s.deviceId)();
    return deviceId;
  }

  /**
   * Disconnect and clean up
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (this.spotifyPlayer) {
      await this.spotifyPlayer.disconnect();
      this.spotifyPlayer = null;
      this.player = null;

      // Reset state
      state.set({
        isPlaying: false,
        isPaused: true,
        currentTrack: null,
        position: 0,
        duration: 0,
        volume: 1.0,
        deviceId: null,
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
export const playerStore = new PlayerStore();

// Export stores directly for $ syntax in components
export {
  state as playerState,
  progress as playerProgress,
  hasNextTrack as playerHasNextTrack,
  hasPreviousTrack as playerHasPreviousTrack,
  currentTrackInfo as playerCurrentTrackInfo
};
