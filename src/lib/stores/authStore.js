// Authentication state management

import { writable, derived } from 'svelte/store';
import { SpotifyAuth } from '$lib/auth/SpotifyAuth.js';

/**
 * Authentication status
 * States: 'idle', 'authenticating', 'authenticated', 'error'
 */
export const authStatus = writable('idle');

/**
 * Current user information from Spotify
 */
export const currentUser = writable(null);

/**
 * Authentication error message
 */
export const authError = writable(null);

/**
 * Spotify access token (for making API calls)
 */
export const accessToken = writable(null);

/**
 * Derived store - is user authenticated?
 */
export const isAuthenticated = derived(
  authStatus,
  $authStatus => $authStatus === 'authenticated'
);

/**
 * Derived store - is authentication in progress?
 */
export const isAuthenticating = derived(
  authStatus,
  $authStatus => $authStatus === 'authenticating'
);

/**
 * Reset authentication state (on logout or error)
 */
export function resetAuth() {
  authStatus.set('idle');
  currentUser.set(null);
  authError.set(null);
  accessToken.set(null);
}

/**
 * Set authentication success
 */
export function setAuthenticated(user, token) {
  authStatus.set('authenticated');
  currentUser.set(user);
  accessToken.set(token);
  authError.set(null);
}

/**
 * Set authentication error
 */
export function setAuthError(error) {
  authStatus.set('error');
  authError.set(error);
  console.error('Authentication error:', error);
}

/**
 * Set authenticating status
 */
export function setAuthenticating() {
  authStatus.set('authenticating');
  authError.set(null);
}

/**
 * Check for existing authentication on app startup
 * Attempts to restore authentication from persisted tokens
 */
export async function checkExistingAuth() {
  console.log('[authStore] Checking for existing authentication...');

  try {
    const spotifyAuth = new SpotifyAuth();

    // Load stored token (may trigger on-demand hydration from backend)
    let tokenData = await spotifyAuth.getStoredToken();
    if (!tokenData) {
      console.log('[authStore] No stored token found');
      return false;
    }

    const now = Date.now() / 1000; // seconds
    const expiresAt = tokenData.expires_at || 0;
    const refreshThreshold = 60; // seconds before expiry to refresh proactively

    const isExpired = expiresAt > 0 && now >= expiresAt;
    const needsRefresh = expiresAt > 0 && now >= (expiresAt - refreshThreshold);

    if ((isExpired || needsRefresh) && tokenData.refresh_token) {
      try {
        console.log('[authStore] Access token expired/expiring, refreshing...');
        await spotifyAuth.refreshToken(tokenData.refresh_token);
        tokenData = await spotifyAuth.getStoredToken();

        if (!tokenData) {
          console.error('[authStore] Failed to load token after refresh');
          resetAuth();
          return false;
        }
      } catch (refreshError) {
        console.error('[authStore] Failed to refresh token:', refreshError);
        resetAuth();
        return false;
      }
    } else if (isExpired && !tokenData.refresh_token) {
      console.log('[authStore] Token expired and no refresh token available');
      resetAuth();
      return false;
    }

    // Get user profile to verify token is valid
    try {
      const user = await spotifyAuth.getCurrentUser();

      // Always read latest token after potential refresh inside getCurrentUser
      const latestToken = await spotifyAuth.getStoredToken();
      if (!latestToken) {
        console.warn('[authStore] Lost token after fetching user profile');
        resetAuth();
        return false;
      }

      // Set authenticated state
      setAuthenticated(user, latestToken.access_token);
      console.log('[authStore] Restored authentication for user:', user.display_name || user.id);
      return true;
    } catch (error) {
      console.error('[authStore] Failed to get user profile:', error);

      // Token might be invalid, try refreshing
      if (tokenData.refresh_token) {
        try {
          const refreshedData = await spotifyAuth.refreshToken(tokenData.refresh_token);
          const user = await spotifyAuth.getCurrentUser();
          const latestToken = await spotifyAuth.getStoredToken();

          if (!latestToken) {
            console.warn('[authStore] No token available after refresh attempt');
            resetAuth();
            return false;
          }

          setAuthenticated(user, latestToken.access_token || refreshedData.access_token);
          console.log('[authStore] Restored authentication after refresh for user:', user.display_name || user.id);
          return true;
        } catch (refreshError) {
          console.error('[authStore] Failed to refresh and restore auth:', refreshError);
          resetAuth();
          return false;
        }
      }

      resetAuth();
      return false;
    }
  } catch (error) {
    console.error('[authStore] Error checking existing auth:', error);
    return false;
  }
}
