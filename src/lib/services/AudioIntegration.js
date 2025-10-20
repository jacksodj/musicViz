/**
 * Audio Integration Module
 *
 * Connects the Spotify Web Playback SDK to the AudioAnalyzer
 * for real-time visualization.
 *
 * This module handles the Web Audio API plumbing required to
 * capture audio from the Spotify player for analysis.
 */

import { AudioAnalyzer } from './AudioAnalyzer.js';
import {
  updateAudioData,
  setAnalysisState,
  setAnalysisError,
  resetAudioData
} from '$lib/stores/audioStore.js';

export class AudioIntegration {
  constructor(spotifyPlayer) {
    this.spotifyPlayer = spotifyPlayer;
    this.analyzer = null;
    this.isConnected = false;

    // Audio elements and nodes
    this.audioElement = null;
    this.mediaElementSource = null;
  }

  /**
   * Initialize audio analysis for Spotify player
   * This method sets up the Web Audio API to capture Spotify audio
   *
   * @returns {Promise<AudioAnalyzer>}
   */
  async initialize() {
    try {
      setAnalysisState('initializing');

      // Create the AudioAnalyzer
      this.analyzer = new AudioAnalyzer();

      // Initialize the analyzer (creates audio context, etc.)
      await this.analyzer.initialize();

      console.log('AudioIntegration initialized');

      return this.analyzer;
    } catch (error) {
      setAnalysisError(`Failed to initialize audio integration: ${error.message}`);
      throw error;
    }
  }

  /**
   * Connect to the Spotify Web Playback SDK audio
   *
   * The Spotify Web Playback SDK uses an internal HTMLAudioElement.
   * We need to find it and connect it to our Web Audio API analyzer.
   *
   * @returns {Promise<void>}
   */
  async connectToSpotify() {
    if (!this.analyzer) {
      throw new Error('AudioAnalyzer not initialized. Call initialize() first.');
    }

    if (!this.spotifyPlayer || !this.spotifyPlayer.isPlayerReady()) {
      throw new Error('Spotify player not ready');
    }

    try {
      // Find the audio element created by Spotify SDK
      this.audioElement = await this._findSpotifyAudioElement();

      if (!this.audioElement) {
        throw new Error('Could not find Spotify audio element');
      }

      console.log('Found Spotify audio element:', this.audioElement);

      // Connect the audio element to our analyzer
      this.analyzer.connectSource(this.audioElement);

      // Start the analysis loop
      this.analyzer.startAnalysis((audioData) => {
        updateAudioData(audioData);
      });

      this.isConnected = true;
      setAnalysisState('active');

      console.log('Successfully connected to Spotify audio for analysis');
    } catch (error) {
      setAnalysisError(`Failed to connect to Spotify audio: ${error.message}`);
      throw error;
    }
  }

  /**
   * Find the audio element created by the Spotify Web Playback SDK
   *
   * The Spotify SDK creates an HTMLAudioElement internally.
   * We need to locate it in the DOM.
   *
   * @private
   * @returns {Promise<HTMLAudioElement>}
   */
  async _findSpotifyAudioElement() {
    console.log('[AudioIntegration] Starting search for Spotify audio element...');

    // Strategy 1: Look for audio elements with Spotify URLs
    let audioElements = document.querySelectorAll('audio');
    console.log(`[AudioIntegration] Found ${audioElements.length} audio elements on page`);

    for (const element of audioElements) {
      console.log('[AudioIntegration] Checking audio element:', {
        src: element.src,
        paused: element.paused,
        readyState: element.readyState
      });

      if (element.src && (
        element.src.includes('spotify') ||
        element.src.includes('audio-ak-') || // Spotify CDN pattern
        element.src.includes('scdn.co') ||
        element.src.includes('audio-fa.scdn.co')
      )) {
        console.log('[AudioIntegration] ✓ Found Spotify audio element:', element.src);
        return element;
      }
    }

    // Strategy 2: Look for ANY audio element (Spotify might use blob URLs)
    console.log('[AudioIntegration] No Spotify URLs found, checking for any audio element...');
    for (const element of audioElements) {
      if (element.src || element.srcObject) {
        console.log('[AudioIntegration] ✓ Found audio element (any src):', element.src || 'srcObject');
        return element;
      }
    }

    // Strategy 3: The SDK might create the element after initialization
    // Wait a bit and try again
    console.log('[AudioIntegration] Waiting 2 seconds for SDK to create audio element...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    audioElements = document.querySelectorAll('audio');
    console.log(`[AudioIntegration] After wait: Found ${audioElements.length} audio elements`);

    for (const element of audioElements) {
      console.log('[AudioIntegration] Checking audio element:', {
        src: element.src,
        srcObject: element.srcObject,
        paused: element.paused,
        readyState: element.readyState
      });

      if (element.src || element.srcObject) {
        console.log('[AudioIntegration] ✓ Found audio element:', element.src || 'srcObject');
        return element;
      }
    }

    // Strategy 4: Use MutationObserver to wait for audio element creation
    console.log('[AudioIntegration] Using MutationObserver to watch for audio element...');

    return new Promise((resolve, reject) => {
      const observer = new MutationObserver((mutations) => {
        const audioElements = document.querySelectorAll('audio');
        console.log(`[AudioIntegration] MutationObserver: Found ${audioElements.length} audio elements`);

        for (const element of audioElements) {
          if (element.src || element.srcObject) {
            console.log('[AudioIntegration] ✓ MutationObserver found audio element!');
            observer.disconnect();
            resolve(element);
            return;
          }
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      // Timeout after 15 seconds
      setTimeout(() => {
        observer.disconnect();
        console.error('[AudioIntegration] ✗ Timeout waiting for Spotify audio element after 15s');
        reject(new Error('Timeout waiting for Spotify audio element. The Spotify SDK may not create an audio element until music is playing. Try starting playback from your Spotify client.'));
      }, 15000);
    });
  }

  /**
   * Resume audio context (required after user interaction in browsers)
   */
  async resume() {
    if (this.analyzer) {
      await this.analyzer.resume();
    }
  }

  /**
   * Pause analysis (keeps analyzer alive but stops processing)
   */
  pause() {
    if (this.analyzer) {
      this.analyzer.stopAnalysis();
      setAnalysisState('paused');
    }
  }

  /**
   * Resume analysis
   */
  resumeAnalysis() {
    if (this.analyzer && this.isConnected) {
      this.analyzer.startAnalysis((audioData) => {
        updateAudioData(audioData);
      });
      setAnalysisState('active');
    }
  }

  /**
   * Disconnect and clean up
   */
  disconnect() {
    if (this.analyzer) {
      this.analyzer.dispose();
      this.analyzer = null;
    }

    if (this.mediaElementSource) {
      this.mediaElementSource.disconnect();
      this.mediaElementSource = null;
    }

    this.audioElement = null;
    this.isConnected = false;

    resetAudioData();
    setAnalysisState('idle');

    console.log('AudioIntegration disconnected');
  }

  /**
   * Get the analyzer instance
   * @returns {AudioAnalyzer|null}
   */
  getAnalyzer() {
    return this.analyzer;
  }

  /**
   * Check if connected
   * @returns {boolean}
   */
  isAudioConnected() {
    return this.isConnected;
  }
}

/**
 * Helper function to set up complete audio integration
 *
 * Usage in a Svelte component:
 *
 * import { setupAudioIntegration } from '$lib/services/AudioIntegration.js';
 *
 * let audioIntegration;
 *
 * onMount(async () => {
 *   audioIntegration = await setupAudioIntegration(spotifyPlayer);
 * });
 *
 * onDestroy(() => {
 *   audioIntegration?.disconnect();
 * });
 */
export async function setupAudioIntegration(spotifyPlayer) {
  const integration = new AudioIntegration(spotifyPlayer);
  let connectionAttempted = false;
  let connectionSuccessful = false;

  console.log('[setupAudioIntegration] Starting audio integration setup...');

  // Initialize the analyzer
  await integration.initialize();

  // Attempt to connect to Spotify audio
  const attemptConnection = async (context = 'unknown') => {
    if (connectionSuccessful) {
      console.log('[setupAudioIntegration] Already connected, skipping');
      return;
    }

    try {
      console.log(`[setupAudioIntegration] Attempting connection (context: ${context})...`);
      await integration.connectToSpotify();
      connectionSuccessful = true;
      console.log('[setupAudioIntegration] ✓ Connection successful!');
    } catch (error) {
      console.error(`[setupAudioIntegration] ✗ Connection failed (${context}):`, error.message);

      // Don't throw - we'll try again when playback starts
      if (!connectionAttempted) {
        console.log('[setupAudioIntegration] Will retry when playback starts...');
      }
    } finally {
      connectionAttempted = true;
    }
  };

  // Listen for player ready event to connect audio
  if (spotifyPlayer.isPlayerReady()) {
    // Player is already ready, try to connect
    console.log('[setupAudioIntegration] Player is ready, attempting immediate connection...');
    await attemptConnection('player-ready');
  } else {
    // Wait for player to be ready
    console.log('[setupAudioIntegration] Waiting for player to be ready...');
    spotifyPlayer.on('ready', async () => {
      console.log('[setupAudioIntegration] Player ready event received');
      await attemptConnection('ready-event');
    });
  }

  // Listen for player state changes - retry connection when playback starts
  spotifyPlayer.on('state_changed', async (state) => {
    console.log('[setupAudioIntegration] Player state changed:', {
      paused: state.paused,
      hasTrack: !!state.track,
      connected: connectionSuccessful
    });

    if (!state.paused && state.track && !connectionSuccessful) {
      // Music is playing but we're not connected - try to connect now!
      console.log('[setupAudioIntegration] Music is playing, retrying audio connection...');
      await attemptConnection('playback-started');
    }

    if (state.paused) {
      // Optionally pause analysis when playback is paused
      // integration.pause();
    } else {
      // Resume analysis when playback starts
      if (integration.analyzer && !integration.analyzer.isAnalyzing && connectionSuccessful) {
        console.log('[setupAudioIntegration] Resuming audio analysis...');
        integration.resumeAnalysis();
      }
    }
  });

  // Ensure audio context resumes on user interaction
  const resumeOnInteraction = async () => {
    console.log('[setupAudioIntegration] User interaction detected, resuming audio context...');
    await integration.resume();

    // Also retry connection if not successful yet
    if (!connectionSuccessful && spotifyPlayer.isPlayerReady()) {
      console.log('[setupAudioIntegration] Retrying connection after user interaction...');
      await attemptConnection('user-interaction');
    }
  };

  document.addEventListener('click', resumeOnInteraction, { once: true });
  document.addEventListener('keydown', resumeOnInteraction, { once: true });

  return integration;
}
