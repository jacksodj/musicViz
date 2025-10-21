/**
 * Test script for keyring functionality
 * Run this in the browser console to test keyring operations
 */

import { invoke } from '@tauri-apps/api/core';

export async function testKeyring() {
  console.log('=== Testing Keyring Functionality ===');

  try {
    // Test basic keyring operations
    console.log('Running keyring test...');
    const result = await invoke('test_keyring');
    console.log('Keyring test result:', result);

    // Check if we have existing tokens
    console.log('\nChecking for existing authentication...');
    const isAuth = await invoke('is_authenticated');
    console.log('Is authenticated:', isAuth);

    if (isAuth) {
      console.log('Getting stored token...');
      const token = await invoke('get_spotify_token');
      if (token) {
        console.log('Token found!', {
          hasAccessToken: !!token.access_token,
          hasRefreshToken: !!token.refresh_token,
          expiresAt: token.expires_at,
          expiresIn: new Date(token.expires_at * 1000).toLocaleString()
        });
      } else {
        console.log('Token expired or not found');
      }
    } else {
      console.log('No authentication found');
    }

    console.log('\n=== Test Complete ===');
    return { success: true, result };
  } catch (error) {
    console.error('Keyring test failed:', error);
    return { success: false, error: error.toString() };
  }
}

// Make it available globally for console testing
if (typeof window !== 'undefined') {
  window.testKeyring = testKeyring;
  console.log('Keyring test loaded. Run: testKeyring()');
}