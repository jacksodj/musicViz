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

    // Check if we have stored tokens
    const isAuth = await spotifyAuth.isAuthenticated();
    if (!isAuth) {
      console.log('[authStore] No valid authentication found');
      return false;
    }

    // Get the stored token
    const tokenData = await spotifyAuth.getStoredToken();
    if (!tokenData) {
      console.log('[authStore] No stored token found');
      return false;
    }

    // Check if token is expired
    const now = Date.now() / 1000; // Convert to seconds
    if (tokenData.expires_at && now >= tokenData.expires_at) {
      console.log('[authStore] Token expired, attempting refresh...');

      // Try to refresh the token
      if (tokenData.refresh_token) {
        try {
          const refreshedData = await spotifyAuth.refreshToken(tokenData.refresh_token);
          tokenData.access_token = refreshedData.access_token;
          console.log('[authStore] Token refreshed successfully');
        } catch (refreshError) {
          console.error('[authStore] Failed to refresh token:', refreshError);
          resetAuth();
          return false;
        }
      } else {
        console.log('[authStore] No refresh token available');
        resetAuth();
        return false;
      }
    }

    // Get user profile to verify token is valid
    try {
      const user = await spotifyAuth.getCurrentUser();

      // Set authenticated state
      setAuthenticated(user, tokenData.access_token);
      console.log('[authStore] Restored authentication for user:', user.display_name || user.id);
      return true;
    } catch (error) {
      console.error('[authStore] Failed to get user profile:', error);

      // Token might be invalid, try refreshing
      if (tokenData.refresh_token) {
        try {
          const refreshedData = await spotifyAuth.refreshToken(tokenData.refresh_token);
          const user = await spotifyAuth.getCurrentUser();
          setAuthenticated(user, refreshedData.access_token);
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
