/**
 * AudioAnalyzer Service
 *
 * Provides real-time audio analysis using Web Audio API with FFT processing.
 * Designed for 60fps visualization at 4K resolution (16.67ms frame budget).
 *
 * Features:
 * - FFT processing with configurable size (default: 2048)
 * - Frequency band extraction with logarithmic scaling
 * - Time-domain waveform data
 * - Smoothed audio features (volume, bass, etc.)
 * - Efficient requestAnimationFrame-based updates
 */

export class AudioAnalyzer {
  // Configuration constants
  static FFT_SIZE = 2048; // Balance between resolution and performance
  static SMOOTHING_TIME_CONSTANT = 0.8; // 0-1, higher = smoother but less responsive
  static MIN_DECIBELS = -90; // Minimum dB value for normalization
  static MAX_DECIBELS = -10; // Maximum dB value for normalization

  // Frequency band definitions (Hz) - based on musical/perceptual ranges
  static FREQUENCY_BANDS = {
    subBass: { min: 20, max: 60, label: 'Sub Bass' },
    bass: { min: 60, max: 250, label: 'Bass' },
    lowMid: { min: 250, max: 500, label: 'Low Mid' },
    mid: { min: 500, max: 2000, label: 'Mid' },
    highMid: { min: 2000, max: 4000, label: 'High Mid' },
    presence: { min: 4000, max: 6000, label: 'Presence' },
    brilliance: { min: 6000, max: 20000, label: 'Brilliance' }
  };

  // Number of spectrum bars for visualization (logarithmic distribution)
  static SPECTRUM_BAR_COUNT = 64;

  constructor() {
    this.audioContext = null;
    this.analyserNode = null;
    this.sourceNode = null;
    this.isAnalyzing = false;
    this.animationFrameId = null;

    // Pre-allocated typed arrays for efficiency
    this.frequencyData = null;
    this.timeDomainData = null;
    this.smoothedFrequencyData = null;

    // Spectrum bar bin mappings (logarithmic)
    this.spectrumBinMappings = null;

    // Frequency band bin ranges
    this.bandBinRanges = {};

    // Previous frame data for smoothing
    this.previousFrequencyData = null;

    // Callback for data updates
    this.onDataUpdate = null;
  }

  /**
   * Initialize the audio analyzer
   * @param {AudioNode|MediaStream} audioSource - Source to analyze (from Spotify SDK)
   * @returns {Promise<void>}
   */
  async initialize(audioSource = null) {
    try {
      // Create or resume audio context
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Create analyser node
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = AudioAnalyzer.FFT_SIZE;
      this.analyserNode.smoothingTimeConstant = AudioAnalyzer.SMOOTHING_TIME_CONSTANT;
      this.analyserNode.minDecibels = AudioAnalyzer.MIN_DECIBELS;
      this.analyserNode.maxDecibels = AudioAnalyzer.MAX_DECIBELS;

      // Calculate buffer sizes
      const bufferLength = this.analyserNode.frequencyBinCount; // FFT_SIZE / 2

      // Allocate typed arrays
      this.frequencyData = new Uint8Array(bufferLength);
      this.timeDomainData = new Uint8Array(bufferLength);
      this.smoothedFrequencyData = new Float32Array(bufferLength);
      this.previousFrequencyData = new Float32Array(bufferLength);

      // Pre-calculate frequency band bin ranges
      this._calculateBandBinRanges();

      // Pre-calculate spectrum bar bin mappings (logarithmic)
      this._calculateSpectrumBinMappings();

      // Connect audio source if provided
      if (audioSource) {
        this.connectSource(audioSource);
      }

      console.log('AudioAnalyzer initialized:', {
        fftSize: this.analyserNode.fftSize,
        frequencyBinCount: bufferLength,
        sampleRate: this.audioContext.sampleRate,
        spectrumBars: AudioAnalyzer.SPECTRUM_BAR_COUNT
      });

      return true;
    } catch (error) {
      console.error('Failed to initialize AudioAnalyzer:', error);
      throw error;
    }
  }

  /**
   * Connect an audio source to the analyzer
   * @param {AudioNode|MediaStream|HTMLMediaElement} source - Audio source
   */
  connectSource(source) {
    try {
      // Disconnect existing source
      if (this.sourceNode) {
        this.sourceNode.disconnect();
      }

      // Handle different source types
      if (source instanceof MediaStream) {
        this.sourceNode = this.audioContext.createMediaStreamSource(source);
      } else if (source instanceof HTMLMediaElement) {
        this.sourceNode = this.audioContext.createMediaElementSource(source);
      } else if (source.connect) {
        // Already an AudioNode
        this.sourceNode = source;
      } else {
        throw new Error('Unsupported audio source type');
      }

      // Connect to analyser (but not to destination - we don't want to play it)
      this.sourceNode.connect(this.analyserNode);

      console.log('Audio source connected to analyzer');
    } catch (error) {
      console.error('Failed to connect audio source:', error);
      throw error;
    }
  }

  /**
   * Start the analysis loop
   * @param {Function} callback - Called on each frame with audio data
   */
  startAnalysis(callback) {
    if (this.isAnalyzing) {
      console.warn('Analysis already running');
      return;
    }

    this.onDataUpdate = callback;
    this.isAnalyzing = true;
    this._analyze();

    console.log('Audio analysis started');
  }

  /**
   * Stop the analysis loop
   */
  stopAnalysis() {
    this.isAnalyzing = false;

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    console.log('Audio analysis stopped');
  }

  /**
   * Internal analysis loop (runs at 60fps via requestAnimationFrame)
   * @private
   */
  _analyze() {
    if (!this.isAnalyzing) return;

    // Get raw frequency and time-domain data
    this.analyserNode.getByteFrequencyData(this.frequencyData);
    this.analyserNode.getByteTimeDomainData(this.timeDomainData);

    // Apply temporal smoothing to frequency data
    this._applySmoothing();

    // Extract frequency bands
    const bands = this._extractFrequencyBands();

    // Extract spectrum bars (logarithmic distribution)
    const spectrum = this._extractSpectrumBars();

    // Calculate audio features
    const features = this._calculateAudioFeatures(bands);

    // Normalize time-domain data to -1 to 1 range
    const waveform = this._normalizeWaveform();

    // Prepare data package
    const audioData = {
      // Raw data
      frequencyData: this.frequencyData, // Uint8Array (0-255)
      timeDomainData: this.timeDomainData, // Uint8Array (0-255)

      // Processed data
      spectrum, // Array of bar heights (0-1), logarithmically distributed
      waveform, // Float32Array (-1 to 1)
      bands, // Frequency band levels (0-1)

      // Audio features
      volume: features.volume, // Overall volume (0-1)
      bass: features.bass, // Bass level (0-1)
      mid: features.mid, // Mid level (0-1)
      treble: features.treble, // Treble level (0-1)

      // Metadata
      timestamp: performance.now(),
      sampleRate: this.audioContext.sampleRate
    };

    // Call the update callback
    if (this.onDataUpdate) {
      this.onDataUpdate(audioData);
    }

    // Schedule next frame
    this.animationFrameId = requestAnimationFrame(() => this._analyze());
  }

  /**
   * Apply temporal smoothing to reduce jitter
   * @private
   */
  _applySmoothing() {
    const smoothingFactor = 0.7; // 0 = no smoothing, 1 = maximum smoothing

    for (let i = 0; i < this.frequencyData.length; i++) {
      const current = this.frequencyData[i] / 255.0; // Normalize to 0-1
      const previous = this.previousFrequencyData[i];

      // Exponential moving average
      this.smoothedFrequencyData[i] = smoothingFactor * previous + (1 - smoothingFactor) * current;
      this.previousFrequencyData[i] = this.smoothedFrequencyData[i];
    }
  }

  /**
   * Extract frequency bands with averaging
   * @private
   * @returns {Object} Band levels (0-1)
   */
  _extractFrequencyBands() {
    const bands = {};

    for (const [key, range] of Object.entries(this.bandBinRanges)) {
      let sum = 0;
      let count = range.end - range.start;

      // Average the bins in this band
      for (let i = range.start; i < range.end; i++) {
        sum += this.smoothedFrequencyData[i];
      }

      bands[key] = count > 0 ? sum / count : 0;
    }

    return bands;
  }

  /**
   * Extract spectrum bars with logarithmic distribution
   * @private
   * @returns {Float32Array} Spectrum bar heights (0-1)
   */
  _extractSpectrumBars() {
    const spectrum = new Float32Array(AudioAnalyzer.SPECTRUM_BAR_COUNT);

    for (let i = 0; i < AudioAnalyzer.SPECTRUM_BAR_COUNT; i++) {
      const mapping = this.spectrumBinMappings[i];
      let sum = 0;

      // Average bins for this bar
      for (let j = mapping.start; j < mapping.end; j++) {
        sum += this.smoothedFrequencyData[j];
      }

      const count = mapping.end - mapping.start;
      spectrum[i] = count > 0 ? sum / count : 0;
    }

    return spectrum;
  }

  /**
   * Calculate high-level audio features
   * @private
   * @param {Object} bands - Frequency band levels
   * @returns {Object} Audio features
   */
  _calculateAudioFeatures(bands) {
    // Overall volume (RMS of all frequencies)
    let sumSquares = 0;
    for (let i = 0; i < this.smoothedFrequencyData.length; i++) {
      sumSquares += this.smoothedFrequencyData[i] * this.smoothedFrequencyData[i];
    }
    const volume = Math.sqrt(sumSquares / this.smoothedFrequencyData.length);

    // Bass: average of sub-bass and bass bands
    const bass = (bands.subBass + bands.bass) / 2;

    // Mid: average of low-mid, mid, and high-mid
    const mid = (bands.lowMid + bands.mid + bands.highMid) / 3;

    // Treble: average of presence and brilliance
    const treble = (bands.presence + bands.brilliance) / 2;

    return { volume, bass, mid, treble };
  }

  /**
   * Normalize time-domain data to -1 to 1 range
   * @private
   * @returns {Float32Array} Normalized waveform
   */
  _normalizeWaveform() {
    const waveform = new Float32Array(this.timeDomainData.length);

    for (let i = 0; i < this.timeDomainData.length; i++) {
      // Convert from 0-255 to -1 to 1
      waveform[i] = (this.timeDomainData[i] - 128) / 128.0;
    }

    return waveform;
  }

  /**
   * Pre-calculate bin ranges for each frequency band
   * @private
   */
  _calculateBandBinRanges() {
    const nyquist = this.audioContext.sampleRate / 2;
    const binCount = this.analyserNode.frequencyBinCount;

    for (const [key, band] of Object.entries(AudioAnalyzer.FREQUENCY_BANDS)) {
      const startBin = Math.floor((band.min / nyquist) * binCount);
      const endBin = Math.ceil((band.max / nyquist) * binCount);

      this.bandBinRanges[key] = {
        start: Math.max(0, startBin),
        end: Math.min(binCount, endBin)
      };
    }
  }

  /**
   * Pre-calculate logarithmic bin mappings for spectrum bars
   * Human hearing is logarithmic, so we want more bars for lower frequencies
   * @private
   */
  _calculateSpectrumBinMappings() {
    const binCount = this.analyserNode.frequencyBinCount;
    this.spectrumBinMappings = new Array(AudioAnalyzer.SPECTRUM_BAR_COUNT);

    for (let i = 0; i < AudioAnalyzer.SPECTRUM_BAR_COUNT; i++) {
      // Logarithmic distribution
      const logIndex = Math.log(i + 1) / Math.log(AudioAnalyzer.SPECTRUM_BAR_COUNT);
      const start = Math.floor(logIndex * binCount);
      const nextLogIndex = Math.log(i + 2) / Math.log(AudioAnalyzer.SPECTRUM_BAR_COUNT);
      const end = Math.ceil(nextLogIndex * binCount);

      this.spectrumBinMappings[i] = {
        start: Math.min(start, binCount - 1),
        end: Math.min(end, binCount)
      };
    }
  }

  /**
   * Get current audio context state
   * @returns {string} Audio context state
   */
  getState() {
    return this.audioContext?.state || 'closed';
  }

  /**
   * Resume audio context (required after user interaction in many browsers)
   */
  async resume() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
      console.log('Audio context resumed');
    }
  }

  /**
   * Clean up resources
   */
  dispose() {
    this.stopAnalysis();

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.analyserNode) {
      this.analyserNode.disconnect();
      this.analyserNode = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    // Clear typed arrays
    this.frequencyData = null;
    this.timeDomainData = null;
    this.smoothedFrequencyData = null;
    this.previousFrequencyData = null;

    console.log('AudioAnalyzer disposed');
  }
}
