// Music queue store for Navidrome playback
// Client-side queue management since Navidrome doesn't have server-side queue

import { writable, derived } from 'svelte/store';

// Queue of tracks
export const queue = writable([]);

// Current position in queue (0-indexed)
export const currentIndex = writable(-1);

// Shuffle mode
export const shuffleEnabled = writable(false);

// Repeat mode: 'off', 'all', 'one'
export const repeatMode = writable('off');

// Derived: current track
export const currentQueueTrack = derived(
  [queue, currentIndex],
  ([$queue, $currentIndex]) => {
    if ($currentIndex >= 0 && $currentIndex < $queue.length) {
      return $queue[$currentIndex];
    }
    return null;
  }
);

// Derived: has next track
export const hasNextTrack = derived(
  [queue, currentIndex, repeatMode],
  ([$queue, $currentIndex, $repeatMode]) => {
    if ($repeatMode === 'all' && $queue.length > 0) {
      return true;
    }
    return $currentIndex < $queue.length - 1;
  }
);

// Derived: has previous track
export const hasPreviousTrack = derived(
  [queue, currentIndex, repeatMode],
  ([$queue, $currentIndex, $repeatMode]) => {
    if ($repeatMode === 'all' && $queue.length > 0) {
      return true;
    }
    return $currentIndex > 0;
  }
);

// Derived: queue length
export const queueLength = derived(
  queue,
  $queue => $queue.length
);

// Derived: upcoming tracks (after current)
export const upcomingTracks = derived(
  [queue, currentIndex],
  ([$queue, $currentIndex]) => {
    if ($currentIndex < 0) return $queue;
    return $queue.slice($currentIndex + 1);
  }
);

/**
 * Set the entire queue
 * @param {Array} tracks
 * @param {number} startIndex - Index to start playing from
 */
export function setQueue(tracks, startIndex = 0) {
  queue.set([...tracks]);
  currentIndex.set(startIndex);
  console.log(`[queueStore] Set queue with ${tracks.length} tracks, starting at ${startIndex}`);
}

/**
 * Add track to end of queue
 * @param {object} track
 */
export function addToQueue(track) {
  queue.update(q => [...q, track]);
  console.log(`[queueStore] Added to queue: ${track.name}`);
}

/**
 * Add track to play next (after current)
 * @param {object} track
 */
export function addNext(track) {
  queue.update(q => {
    let idx = -1;
    currentIndex.subscribe(i => idx = i)();

    if (idx < 0 || idx >= q.length) {
      return [...q, track];
    }
    const newQueue = [...q];
    newQueue.splice(idx + 1, 0, track);
    return newQueue;
  });
  console.log(`[queueStore] Added to play next: ${track.name}`);
}

/**
 * Add multiple tracks to queue
 * @param {Array} tracks
 */
export function addTracksToQueue(tracks) {
  queue.update(q => [...q, ...tracks]);
  console.log(`[queueStore] Added ${tracks.length} tracks to queue`);
}

/**
 * Remove track at index
 * @param {number} index
 */
export function removeFromQueue(index) {
  queue.update(q => {
    const newQueue = [...q];
    newQueue.splice(index, 1);
    return newQueue;
  });

  // Adjust current index if needed
  currentIndex.update(idx => {
    if (index < idx) {
      return idx - 1;
    } else if (index === idx && idx >= getQueueLength()) {
      return Math.max(0, idx - 1);
    }
    return idx;
  });
}

/**
 * Move track within queue
 * @param {number} from - Source index
 * @param {number} to - Destination index
 */
export function moveInQueue(from, to) {
  queue.update(q => {
    const newQueue = [...q];
    const [track] = newQueue.splice(from, 1);
    newQueue.splice(to, 0, track);
    return newQueue;
  });

  // Adjust current index
  currentIndex.update(idx => {
    if (from === idx) {
      return to;
    } else if (from < idx && to >= idx) {
      return idx - 1;
    } else if (from > idx && to <= idx) {
      return idx + 1;
    }
    return idx;
  });
}

/**
 * Clear the entire queue
 */
export function clearQueue() {
  queue.set([]);
  currentIndex.set(-1);
  console.log('[queueStore] Queue cleared');
}

/**
 * Play track at specific index
 * @param {number} index
 */
export function playAtIndex(index) {
  let length = 0;
  queue.subscribe(q => length = q.length)();

  if (index >= 0 && index < length) {
    currentIndex.set(index);
    console.log(`[queueStore] Playing at index ${index}`);
  }
}

/**
 * Go to next track
 * @returns {object | null} Next track or null
 */
export function nextTrack() {
  let q = [];
  let idx = -1;
  let repeat = 'off';

  queue.subscribe(val => q = val)();
  currentIndex.subscribe(val => idx = val)();
  repeatMode.subscribe(val => repeat = val)();

  if (q.length === 0) return null;

  if (repeat === 'one') {
    // Repeat same track
    return q[idx];
  }

  let nextIdx = idx + 1;

  if (nextIdx >= q.length) {
    if (repeat === 'all') {
      nextIdx = 0;
    } else {
      return null;
    }
  }

  currentIndex.set(nextIdx);
  console.log(`[queueStore] Next track: index ${nextIdx}`);
  return q[nextIdx];
}

/**
 * Go to previous track
 * @returns {object | null} Previous track or null
 */
export function previousTrack() {
  let q = [];
  let idx = -1;
  let repeat = 'off';

  queue.subscribe(val => q = val)();
  currentIndex.subscribe(val => idx = val)();
  repeatMode.subscribe(val => repeat = val)();

  if (q.length === 0) return null;

  let prevIdx = idx - 1;

  if (prevIdx < 0) {
    if (repeat === 'all') {
      prevIdx = q.length - 1;
    } else {
      return null;
    }
  }

  currentIndex.set(prevIdx);
  console.log(`[queueStore] Previous track: index ${prevIdx}`);
  return q[prevIdx];
}

/**
 * Toggle shuffle mode
 */
export function toggleShuffle() {
  shuffleEnabled.update(s => !s);
}

/**
 * Cycle repeat mode: off -> all -> one -> off
 */
export function cycleRepeatMode() {
  repeatMode.update(mode => {
    switch (mode) {
      case 'off': return 'all';
      case 'all': return 'one';
      case 'one': return 'off';
      default: return 'off';
    }
  });
}

/**
 * Shuffle the queue (keeping current track at position 0)
 */
export function shuffleQueue() {
  queue.update(q => {
    if (q.length <= 1) return q;

    let idx = -1;
    currentIndex.subscribe(i => idx = i)();

    // Get current track
    const currentTrack = idx >= 0 ? q[idx] : null;

    // Remove current track and shuffle rest
    const rest = q.filter((_, i) => i !== idx);
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }

    // Put current track at front
    if (currentTrack) {
      currentIndex.set(0);
      return [currentTrack, ...rest];
    }

    return rest;
  });

  console.log('[queueStore] Queue shuffled');
}

/**
 * Get queue length synchronously
 * @returns {number}
 */
function getQueueLength() {
  let length = 0;
  queue.subscribe(q => length = q.length)();
  return length;
}

/**
 * Get current track synchronously
 * @returns {object | null}
 */
export function getCurrentTrack() {
  let track = null;
  currentQueueTrack.subscribe(t => track = t)();
  return track;
}
