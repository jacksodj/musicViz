<script>
  import { onMount, onDestroy } from 'svelte';
  import { timbreToColor, timbreToBrightness } from '$lib/utils/timbreMapping.js';

  // Props
  let {
    bpm = 120,              // Beats per minute
    isPlaying = false,      // Whether music is playing
    intensity = 0.8,        // Pulse intensity (0-1)
    colorSeed = 0           // Seed for color generation
  } = $props();

  // State
  let pulseScale = $state(1.0);
  let currentColor = $state('hsl(200, 70%, 50%)');
  let animationFrameId = null;
  let lastBeatTime = 0;

  // Calculate beat interval in milliseconds
  $effect(() => {
    beatInterval = (60 / bpm) * 1000;
  });
  let beatInterval = (60 / bpm) * 1000;

  // Generate mock timbre vector for color
  function generateMockTimbre(seed) {
    const timbre = [];
    for (let i = 0; i < 12; i++) {
      // Generate pseudo-random values between -50 and 50
      const value = Math.sin(seed + i * 0.5) * 50;
      timbre.push(value);
    }
    return timbre;
  }

  // Update colors based on seed
  $effect(() => {
    const mockTimbre = generateMockTimbre(colorSeed);
    currentColor = timbreToColor(mockTimbre);
  });

  // Animation loop
  function animate(timestamp) {
    if (!isPlaying) {
      pulseScale = 1.0;
      animationFrameId = requestAnimationFrame(animate);
      return;
    }

    // Calculate time since last beat
    const timeSinceBeat = (timestamp - lastBeatTime) % beatInterval;
    const beatProgress = timeSinceBeat / beatInterval;

    // Create pulse effect - quick expansion, slow decay
    if (beatProgress < 0.1) {
      // Quick pulse on beat
      pulseScale = 1.0 + (intensity * 0.3 * (1 - beatProgress / 0.1));
    } else {
      // Smooth decay back to normal
      const decayProgress = (beatProgress - 0.1) / 0.9;
      pulseScale = 1.0 + (intensity * 0.3 * Math.exp(-5 * decayProgress));
    }

    // Trigger new beat color change
    if (timeSinceBeat < 16) { // Within one frame of beat
      const mockTimbre = generateMockTimbre(timestamp / 1000);
      currentColor = timbreToColor(mockTimbre);
    }

    animationFrameId = requestAnimationFrame(animate);
  }

  onMount(() => {
    lastBeatTime = performance.now();
    animationFrameId = requestAnimationFrame(animate);
  });

  onDestroy(() => {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
  });
</script>

<div
  class="beat-pulse"
  style="
    transform: scale({pulseScale});
    background: radial-gradient(
      circle at center,
      {currentColor} 0%,
      transparent 70%
    );
    opacity: {isPlaying ? 0.6 : 0.3};
  "
></div>

<style>
  .beat-pulse {
    position: fixed;
    top: 50%;
    left: 50%;
    width: 200%;
    height: 200%;
    transform-origin: center center;
    transition: opacity 0.5s ease;
    pointer-events: none;
    z-index: 1;
    margin-left: -100%;
    margin-top: -100%;
    will-change: transform;
  }
</style>
