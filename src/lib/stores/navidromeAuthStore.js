// Navidrome authentication state management

import { writable, derived } from 'svelte/store';
import { NavidromeAuth } from '$lib/auth/NavidromeAuth.js';

/**
 * Authentication status
 * States: 'idle', 'authenticating', 'authenticated', 'error'
 */
export const navidromeAuthStatus = writable('idle');

/**
 * Server information from ping response
 */
export const navidromeServerInfo = writable(null);

/**
 * Current username
 */
export const navidromeUser = writable(null);

/**
 * Server URL
 */
export const navidromeServerUrl = writable(null);

/**
 * Authentication error message
 */
export const navidromeAuthError = writable(null);

/**
 * Derived store - is user authenticated?
 */
export const isNavidromeAuthenticated = derived(
  navidromeAuthStatus,
  $status => $status === 'authenticated'
);

/**
 * Derived store - is authentication in progress?
 */
export const isNavidromeAuthenticating = derived(
  navidromeAuthStatus,
  $status => $status === 'authenticating'
);

// Singleton auth instance
let navidromeAuth = null;

/**
 * Get or create NavidromeAuth instance
 * @returns {NavidromeAuth}
 */
export function getNavidromeAuth() {
  if (!navidromeAuth) {
    navidromeAuth = new NavidromeAuth();
  }
  return navidromeAuth;
}

/**
 * Reset authentication state
 */
export function resetNavidromeAuth() {
  navidromeAuthStatus.set('idle');
  navidromeServerInfo.set(null);
  navidromeUser.set(null);
  navidromeServerUrl.set(null);
  navidromeAuthError.set(null);
}

/**
 * Set authentication success
 * @param {string} username
 * @param {string} serverUrl
 * @param {object} serverInfo
 */
export function setNavidromeAuthenticated(username, serverUrl, serverInfo = null) {
  navidromeAuthStatus.set('authenticated');
  navidromeUser.set(username);
  navidromeServerUrl.set(serverUrl);
  navidromeServerInfo.set(serverInfo);
  navidromeAuthError.set(null);
}

/**
 * Set authentication error
 * @param {string} error
 */
export function setNavidromeAuthError(error) {
  navidromeAuthStatus.set('error');
  navidromeAuthError.set(error);
  console.error('[navidromeAuthStore] Authentication error:', error);
}

/**
 * Set authenticating status
 */
export function setNavidromeAuthenticating() {
  navidromeAuthStatus.set('authenticating');
  navidromeAuthError.set(null);
}

/**
 * Check for existing authentication on app startup
 * Attempts to restore authentication from persisted credentials
 * @returns {Promise<boolean>}
 */
export async function checkExistingNavidromeAuth() {
  console.log('[navidromeAuthStore] Checking for existing authentication...');

  try {
    const auth = getNavidromeAuth();
    const creds = await auth.getStoredCredentials();

    if (!creds) {
      console.log('[navidromeAuthStore] No stored credentials found');
      return false;
    }

    console.log('[navidromeAuthStore] Found stored credentials, testing connection...');

    // Test the connection
    const result = await auth.testConnection(creds.serverUrl, creds.username, creds.password);

    if (result.success) {
      setNavidromeAuthenticated(creds.username, creds.serverUrl, result.serverInfo);
      console.log('[navidromeAuthStore] Restored authentication for:', creds.username);
      return true;
    } else {
      console.warn('[navidromeAuthStore] Stored credentials invalid:', result.error);
      // Don't clear credentials - server might just be temporarily unavailable
      return false;
    }
  } catch (error) {
    console.error('[navidromeAuthStore] Error checking existing auth:', error);
    return false;
  }
}

/**
 * Authenticate with Navidrome server
 * @param {string} serverUrl
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function authenticateNavidrome(serverUrl, username, password) {
  setNavidromeAuthenticating();

  try {
    const auth = getNavidromeAuth();

    // Test connection first
    const result = await auth.testConnection(serverUrl, username, password);

    if (!result.success) {
      setNavidromeAuthError(result.error);
      return { success: false, error: result.error };
    }

    // Store credentials
    await auth.storeCredentials(serverUrl, username, password);

    // Set authenticated state
    setNavidromeAuthenticated(username, serverUrl, result.serverInfo);

    console.log('[navidromeAuthStore] Authentication successful');
    return { success: true };
  } catch (error) {
    const errorMsg = error.message || 'Authentication failed';
    setNavidromeAuthError(errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Logout from Navidrome
 * @returns {Promise<void>}
 */
export async function logoutNavidrome() {
  try {
    const auth = getNavidromeAuth();
    await auth.logout();
    resetNavidromeAuth();
    console.log('[navidromeAuthStore] Logged out successfully');
  } catch (error) {
    console.error('[navidromeAuthStore] Logout error:', error);
    // Reset state anyway
    resetNavidromeAuth();
  }
}
