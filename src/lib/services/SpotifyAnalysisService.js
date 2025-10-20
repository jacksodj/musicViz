// Spotify Audio Analysis API Service
// Fetches and caches audio analysis data for tracks

export class SpotifyAnalysisService {
  constructor() {
    this.cache = new Map(); // trackId → analysis data
    this.maxCacheSize = 50; // Limit memory usage
    this.pendingRequests = new Map(); // trackId → Promise (prevent duplicate requests)
  }

  /**
   * Get audio analysis for a track
   * @param {string} trackId - Spotify track ID
   * @param {string} accessToken - Spotify OAuth token
   * @returns {Promise<Object>} Audio analysis data
   */
  async getAnalysis(trackId, accessToken) {
    if (!trackId) {
      throw new Error('Track ID is required');
    }

    if (!accessToken) {
      throw new Error('Access token is required');
    }

    // Check cache first
    if (this.cache.has(trackId)) {
      console.log(`[SpotifyAnalysisService] Cache hit for track ${trackId}`);
      return this.cache.get(trackId);
    }

    // Check if request is already pending
    if (this.pendingRequests.has(trackId)) {
      console.log(`[SpotifyAnalysisService] Request already pending for track ${trackId}`);
      return this.pendingRequests.get(trackId);
    }

    // Create new request
    const requestPromise = this.fetchAnalysis(trackId, accessToken);
    this.pendingRequests.set(trackId, requestPromise);

    try {
      const data = await requestPromise;

      // Cache the result
      this.cacheAnalysis(trackId, data);

      return data;
    } finally {
      // Clean up pending request
      this.pendingRequests.delete(trackId);
    }
  }

  /**
   * Fetch analysis from Spotify API
   * @private
   */
  async fetchAnalysis(trackId, accessToken) {
    console.log(`[SpotifyAnalysisService] Fetching analysis for track ${trackId}`);
    console.log(`[SpotifyAnalysisService] Token: ${accessToken?.substring(0, 20)}...`);

    const url = `https://api.spotify.com/v1/audio-analysis/${trackId}`;
    console.log(`[SpotifyAnalysisService] Request URL: ${url}`);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`[SpotifyAnalysisService] Response status: ${response.status}`);
    console.log(`[SpotifyAnalysisService] Response headers:`, Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      // Try to get more details from the response body
      let errorDetails = response.statusText;
      try {
        const errorBody = await response.json();
        console.error(`[SpotifyAnalysisService] Error response body:`, errorBody);
        errorDetails = errorBody.error?.message || errorBody.message || response.statusText;
      } catch (e) {
        console.error(`[SpotifyAnalysisService] Could not parse error response`);
      }

      if (response.status === 401) {
        throw new Error('Unauthorized - token may have expired');
      } else if (response.status === 403) {
        throw new Error(`Forbidden - ${errorDetails}. Check Spotify app settings in Developer Dashboard.`);
      } else if (response.status === 404) {
        throw new Error('Track analysis not found');
      } else if (response.status === 429) {
        throw new Error('Rate limited - too many requests');
      }
      throw new Error(`Failed to fetch analysis: ${errorDetails}`);
    }

    const data = await response.json();
    console.log(`[SpotifyAnalysisService] Successfully fetched analysis for track ${trackId}`);
    console.log(`[SpotifyAnalysisService] Bars: ${data.bars?.length}, Beats: ${data.beats?.length}, Segments: ${data.segments?.length}`);

    return data;
  }

  /**
   * Cache analysis data with LRU eviction
   * @private
   */
  cacheAnalysis(trackId, data) {
    // If cache is full, remove oldest entry (first one)
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      console.log(`[SpotifyAnalysisService] Cache full - evicted ${firstKey}`);
    }

    this.cache.set(trackId, data);
    console.log(`[SpotifyAnalysisService] Cached analysis for ${trackId} (cache size: ${this.cache.size})`);
  }

  /**
   * Prefetch analysis for a track (non-blocking)
   * @param {string} trackId - Spotify track ID
   * @param {string} accessToken - Spotify OAuth token
   */
  prefetch(trackId, accessToken) {
    if (!this.cache.has(trackId) && !this.pendingRequests.has(trackId)) {
      console.log(`[SpotifyAnalysisService] Prefetching analysis for ${trackId}`);
      this.getAnalysis(trackId, accessToken).catch(error => {
        console.warn(`[SpotifyAnalysisService] Prefetch failed for ${trackId}:`, error);
      });
    }
  }

  /**
   * Prefetch analysis for upcoming tracks in queue
   * @param {Array<Object>} nextTracks - Array of track objects from player state
   * @param {string} accessToken - Spotify OAuth token
   */
  prefetchQueue(nextTracks, accessToken) {
    if (!nextTracks || nextTracks.length === 0) return;

    // Prefetch next 3 tracks
    nextTracks.slice(0, 3).forEach(track => {
      this.prefetch(track.id, accessToken);
    });
  }

  /**
   * Clear the cache
   */
  clearCache() {
    this.cache.clear();
    console.log('[SpotifyAnalysisService] Cache cleared');
  }

  /**
   * Get cache stats
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      trackIds: Array.from(this.cache.keys())
    };
  }
}

// Export singleton instance
export const spotifyAnalysisService = new SpotifyAnalysisService();
