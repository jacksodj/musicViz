// Spotify OAuth with PKCE (Proof Key for Code Exchange)
// No Client Secret needed - secure for native apps

import { invoke } from '@tauri-apps/api/core';

export class SpotifyAuth {
  constructor() {
    this.clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
    this.redirectUri = import.meta.env.VITE_SPOTIFY_REDIRECT_URI || 'musicviz://callback';
    this.scopes = [
      'user-read-playback-state',
      'user-modify-playback-state',
      'user-read-currently-playing',
      'streaming',
      'user-read-email',
      'user-read-private',
    ];

    if (!this.clientId) {
      throw new Error('VITE_SPOTIFY_CLIENT_ID not found in environment variables');
    }
  }

  /**
   * Generate a random string for PKCE code_verifier
   * @param {number} length - Length of random string (43-128 chars)
   * @returns {string}
   */
  generateRandomString(length) {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(values)
      .map(x => possible[x % possible.length])
      .join('');
  }

  /**
   * Base64 URL encode (without padding)
   * @param {ArrayBuffer} buffer
   * @returns {string}
   */
  base64URLEncode(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Generate PKCE code_challenge from code_verifier
   * @returns {Promise<string>} code_challenge
   */
  async generateCodeChallenge() {
    // Generate random code_verifier (128 chars recommended)
    const codeVerifier = this.generateRandomString(128);

    // Store verifier in Rust backend (secure, not accessible from JS)
    await invoke('store_code_verifier', { codeVerifier });

    // Create SHA256 hash
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await crypto.subtle.digest('SHA-256', data);

    // Base64 URL encode
    const codeChallenge = this.base64URLEncode(digest);

    return codeChallenge;
  }

  /**
   * Start OAuth flow - opens browser for user authorization
   * @returns {Promise<void>}
   */
  async startAuth() {
    try {
      // Generate PKCE challenge
      const codeChallenge = await this.generateCodeChallenge();

      // Build authorization URL
      const params = new URLSearchParams({
        client_id: this.clientId,
        response_type: 'code',
        redirect_uri: this.redirectUri,
        scope: this.scopes.join(' '),
        code_challenge_method: 'S256',
        code_challenge: codeChallenge,
        show_dialog: 'true', // Always show auth dialog
      });

      const authUrl = `https://accounts.spotify.com/authorize?${params.toString()}`;

      console.log('Opening authorization URL...');

      // Open in system browser
      await invoke('open_url', { url: authUrl });

      // Note: Callback will be handled by Tauri deep link handler
      // or by listening for redirect in the app
    } catch (error) {
      console.error('Failed to start auth:', error);
      throw error;
    }
  }

  /**
   * Exchange authorization code for access token
   * @param {string} code - Authorization code from Spotify redirect
   * @returns {Promise<{access_token: string, refresh_token: string, expires_in: number}>}
   */
  async exchangeCodeForToken(code) {
    try {
      // Get code_verifier from Rust backend
      const codeVerifier = await invoke('get_code_verifier');

      console.log('Exchanging authorization code for token...');

      // Exchange code for token (PKCE - no secret needed!)
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: this.redirectUri,
          client_id: this.clientId,
          code_verifier: codeVerifier, // PKCE verifier, not secret!
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Token exchange failed: ${error.error_description || error.error}`);
      }

      const data = await response.json();

      // Store tokens securely in Rust backend
      await invoke('store_spotify_token', {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
      });

      console.log('Successfully obtained and stored tokens');

      return data;
    } catch (error) {
      console.error('Failed to exchange code for token:', error);
      throw error;
    }
  }

  /**
   * Refresh expired access token
   * @param {string} refreshToken - Refresh token from previous auth
   * @returns {Promise<{access_token: string, expires_in: number}>}
   */
  async refreshToken(refreshToken) {
    try {
      console.log('Refreshing access token...');

      // Refresh token (PKCE - no secret needed!)
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: this.clientId, // Only Client ID needed!
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Token refresh failed: ${error.error_description || error.error}`);
      }

      const data = await response.json();

      // Store new access token
      await invoke('store_spotify_token', {
        accessToken: data.access_token,
        refreshToken: refreshToken, // Keep existing refresh token
        expiresIn: data.expires_in,
      });

      console.log('Successfully refreshed token');

      return data;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      throw error;
    }
  }

  /**
   * Get stored access token from backend
   * @returns {Promise<{access_token: string, refresh_token: string, expires_at: number} | null>}
   */
  async getStoredToken() {
    try {
      const token = await invoke('get_spotify_token');
      return token;
    } catch (error) {
      console.error('Failed to get stored token:', error);
      return null;
    }
  }

  /**
   * Check if user is authenticated
   * @returns {Promise<boolean>}
   */
  async isAuthenticated() {
    try {
      return await invoke('is_authenticated');
    } catch (error) {
      console.error('Failed to check authentication:', error);
      return false;
    }
  }

  /**
   * Logout - clear stored tokens
   * @returns {Promise<void>}
   */
  async logout() {
    try {
      await invoke('logout');
      console.log('Logged out successfully');
    } catch (error) {
      console.error('Failed to logout:', error);
      throw error;
    }
  }

  /**
   * Get current user profile
   * @returns {Promise<object>}
   */
  async getCurrentUser() {
    try {
      const token = await this.getStoredToken();

      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('https://api.spotify.com/v1/me', {
        headers: {
          'Authorization': `Bearer ${token.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get user profile');
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get current user:', error);
      throw error;
    }
  }
}
