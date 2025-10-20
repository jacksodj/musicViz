<!--
  Example Audio Visualizer Component

  Demonstrates how to consume audio data from the audioStore
  and render a simple spectrum + waveform visualization.

  This is a reference implementation showing best practices.
-->

<script>
  import { onMount, onDestroy } from 'svelte';
  import {
    spectrumBars,
    waveformData,
    frequencyBands,
    audioFeatures,
    bassEnergy,
    isAnalyzing
  } from '$lib/stores/audioStore.js';

  let canvas;
  let ctx;
  let animationFrameId;

  // Visual settings
  const barGap = 2;
  const waveformHeight = 150;
  const spectrumHeight = 400;

  onMount(() => {
    if (canvas) {
      ctx = canvas.getContext('2d');
      startRenderLoop();
    }
  });

  onDestroy(() => {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
  });

  function startRenderLoop() {
    function render() {
      if (!ctx || !canvas) return;

      // Clear canvas
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw spectrum bars
      drawSpectrum();

      // Draw waveform
      drawWaveform();

      // Draw frequency band indicators
      drawBandIndicators();

      // Draw audio features
      drawAudioFeatures();

      // Continue loop
      animationFrameId = requestAnimationFrame(render);
    }

    render();
  }

  function drawSpectrum() {
    const spectrum = $spectrumBars;
    const barCount = spectrum.length;
    const barWidth = (canvas.width / barCount) - barGap;
    const bass = $bassEnergy;

    for (let i = 0; i < barCount; i++) {
      const barHeight = spectrum[i] * spectrumHeight;
      const x = i * (barWidth + barGap);
      const y = canvas.height - waveformHeight - barHeight;

      // Color based on frequency (low = red, high = blue)
      const hue = (i / barCount) * 240; // 0-240 (red to blue)
      const saturation = 70 + (bass * 30); // More saturation on bass hits
      const lightness = 50;

      ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
      ctx.fillRect(x, y, barWidth, barHeight);
    }
  }

  function drawWaveform() {
    const waveform = $waveformData;
    const sliceWidth = canvas.width / waveform.length;
    const centerY = canvas.height - (waveformHeight / 2);

    ctx.lineWidth = 2;
    ctx.strokeStyle = '#1DB954'; // Spotify green
    ctx.beginPath();

    let x = 0;
    for (let i = 0; i < waveform.length; i++) {
      const v = waveform[i];
      const y = centerY + (v * (waveformHeight / 2));

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    ctx.stroke();

    // Draw waveform center line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(canvas.width, centerY);
    ctx.stroke();
  }

  function drawBandIndicators() {
    const bands = $frequencyBands;
    const bandNames = Object.keys(bands);
    const barHeight = 10;
    const startY = canvas.height - waveformHeight - spectrumHeight - 40;

    ctx.font = '12px monospace';
    ctx.textAlign = 'left';

    bandNames.forEach((name, index) => {
      const value = bands[name];
      const x = 10;
      const y = startY + (index * 20);
      const barWidth = value * 200;

      // Label
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(name.padEnd(12), x, y);

      // Bar
      const hue = (index / bandNames.length) * 360;
      ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
      ctx.fillRect(x + 100, y - 10, barWidth, barHeight);

      // Value
      ctx.fillText((value * 100).toFixed(0) + '%', x + 310, y);
    });
  }

  function drawAudioFeatures() {
    const features = $audioFeatures;
    const x = canvas.width - 250;
    const y = 30;

    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'left';

    ctx.fillText('Audio Features', x, y);

    ctx.font = '12px monospace';

    // Volume
    ctx.fillText('Volume:', x, y + 30);
    drawFeatureBar(x + 80, y + 20, features.volume, '#FF6B6B');

    // Bass
    ctx.fillText('Bass:', x, y + 50);
    drawFeatureBar(x + 80, y + 40, features.bass, '#4ECDC4');

    // Mid
    ctx.fillText('Mid:', x, y + 70);
    drawFeatureBar(x + 80, y + 60, features.mid, '#FFE66D');

    // Treble
    ctx.fillText('Treble:', x, y + 90);
    drawFeatureBar(x + 80, y + 80, features.treble, '#A8DADC');

    // Analysis status
    ctx.fillStyle = $isAnalyzing ? '#1DB954' : '#FF6B6B';
    ctx.fillText($isAnalyzing ? '● ACTIVE' : '● INACTIVE', x, y + 120);
  }

  function drawFeatureBar(x, y, value, color) {
    const maxWidth = 150;
    const height = 10;

    // Background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(x, y, maxWidth, height);

    // Value bar
    ctx.fillStyle = color;
    ctx.fillRect(x, y, value * maxWidth, height);
  }
</script>

<div class="visualizer-container">
  <canvas
    bind:this={canvas}
    width={1920}
    height={1080}
    class="visualizer-canvas"
  />

  {#if !$isAnalyzing}
    <div class="overlay-message">
      <h2>Waiting for audio...</h2>
      <p>Play something on Spotify to see the visualization</p>
    </div>
  {/if}
</div>

<style>
  .visualizer-container {
    position: relative;
    width: 100%;
    height: 100vh;
    background: #000;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .visualizer-canvas {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }

  .overlay-message {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    color: rgba(255, 255, 255, 0.5);
    pointer-events: none;
  }

  .overlay-message h2 {
    font-size: 2rem;
    margin: 0 0 1rem 0;
    font-weight: 300;
  }

  .overlay-message p {
    font-size: 1rem;
    margin: 0;
    opacity: 0.7;
  }
</style>
