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
    // Strategy 1: Look for audio elements with Spotify URLs
    let audioElements = document.querySelectorAll('audio');

    for (const element of audioElements) {
      if (element.src && (
        element.src.includes('spotify') ||
        element.src.includes('audio-ak-') || // Spotify CDN pattern
        element.src.includes('scdn.co')
      )) {
        return element;
      }
    }

    // Strategy 2: The SDK might create the element after initialization
    // Wait a bit and try again
    await new Promise(resolve => setTimeout(resolve, 1000));

    audioElements = document.querySelectorAll('audio');
    for (const element of audioElements) {
      if (element.src) {
        console.log('Found audio element with src:', element.src);
        return element;
      }
    }

    // Strategy 3: Use MutationObserver to wait for audio element creation
    return new Promise((resolve, reject) => {
      const observer = new MutationObserver((mutations) => {
        const audioElements = document.querySelectorAll('audio');
        for (const element of audioElements) {
          if (element.src) {
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

      // Timeout after 10 seconds
      setTimeout(() => {
        observer.disconnect();
        reject(new Error('Timeout waiting for Spotify audio element'));
      }, 10000);

      // Also trigger playback to force element creation
      // The Spotify SDK might not create the audio element until playback starts
      if (this.spotifyPlayer.currentState.paused) {
        console.log('Triggering playback to force audio element creation...');
        this.spotifyPlayer.play().catch(err => {
          console.warn('Could not trigger playback:', err);
        });
      }
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

  // Initialize the analyzer
  await integration.initialize();

  // Listen for player ready event to connect audio
  if (spotifyPlayer.isPlayerReady()) {
    // Player is already ready, connect immediately
    await integration.connectToSpotify();
  } else {
    // Wait for player to be ready
    spotifyPlayer.on('ready', async () => {
      try {
        await integration.connectToSpotify();
      } catch (error) {
        console.error('Failed to connect audio after player ready:', error);
      }
    });
  }

  // Listen for player state changes
  spotifyPlayer.on('state_changed', (state) => {
    if (state.paused) {
      // Optionally pause analysis when playback is paused
      // integration.pause();
    } else {
      // Resume analysis when playback starts
      if (integration.analyzer && !integration.analyzer.isAnalyzing) {
        integration.resumeAnalysis();
      }
    }
  });

  // Ensure audio context resumes on user interaction
  const resumeOnInteraction = async () => {
    await integration.resume();
    document.removeEventListener('click', resumeOnInteraction);
    document.removeEventListener('keydown', resumeOnInteraction);
  };

  document.addEventListener('click', resumeOnInteraction, { once: true });
  document.addEventListener('keydown', resumeOnInteraction, { once: true });

  return integration;
}
