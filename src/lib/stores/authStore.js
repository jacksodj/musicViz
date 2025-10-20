// Authentication state management

import { writable, derived } from 'svelte/store';

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
