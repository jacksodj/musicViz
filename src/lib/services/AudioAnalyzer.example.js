/**
 * AudioAnalyzer Usage Examples
 *
 * This file demonstrates how to use the AudioAnalyzer service
 * with the Spotify Web Playback SDK and audio store.
 */

import { AudioAnalyzer } from './AudioAnalyzer.js';
import {
  updateAudioData,
  setAnalysisState,
  setAnalysisError,
  audioData,
  bassEnergy,
  trebleEnergy
} from '$lib/stores/audioStore.js';

/**
 * Example 1: Basic setup with Spotify Web Playback SDK
 */
export async function setupAudioAnalyzerWithSpotify(spotifyPlayer) {
  const analyzer = new AudioAnalyzer();

  try {
    // Initialize the analyzer
    await analyzer.initialize();
    setAnalysisState('initializing');

    // Get the audio element from Spotify player
    // Note: This requires getting the underlying HTML5 Audio element from the Spotify SDK
    // The exact method depends on the SDK version and implementation
    const audioElement = await getSpotifyAudioElement(spotifyPlayer);

    // Connect the audio element to the analyzer
    analyzer.connectSource(audioElement);

    // Start analysis with store update callback
    analyzer.startAnalysis((data) => {
      updateAudioData(data);
    });

    setAnalysisState('active');

    return analyzer;
  } catch (error) {
    setAnalysisError(error.message);
    throw error;
  }
}

/**
 * Example 2: Setup with Web Audio API MediaStreamDestination
 * (More advanced: captures audio from Spotify SDK via MediaStream)
 */
export async function setupAudioAnalyzerWithMediaStream() {
  const analyzer = new AudioAnalyzer();

  try {
    await analyzer.initialize();
    setAnalysisState('initializing');

    // Create a MediaStream from the Spotify audio
    // This might require additional setup depending on SDK integration
    const stream = await captureSpotifyAudioStream();

    analyzer.connectSource(stream);

    analyzer.startAnalysis((data) => {
      updateAudioData(data);
    });

    setAnalysisState('active');

    return analyzer;
  } catch (error) {
    setAnalysisError(error.message);
    throw error;
  }
}

/**
 * Example 3: Using in a Svelte component
 */
/*
<script>
  import { onMount, onDestroy } from 'svelte';
  import { AudioAnalyzer } from '$lib/services/AudioAnalyzer.js';
  import {
    updateAudioData,
    setAnalysisState,
    audioData,
    bassEnergy
  } from '$lib/stores/audioStore.js';

  let analyzer;

  onMount(async () => {
    analyzer = new AudioAnalyzer();

    try {
      await analyzer.initialize();

      // Resume audio context on user interaction (required by browsers)
      document.addEventListener('click', () => analyzer.resume(), { once: true });

      // Connect to Spotify player (implementation depends on SDK setup)
      const audioElement = getSpotifyAudioElement();
      analyzer.connectSource(audioElement);

      // Start analysis
      analyzer.startAnalysis((data) => {
        updateAudioData(data);
      });

      setAnalysisState('active');
    } catch (error) {
      console.error('Failed to setup audio analyzer:', error);
    }
  });

  onDestroy(() => {
    if (analyzer) {
      analyzer.dispose();
    }
  });

  // Use the store data in your component
  $: spectrum = $audioData.spectrum;
  $: waveform = $audioData.waveform;
  $: bass = $bassEnergy;
</script>
*/

/**
 * Example 4: Using audio data in a visualization component
 */
/*
<script>
  import { spectrumBars, waveformData, bassEnergy } from '$lib/stores/audioStore.js';
  import { onMount } from 'svelte';

  let canvas;
  let ctx;

  onMount(() => {
    ctx = canvas.getContext('2d');
    renderLoop();
  });

  function renderLoop() {
    requestAnimationFrame(renderLoop);

    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Get current spectrum data
    const spectrum = $spectrumBars;
    const barWidth = canvas.width / spectrum.length;

    // Draw spectrum bars
    for (let i = 0; i < spectrum.length; i++) {
      const barHeight = spectrum[i] * canvas.height;
      const x = i * barWidth;
      const y = canvas.height - barHeight;

      // Color based on bass energy
      const hue = 120 + ($bassEnergy * 120); // Green to red
      ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
      ctx.fillRect(x, y, barWidth - 2, barHeight);
    }

    // Draw waveform
    const waveform = $waveformData;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();

    const sliceWidth = canvas.width / waveform.length;
    let x = 0;

    for (let i = 0; i < waveform.length; i++) {
      const v = waveform[i];
      const y = (v + 1) / 2 * canvas.height; // Convert from -1..1 to 0..height

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    ctx.stroke();
  }
</script>

<canvas bind:this={canvas} width={1920} height={1080} />
*/

/**
 * Helper: Get Spotify audio element (implementation depends on SDK)
 * This is a placeholder - actual implementation will depend on how
 * the Spotify SDK exposes the audio element
 */
async function getSpotifyAudioElement(player) {
  // Method 1: If SDK provides direct access
  // return player._audioElement;

  // Method 2: If SDK uses a specific element ID
  // return document.getElementById('spotify-audio-element');

  // Method 3: Query the DOM for the audio element created by SDK
  const audioElement = document.querySelector('audio[src*="spotify"]');
  if (audioElement) {
    return audioElement;
  }

  throw new Error('Could not find Spotify audio element');
}

/**
 * Helper: Capture Spotify audio as MediaStream
 */
async function captureSpotifyAudioStream() {
  // This would typically involve:
  // 1. Getting the audio element
  // 2. Creating a MediaStream from it
  const audioElement = await getSpotifyAudioElement();

  if (!audioElement.captureStream) {
    throw new Error('Audio capture not supported in this browser');
  }

  return audioElement.captureStream();
}

/**
 * Performance monitoring example
 */
export function monitorAudioAnalysisPerformance(analyzer) {
  let frameCount = 0;
  let lastTime = performance.now();

  const checkPerformance = setInterval(() => {
    const now = performance.now();
    const elapsed = now - lastTime;
    const fps = (frameCount / elapsed) * 1000;

    console.log(`Audio Analysis FPS: ${fps.toFixed(2)}`);

    if (fps < 55) {
      console.warn('Audio analysis is dropping frames! Target is 60fps.');
    }

    frameCount = 0;
    lastTime = now;
  }, 1000);

  // Track frame updates
  const originalCallback = analyzer.onDataUpdate;
  analyzer.onDataUpdate = (data) => {
    frameCount++;
    if (originalCallback) {
      originalCallback(data);
    }
  };

  return () => clearInterval(checkPerformance);
}
