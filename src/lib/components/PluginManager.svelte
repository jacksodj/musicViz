<script>
  import { onDestroy, tick } from 'svelte';
  import { playerState, playerProgress } from '$lib/stores/playerStore.js';
  import { analysisStore } from '$lib/stores/analysisStore.js';
  import { pluginRegistry } from '$lib/plugins/PluginRegistry.js';
  import { pluginDataAdapter } from '$lib/plugins/PluginDataAdapter.js';
  import { get } from 'svelte/store';

  // Props
  let {
    pluginId = null,       // Plugin ID to load
    presetId = null,       // Preset ID to load (overrides pluginId)
    width = '100%',        // Container width
    height = '100vh',      // Container height
    onPluginChange = null, // Callback when plugin changes
    canvasRef = null       // Bindable canvas reference
  } = $props();

  // State
  let plugin = $state(null);
  let canvasEl = $state(null);
  let containerEl = $state(null);
  let animationFrameId = null;
  let lastTimestamp = 0;
  let currentFps = 60;
  let fpsFrameCount = 0;
  let fpsLastTime = 0;

  // Component plugin state
  let componentInstance = $state(null);
  let componentProps = $state({});

  // We'll read stores synchronously in the animation loop using get()
  // to avoid any reactivity/subscription issues

  // Track which plugin is currently loaded to prevent reload loops
  let loadedPluginId = $state(null);
  let loadedPresetId = $state(null);
  let canvasKey = $state(0); // Force canvas recreation when this changes
  let loadRequestCounter = 0;

  // Effect to load plugin when pluginId or presetId changes
  $effect(() => {
    // Only reload if the ID actually changed
    if (presetId && presetId !== loadedPresetId) {
      loadedPresetId = presetId;
      loadedPluginId = null;
      void loadPluginFromPreset(presetId);
    } else if (pluginId && pluginId !== loadedPluginId && !presetId) {
      loadedPluginId = pluginId;
      loadedPresetId = null;
      void loadPlugin(pluginId);
    }
  });

  async function waitForCanvasReady(attempts = 10, delayMs = 30) {
    for (let i = 0; i < attempts; i++) {
      await tick();

      if (canvasEl && canvasEl instanceof HTMLCanvasElement) {
        if (document.body.contains(canvasEl)) {
          return true;
        }
      }

      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    return false;
  }

  /**
   * Load plugin by ID
   */
  async function loadPlugin(id) {
    const requestId = ++loadRequestCounter;
    try {
      cleanupPlugin();

      if (!id) {
        console.warn('[PluginManager] No plugin ID provided');
        return;
      }

      console.log(`[PluginManager] Loading plugin: ${id}`);

      const PluginClass = pluginRegistry.get(id);
      if (!PluginClass) {
        console.error(`[PluginManager] Plugin '${id}' not found`);
        return;
      }

      const tempInstance = new PluginClass();
      const pluginType = tempInstance.metadata.type;

      let context = {};

      if (pluginType === 'canvas') {
        const canvasReady = await waitForCanvasReady();

        if (requestId !== loadRequestCounter) {
          console.log('[PluginManager] Canvas wait aborted by newer load request');
          return;
        }

        if (!canvasReady || !canvasEl) {
          console.error('[PluginManager] Canvas element not ready for plugin load');
          return;
        }

        if (!canvasEl.classList.contains('plugin-canvas')) {
          console.error('[PluginManager] Canvas missing plugin-canvas class! Classes:', canvasEl.className);
        }

        const rect = canvasEl.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const isMilkdrop = id.startsWith('milkdrop-');
        const containerRect = containerEl?.getBoundingClientRect();
        const width = Math.max(rect.width || containerRect?.width || canvasEl.width || 0, 1);
        const height = Math.max(rect.height || containerRect?.height || canvasEl.height || 0, 1);

        context = {
          canvas: canvasEl,
          width: width * dpr,
          height: height * dpr,
          dpr
        };

        if (!isMilkdrop) {
          const ctx = canvasEl.getContext('2d');
          if (!ctx) {
            console.error('[PluginManager] Failed to acquire 2D context for canvas plugin');
            return;
          }
          context.ctx = ctx;
        }
      } else if (pluginType === 'component') {
        context = {
          container: containerEl
        };
      }

      if (requestId !== loadRequestCounter) {
        console.log('[PluginManager] Plugin load aborted before instantiation');
        return;
      }

      plugin = pluginRegistry.createInstance(id, context);

      if (!plugin) {
        console.error(`[PluginManager] Failed to create plugin instance: ${id}`);
        return;
      }

      if (pluginType === 'component') {
        componentInstance = plugin.getComponent();
        componentProps = plugin.getProps();
      }

      if (plugin.metadata.type === 'canvas') {
        handleResize();

        if (!canvasEl || !document.body.contains(canvasEl)) {
          console.warn('[PluginManager] Canvas not in DOM yet; waiting before animation start');

          const readyAfterResize = await waitForCanvasReady();

          if (requestId !== loadRequestCounter) {
            console.log('[PluginManager] Plugin load aborted during post-resize wait');
            return;
          }

          if (!readyAfterResize) {
            console.error('[PluginManager] Canvas never became available for animation');
            return;
          }

          handleResize();
        }
      }

      startAnimationLoop();

      if (onPluginChange) {
        onPluginChange(plugin);
      }

      console.log(`[PluginManager] Plugin loaded: ${plugin.metadata.name}`);
    } catch (error) {
      console.error('[PluginManager] Failed to load plugin:', error);
      plugin = null;
    }
  }

  /**
   * Load plugin from preset
   */
  async function loadPluginFromPreset(id) {
    if (!id) {
      console.warn('[PluginManager] No preset ID provided');
      return;
    }

    console.log(`[PluginManager] Loading preset: ${id}`);

    const preset = pluginRegistry.getPreset(id);
    if (!preset) {
      console.error(`[PluginManager] Preset '${id}' not found`);
      return;
    }

    await loadPlugin(preset.pluginId);

    if (plugin && preset.config) {
      plugin.setConfig(preset.config);
    }
  }

  /**
   * Start animation loop
   */
  function startAnimationLoop() {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }

    lastTimestamp = performance.now();
    fpsLastTime = lastTimestamp;
    fpsFrameCount = 0;

    animationFrameId = requestAnimationFrame(animate);
  }

  /**
   * Animation loop
   */
  function animate(timestamp) {
    if (!plugin) {
      animationFrameId = null;
      return;
    }

    // Calculate FPS
    fpsFrameCount++;
    if (timestamp - fpsLastTime >= 1000) {
      currentFps = fpsFrameCount;
      fpsFrameCount = 0;
      fpsLastTime = timestamp;
    }

    // Read stores synchronously to avoid reactivity issues in animation loop
    const currentPlayerState = get(playerState) || {
      isPlaying: false,
      position: 0,
      duration: 0,
      currentTrack: null
    };
    const currentAnalysis = get(analysisStore.analysis) || {};

    // Create unified data
    const unifiedData = pluginDataAdapter.createUnifiedData({
      playerState: currentPlayerState,
      analysis: currentAnalysis,
      audioData: null, // TODO: Add real audio data when available
      timestamp,
      fps: currentFps
    });

    // Update plugin
    plugin.update(unifiedData);

    // Render canvas plugins
    if (plugin.metadata.type === 'canvas' && plugin.render) {
      plugin.render();
    }

    // Update component plugin props
    if (plugin.metadata.type === 'component') {
      componentProps = plugin.getProps();
    }

    // Schedule next frame
    animationFrameId = requestAnimationFrame(animate);
  }

  /**
   * Handle canvas resize
   */
  function handleResize() {
    if (!plugin || plugin.metadata.type !== 'canvas' || !canvasEl) {
      return;
    }

    const rect = canvasEl.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Update canvas size
    canvasEl.width = rect.width * dpr;
    canvasEl.height = rect.height * dpr;

    // Notify plugin
    if (plugin.resize) {
      plugin.resize(rect.width * dpr, rect.height * dpr, dpr);
    }
  }

  /**
   * Cleanup plugin
   */
  function cleanupPlugin() {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    if (plugin) {
      if (plugin.destroy) {
        plugin.destroy();
      }
      plugin = null;
    }

    componentInstance = null;
    componentProps = {};

    // Increment canvas key to force recreation
    // This prevents WebGL/2D context conflicts
    canvasKey++;
  }

  // Expose canvas to parent when it changes
  $effect(() => {
    if (canvasRef && typeof canvasRef === 'function') {
      canvasRef(canvasEl);
    }
  });

  // Effect to set up canvas resize observer whenever canvas changes
  $effect(() => {
    // This runs whenever canvasEl changes (including when canvas is recreated)
    if (canvasEl) {
      console.log('[PluginManager] Setting up resize observer for canvas');

      // IMPORTANT: Set canvas dimensions immediately to container size
      const rect = containerEl?.getBoundingClientRect();
      if (rect && rect.width > 0 && rect.height > 0) {
        const dpr = window.devicePixelRatio || 1;
        canvasEl.width = rect.width * dpr;
        canvasEl.height = rect.height * dpr;
        console.log('[PluginManager] Set canvas dimensions:', canvasEl.width, 'x', canvasEl.height);

        // Force style dimensions too
        canvasEl.style.width = rect.width + 'px';
        canvasEl.style.height = rect.height + 'px';
      } else {
        console.warn('[PluginManager] Container has no dimensions yet, will retry...');
        // Retry after a short delay
        setTimeout(() => {
          const retryRect = containerEl?.getBoundingClientRect();
          if (retryRect && retryRect.width > 0 && retryRect.height > 0) {
            const dpr = window.devicePixelRatio || 1;
            canvasEl.width = retryRect.width * dpr;
            canvasEl.height = retryRect.height * dpr;
            canvasEl.style.width = retryRect.width + 'px';
            canvasEl.style.height = retryRect.height + 'px';
            console.log('[PluginManager] Retry: Set canvas dimensions:', canvasEl.width, 'x', canvasEl.height);
            handleResize();
          }
        }, 100);
      }

      // Initial resize
      handleResize();

      // Resize observer
      const resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      resizeObserver.observe(canvasEl);

      // Cleanup function runs when effect re-runs or component unmounts
      return () => {
        console.log('[PluginManager] Disconnecting resize observer');
        resizeObserver.disconnect();
      };
    }
  });

  // Cleanup on destroy
  onDestroy(() => {
    cleanupPlugin();
  });
</script>

<div
  class="plugin-manager"
  bind:this={containerEl}
  style="width: {width}; height: {height};"
>
  <!-- Canvas always rendered for canvas plugins - recreate on key change to prevent context conflicts -->
  {#key canvasKey}
    <canvas
      bind:this={canvasEl}
      class="plugin-canvas"
    ></canvas>
  {/key}

  <!-- Component plugins render here -->
  {#if plugin && plugin.metadata.type === 'component' && componentInstance}
    {@const Component = componentInstance}
    <Component {...componentProps} />
  {/if}

  <!-- Placeholder when no plugin loaded -->
  {#if !plugin}
    <div class="plugin-placeholder">
      <p>No plugin loaded</p>
    </div>
  {/if}
</div>

<style>
  .plugin-manager {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    z-index: 1;
  }

  .plugin-canvas {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: block;
    z-index: 1;
  }

  .plugin-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #000;
  }

  .plugin-placeholder p {
    color: rgba(255, 255, 255, 0.5);
    font-size: 1.2rem;
  }
</style>
