/**
 * Audio Store
 *
 * Manages real-time audio analysis data for visualization components.
 * Updated at 60fps by the AudioAnalyzer service.
 */

import { writable, derived } from 'svelte/store';

/**
 * Raw frequency data (Uint8Array, 0-255)
 * Length: FFT_SIZE / 2 (default: 1024 bins)
 */
export const frequencyData = writable(new Uint8Array(1024));

/**
 * Raw time-domain data for waveform (Uint8Array, 0-255)
 * Length: FFT_SIZE / 2 (default: 1024 samples)
 */
export const timeDomainData = writable(new Uint8Array(1024));

/**
 * Spectrum bar data (Float32Array, 0-1)
 * Logarithmically distributed frequency bars for visualization
 * Length: 64 bars
 */
export const spectrumBars = writable(new Float32Array(64));

/**
 * Normalized waveform data (Float32Array, -1 to 1)
 * Ready for waveform visualization
 */
export const waveformData = writable(new Float32Array(1024));

/**
 * Frequency bands (Object with band names as keys)
 * All values normalized 0-1
 * {
 *   subBass: 0.5,
 *   bass: 0.7,
 *   lowMid: 0.4,
 *   mid: 0.6,
 *   highMid: 0.5,
 *   presence: 0.3,
 *   brilliance: 0.2
 * }
 */
export const frequencyBands = writable({
  subBass: 0,
  bass: 0,
  lowMid: 0,
  mid: 0,
  highMid: 0,
  presence: 0,
  brilliance: 0
});

/**
 * High-level audio features (Object)
 * All values normalized 0-1
 * {
 *   volume: 0.6,  // Overall volume/energy
 *   bass: 0.7,    // Bass level
 *   mid: 0.5,     // Mid-range level
 *   treble: 0.4   // Treble level
 * }
 */
export const audioFeatures = writable({
  volume: 0,
  bass: 0,
  mid: 0,
  treble: 0
});

/**
 * Analysis state
 * States: 'idle', 'initializing', 'active', 'paused', 'error'
 */
export const analysisState = writable('idle');

/**
 * Analysis error message
 */
export const analysisError = writable(null);

/**
 * Analysis metadata
 * {
 *   sampleRate: 44100,
 *   fftSize: 2048,
 *   lastUpdate: timestamp
 * }
 */
export const analysisMetadata = writable({
  sampleRate: 0,
  fftSize: 0,
  lastUpdate: 0
});

/**
 * Derived store - is analysis active?
 */
export const isAnalyzing = derived(
  analysisState,
  $analysisState => $analysisState === 'active'
);

/**
 * Derived store - combined audio data for convenience
 * This is useful for components that need multiple data sources
 */
export const audioData = derived(
  [spectrumBars, waveformData, frequencyBands, audioFeatures],
  ([$spectrumBars, $waveformData, $frequencyBands, $audioFeatures]) => ({
    spectrum: $spectrumBars,
    waveform: $waveformData,
    bands: $frequencyBands,
    features: $audioFeatures
  })
);

/**
 * Derived store - bass energy level for beat-reactive effects
 * Combines sub-bass and bass bands
 */
export const bassEnergy = derived(
  frequencyBands,
  $frequencyBands => ($frequencyBands.subBass + $frequencyBands.bass) / 2
);

/**
 * Derived store - treble energy level for high-frequency effects
 * Combines presence and brilliance bands
 */
export const trebleEnergy = derived(
  frequencyBands,
  $frequencyBands => ($frequencyBands.presence + $frequencyBands.brilliance) / 2
);

/**
 * Update audio store with new analysis data
 * Called by AudioAnalyzer on each frame
 *
 * @param {Object} data - Audio analysis data from AudioAnalyzer
 */
export function updateAudioData(data) {
  // Update raw data
  frequencyData.set(data.frequencyData);
  timeDomainData.set(data.timeDomainData);

  // Update processed data
  spectrumBars.set(data.spectrum);
  waveformData.set(data.waveform);
  frequencyBands.set(data.bands);

  // Update features
  audioFeatures.set({
    volume: data.volume,
    bass: data.bass,
    mid: data.mid,
    treble: data.treble
  });

  // Update metadata
  analysisMetadata.set({
    sampleRate: data.sampleRate,
    fftSize: data.frequencyData.length * 2,
    lastUpdate: data.timestamp
  });
}

/**
 * Set analysis state
 */
export function setAnalysisState(state) {
  analysisState.set(state);
  if (state !== 'error') {
    analysisError.set(null);
  }
}

/**
 * Set analysis error
 */
export function setAnalysisError(error) {
  analysisState.set('error');
  analysisError.set(error);
  console.error('Audio analysis error:', error);
}

/**
 * Reset audio store to initial state
 */
export function resetAudioData() {
  frequencyData.set(new Uint8Array(1024));
  timeDomainData.set(new Uint8Array(1024));
  spectrumBars.set(new Float32Array(64));
  waveformData.set(new Float32Array(1024));

  frequencyBands.set({
    subBass: 0,
    bass: 0,
    lowMid: 0,
    mid: 0,
    highMid: 0,
    presence: 0,
    brilliance: 0
  });

  audioFeatures.set({
    volume: 0,
    bass: 0,
    mid: 0,
    treble: 0
  });

  analysisState.set('idle');
  analysisError.set(null);

  analysisMetadata.set({
    sampleRate: 0,
    fftSize: 0,
    lastUpdate: 0
  });
}
