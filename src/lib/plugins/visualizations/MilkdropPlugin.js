/**
 * Milkdrop Plugin
 *
 * Wraps Butterchurn library to load and render Milkdrop/ProjectM presets
 */

import { CanvasPlugin } from '../types.js';
import butterchurn from 'butterchurn';

export class MilkdropPlugin extends CanvasPlugin {
  constructor(presetData, presetName) {
    super();

    this.presetName = presetName;
    this.presetData = presetData;

    // Plugin metadata
    this.metadata = {
      id: `milkdrop-${presetName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name: presetName,
      author: 'Milkdrop Community',
      version: '1.0.0',
      description: 'Milkdrop preset visualization',
      type: 'canvas'
    };

    // Extract author from preset name if available (format: "Author - Name")
    const parts = presetName.split(' - ');
    if (parts.length >= 2) {
      this.metadata.author = parts[0].trim();
    }

    this.visualizer = null;
    this.audioContext = null;
    this.analyser = null;
    this.dataArray = null;
    this.bufferLength = 0;
    this.canvas = null;
    this.isPlaying = false;
    this.renderCount = 0;
    this.webglUnavailable = false;
    this.originalGetContextFn = null;
    this.glContext = null;
    this.usingWebGL1 = false;
  }

  /**
   * Initialize plugin with canvas context
   */
  initialize(context) {
    console.log('[MilkdropPlugin] initialize() called with context:', context);
    super.initialize(context);
    this.canvas = context.canvas;

    if (this.webglUnavailable) {
      console.warn('[MilkdropPlugin] Skipping initialization because WebGL is unavailable');
      return;
    }

    console.log('[MilkdropPlugin] After super.initialize(), this.width:', this.width, 'this.height:', this.height);

    try {
      // Check if canvas has valid dimensions
      if (!this.width || !this.height || this.width === 0 || this.height === 0) {
        console.warn('[MilkdropPlugin] Canvas has zero dimensions, waiting for resize...');
        console.warn('[MilkdropPlugin] width:', this.width, 'height:', this.height);
        console.warn('[MilkdropPlugin] context.width:', context.width, 'context.height:', context.height);
        // Don't initialize yet - wait for first resize call
        return;
      }

      console.log('[MilkdropPlugin] Dimensions valid, proceeding with Butterchurn initialization...');

      // Set canvas dimensions (Butterchurn needs these set)
      if (this.canvas) {
        this.canvas.width = this.width;
        this.canvas.height = this.height;
      }

      // Ensure WebGL context is obtainable before handing control to Butterchurn
      if (this.canvas) {
        const contextAttributes = {
          alpha: false,
          antialias: true,
          depth: false,
          stencil: false,
          preserveDrawingBuffer: false,
          premultipliedAlpha: false,
          powerPreference: 'high-performance'
        };

        if (!this.originalGetContextFn) {
          this.originalGetContextFn = this.canvas.getContext;
        }

        const getContextBound = (type, attrs) => this.originalGetContextFn.call(this.canvas, type, attrs);

        const attributeCandidates = [
          contextAttributes,
          { ...contextAttributes, antialias: false },
          { alpha: true, antialias: true, depth: false, stencil: false, preserveDrawingBuffer: false },
          undefined
        ];

        let testGl = null;
        let usedAttrs = null;

        for (const attrs of attributeCandidates) {
          testGl = getContextBound('webgl2', attrs) || getContextBound('experimental-webgl2', attrs);
          if (testGl) {
            usedAttrs = attrs;
            break;
          }
        }

        if (!testGl) {
          for (const attrs of attributeCandidates) {
            testGl = getContextBound('webgl', attrs) || getContextBound('experimental-webgl', attrs);
            if (testGl) {
              usedAttrs = attrs;
              this.usingWebGL1 = true;
              console.warn('[MilkdropPlugin] Falling back to WebGL1 context for Milkdrop preset');
              break;
            }
          }
        }

        if (!testGl) {
          console.error('[MilkdropPlugin] WebGL context unavailable – Milkdrop visualizations require WebGL support.');
          this.webglUnavailable = true;
          return;
        }

        console.log('[MilkdropPlugin] Obtained WebGL context. Antialias:', usedAttrs?.antialias, 'Preserve buffer:', usedAttrs?.preserveDrawingBuffer, 'Using WebGL1:', this.usingWebGL1);
        console.log('[MilkdropPlugin] Context prototype:', Object.getPrototypeOf(testGl)?.constructor?.name);
        window.__milkdropGlContext = testGl;

        if (typeof testGl.getExtension === 'function') {
          testGl.getExtension('OES_standard_derivatives');
        }

        this.glContext = testGl;

        const pluginRef = this;
        Object.defineProperty(this.canvas, 'getContext', {
          configurable: true,
          value(type, attrs) {
            if (!type) {
              return getContextBound(type, attrs);
            }

            const normalized = String(type).toLowerCase();
            if (normalized === 'webgl2' || normalized === 'experimental-webgl2' || normalized === 'webgl' || normalized === 'experimental-webgl') {
              return pluginRef.glContext;
            }

            return getContextBound(type, attrs);
          }
        });
      }

      // Create audio context if needed
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }

      // Resume AudioContext if suspended (required for Butterchurn to render)
      console.log('[MilkdropPlugin] Initial AudioContext state:', this.audioContext.state);
      if (this.audioContext.state === 'suspended') {
        console.log('[MilkdropPlugin] Resuming suspended AudioContext...');
        this.audioContext.resume().then(() => {
          console.log('[MilkdropPlugin] AudioContext resumed successfully');
        }).catch(err => {
          console.error('[MilkdropPlugin] Failed to resume AudioContext:', err);
        });
      }

      // Create analyser node for butterchurn
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(this.bufferLength);

      // Create butterchurn visualizer with LOGICAL pixels (CSS dimensions)
      // Butterchurn will multiply by pixelRatio internally to get physical dimensions
      const rect = this.canvas.getBoundingClientRect();

      console.log('[MilkdropPlugin] Creating visualizer with rect:', rect);
      console.log('[MilkdropPlugin] Canvas physical dimensions:', this.canvas.width, 'x', this.canvas.height);
      console.log('[MilkdropPlugin] Using renderer size:', this.width, 'x', this.height);
      console.log('[MilkdropPlugin] AudioContext state after setup:', this.audioContext.state);

      this.visualizer = butterchurn.createVisualizer(
        this.audioContext,
        this.canvas,
        {
          width: this.width,
          height: this.height,
          pixelRatio: 1,
          textureRatio: 1
        }
      );

      console.log('[MilkdropPlugin] Visualizer type:', typeof this.visualizer);
      console.log('[MilkdropPlugin] Visualizer has render:', typeof this.visualizer.render);

      // Connect analyser (even though we may not have actual audio source)
      // Butterchurn needs the analyser to exist
      this.analyser.connect(this.audioContext.destination);

      // Load preset
      if (this.presetData) {
        this.visualizer.loadPreset(this.presetData, 0.0);
        console.log(`[MilkdropPlugin] Loaded preset: ${this.presetName}`);
        console.log(`[MilkdropPlugin] Visualizer created:`, !!this.visualizer);
        console.log(`[MilkdropPlugin] Canvas dimensions:`, this.canvas.width, 'x', this.canvas.height);
      }
    } catch (error) {
      console.error('[MilkdropPlugin] Initialization error:', error);
    }
  }

  /**
   * Update with new data
   */
  update(data) {
    // Store data
    this.data = data;

    // Track playing state to control animation
    const wasPlaying = this.isPlaying;
    this.isPlaying = data.playback.isPlaying;

    // Log state changes
    if (wasPlaying !== this.isPlaying) {
      console.log(`[MilkdropPlugin] Playing state changed:`, this.isPlaying);
    }
  }

  /**
   * Render visualization
   */
  render() {
    if (!this.visualizer) {
      console.warn('[MilkdropPlugin] No visualizer in render()');
      return;
    }

    // Log first few renders to confirm it's being called
    if (!this.renderCount) {
      this.renderCount = 0;
    }
    this.renderCount++;
    if (this.renderCount <= 5) {
      console.log(`[MilkdropPlugin] Render call #${this.renderCount}`);

      // Check AudioContext state during first renders
      if (this.audioContext) {
        console.log(`[MilkdropPlugin] AudioContext state in render: ${this.audioContext.state}`);

        // Try to resume if suspended
        if (this.audioContext.state === 'suspended') {
          console.log('[MilkdropPlugin] AudioContext suspended in render(), attempting resume...');
          this.audioContext.resume();
        }
      }
    }

    // ALWAYS render, don't check isPlaying
    // Butterchurn needs to render continuously to work properly
    try {
      // Log detailed info for first render
      if (this.renderCount === 1) {
        console.log('[MilkdropPlugin] About to call visualizer.render()');
        console.log('[MilkdropPlugin] Visualizer object:', this.visualizer);
        console.log('[MilkdropPlugin] Canvas:', this.canvas);
        console.log('[MilkdropPlugin] Canvas context:', this.canvas.getContext('webgl'));
      }

      // Butterchurn handles the full render cycle
      const renderStart = performance.now();
      this.visualizer.render();
      const renderTime = performance.now() - renderStart;

      if (this.renderCount <= 5) {
        console.log(`[MilkdropPlugin] Render #${this.renderCount} took ${renderTime.toFixed(2)}ms`);
      }

      if (this.renderCount === 5) {
        console.log('[MilkdropPlugin] First 5 renders completed successfully');
        console.log('[MilkdropPlugin] If you see this but no visualization, the issue is within Butterchurn itself');
      }
    } catch (error) {
      console.error('[MilkdropPlugin] Render error:', error);
      console.error('[MilkdropPlugin] Error stack:', error.stack);
    }
  }

  /**
   * Handle resize
   */
  resize(width, height, dpr) {
    console.log('[MilkdropPlugin] resize() called:', width, 'x', height, 'dpr:', dpr);
    console.log('[MilkdropPlugin] Current visualizer state:', !!this.visualizer);

    if (this.webglUnavailable) {
      console.warn('[MilkdropPlugin] Resize skipped – WebGL unavailable');
      return;
    }

    super.resize(width, height, dpr);

    // If visualizer wasn't created due to zero dimensions, try to initialize now
    if (!this.visualizer && this.canvas && width > 0 && height > 0) {
      console.log('[MilkdropPlugin] No visualizer exists, attempting deferred initialization...');
      console.log('[MilkdropPlugin] Initializing on resize with dimensions:', width, 'x', height);
      // Call initialize again with proper context
      this.initialize({
        canvas: this.canvas,
        width: width,
        height: height,
        dpr: dpr || 1
      });
      return;
    }

    if (this.visualizer) {
      // CRITICAL: Never resize Butterchurn to 0x0 - it corrupts WebGL state
      if (width === 0 || height === 0) {
        console.warn('[MilkdropPlugin] Ignoring resize to zero dimensions - would corrupt Butterchurn');
        return;
      }

      console.log('[MilkdropPlugin] Visualizer exists, calling setRendererSize');
      try {
        // Pass logical dimensions to setRendererSize (it will scale by DPR internally)
        this.visualizer.setRendererSize(width, height, 1);
      } catch (error) {
        console.warn('[MilkdropPlugin] Resize error:', error);
      }
    } else {
      console.warn('[MilkdropPlugin] resize() called but no visualizer and no valid dimensions to create one');
    }
  }

  /**
   * Clean up resources
   */
  destroy() {
    console.log(`[MilkdropPlugin] Destroying: ${this.presetName}`);

    if (this.visualizer) {
      try {
        // Butterchurn uses .release() not .destroy()
        if (typeof this.visualizer.release === 'function') {
          this.visualizer.release();
        }
      } catch (error) {
        console.warn('[MilkdropPlugin] Release error:', error);
      }
      this.visualizer = null;
    }

    if (!this.webglUnavailable && this.canvas && this.glContext) {
      try {
        const loseExt = this.glContext.getExtension && this.glContext.getExtension('WEBGL_lose_context');
        if (loseExt) {
          loseExt.loseContext();
        }
      } catch (error) {
        console.warn('[MilkdropPlugin] Failed to release WebGL context:', error);
      }
    }

    if (this.originalGetContextFn && this.canvas) {
      Object.defineProperty(this.canvas, 'getContext', {
        configurable: true,
        value: this.originalGetContextFn
      });
      this.originalGetContextFn = null;
    }

    this.glContext = null;
    this.usingWebGL1 = false;

    if (this.analyser) {
      try {
        this.analyser.disconnect();
      } catch (error) {
        // Already disconnected
      }
      this.analyser = null;
    }

    // Note: We don't close audioContext as it might be shared
    // or needed by other parts of the app

    console.log(`[MilkdropPlugin] Destroyed: ${this.presetName}`);
  }
}
