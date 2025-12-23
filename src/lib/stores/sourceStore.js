// Audio source selection store
// Manages which audio source (Spotify or Navidrome) is active

import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

const STORAGE_KEY = 'musicviz_audio_source';

// Load persisted source from localStorage
function loadPersistedSource() {
  if (browser) {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'spotify' || stored === 'navidrome') {
        return stored;
      }
    } catch (e) {
      console.warn('[sourceStore] Failed to load persisted source:', e);
    }
  }
  return null;
}

// Audio source: 'spotify' | 'navidrome' | null
export const audioSource = writable(loadPersistedSource());

// Persist source changes to localStorage
if (browser) {
  audioSource.subscribe(source => {
    try {
      if (source) {
        localStorage.setItem(STORAGE_KEY, source);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.warn('[sourceStore] Failed to persist source:', e);
    }
  });
}

// Derived: is a source selected?
export const isSourceSelected = derived(
  audioSource,
  $audioSource => $audioSource !== null
);

// Derived: is Spotify selected?
export const isSpotifySource = derived(
  audioSource,
  $audioSource => $audioSource === 'spotify'
);

// Derived: is Navidrome selected?
export const isNavidromeSource = derived(
  audioSource,
  $audioSource => $audioSource === 'navidrome'
);

/**
 * Select an audio source
 * @param {'spotify' | 'navidrome'} source
 */
export function selectSource(source) {
  if (source !== 'spotify' && source !== 'navidrome') {
    throw new Error(`Invalid audio source: ${source}`);
  }
  console.log(`[sourceStore] Selecting audio source: ${source}`);
  audioSource.set(source);
}

/**
 * Clear the audio source selection (return to selector)
 */
export function clearSource() {
  console.log('[sourceStore] Clearing audio source selection');
  audioSource.set(null);
}

/**
 * Get current source value synchronously
 * @returns {'spotify' | 'navidrome' | null}
 */
export function getCurrentSource() {
  let current = null;
  audioSource.subscribe(s => current = s)();
  return current;
}
