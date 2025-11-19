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
      'user-library-read',  // May be needed for audio analysis
      'user-top-read',      // Additional permissions for track data
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
   * Start Device OAuth flow - for TV/devices without easy text input
   * Shows QR code and waits for user to complete auth on phone
   * @returns {Promise<{authUrl: string, userCode: string}>}
   */
  async startDeviceAuth() {
    try {
      // Generate PKCE challenge
      const codeChallenge = await this.generateCodeChallenge();

      // Use a web-based redirect that shows the code
      const webRedirectUri = 'https://spotify-auth-display.github.io/callback';

      // Build authorization URL
      const params = new URLSearchParams({
        client_id: this.clientId,
        response_type: 'code',
        redirect_uri: webRedirectUri,
        scope: this.scopes.join(' '),
        code_challenge_method: 'S256',
        code_challenge: codeChallenge,
        show_dialog: 'true',
      });

      const authUrl = `https://accounts.spotify.com/authorize?${params.toString()}`;

      console.log('[DeviceAuth] Generated auth URL for QR code');

      // Return URL for QR code display and wait for manual code entry
      return {
        authUrl,
        message: 'Scan QR code with your phone to login'
      };
    } catch (error) {
      console.error('Failed to start device auth:', error);
      throw error;
    }
  }

  /**
   * Start OAuth flow - opens browser for user authorization
   * @returns {Promise<string>} Authorization code
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

      // Try to detect if we're on Android
      const isAndroid = navigator.userAgent.toLowerCase().includes('android');

      if (isAndroid) {
        // On Android, show in-app OAuth modal
        console.log('[Auth] Android detected, showing in-app OAuth');
        return await this.showInAppOAuth(authUrl);
      } else {
        // On desktop, open in system browser
        await invoke('open_url', { url: authUrl });
        // Return promise that will be resolved by deep link handler
        return new Promise((resolve, reject) => {
          window._oauthResolve = resolve;
          window._oauthReject = reject;
        });
      }
    } catch (error) {
      console.error('Failed to start auth:', error);
      throw error;
    }
  }

  /**
   * Show in-app OAuth for Android by navigating current window
   * @param {string} authUrl - Spotify authorization URL
   * @returns {Promise<string>} Authorization code
   */
  async showInAppOAuth(authUrl) {
    console.log('[Auth] Android OAuth: navigating to Spotify');

    // Inject keyboard debugging script after page loads
    this.injectKeyboardDebugger();

    // Use Tauri's event system
    const { listen } = await import('@tauri-apps/api/event');

    return new Promise((resolve, reject) => {
      let unlisten;

      // Set up deep-link listener before navigating
      listen('deep-link', (event) => {
        console.log('[Auth] Deep-link received:', event);

        const url = event.payload;
        if (typeof url === 'string' && url.startsWith(this.redirectUri)) {
          console.log('[Auth] OAuth redirect detected');

          try {
            const parsedUrl = new URL(url);
            const code = parsedUrl.searchParams.get('code');

            if (code) {
              console.log('[Auth] Successfully captured OAuth code');
              if (unlisten) unlisten();
              resolve(code);
            } else {
              if (unlisten) unlisten();
              reject(new Error('No code found in redirect URL'));
            }
          } catch (err) {
            if (unlisten) unlisten();
            reject(err);
          }
        }
      }).then((unlistenFn) => {
        unlisten = unlistenFn;
      });

      // Set timeout
      setTimeout(() => {
        if (unlisten) unlisten();
        reject(new Error('OAuth timeout after 5 minutes'));
      }, 300000);

      // Navigate to Spotify OAuth page
      console.log('[Auth] Navigating to:', authUrl);
      window.location.href = authUrl;
    });
  }

  /**
   * Fallback: Show OAuth in a window.open popup
   * @param {string} authUrl - Spotify authorization URL
   * @returns {Promise<string>} Authorization code
   */
  async showPopupOAuth(authUrl) {
    console.log('[Auth] Using window.open fallback for OAuth');

    return new Promise((resolve, reject) => {
      const popup = window.open(
        authUrl,
        'spotify-oauth',
        'width=800,height=600,location=yes,toolbar=no,menubar=no'
      );

      if (!popup) {
        reject(new Error('Failed to open OAuth popup'));
        return;
      }

      // Check for redirect by polling the popup
      const interval = setInterval(() => {
        try {
          if (popup.closed) {
            clearInterval(interval);
            reject(new Error('OAuth popup was closed'));
            return;
          }

          // Try to access popup location
          const popupUrl = popup.location.href;

          if (popupUrl.startsWith(this.redirectUri)) {
            clearInterval(interval);

            const url = new URL(popupUrl);
            const code = url.searchParams.get('code');

            popup.close();

            if (code) {
              console.log('[Auth] Successfully captured OAuth code from popup');
              resolve(code);
            } else {
              reject(new Error('No code found in redirect URL'));
            }
          }
        } catch (e) {
          // Cross-origin error is expected while on Spotify domain
        }
      }, 500);

      // Timeout after 5 minutes
      setTimeout(() => {
        clearInterval(interval);
        if (!popup.closed) {
          popup.close();
          reject(new Error('OAuth timeout'));
        }
      }, 300000);
    });
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

      if (!token || !token.access_token) {
        return null;
      }

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
      let tokenData = await this.getStoredToken();

      if (!tokenData) {
        return false;
      }

      const now = Date.now() / 1000; // seconds
      const expiresAt = tokenData.expires_at || 0;
      const refreshThreshold = 60; // seconds before expiry to refresh proactively

      const isExpired = expiresAt > 0 && now >= expiresAt;
      const needsRefresh = expiresAt > 0 && now >= (expiresAt - refreshThreshold);

      if ((isExpired || needsRefresh) && tokenData.refresh_token) {
        try {
          console.log('[SpotifyAuth] Access token expired/expiring, attempting refresh');
          await this.refreshToken(tokenData.refresh_token);
          tokenData = await this.getStoredToken();
          return !!tokenData;
        } catch (refreshError) {
          console.error('[SpotifyAuth] Failed to refresh token during auth check:', refreshError);
          return false;
        }
      }

      if (isExpired && !tokenData.refresh_token) {
        console.warn('[SpotifyAuth] Access token expired and no refresh token available');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Failed to check authentication:', error);
      return false;
    }
  }

  /**
   * Inject keyboard debugging script into page
   * Logs all keyboard events to help diagnose Android TV keyboard issues
   */
  injectKeyboardDebugger() {
    // Wait for page to load, then inject debugging
    setTimeout(() => {
      console.log('[KeyboardDebug] Injecting keyboard event listeners');

      // Log all keyboard events on document
      document.addEventListener('keydown', (e) => {
        console.log(`[KeyboardDebug] keydown - key: "${e.key}", code: "${e.code}", keyCode: ${e.keyCode}, target: ${e.target.tagName}, type: ${e.target.type || 'none'}`);
      }, true);

      document.addEventListener('keypress', (e) => {
        console.log(`[KeyboardDebug] keypress - key: "${e.key}", code: "${e.code}", char: "${String.fromCharCode(e.keyCode)}"`);
      }, true);

      document.addEventListener('keyup', (e) => {
        console.log(`[KeyboardDebug] keyup - key: "${e.key}"`);
      }, true);

      document.addEventListener('input', (e) => {
        console.log(`[KeyboardDebug] input event - target: ${e.target.tagName}, value: "${e.target.value}", inputType: ${e.inputType}`);
      }, true);

      // Log focus changes
      document.addEventListener('focusin', (e) => {
        console.log(`[KeyboardDebug] focusin - element: ${e.target.tagName}, id: ${e.target.id}, class: ${e.target.className}, type: ${e.target.type || 'none'}, inputmode: ${e.target.inputMode || 'none'}`);

        // Log computed style and attributes
        if (e.target.tagName === 'INPUT') {
          console.log(`[KeyboardDebug] Input details - name: ${e.target.name}, autocomplete: ${e.target.autocomplete}, pattern: ${e.target.pattern}`);
        }
      }, true);

      // Monitor active element changes
      setInterval(() => {
        const active = document.activeElement;
        if (active && active.tagName === 'INPUT') {
          console.log(`[KeyboardDebug] Active input - tag: ${active.tagName}, type: ${active.type}, value length: ${active.value?.length || 0}`);
        }
      }, 2000);

      console.log('[KeyboardDebug] Keyboard debugger injected successfully');
    }, 1000);
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
