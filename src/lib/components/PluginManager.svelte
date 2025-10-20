<script>
  import { onMount, onDestroy } from 'svelte';
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
    onPluginChange = null  // Callback when plugin changes
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

  // Effect to load plugin when pluginId or presetId changes
  $effect(() => {
    // Only reload if the ID actually changed
    if (presetId && presetId !== loadedPresetId) {
      loadedPresetId = presetId;
      loadedPluginId = null;
      loadPluginFromPreset(presetId);
    } else if (pluginId && pluginId !== loadedPluginId && !presetId) {
      loadedPluginId = pluginId;
      loadedPresetId = null;
      loadPlugin(pluginId);
    }
  });

  /**
   * Load plugin by ID
   */
  function loadPlugin(id) {
    try {
      // Clean up existing plugin
      cleanupPlugin();

      if (!id) {
        console.warn('[PluginManager] No plugin ID provided');
        return;
      }

      console.log(`[PluginManager] Loading plugin: ${id}`);

    // Get context based on plugin type
    const PluginClass = pluginRegistry.get(id);
    if (!PluginClass) {
      console.error(`[PluginManager] Plugin '${id}' not found`);
      return;
    }

    // Create temp instance to check type
    const tempInstance = new PluginClass();
    const pluginType = tempInstance.metadata.type;

    // Create appropriate context
    let context = {};
    if (pluginType === 'canvas') {
      // Wait for canvas to be mounted
      if (!canvasEl) {
        console.warn('[PluginManager] Canvas not yet mounted, will retry');
        setTimeout(() => loadPlugin(id), 100);
        return;
      }

      console.log('[PluginManager] Canvas state before plugin load:');
      console.log('  - Canvas element:', canvasEl);
      console.log('  - Canvas in DOM:', document.body.contains(canvasEl));
      console.log('  - Canvas display:', window.getComputedStyle(canvasEl).display);
      console.log('  - Canvas visibility:', window.getComputedStyle(canvasEl).visibility);
      console.log('  - Canvas opacity:', window.getComputedStyle(canvasEl).opacity);

      const rect = canvasEl.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      console.log('  - BoundingClientRect:', rect.width, 'x', rect.height);
      console.log('  - Device Pixel Ratio:', dpr);

      // For Milkdrop plugins, don't get 2D context (they need WebGL)
      // Check if this is a Milkdrop plugin by ID
      const isMilkdrop = id.startsWith('milkdrop-');

      context = {
        canvas: canvasEl, // Always pass canvas element
        width: rect.width * dpr,
        height: rect.height * dpr,
        dpr
      };

      // Only get 2D context for non-Milkdrop plugins
      // NOTE: This context may become stale when canvas is recreated
      if (!isMilkdrop) {
        const ctx = canvasEl.getContext('2d');
        console.log('  - 2D Context acquired:', !!ctx);
        if (ctx) {
          console.log('  - Context canvas:', ctx.canvas === canvasEl);

          // Test drawing to verify canvas is working
          try {
            ctx.fillStyle = '#FF0000';
            ctx.fillRect(10, 10, 50, 50);
            console.log('  - Test drawing successful (red square at 10,10)');
            // Clear the test drawing
            setTimeout(() => {
              ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
              console.log('  - Test drawing cleared');
            }, 100);
          } catch (error) {
            console.error('  - Test drawing failed:', error);
          }
        }
        context.ctx = ctx;
      } else {
        console.log('  - Skipping 2D context for Milkdrop plugin');
      }
    } else if (pluginType === 'component') {
      context = {
        container: containerEl
      };
    }

    // Create plugin instance
    plugin = pluginRegistry.createInstance(id, context);

    if (!plugin) {
      console.error(`[PluginManager] Failed to create plugin instance: ${id}`);
      return;
    }

    // For component plugins, set up component rendering
    if (pluginType === 'component') {
      componentInstance = plugin.getComponent();
      componentProps = plugin.getProps();
    }

    // Ensure canvas is properly sized before starting animation
    if (plugin.metadata.type === 'canvas') {
      console.log('[PluginManager] Calling handleResize() after plugin creation');
      handleResize();
    }

    // Start animation loop
    startAnimationLoop();

      // Callback
      if (onPluginChange) {
        onPluginChange(plugin);
      }

      console.log(`[PluginManager] Plugin loaded: ${plugin.metadata.name}`);
    } catch (error) {
      console.error('[PluginManager] Failed to load plugin:', error);
      // Don't let plugin errors break the entire app
      plugin = null;
    }
  }

  /**
   * Load plugin from preset
   */
  function loadPluginFromPreset(id) {
    cleanupPlugin();

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

    // Load the plugin first
    loadPlugin(preset.pluginId);

    // Apply preset config
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

  // Effect to set up canvas resize observer whenever canvas changes
  $effect(() => {
    // This runs whenever canvasEl changes (including when canvas is recreated)
    if (canvasEl) {
      console.log('[PluginManager] Setting up resize observer for canvas');

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
