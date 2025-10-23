<script>
  import { onMount, onDestroy } from 'svelte';
  import { GoveeManager } from '$lib/govee/GoveeManager.js';

  // Props
  let {
    canvas = null,
    isPlaying = false
  } = $props();

  let goveeManager = $state(null);
  let devices = $state([]);
  let syncEnabled = $state(false);
  let isDiscovering = $state(false);
  let showPanel = $state(false);
  let selectedScene = $state('');
  let globalBrightness = $state(75);
  let latencyCompensation = $state(50);
  let extractionMode = $state('zones');
  let stats = $state({});

  // Auto-settings
  let autoDiscoverOnStartup = $state(false);
  let autoSyncWithMusic = $state(false);

  // Fade-out behavior
  let isVisible = $state(true);
  let inactivityTimer = null;
  let lastInteractionTime = $state(Date.now());

  onMount(async () => {
    // Load settings from localStorage
    loadSettings();

    // Initialize Govee manager with API key from environment
    goveeManager = new GoveeManager({
      apiKey: import.meta.env.VITE_GOVEE_API_KEY,
      useLanApi: true,
      discoveryTimeout: 5000,
      latencyCompensation,
      syncOptions: {
        sampleRate: 30,
        extractionMode,
        smoothing: 0.3,
        brightnessBoost: 1.2,
        saturationBoost: 1.3
      }
    });

    // Load cached devices if any
    await loadCachedDevices();

    // Auto-discover if enabled
    if (autoDiscoverOnStartup && devices.length === 0) {
      console.log('[GoveeControl] Auto-discovering devices on startup');
      await discoverDevices();
    }

    // Setup global interaction listeners for fade-out behavior
    const handleInteraction = () => {
      lastInteractionTime = Date.now();
      isVisible = true;
      resetInactivityTimer();
    };

    window.addEventListener('mousemove', handleInteraction);
    window.addEventListener('mousedown', handleInteraction);
    window.addEventListener('keydown', handleInteraction);

    resetInactivityTimer();

    return () => {
      window.removeEventListener('mousemove', handleInteraction);
      window.removeEventListener('mousedown', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
      if (inactivityTimer) clearTimeout(inactivityTimer);
    };
  });

  onDestroy(() => {
    if (goveeManager) {
      goveeManager.destroy();
    }
    if (inactivityTimer) clearTimeout(inactivityTimer);
  });

  function resetInactivityTimer() {
    if (inactivityTimer) clearTimeout(inactivityTimer);

    // Don't hide if panel is open
    if (showPanel) return;

    // Hide after 3 seconds of inactivity
    inactivityTimer = setTimeout(() => {
      isVisible = false;
    }, 3000);
  }

  async function discoverDevices() {
    isDiscovering = true;
    try {
      await goveeManager.initialize();
      devices = goveeManager.getDevices();
      console.log(`[GoveeControl] Found ${devices.length} devices`);
    } catch (error) {
      console.error('[GoveeControl] Discovery failed:', error);
    } finally {
      isDiscovering = false;
    }
  }

  async function loadCachedDevices() {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const cached = await invoke('govee_get_all_devices');
      if (cached && cached.length > 0) {
        devices = cached;
        // Update manager's device map
        devices.forEach(device => {
          goveeManager.devices.set(device.id, device);
          if (device.online) {
            goveeManager.activeDevices.add(device.id);
          }
        });
        console.log(`[GoveeControl] Loaded ${devices.length} cached devices`);
      }
    } catch (error) {
      console.error('[GoveeControl] Failed to load cached devices:', error);
    }
  }

  function loadSettings() {
    try {
      const saved = localStorage.getItem('goveeSettings');
      if (saved) {
        const settings = JSON.parse(saved);
        autoDiscoverOnStartup = settings.autoDiscoverOnStartup ?? false;
        autoSyncWithMusic = settings.autoSyncWithMusic ?? false;
        extractionMode = settings.extractionMode ?? 'zones';
        latencyCompensation = settings.latencyCompensation ?? 50;
        console.log('[GoveeControl] Loaded settings:', settings);
      }
    } catch (error) {
      console.error('[GoveeControl] Failed to load settings:', error);
    }
  }

  function saveSettings() {
    try {
      const settings = {
        autoDiscoverOnStartup,
        autoSyncWithMusic,
        extractionMode,
        latencyCompensation
      };
      localStorage.setItem('goveeSettings', JSON.stringify(settings));
      console.log('[GoveeControl] Saved settings');
    } catch (error) {
      console.error('[GoveeControl] Failed to save settings:', error);
    }
  }

  async function toggleSync() {
    if (!canvas) {
      console.error('[GoveeControl] No canvas available for sync');
      return;
    }

    if (syncEnabled) {
      goveeManager.stopSync();
      syncEnabled = false;
    } else {
      goveeManager.startSync(canvas, {
        extractionMode,
        latencyCompensation
      });
      syncEnabled = true;
    }
  }

  async function toggleDevice(deviceId) {
    const device = devices.find(d => d.id === deviceId);
    if (!device) return;

    const newState = !device.state.on;
    const success = await goveeManager.setPower(deviceId, newState);

    if (success) {
      device.state.on = newState;
      devices = devices; // Trigger reactivity
    }
  }

  async function toggleDeviceActive(deviceId) {
    const device = devices.find(d => d.id === deviceId);
    if (!device) return;

    const isActive = goveeManager.activeDevices.has(deviceId);
    goveeManager.setDeviceActive(deviceId, !isActive);

    // Force update
    devices = devices;
  }

  async function setBrightnessAll() {
    await goveeManager.setBrightnessAll(globalBrightness);
    devices.forEach(d => {
      if (d.state) d.state.brightness = globalBrightness;
    });
    devices = devices;
  }

  async function setColorAll(color) {
    await goveeManager.setAllColors(color);
    devices.forEach(d => {
      if (d.state) d.state.color = color;
    });
    devices = devices;
  }

  async function applyScene() {
    if (selectedScene) {
      await goveeManager.applyScene(selectedScene);
    }
  }

  async function turnAllOn() {
    await goveeManager.setPowerAll(true);
    devices.forEach(d => {
      if (d.state) d.state.on = true;
    });
    devices = devices;
  }

  async function turnAllOff() {
    await goveeManager.setPowerAll(false);
    devices.forEach(d => {
      if (d.state) d.state.on = false;
    });
    devices = devices;
  }

  // Update stats periodically
  $effect(() => {
    if (!syncEnabled) return;

    const interval = setInterval(() => {
      stats = goveeManager.getSyncStats();
    }, 1000);

    return () => clearInterval(interval);
  });

  // Update latency compensation
  $effect(() => {
    if (goveeManager) {
      goveeManager.latencyCompensation = latencyCompensation;
    }
  });

  // Watch for canvas changes and restart sync if needed
  $effect(() => {
    if (syncEnabled && canvas && goveeManager) {
      console.log('[GoveeControl] Canvas changed, restarting sync after delay');
      goveeManager.stopSync();

      // Wait for new visualizer to initialize and render first frame
      const timeout = setTimeout(() => {
        if (syncEnabled && canvas && goveeManager) {
          console.log('[GoveeControl] Restarting sync with new canvas');
          goveeManager.startSync(canvas, {
            extractionMode,
            latencyCompensation
          });
        }
      }, 500); // 500ms delay to let visualizer initialize

      // Cleanup timeout if effect re-runs
      return () => clearTimeout(timeout);
    }
  });

  // Auto-sync with music playback
  $effect(() => {
    if (!autoSyncWithMusic || !goveeManager || !canvas || devices.length === 0) return;

    if (isPlaying && !syncEnabled) {
      console.log('[GoveeControl] Auto-starting sync (music playing)');
      goveeManager.startSync(canvas, {
        extractionMode,
        latencyCompensation
      });
      syncEnabled = true;
    } else if (!isPlaying && syncEnabled) {
      console.log('[GoveeControl] Auto-stopping sync (music paused)');
      goveeManager.stopSync();
      syncEnabled = false;
    }
  });

  // Save settings when they change
  $effect(() => {
    // Track all settings
    autoDiscoverOnStartup;
    autoSyncWithMusic;
    extractionMode;
    latencyCompensation;

    // Save to localStorage
    saveSettings();
  });

  // Keep visible while panel is open, restart timer when panel closes
  $effect(() => {
    if (showPanel) {
      isVisible = true;
      if (inactivityTimer) clearTimeout(inactivityTimer);
    } else {
      resetInactivityTimer();
    }
  });
</script>

<div class="govee-control" class:hidden={!isVisible}>
  <button
    class="govee-toggle"
    onclick={() => showPanel = !showPanel}
    class:active={syncEnabled}
  >
    <svg width="24" height="24" viewBox="0 0 24 24">
      <path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v6c0 1.1.9 2 2 2h1v5c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-5h8v5c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-5h1c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm2 5.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5S13.33 9 12.5 9 11 8.33 11 7.5z"/>
    </svg>
    {#if devices.length > 0}
      <span class="device-count">{devices.length}</span>
    {/if}
  </button>

  {#if showPanel}
    <div class="govee-panel">
      <div class="panel-header">
        <h3>Govee Lights</h3>
        <button class="close-btn" onclick={() => showPanel = false}>×</button>
      </div>

      <div class="panel-content">
        {#if devices.length === 0}
          <div class="empty-state">
            <p>No devices found</p>
            <button
              class="btn-primary"
              onclick={discoverDevices}
              disabled={isDiscovering}
            >
              {isDiscovering ? 'Discovering...' : 'Discover Devices'}
            </button>
          </div>
        {:else}
          <div class="sync-control">
            <button
              class="btn-sync"
              class:active={syncEnabled}
              onclick={toggleSync}
              disabled={!canvas}
            >
              {syncEnabled ? 'Stop Sync' : 'Start Sync'}
            </button>

            {#if syncEnabled}
              <div class="sync-stats">
                <span>FPS: {stats.extractorStats?.sampleRate || 0}</span>
                <span>Frames: {stats.extractorStats?.frameCount || 0}</span>
              </div>
            {/if}
          </div>

          <div class="global-controls">
            <div class="control-row">
              <label>
                Brightness
                <input
                  type="range"
                  bind:value={globalBrightness}
                  min="0"
                  max="100"
                  onchange={setBrightnessAll}
                />
                <span>{globalBrightness}%</span>
              </label>
            </div>

            <div class="control-row">
              <label>
                Latency Comp
                <input
                  type="range"
                  bind:value={latencyCompensation}
                  min="0"
                  max="200"
                  step="10"
                />
                <span>{latencyCompensation}ms</span>
              </label>
            </div>

            <div class="control-row">
              <label>
                Mode
                <select bind:value={extractionMode}>
                  <option value="dominant">Dominant Color</option>
                  <option value="average">Average Color</option>
                  <option value="zones">Zone Colors</option>
                </select>
              </label>
            </div>

            <div class="control-row checkbox-row">
              <label>
                <input
                  type="checkbox"
                  bind:checked={autoDiscoverOnStartup}
                />
                Auto-discover on startup
              </label>
            </div>

            <div class="control-row checkbox-row">
              <label>
                <input
                  type="checkbox"
                  bind:checked={autoSyncWithMusic}
                />
                Auto-sync with music
              </label>
            </div>

            <div class="button-row">
              <button class="btn-small" onclick={turnAllOn}>All On</button>
              <button class="btn-small" onclick={turnAllOff}>All Off</button>
            </div>
          </div>

          <div class="scene-controls">
            <label>
              Scene
              <select bind:value={selectedScene}>
                <option value="">Choose scene...</option>
                <option value="rainbow">Rainbow</option>
                <option value="party">Party</option>
                <option value="chill">Chill</option>
                <option value="sunset">Sunset</option>
              </select>
            </label>
            <button onclick={applyScene} disabled={!selectedScene}>Apply</button>
          </div>

          <div class="device-list">
            <h4>Devices</h4>
            {#each devices as device}
              <div class="device-item">
                <div class="device-info">
                  <span class="device-name">{device.name}</span>
                  <span class="device-model">{device.model}</span>
                </div>

                <div class="device-controls">
                  <button
                    class="btn-toggle"
                    class:on={device.state.on}
                    onclick={() => toggleDevice(device.id)}
                  >
                    {device.state.on ? 'ON' : 'OFF'}
                  </button>

                  <label class="checkbox">
                    <input
                      type="checkbox"
                      checked={goveeManager.activeDevices.has(device.id)}
                      onchange={() => toggleDeviceActive(device.id)}
                    />
                    Sync
                  </label>
                </div>

                <div
                  class="device-color"
                  style={`background: rgb(${device.state.color.r}, ${device.state.color.g}, ${device.state.color.b})`}
                ></div>
              </div>
            {/each}
          </div>

          <button
            class="btn-refresh"
            onclick={discoverDevices}
            disabled={isDiscovering}
          >
            {isDiscovering ? 'Discovering...' : 'Refresh Devices'}
          </button>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .govee-control {
    position: fixed;
    top: 5rem;
    right: 1rem;
    z-index: 1000;
    opacity: 1;
    transition: opacity 0.3s ease;
  }

  .govee-control.hidden {
    opacity: 0;
    pointer-events: none;
  }

  .govee-toggle {
    width: 3rem;
    height: 3rem;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(10px);
    border: 2px solid rgba(255, 255, 255, 0.1);
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    position: relative;
  }

  .govee-toggle:hover {
    background: rgba(0, 0, 0, 0.9);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .govee-toggle.active {
    border-color: #1db954;
    box-shadow: 0 0 20px rgba(29, 185, 84, 0.5);
  }

  .govee-toggle svg {
    fill: currentColor;
  }

  .device-count {
    position: absolute;
    top: -0.25rem;
    right: -0.25rem;
    background: #1db954;
    color: white;
    border-radius: 50%;
    width: 1.2rem;
    height: 1.2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: bold;
  }

  .govee-panel {
    position: fixed;
    top: 9rem;
    right: 1rem;
    width: 320px;
    max-height: 80vh;
    background: rgba(0, 0, 0, 0.95);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.5rem;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.8rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .panel-header h3 {
    margin: 0;
    font-size: 1.1rem;
  }

  .close-btn {
    background: none;
    border: none;
    color: white;
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .panel-content {
    padding: 0.8rem;
    overflow-y: auto;
  }

  .empty-state {
    text-align: center;
    padding: 2rem 0;
  }

  .empty-state p {
    margin: 0 0 1rem 0;
    color: rgba(255, 255, 255, 0.6);
  }

  .btn-primary, .btn-sync, .btn-small, .btn-refresh {
    background: #1db954;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 0.25rem;
    cursor: pointer;
    font-weight: 500;
    transition: background 0.2s ease;
  }

  .btn-primary:hover:not(:disabled),
  .btn-sync:hover:not(:disabled),
  .btn-small:hover:not(:disabled),
  .btn-refresh:hover:not(:disabled) {
    background: #1ed760;
  }

  .btn-primary:disabled,
  .btn-sync:disabled,
  .btn-small:disabled,
  .btn-refresh:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-sync {
    width: 100%;
    margin-bottom: 0.4rem;
  }

  .btn-sync.active {
    background: #e74c3c;
  }

  .btn-sync.active:hover {
    background: #c0392b;
  }

  .btn-small {
    padding: 0.25rem 0.75rem;
    font-size: 0.9rem;
  }

  .sync-control {
    margin-bottom: 0.8rem;
  }

  .sync-stats {
    display: flex;
    justify-content: space-around;
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.6);
    margin-top: 0.4rem;
  }

  .global-controls {
    margin-bottom: 0.8rem;
    padding-bottom: 0.8rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .control-row {
    margin-bottom: 0.6rem;
  }

  .control-row label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
  }

  .control-row input[type="range"] {
    flex: 1;
  }

  .control-row span {
    min-width: 3rem;
    text-align: right;
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.6);
  }

  .control-row select {
    flex: 1;
    background: rgba(255, 255, 255, 0.1);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.2);
    padding: 0.25rem;
    border-radius: 0.25rem;
  }

  .checkbox-row label {
    cursor: pointer;
    font-size: 0.9rem;
  }

  .checkbox-row input[type="checkbox"] {
    width: 1.1rem;
    height: 1.1rem;
    cursor: pointer;
    margin-right: 0.5rem;
  }

  .button-row {
    display: flex;
    gap: 0.5rem;
  }

  .button-row button {
    flex: 1;
  }

  .scene-controls {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.8rem;
  }

  .scene-controls label {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: 0.9rem;
  }

  .scene-controls select {
    background: rgba(255, 255, 255, 0.1);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.2);
    padding: 0.25rem;
    border-radius: 0.25rem;
  }

  .device-list h4 {
    margin: 0 0 0.6rem 0;
    font-size: 0.95rem;
  }

  .device-item {
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: 0.4rem;
    align-items: center;
    padding: 0.4rem;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 0.25rem;
    margin-bottom: 0.4rem;
  }

  .device-info {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }

  .device-name {
    font-size: 0.9rem;
    font-weight: 500;
  }

  .device-model {
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.6);
  }

  .device-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-toggle {
    padding: 0.25rem 0.5rem;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.1);
    color: white;
    border-radius: 0.25rem;
    cursor: pointer;
    font-size: 0.8rem;
    transition: all 0.2s ease;
  }

  .btn-toggle.on {
    background: #1db954;
    border-color: #1db954;
  }

  .checkbox {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.8rem;
  }

  .device-color {
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.3);
  }

  .btn-refresh {
    width: 100%;
    margin-top: 0.8rem;
  }
</style>