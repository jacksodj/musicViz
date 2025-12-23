// Navidrome/Subsonic API Client
// Provides access to server endpoints for browsing, searching, and streaming

import { getNavidromeAuth } from '$lib/stores/navidromeAuthStore.js';

export class NavidromeApi {
  constructor() {
    this.auth = null;
  }

  /**
   * Initialize API with auth credentials
   */
  initialize() {
    this.auth = getNavidromeAuth();
    if (!this.auth.isSessionInitialized()) {
      throw new Error('NavidromeAuth not initialized. Call getStoredCredentials() first.');
    }
  }

  /**
   * Get base URL with auth parameters
   * @param {string} endpoint
   * @param {object} params
   * @returns {string}
   */
  buildUrl(endpoint, params = {}) {
    if (!this.auth || !this.auth.isSessionInitialized()) {
      this.initialize();
    }

    const url = new URL(`${this.auth.getServerUrl()}/rest/${endpoint}`);
    const authParams = this.auth.getAuthParams();

    // Add auth params
    for (const [key, value] of authParams) {
      url.searchParams.set(key, value);
    }

    // Add additional params
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }

    return url.toString();
  }

  /**
   * Make API request
   * @param {string} endpoint
   * @param {object} params
   * @returns {Promise<object>}
   */
  async request(endpoint, params = {}) {
    const url = this.buildUrl(endpoint, params);

    console.log(`[NavidromeApi] Request: ${endpoint}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const subsonicResponse = data['subsonic-response'];

    if (!subsonicResponse) {
      throw new Error('Invalid API response format');
    }

    if (subsonicResponse.status !== 'ok') {
      const error = subsonicResponse.error;
      throw new Error(error?.message || `API error code ${error?.code}`);
    }

    return subsonicResponse;
  }

  // ===== Server Methods =====

  /**
   * Ping server to test connection
   */
  async ping() {
    return this.request('ping');
  }

  /**
   * Get server license info
   */
  async getLicense() {
    return this.request('getLicense');
  }

  // ===== Search Methods =====

  /**
   * Search for artists, albums, and songs
   * @param {string} query
   * @param {object} options
   */
  async search(query, options = {}) {
    const params = {
      query,
      artistCount: options.artistCount ?? 10,
      artistOffset: options.artistOffset ?? 0,
      albumCount: options.albumCount ?? 10,
      albumOffset: options.albumOffset ?? 0,
      songCount: options.songCount ?? 20,
      songOffset: options.songOffset ?? 0
    };

    const response = await this.request('search3', params);
    return response.searchResult3 || { artist: [], album: [], song: [] };
  }

  // ===== Album Methods =====

  /**
   * Get album details with songs
   * @param {string} id
   */
  async getAlbum(id) {
    const response = await this.request('getAlbum', { id });
    return response.album;
  }

  /**
   * Get list of albums
   * @param {string} type - 'recent', 'newest', 'frequent', 'random', 'starred', 'alphabeticalByName', 'alphabeticalByArtist'
   * @param {object} options
   */
  async getAlbumList(type = 'recent', options = {}) {
    const params = {
      type,
      size: options.size ?? 20,
      offset: options.offset ?? 0
    };

    const response = await this.request('getAlbumList2', params);
    return response.albumList2?.album || [];
  }

  /**
   * Get random albums
   * @param {number} size
   */
  async getRandomAlbums(size = 20) {
    return this.getAlbumList('random', { size });
  }

  /**
   * Get recently added albums
   * @param {number} size
   */
  async getRecentAlbums(size = 20) {
    return this.getAlbumList('recent', { size });
  }

  // ===== Artist Methods =====

  /**
   * Get artist details
   * @param {string} id
   */
  async getArtist(id) {
    const response = await this.request('getArtist', { id });
    return response.artist;
  }

  /**
   * Get all artists indexed
   */
  async getArtists() {
    const response = await this.request('getArtists');
    return response.artists?.index || [];
  }

  // ===== Song Methods =====

  /**
   * Get song details
   * @param {string} id
   */
  async getSong(id) {
    const response = await this.request('getSong', { id });
    return response.song;
  }

  /**
   * Get random songs
   * @param {number} size
   */
  async getRandomSongs(size = 20) {
    const response = await this.request('getRandomSongs', { size });
    return response.randomSongs?.song || [];
  }

  /**
   * Get starred songs
   */
  async getStarredSongs() {
    const response = await this.request('getStarred2');
    return response.starred2?.song || [];
  }

  // ===== Playlist Methods =====

  /**
   * Get all playlists
   */
  async getPlaylists() {
    const response = await this.request('getPlaylists');
    return response.playlists?.playlist || [];
  }

  /**
   * Get playlist with songs
   * @param {string} id
   */
  async getPlaylist(id) {
    const response = await this.request('getPlaylist', { id });
    return response.playlist;
  }

  // ===== Media URLs =====

  /**
   * Get stream URL for a song
   * @param {string} id - Song ID
   * @param {object} options
   */
  getStreamUrl(id, options = {}) {
    const params = {
      id,
      // maxBitRate: 0 means no transcoding (original quality)
      maxBitRate: options.maxBitRate ?? 0,
      // format: 'raw' means original format
      format: options.format ?? 'raw'
    };

    return this.buildUrl('stream', params);
  }

  /**
   * Get cover art URL
   * @param {string} id - Album or song ID
   * @param {number} size - Image size (pixels)
   */
  getCoverArtUrl(id, size = 300) {
    if (!id) {
      return null;
    }
    return this.buildUrl('getCoverArt', { id, size });
  }

  // ===== Playback Reporting =====

  /**
   * Report that playback has started (scrobble)
   * @param {string} id
   */
  async scrobble(id) {
    await this.request('scrobble', { id, submission: true });
  }

  /**
   * Report current playback position (now playing)
   * @param {string} id
   */
  async nowPlaying(id) {
    await this.request('scrobble', { id, submission: false });
  }

  // ===== Utility Methods =====

  /**
   * Normalize song data to common format
   * @param {object} song - Subsonic song object
   * @returns {object} Normalized track object
   */
  normalizeTrack(song) {
    return {
      id: song.id,
      name: song.title,
      artists: [{ name: song.artist || 'Unknown Artist' }],
      album: {
        name: song.album || 'Unknown Album',
        images: song.coverArt ? [{ url: this.getCoverArtUrl(song.coverArt) }] : []
      },
      duration_ms: (song.duration || 0) * 1000,
      // Additional Navidrome-specific fields
      _navidrome: {
        artistId: song.artistId,
        albumId: song.albumId,
        coverArt: song.coverArt,
        genre: song.genre,
        year: song.year,
        track: song.track,
        discNumber: song.discNumber,
        bitRate: song.bitRate,
        suffix: song.suffix,
        contentType: song.contentType,
        path: song.path
      }
    };
  }

  /**
   * Normalize album data
   * @param {object} album - Subsonic album object
   * @returns {object} Normalized album object
   */
  normalizeAlbum(album) {
    return {
      id: album.id,
      name: album.name || album.title,
      artist: album.artist,
      artistId: album.artistId,
      coverArt: album.coverArt,
      coverArtUrl: this.getCoverArtUrl(album.coverArt),
      songCount: album.songCount,
      duration: album.duration,
      year: album.year,
      genre: album.genre,
      songs: album.song?.map(s => this.normalizeTrack(s)) || []
    };
  }
}

// Singleton instance
let apiInstance = null;

/**
 * Get or create NavidromeApi instance
 * @returns {NavidromeApi}
 */
export function getNavidromeApi() {
  if (!apiInstance) {
    apiInstance = new NavidromeApi();
  }
  return apiInstance;
}

/**
 * Reset API instance (on logout)
 */
export function resetNavidromeApi() {
  apiInstance = null;
}
