// Audio Analysis Store
// Manages Spotify audio analysis data for the current track

import { writable, derived } from 'svelte/store';

// Create writable store for analysis data
const analysis = writable({
  // Track-level data
  track: null,    // {duration, tempo, key, mode, time_signature, etc.}
  meta: null,     // {analyzer_version, platform, status, etc.}

  // Temporal data (all arrays of {start, duration, confidence})
  bars: [],       // Musical measures
  beats: [],      // Individual beats
  tatums: [],     // Sub-beat divisions
  sections: [],   // Large structural segments
  segments: [],   // Small sound chunks with timbre/pitch data

  // Current track ID
  trackId: null,

  // Loading state
  isLoading: false,
  error: null,
});

// Derived store for quick access to arrays
export const bars = derived(analysis, $analysis => $analysis.bars);
export const beats = derived(analysis, $analysis => $analysis.beats);
export const tatums = derived(analysis, $analysis => $analysis.tatums);
export const sections = derived(analysis, $analysis => $analysis.sections);
export const segments = derived(analysis, $analysis => $analysis.segments);
export const trackInfo = derived(analysis, $analysis => $analysis.track);

// Derived store for loaded state
export const hasAnalysis = derived(analysis, $analysis =>
  $analysis.trackId !== null &&
  $analysis.beats.length > 0
);

// Derived store for error state
export const analysisError = derived(analysis, $analysis => $analysis.error);

class AnalysisStore {
  // Expose main store
  analysis = analysis;

  // Expose derived stores
  bars = bars;
  beats = beats;
  tatums = tatums;
  sections = sections;
  segments = segments;
  trackInfo = trackInfo;
  hasAnalysis = hasAnalysis;

  /**
   * Set analysis data for a track
   * @param {string} trackId - Spotify track ID
   * @param {Object} data - Audio analysis data from Spotify API
   */
  setAnalysis(trackId, data) {
    if (!data) {
      console.error('[analysisStore] Cannot set null analysis data');
      return;
    }

    analysis.update(s => ({
      track: data.track || null,
      meta: data.meta || null,
      bars: data.bars || [],
      beats: data.beats || [],
      tatums: data.tatums || [],
      sections: data.sections || [],
      segments: data.segments || [],
      trackId,
      isLoading: false,
      error: null
    }));

    console.log(`[analysisStore] Analysis loaded for track ${trackId}`);
    console.log(`[analysisStore] Bars: ${data.bars?.length}, Beats: ${data.beats?.length}, Segments: ${data.segments?.length}`);
  }

  /**
   * Set loading state
   * @param {boolean} isLoading - Loading state
   */
  setLoading(isLoading) {
    analysis.update(s => ({ ...s, isLoading, error: null }));
  }

  /**
   * Set error state
   * @param {string} error - Error message
   */
  setError(error) {
    analysis.update(s => ({
      ...s,
      isLoading: false,
      error
    }));
    console.error('[analysisStore] Error:', error);
  }

  /**
   * Clear analysis data
   */
  clear() {
    analysis.set({
      track: null,
      meta: null,
      bars: [],
      beats: [],
      tatums: [],
      sections: [],
      segments: [],
      trackId: null,
      isLoading: false,
      error: null
    });
    console.log('[analysisStore] Analysis cleared');
  }

  /**
   * Find active interval at given position
   * @param {Array} intervals - Array of {start, duration} objects
   * @param {number} positionMs - Position in milliseconds
   * @returns {Object|null} Active interval or null
   */
  findActiveInterval(intervals, positionMs) {
    if (!intervals || intervals.length === 0) return null;

    const positionSec = positionMs / 1000;

    return intervals.find(interval =>
      positionSec >= interval.start &&
      positionSec < (interval.start + interval.duration)
    ) || null;
  }

  /**
   * Find active beat at given position
   * @param {number} positionMs - Position in milliseconds
   * @returns {Object|null} Active beat or null
   */
  findActiveBeat(positionMs) {
    let currentBeats = [];
    const unsubscribe = beats.subscribe(b => currentBeats = b);
    const result = this.findActiveInterval(currentBeats, positionMs);
    unsubscribe();
    return result;
  }

  /**
   * Find active segment at given position
   * @param {number} positionMs - Position in milliseconds
   * @returns {Object|null} Active segment or null
   */
  findActiveSegment(positionMs) {
    let currentSegments = [];
    const unsubscribe = segments.subscribe(s => currentSegments = s);
    const result = this.findActiveInterval(currentSegments, positionMs);
    unsubscribe();
    return result;
  }

  /**
   * Find active bar at given position
   * @param {number} positionMs - Position in milliseconds
   * @returns {Object|null} Active bar or null
   */
  findActiveBar(positionMs) {
    let currentBars = [];
    const unsubscribe = bars.subscribe(b => currentBars = b);
    const result = this.findActiveInterval(currentBars, positionMs);
    unsubscribe();
    return result;
  }

  /**
   * Get progress within an interval (0.0 to 1.0)
   * @param {Object} interval - Interval object {start, duration}
   * @param {number} positionMs - Position in milliseconds
   * @returns {number} Progress from 0.0 to 1.0
   */
  getIntervalProgress(interval, positionMs) {
    if (!interval) return 0;

    const positionSec = positionMs / 1000;
    const progress = (positionSec - interval.start) / interval.duration;

    return Math.max(0, Math.min(1, progress));
  }
}

// Export singleton instance
export const analysisStore = new AnalysisStore();
