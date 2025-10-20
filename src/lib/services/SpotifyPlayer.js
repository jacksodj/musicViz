// Spotify Web Playback SDK Service
// Handles audio streaming and playback control

import { invoke } from '@tauri-apps/api/core';

export class SpotifyPlayer {
  constructor() {
    this.player = null;
    this.deviceId = null;
    this.isReady = false;
    this.eventListeners = new Map();

    // Track current state
    this.currentState = {
      paused: true,
      position: 0,
      duration: 0,
      track: null,
      volume: 1.0
    };
  }

  /**
   * Initialize the Spotify Web Playback SDK
   * @returns {Promise<string>} Device ID of the created player
   */
  async initialize() {
    try {
      // Get access token from Rust backend
      const tokenData = await invoke('get_spotify_token');
      if (!tokenData || !tokenData.access_token) {
        throw new Error('No access token available');
      }

      const token = tokenData.access_token;

      // Wait for Spotify SDK to be loaded
      await this.waitForSpotifySDK();

      return new Promise((resolve, reject) => {
        // Create player instance
        this.player = new window.Spotify.Player({
          name: 'musicViz Player',
          getOAuthToken: async (cb) => {
            try {
              // Get fresh token (handles refresh automatically)
              const freshToken = await this.getAccessToken();
              cb(freshToken);
            } catch (error) {
              console.error('Failed to get OAuth token:', error);
              cb(token); // Fallback to current token
            }
          },
          volume: 1.0
        });

        // Error handling
        this.player.addListener('initialization_error', ({ message }) => {
          console.error('Initialization error:', message);
          reject(new Error(`Initialization error: ${message}`));
        });

        this.player.addListener('authentication_error', ({ message }) => {
          console.error('Authentication error:', message);
          this.emit('auth_error', { message });
          reject(new Error(`Authentication error: ${message}`));
        });

        this.player.addListener('account_error', ({ message }) => {
          console.error('Account error:', message);
          reject(new Error(`Account error: ${message}. Spotify Premium required for Web Playback.`));
        });

        this.player.addListener('playback_error', ({ message }) => {
          console.error('Playback error:', message);
          this.emit('playback_error', { message });
        });

        // Ready event - player is initialized and ready to use
        this.player.addListener('ready', ({ device_id }) => {
          console.log('Player ready with Device ID:', device_id);
          this.deviceId = device_id;
          this.isReady = true;
          this.emit('ready', { device_id });
          resolve(device_id);
        });

        // Not Ready event
        this.player.addListener('not_ready', ({ device_id }) => {
          console.log('Device has gone offline:', device_id);
          this.isReady = false;
          this.emit('not_ready', { device_id });
        });

        // Player state changes
        this.player.addListener('player_state_changed', (state) => {
          if (!state) {
            console.log('Player state is null - playback stopped');
            this.currentState = {
              paused: true,
              position: 0,
              duration: 0,
              track: null,
              volume: this.currentState.volume
            };
            this.emit('state_changed', this.currentState);
            return;
          }

          console.log('Player state changed:', state);

          // Update current state
          this.currentState = {
            paused: state.paused,
            position: state.position,
            duration: state.duration,
            track: state.track_window.current_track,
            nextTracks: state.track_window.next_tracks,
            previousTracks: state.track_window.previous_tracks,
            volume: this.currentState.volume
          };

          this.emit('state_changed', this.currentState);
        });

        // Connect to the player
        this.player.connect().then(success => {
          if (success) {
            console.log('Successfully connected to Spotify Web Playback SDK');
          } else {
            reject(new Error('Failed to connect to Spotify Web Playback SDK'));
          }
        });
      });
    } catch (error) {
      console.error('Failed to initialize Spotify Player:', error);
      throw error;
    }
  }

  /**
   * Wait for Spotify SDK to be loaded
   * @returns {Promise<void>}
   */
  waitForSpotifySDK() {
    return new Promise((resolve, reject) => {
      if (window.Spotify) {
        resolve();
        return;
      }

      // Set up callback for when SDK loads
      window.onSpotifyWebPlaybackSDKReady = () => {
        resolve();
      };

      // Timeout after 10 seconds
      setTimeout(() => {
        if (!window.Spotify) {
          reject(new Error('Spotify SDK failed to load'));
        }
      }, 10000);
    });
  }

  /**
   * Get fresh access token from backend
   * @returns {Promise<string>}
   */
  async getAccessToken() {
    try {
      const tokenData = await invoke('get_spotify_token');
      if (!tokenData || !tokenData.access_token) {
        throw new Error('No access token available');
      }
      return tokenData.access_token;
    } catch (error) {
      console.error('Failed to get access token:', error);
      throw error;
    }
  }

  /**
   * Transfer playback to this device
   * @param {boolean} play - Whether to start playing immediately
   * @returns {Promise<void>}
   */
  async transferPlayback(play = true) {
    if (!this.deviceId) {
      throw new Error('Player not ready - no device ID');
    }

    try {
      const token = await this.getAccessToken();

      const response = await fetch('https://api.spotify.com/v1/me/player', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          device_ids: [this.deviceId],
          play: play
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to transfer playback: ${error.error?.message || response.statusText}`);
      }

      console.log('Playback transferred to musicViz Player');
      this.emit('playback_transferred', { device_id: this.deviceId });
    } catch (error) {
      console.error('Failed to transfer playback:', error);
      throw error;
    }
  }

  /**
   * Play/Resume playback
   * @returns {Promise<void>}
   */
  async play() {
    if (!this.player) {
      throw new Error('Player not initialized');
    }

    try {
      await this.player.resume();
      console.log('Playback resumed');
    } catch (error) {
      console.error('Failed to play:', error);
      throw error;
    }
  }

  /**
   * Pause playback
   * @returns {Promise<void>}
   */
  async pause() {
    if (!this.player) {
      throw new Error('Player not initialized');
    }

    try {
      await this.player.pause();
      console.log('Playback paused');
    } catch (error) {
      console.error('Failed to pause:', error);
      throw error;
    }
  }

  /**
   * Toggle play/pause
   * @returns {Promise<void>}
   */
  async togglePlay() {
    if (!this.player) {
      throw new Error('Player not initialized');
    }

    try {
      await this.player.togglePlay();
      console.log('Playback toggled');
    } catch (error) {
      console.error('Failed to toggle play:', error);
      throw error;
    }
  }

  /**
   * Skip to next track
   * @returns {Promise<void>}
   */
  async nextTrack() {
    if (!this.player) {
      throw new Error('Player not initialized');
    }

    try {
      await this.player.nextTrack();
      console.log('Skipped to next track');
    } catch (error) {
      console.error('Failed to skip to next track:', error);
      throw error;
    }
  }

  /**
   * Skip to previous track
   * @returns {Promise<void>}
   */
  async previousTrack() {
    if (!this.player) {
      throw new Error('Player not initialized');
    }

    try {
      await this.player.previousTrack();
      console.log('Skipped to previous track');
    } catch (error) {
      console.error('Failed to skip to previous track:', error);
      throw error;
    }
  }

  /**
   * Set volume (0.0 to 1.0)
   * @param {number} volume - Volume level (0.0 to 1.0)
   * @returns {Promise<void>}
   */
  async setVolume(volume) {
    if (!this.player) {
      throw new Error('Player not initialized');
    }

    if (volume < 0 || volume > 1) {
      throw new Error('Volume must be between 0 and 1');
    }

    try {
      await this.player.setVolume(volume);
      this.currentState.volume = volume;
      console.log('Volume set to:', volume);
      this.emit('volume_changed', { volume });
    } catch (error) {
      console.error('Failed to set volume:', error);
      throw error;
    }
  }

  /**
   * Seek to position in track
   * @param {number} positionMs - Position in milliseconds
   * @returns {Promise<void>}
   */
  async seek(positionMs) {
    if (!this.player) {
      throw new Error('Player not initialized');
    }

    try {
      await this.player.seek(positionMs);
      console.log('Seeked to position:', positionMs);
    } catch (error) {
      console.error('Failed to seek:', error);
      throw error;
    }
  }

  /**
   * Get current player state
   * @returns {Promise<object>}
   */
  async getCurrentState() {
    if (!this.player) {
      throw new Error('Player not initialized');
    }

    try {
      const state = await this.player.getCurrentState();
      return state;
    } catch (error) {
      console.error('Failed to get current state:', error);
      throw error;
    }
  }

  /**
   * Disconnect and clean up player
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (this.player) {
      this.player.disconnect();
      this.player = null;
      this.deviceId = null;
      this.isReady = false;
      this.eventListeners.clear();
      console.log('Player disconnected');
    }
  }

  /**
   * Add event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  /**
   * Remove event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  off(event, callback) {
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event);
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to all listeners
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  emit(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Get device ID
   * @returns {string|null}
   */
  getDeviceId() {
    return this.deviceId;
  }

  /**
   * Check if player is ready
   * @returns {boolean}
   */
  isPlayerReady() {
    return this.isReady;
  }
}
