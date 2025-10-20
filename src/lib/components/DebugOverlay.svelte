<script>
  import { onMount, onDestroy } from 'svelte';
  import {
    spectrumBars,
    waveformData,
    frequencyBands,
    audioFeatures,
    bassEnergy,
    trebleEnergy,
    isAnalyzing
  } from '$lib/stores/audioStore.js';
  import { playerStore } from '$lib/stores/playerStore.js';

  // Props
  let {
    visible = $bindable(true),
    position = 'top-right', // 'top-left', 'top-right', 'bottom-left', 'bottom-right'
    compact = false,
    manager = null // VisualizationManager instance
  } = $props();

  // Performance metrics
  let fps = $state(0);
  let frameTime = $state(0);
  let budgetUtilization = $state(0);
  let frames = $state([]);
  let lastTime = $state(performance.now());

  // Audio metrics
  let audioMetrics = $derived({
    bass: $frequencyBands?.bass ?? 0,
    mid: $frequencyBands?.mid ?? 0,
    treble: $frequencyBands?.brilliance ?? 0,
    volume: $audioFeatures?.volume ?? 0,
    bassEnergy: $bassEnergy ?? 0,
    trebleEnergy: $trebleEnergy ?? 0,
    isAnalyzing: $isAnalyzing
  });

  // Player metrics
  let playerMetrics = $derived({
    isPlaying: playerStore.state.isPlaying,
    isPaused: playerStore.state.isPaused,
    isReady: playerStore.state.isReady,
    trackName: playerStore.state.currentTrack?.name,
    artist: playerStore.state.currentTrack?.artists?.[0]?.name,
    deviceId: playerStore.state.deviceId
  });

  // Performance warnings
  let warnings = $derived.by(() => {
    const warns = [];
    if (fps < 55 && fps > 0) warns.push('⚠️ Low FPS');
    if (budgetUtilization > 90) warns.push('⚠️ Frame budget exceeded');
    if (frameTime > 20) warns.push('⚠️ Slow rendering');
    if (!audioMetrics.isAnalyzing && playerMetrics.isPlaying) {
      warns.push('⚠️ Audio not analyzing');
    }
    return warns;
  });

  // Update performance metrics
  function updateMetrics() {
    if (!visible) return;

    const now = performance.now();
    const delta = now - lastTime;
    frames.push(delta);

    // Keep last 60 frames for averaging
    if (frames.length > 60) {
      frames.shift();
    }

    // Calculate FPS
    const avgDelta = frames.reduce((a, b) => a + b, 0) / frames.length;
    fps = Math.round(1000 / avgDelta);
    frameTime = avgDelta.toFixed(2);
    budgetUtilization = ((avgDelta / 16.67) * 100).toFixed(1);

    lastTime = now;

    // Get stats from VisualizationManager if available
    if (manager) {
      const stats = manager.getStats();
      fps = Math.round(stats.fps);
      frameTime = stats.avgFrameTime.toFixed(2);
      budgetUtilization = stats.budgetUtilization.toFixed(1);
    }

    requestAnimationFrame(updateMetrics);
  }

  onMount(() => {
    requestAnimationFrame(updateMetrics);
  });

  // Position styles
  const positionStyles = {
    'top-left': 'top: 20px; left: 20px;',
    'top-right': 'top: 20px; right: 20px;',
    'bottom-left': 'bottom: 20px; left: 20px;',
    'bottom-right': 'bottom: 20px; right: 20px;'
  };

  // Format value with color coding
  function getValueColor(value, thresholds = { good: 0.7, warn: 0.4 }) {
    if (value >= thresholds.good) return '#4ade80'; // green
    if (value >= thresholds.warn) return '#fbbf24'; // yellow
    return '#ef4444'; // red
  }

  // Format FPS with color coding
  function getFpsColor(fps) {
    if (fps >= 58) return '#4ade80'; // green
    if (fps >= 50) return '#fbbf24'; // yellow
    return '#ef4444'; // red
  }
</script>

{#if visible}
  <div
    class="debug-overlay"
    class:compact
    style={positionStyles[position]}
  >
    <!-- Header -->
    <div class="header">
      <span class="title">🎵 musicViz Debug</span>
      <button class="close-btn" onclick={() => visible = false}>✕</button>
    </div>

    <!-- Performance Section -->
    <div class="section">
      <div class="section-title">Performance</div>
      <div class="metric-row">
        <span class="label">FPS:</span>
        <span class="value" style="color: {getFpsColor(fps)}">{fps}</span>
      </div>
      <div class="metric-row">
        <span class="label">Frame Time:</span>
        <span class="value" style="color: {frameTime > 16.67 ? '#ef4444' : '#4ade80'}">{frameTime}ms</span>
      </div>
      <div class="metric-row">
        <span class="label">Budget:</span>
        <span class="value" style="color: {budgetUtilization > 90 ? '#ef4444' : '#4ade80'}">{budgetUtilization}%</span>
      </div>
    </div>

    {#if !compact}
      <!-- Audio Metrics Section -->
      <div class="section">
        <div class="section-title">Audio</div>
        <div class="metric-row">
          <span class="label">Status:</span>
          <span class="value" style="color: {audioMetrics.isAnalyzing ? '#4ade80' : '#ef4444'}">
            {audioMetrics.isAnalyzing ? 'Analyzing' : 'Idle'}
          </span>
        </div>
        <div class="metric-row">
          <span class="label">Bass:</span>
          <div class="bar-container">
            <div
              class="bar"
              style="width: {audioMetrics.bass * 100}%; background-color: {getValueColor(audioMetrics.bass)}"
            ></div>
          </div>
          <span class="value">{(audioMetrics.bass * 100).toFixed(0)}%</span>
        </div>
        <div class="metric-row">
          <span class="label">Mid:</span>
          <div class="bar-container">
            <div
              class="bar"
              style="width: {audioMetrics.mid * 100}%; background-color: {getValueColor(audioMetrics.mid)}"
            ></div>
          </div>
          <span class="value">{(audioMetrics.mid * 100).toFixed(0)}%</span>
        </div>
        <div class="metric-row">
          <span class="label">Treble:</span>
          <div class="bar-container">
            <div
              class="bar"
              style="width: {audioMetrics.treble * 100}%; background-color: {getValueColor(audioMetrics.treble)}"
            ></div>
          </div>
          <span class="value">{(audioMetrics.treble * 100).toFixed(0)}%</span>
        </div>
      </div>

      <!-- Player Section -->
      <div class="section">
        <div class="section-title">Player</div>
        <div class="metric-row">
          <span class="label">Status:</span>
          <span class="value" style="color: {playerMetrics.isPlaying ? '#4ade80' : '#9ca3af'}">
            {playerMetrics.isPlaying ? 'Playing' : playerMetrics.isPaused ? 'Paused' : 'Stopped'}
          </span>
        </div>
        {#if playerMetrics.trackName}
          <div class="metric-row">
            <span class="label">Track:</span>
            <span class="value track-info">{playerMetrics.trackName}</span>
          </div>
          <div class="metric-row">
            <span class="label">Artist:</span>
            <span class="value track-info">{playerMetrics.artist}</span>
          </div>
        {/if}
        <div class="metric-row">
          <span class="label">Device:</span>
          <span class="value" style="color: {playerMetrics.deviceId ? '#4ade80' : '#ef4444'}">
            {playerMetrics.deviceId ? 'Connected' : 'None'}
          </span>
        </div>
      </div>

      <!-- Warnings Section -->
      {#if warnings.length > 0}
        <div class="section warnings">
          <div class="section-title">Warnings</div>
          {#each warnings as warning}
            <div class="warning-item">{warning}</div>
          {/each}
        </div>
      {/if}
    {/if}
  </div>
{/if}

<style>
  .debug-overlay {
    position: fixed;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(10px);
    border-radius: 12px;
    padding: 16px;
    color: #fff;
    font-family: 'SF Mono', 'Monaco', 'Courier New', monospace;
    font-size: 12px;
    z-index: 9999;
    min-width: 280px;
    max-width: 350px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .debug-overlay.compact {
    min-width: 200px;
    padding: 12px;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .title {
    font-weight: 600;
    font-size: 14px;
  }

  .close-btn {
    background: none;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 16px;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  .section {
    margin-bottom: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .section:last-child {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
  }

  .section-title {
    font-weight: 600;
    margin-bottom: 8px;
    color: #9ca3af;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .metric-row {
    display: grid;
    grid-template-columns: 80px 1fr auto;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }

  .label {
    color: #9ca3af;
  }

  .value {
    font-weight: 600;
    text-align: right;
  }

  .track-info {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 150px;
  }

  .bar-container {
    height: 8px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    overflow: hidden;
  }

  .bar {
    height: 100%;
    transition: width 0.1s ease-out;
    border-radius: 4px;
  }

  .warnings {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    padding: 8px;
  }

  .warning-item {
    color: #fca5a5;
    margin-bottom: 4px;
    font-size: 11px;
  }

  .warning-item:last-child {
    margin-bottom: 0;
  }
</style>
