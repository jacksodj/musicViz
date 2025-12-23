// Navidrome Player Service
// Handles audio playback via HTMLAudioElement with queue management

import { getNavidromeApi } from '$lib/services/NavidromeApi.js';
import {
  queue,
  currentIndex,
  currentQueueTrack,
  nextTrack as queueNextTrack,
  previousTrack as queuePreviousTrack,
  setQueue,
  clearQueue,
  playAtIndex
} from '$lib/stores/queueStore.js';

export class NavidromePlayer {
  constructor() {
    this.audioElement = null;
    this.api = null;
    this.isReady = false;
    this.eventListeners = new Map();

    // Current state
    this.currentState = {
      paused: true,
      position: 0,
      duration: 0,
      track: null,
      volume: 1.0
    };

    // Unsubscribe functions
    this.unsubscribers = [];
  }

  /**
   * Initialize the player
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      console.log('[NavidromePlayer] Initializing...');

      // Get API instance
      this.api = getNavidromeApi();

      // Create audio element
      this.audioElement = new Audio();
      this.audioElement.crossOrigin = 'anonymous';
      this.audioElement.preload = 'auto';

      // Set up audio element event listeners
      this.setupAudioEvents();

      // Subscribe to queue changes
      this.setupQueueSubscription();

      this.isReady = true;
      this.emit('ready', {});

      console.log('[NavidromePlayer] Initialized successfully');
    } catch (error) {
      console.error('[NavidromePlayer] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Set up audio element event listeners
   */
  setupAudioEvents() {
    this.audioElement.addEventListener('play', () => {
      this.currentState.paused = false;
      this.emitStateChanged();
    });

    this.audioElement.addEventListener('pause', () => {
      this.currentState.paused = true;
      this.emitStateChanged();
    });

    this.audioElement.addEventListener('timeupdate', () => {
      this.currentState.position = Math.floor(this.audioElement.currentTime * 1000);
      // Throttle state updates during playback
      if (!this._lastTimeUpdate || Date.now() - this._lastTimeUpdate > 250) {
        this._lastTimeUpdate = Date.now();
        this.emitStateChanged();
      }
    });

    this.audioElement.addEventListener('durationchange', () => {
      this.currentState.duration = Math.floor(this.audioElement.duration * 1000) || 0;
      this.emitStateChanged();
    });

    this.audioElement.addEventListener('ended', () => {
      console.log('[NavidromePlayer] Track ended');
      this.handleTrackEnded();
    });

    this.audioElement.addEventListener('error', (e) => {
      const error = this.audioElement.error;
      const message = error ? `Error code ${error.code}: ${error.message}` : 'Unknown playback error';
      console.error('[NavidromePlayer] Playback error:', message);
      this.emit('playback_error', { message });
    });

    this.audioElement.addEventListener('volumechange', () => {
      this.currentState.volume = this.audioElement.volume;
      this.emit('volume_changed', { volume: this.audioElement.volume });
    });

    this.audioElement.addEventListener('loadstart', () => {
      console.log('[NavidromePlayer] Loading track...');
    });

    this.audioElement.addEventListener('canplay', () => {
      console.log('[NavidromePlayer] Track ready to play');
    });
  }

  /**
   * Subscribe to queue store changes
   */
  setupQueueSubscription() {
    // Update current track when queue position changes
    const unsub = currentQueueTrack.subscribe(track => {
      if (track && track !== this.currentState.track) {
        this.loadTrack(track);
      }
    });
    this.unsubscribers.push(unsub);
  }

  /**
   * Load a track into the audio element
   * @param {object} track - Normalized track object
   */
  async loadTrack(track) {
    if (!track) return;

    console.log(`[NavidromePlayer] Loading track: ${track.name}`);

    this.currentState.track = track;
    this.currentState.position = 0;
    this.currentState.duration = track.duration_ms || 0;

    // Get stream URL
    const streamUrl = this.api.getStreamUrl(track.id);
    this.audioElement.src = streamUrl;

    // Report now playing to server
    try {
      await this.api.nowPlaying(track.id);
    } catch (e) {
      console.warn('[NavidromePlayer] Failed to report now playing:', e);
    }

    this.emitStateChanged();
  }

  /**
   * Handle track ended event
   */
  async handleTrackEnded() {
    // Scrobble the track
    if (this.currentState.track) {
      try {
        await this.api.scrobble(this.currentState.track.id);
      } catch (e) {
        console.warn('[NavidromePlayer] Failed to scrobble:', e);
      }
    }

    // Play next track
    const next = queueNextTrack();
    if (next) {
      await this.play();
    } else {
      // End of queue
      this.currentState.paused = true;
      this.currentState.position = 0;
      this.emitStateChanged();
    }
  }

  /**
   * Play a specific track (sets queue to single track)
   * @param {object} track
   */
  async playTrack(track) {
    setQueue([track], 0);
    await this.play();
  }

  /**
   * Play tracks starting from index
   * @param {Array} tracks
   * @param {number} startIndex
   */
  async playTracks(tracks, startIndex = 0) {
    setQueue(tracks, startIndex);
    await this.play();
  }

  /**
   * Resume/start playback
   */
  async play() {
    if (!this.audioElement.src && this.currentState.track) {
      const streamUrl = this.api.getStreamUrl(this.currentState.track.id);
      this.audioElement.src = streamUrl;
    }

    try {
      await this.audioElement.play();
      console.log('[NavidromePlayer] Playback started');
    } catch (error) {
      console.error('[NavidromePlayer] Failed to play:', error);
      throw error;
    }
  }

  /**
   * Pause playback
   */
  async pause() {
    this.audioElement.pause();
    console.log('[NavidromePlayer] Playback paused');
  }

  /**
   * Toggle play/pause
   */
  async togglePlay() {
    if (this.audioElement.paused) {
      await this.play();
    } else {
      await this.pause();
    }
  }

  /**
   * Skip to next track
   */
  async nextTrack() {
    const next = queueNextTrack();
    if (next) {
      await this.play();
    }
  }

  /**
   * Skip to previous track
   */
  async previousTrack() {
    // If more than 3 seconds in, restart current track
    if (this.audioElement.currentTime > 3) {
      await this.seek(0);
      return;
    }

    const prev = queuePreviousTrack();
    if (prev) {
      await this.play();
    }
  }

  /**
   * Seek to position
   * @param {number} positionMs - Position in milliseconds
   */
  async seek(positionMs) {
    this.audioElement.currentTime = positionMs / 1000;
    this.currentState.position = positionMs;
    this.emitStateChanged();
  }

  /**
   * Set volume
   * @param {number} volume - Volume level (0.0 to 1.0)
   */
  async setVolume(volume) {
    if (volume < 0 || volume > 1) {
      throw new Error('Volume must be between 0 and 1');
    }
    this.audioElement.volume = volume;
    this.currentState.volume = volume;
  }

  /**
   * Get current player state
   * @returns {object}
   */
  getCurrentState() {
    return { ...this.currentState };
  }

  /**
   * Get the audio element (for visualization)
   * @returns {HTMLAudioElement}
   */
  getAudioElement() {
    return this.audioElement;
  }

  /**
   * Check if player is ready
   * @returns {boolean}
   */
  isPlayerReady() {
    return this.isReady;
  }

  /**
   * Disconnect and clean up
   */
  async disconnect() {
    console.log('[NavidromePlayer] Disconnecting...');

    // Unsubscribe from stores
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];

    // Clean up audio element
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.src = '';
      this.audioElement = null;
    }

    // Clear queue
    clearQueue();

    // Reset state
    this.isReady = false;
    this.currentState = {
      paused: true,
      position: 0,
      duration: 0,
      track: null,
      volume: 1.0
    };

    this.eventListeners.clear();

    console.log('[NavidromePlayer] Disconnected');
  }

  /**
   * Emit state changed event
   */
  emitStateChanged() {
    // Get queue info
    let nextTracks = [];
    let prevTracks = [];
    let idx = -1;
    let q = [];

    queue.subscribe(val => q = val)();
    currentIndex.subscribe(val => idx = val)();

    if (idx >= 0) {
      prevTracks = q.slice(0, idx);
      nextTracks = q.slice(idx + 1);
    }

    this.emit('state_changed', {
      paused: this.currentState.paused,
      position: this.currentState.position,
      duration: this.currentState.duration,
      track: this.currentState.track,
      volume: this.currentState.volume,
      nextTracks,
      previousTracks: prevTracks
    });
  }

  // ===== Event Emitter Methods =====

  /**
   * Add event listener
   * @param {string} event
   * @param {Function} callback
   */
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  /**
   * Remove event listener
   * @param {string} event
   * @param {Function} callback
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
   * @param {string} event
   * @param {*} data
   */
  emit(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[NavidromePlayer] Error in ${event} listener:`, error);
        }
      });
    }
  }
}
