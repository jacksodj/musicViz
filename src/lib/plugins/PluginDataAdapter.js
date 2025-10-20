/**
 * Plugin Data Adapter
 *
 * Aggregates data from multiple sources (player store, analysis store, audio)
 * and provides a unified interface to plugins.
 */

/**
 * PluginDataAdapter class
 * Transforms raw data sources into UnifiedPluginData format
 */
export class PluginDataAdapter {
  constructor() {
    this.lastTimestamp = 0;
    this.lastFps = 60;
  }

  /**
   * Create unified plugin data from multiple sources
   *
   * @param {Object} options - Data sources
   * @param {Object} options.playerState - Player state from playerStore
   * @param {Object} options.analysis - Analysis data from analysisStore
   * @param {Object} options.audioData - Audio data from Web Audio API (optional)
   * @param {number} options.timestamp - Current performance timestamp
   * @param {number} options.fps - Current FPS
   * @returns {UnifiedPluginData}
   */
  createUnifiedData({
    playerState = {},
    analysis = {},
    audioData = null,
    timestamp = 0,
    fps = 60
  }) {
    // Calculate delta time
    const deltaTime = this.lastTimestamp > 0 ? timestamp - this.lastTimestamp : 16.67;
    this.lastTimestamp = timestamp;
    this.lastFps = fps;

    return {
      // Audio data (real-time Web Audio API)
      audio: this._createAudioData(audioData),

      // Music analysis data (Spotify or mock)
      music: this._createMusicData(analysis),

      // Playback state
      playback: this._createPlaybackData(playerState),

      // Timing data
      timing: {
        timestamp,
        deltaTime,
        fps
      }
    };
  }

  /**
   * Create audio data section
   * @private
   */
  _createAudioData(audioData) {
    if (audioData && audioData.frequencyData && audioData.waveformData) {
      // Real audio data available
      return {
        frequencyData: audioData.frequencyData,
        waveformData: audioData.waveformData,
        energy: this._calculateEnergy(audioData.frequencyData),
        available: true
      };
    }

    // Return empty audio data
    return {
      frequencyData: new Uint8Array(0),
      waveformData: new Uint8Array(0),
      energy: 0,
      available: false
    };
  }

  /**
   * Calculate energy level from frequency data
   * @private
   */
  _calculateEnergy(frequencyData) {
    if (!frequencyData || frequencyData.length === 0) return 0;

    let sum = 0;
    for (let i = 0; i < frequencyData.length; i++) {
      sum += frequencyData[i];
    }
    return (sum / (frequencyData.length * 255));
  }

  /**
   * Create music analysis data section
   * @private
   */
  _createMusicData(analysis) {
    const hasData = analysis.trackId && (analysis.beats?.length > 0 || analysis.track?.tempo);

    if (hasData) {
      // Real or mock analysis data available
      return {
        bpm: analysis.track?.tempo || 120,
        tempo: analysis.track?.tempo || 120,
        beats: analysis.beats || [],
        bars: analysis.bars || [],
        segments: analysis.segments || [],
        sections: analysis.sections || [],
        available: true
      };
    }

    // Return default music data
    return {
      bpm: 120,
      tempo: 120,
      beats: [],
      bars: [],
      segments: [],
      sections: [],
      available: false
    };
  }

  /**
   * Create playback data section
   * @private
   */
  _createPlaybackData(playerState) {
    return {
      isPlaying: playerState.isPlaying || false,
      position: playerState.position || 0,
      duration: playerState.duration || 0,
      track: playerState.currentTrack || null
    };
  }

  /**
   * Generate mock audio data for testing
   * Creates pseudo-random frequency and waveform data
   *
   * @param {number} timestamp - Current timestamp
   * @param {number} bpm - Beats per minute
   * @param {boolean} isPlaying - Whether music is playing
   * @returns {Object} Mock audio data
   */
  static generateMockAudioData(timestamp, bpm = 120, isPlaying = false) {
    const fftSize = 2048;
    const bufferLength = fftSize / 2;
    const frequencyData = new Uint8Array(bufferLength);
    const waveformData = new Uint8Array(fftSize);

    if (!isPlaying) {
      return { frequencyData, waveformData };
    }

    // Generate beat-synced data
    const beatInterval = (60 / bpm) * 1000; // ms per beat
    const beatProgress = (timestamp % beatInterval) / beatInterval;
    const beatEnergy = Math.max(0, 1 - beatProgress * 2); // Quick decay

    // Frequency data (bass to treble)
    for (let i = 0; i < bufferLength; i++) {
      const freq = i / bufferLength;

      // Bass frequencies (0-0.2) - pulse with beat
      if (freq < 0.2) {
        const bassEnergy = beatEnergy * 0.8 + 0.2;
        frequencyData[i] = Math.floor(
          bassEnergy * 200 * (1 - freq * 2) + Math.random() * 20
        );
      }
      // Mid frequencies (0.2-0.6) - more stable
      else if (freq < 0.6) {
        frequencyData[i] = Math.floor(
          120 * (1 - freq) + beatEnergy * 50 + Math.random() * 30
        );
      }
      // High frequencies (0.6-1.0) - lower energy
      else {
        frequencyData[i] = Math.floor(
          60 * (1 - freq) + Math.random() * 40
        );
      }
    }

    // Waveform data (time domain)
    const waveFreq = 0.05; // Wave frequency
    for (let i = 0; i < fftSize; i++) {
      const t = (timestamp / 1000 + i / fftSize) * waveFreq;
      const wave = Math.sin(t * Math.PI * 2) * (0.5 + beatEnergy * 0.5);
      waveformData[i] = Math.floor((wave * 0.8 + 0.5) * 255);
    }

    return { frequencyData, waveformData };
  }

  /**
   * Generate mock music analysis data
   * Creates beat/bar intervals based on BPM
   *
   * @param {number} duration - Track duration in seconds
   * @param {number} bpm - Beats per minute
   * @returns {Object} Mock analysis data
   */
  static generateMockMusicAnalysis(duration, bpm = 120) {
    const beatDuration = 60 / bpm; // seconds per beat
    const barDuration = beatDuration * 4; // 4 beats per bar (4/4 time)

    const beats = [];
    const bars = [];
    const segments = [];

    // Generate beats
    for (let time = 0; time < duration; time += beatDuration) {
      beats.push({
        start: time,
        duration: beatDuration,
        confidence: 1.0
      });
    }

    // Generate bars
    for (let time = 0; time < duration; time += barDuration) {
      bars.push({
        start: time,
        duration: barDuration,
        confidence: 1.0
      });
    }

    // Generate segments (approximately every 0.2 seconds)
    const segmentDuration = 0.2;
    for (let time = 0; time < duration; time += segmentDuration) {
      // Generate pseudo-random timbre and pitch vectors
      const timbre = Array.from({ length: 12 }, (_, i) =>
        Math.sin(time + i) * 50
      );
      const pitches = Array.from({ length: 12 }, (_, i) =>
        Math.max(0, Math.sin(time * 2 + i * 0.5))
      );

      segments.push({
        start: time,
        duration: segmentDuration,
        confidence: 1.0,
        loudness_start: -20,
        loudness_max: -10,
        timbre,
        pitches
      });
    }

    return {
      track: { tempo: bpm },
      beats,
      bars,
      segments,
      sections: [],
      trackId: 'mock-track'
    };
  }
}

// Export singleton instance
export const pluginDataAdapter = new PluginDataAdapter();
