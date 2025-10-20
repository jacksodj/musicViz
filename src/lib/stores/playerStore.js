// Player state management using Svelte 5 runes
// Manages Spotify Web Playback SDK state

import { SpotifyPlayer } from '$lib/services/SpotifyPlayer.js';

class PlayerStore {
  // Player instance
  spotifyPlayer = null;

  // Player state using Svelte 5 $state rune
  state = $state({
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

  // Derived states using $derived
  progress = $derived.by(() => {
    if (this.state.duration === 0) return 0;
    return (this.state.position / this.state.duration) * 100;
  });

  hasNextTrack = $derived.by(() => {
    return this.state.nextTracks && this.state.nextTracks.length > 0;
  });

  hasPreviousTrack = $derived.by(() => {
    return this.state.previousTracks && this.state.previousTracks.length > 0;
  });

  currentTrackInfo = $derived.by(() => {
    if (!this.state.currentTrack) return null;

    return {
      name: this.state.currentTrack.name,
      artists: this.state.currentTrack.artists.map(a => a.name).join(', '),
      album: this.state.currentTrack.album.name,
      albumArt: this.state.currentTrack.album.images[0]?.url,
      duration: this.state.currentTrack.duration_ms,
      uri: this.state.currentTrack.uri
    };
  });

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
      this.state.isInitializing = true;
      this.state.error = null;

      // Create new player instance
      this.spotifyPlayer = new SpotifyPlayer();

      // Set up event listeners
      this.setupEventListeners();

      // Initialize player
      const deviceId = await this.spotifyPlayer.initialize();

      this.state.deviceId = deviceId;
      this.state.isReady = true;
      this.state.isInitializing = false;

      console.log('Player store initialized with device ID:', deviceId);

      // Transfer playback to this device
      await this.transferPlayback(false);
    } catch (error) {
      console.error('Failed to initialize player store:', error);
      this.state.error = error.message;
      this.state.isInitializing = false;
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
      this.state.isPaused = playerState.paused;
      this.state.isPlaying = !playerState.paused;
      this.state.position = playerState.position;
      this.state.duration = playerState.duration;
      this.state.currentTrack = playerState.track;
      this.state.nextTracks = playerState.nextTracks || [];
      this.state.previousTracks = playerState.previousTracks || [];

      if (playerState.volume !== undefined) {
        this.state.volume = playerState.volume;
      }
    });

    // Ready event
    this.spotifyPlayer.on('ready', ({ device_id }) => {
      this.state.deviceId = device_id;
      this.state.isReady = true;
      console.log('Player ready event received in store');
    });

    // Not ready event
    this.spotifyPlayer.on('not_ready', () => {
      this.state.isReady = false;
      console.log('Player not ready event received in store');
    });

    // Error events
    this.spotifyPlayer.on('auth_error', ({ message }) => {
      this.state.error = `Authentication error: ${message}`;
    });

    this.spotifyPlayer.on('playback_error', ({ message }) => {
      this.state.error = `Playback error: ${message}`;
    });

    // Volume change
    this.spotifyPlayer.on('volume_changed', ({ volume }) => {
      this.state.volume = volume;
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
      this.state.error = error.message;
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
      this.state.error = null;
    } catch (error) {
      console.error('Failed to play:', error);
      this.state.error = error.message;
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
      this.state.error = null;
    } catch (error) {
      console.error('Failed to pause:', error);
      this.state.error = error.message;
      throw error;
    }
  }

  /**
   * Toggle play/pause
   * @returns {Promise<void>}
   */
  async togglePlay() {
    if (!this.spotifyPlayer) {
      throw new Error('Player not initialized');
    }

    try {
      await this.spotifyPlayer.togglePlay();
      this.state.error = null;
    } catch (error) {
      console.error('Failed to toggle play:', error);
      this.state.error = error.message;
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
      this.state.error = null;
    } catch (error) {
      console.error('Failed to skip to next track:', error);
      this.state.error = error.message;
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
      this.state.error = null;
    } catch (error) {
      console.error('Failed to skip to previous track:', error);
      this.state.error = error.message;
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
      this.state.error = null;
    } catch (error) {
      console.error('Failed to set volume:', error);
      this.state.error = error.message;
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
      this.state.error = null;
    } catch (error) {
      console.error('Failed to seek:', error);
      this.state.error = error.message;
      throw error;
    }
  }

  /**
   * Get device ID
   * @returns {string|null}
   */
  getDeviceId() {
    return this.state.deviceId;
  }

  /**
   * Disconnect and clean up
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (this.spotifyPlayer) {
      await this.spotifyPlayer.disconnect();
      this.spotifyPlayer = null;

      // Reset state
      this.state.isPlaying = false;
      this.state.isPaused = true;
      this.state.currentTrack = null;
      this.state.position = 0;
      this.state.duration = 0;
      this.state.deviceId = null;
      this.state.isReady = false;
      this.state.error = null;
      this.state.nextTracks = [];
      this.state.previousTracks = [];
    }
  }

  /**
   * Clear error
   */
  clearError() {
    this.state.error = null;
  }
}

// Export singleton instance
export const playerStore = new PlayerStore();
