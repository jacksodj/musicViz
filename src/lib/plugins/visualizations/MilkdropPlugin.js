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

    // Synthetic audio graph (keeps Milkdrop alive without real audio)
    this.syntheticGainNode = null;
    this.syntheticOutputGain = null;
    this.syntheticSources = null;
    this.syntheticNoise = null;
    this.syntheticAudioConnected = false;
    this.lastSyntheticUpdate = 0;
  }

  /**
   * Lazily create a beat-synced synthetic audio graph so presets have
   * spectrum energy even when no real audio stream exists yet.
   */
  setupSyntheticAudio() {
    if (!this.audioContext || this.syntheticGainNode) {
      return;
    }

    this.syntheticGainNode = this.audioContext.createGain();
    this.syntheticGainNode.gain.value = 0.8;

    // Keep the graph running but mute audible output
    this.syntheticOutputGain = this.audioContext.createGain();
    this.syntheticOutputGain.gain.value = 0;
    this.syntheticGainNode.connect(this.syntheticOutputGain);
    this.syntheticOutputGain.connect(this.audioContext.destination);

    const makeOscillator = (type, baseFrequency) => {
      const osc = this.audioContext.createOscillator();
      osc.type = type;
      osc.frequency.value = baseFrequency;

      const gain = this.audioContext.createGain();
      gain.gain.value = 0;

      osc.connect(gain);
      gain.connect(this.syntheticGainNode);
      osc.start();

      return { osc, gain, baseFrequency };
    };

    this.syntheticSources = {
      bass: makeOscillator('sine', 55),
      mid: makeOscillator('triangle', 220),
      high: makeOscillator('sawtooth', 880)
    };

    // Wide-band noise keeps treble energy lively
    const noiseBuffer = this.audioContext.createBuffer(
      1,
      this.audioContext.sampleRate,
      this.audioContext.sampleRate
    );
    const channel = noiseBuffer.getChannelData(0);
    for (let i = 0; i < channel.length; i++) {
      channel[i] = Math.random() * 2 - 1;
    }

    const noiseSource = this.audioContext.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const noiseGain = this.audioContext.createGain();
    noiseGain.gain.value = 0;

    noiseSource.connect(noiseGain);
    noiseGain.connect(this.syntheticGainNode);
    noiseSource.start();

    this.syntheticNoise = { source: noiseSource, gain: noiseGain };
  }

  /**
   * Smoothly modulate synthetic sources from timing/BPM data.
   * @param {UnifiedPluginData} data
   */
  updateSyntheticAudio(data) {
    if (!this.audioContext || !this.syntheticGainNode || !this.syntheticSources) {
      return;
    }

    const { music = {}, playback = {}, timing = {} } = data || {};
    const bpm = Math.max(20, music.bpm || 120);
    const isPlaying = playback.isPlaying ?? true;
    const timestamp = timing.timestamp ?? performance.now();

    const beatIntervalMs = (60 / bpm) * 1000;
    const beatPhase = beatIntervalMs > 0 ? (timestamp % beatIntervalMs) / beatIntervalMs : 0;
    const beatPulse = Math.max(0, 1 - beatPhase * 2);
    const easedPulse = beatPulse * beatPulse;

    const barIntervalMs = beatIntervalMs * 4;
    const barPhase = barIntervalMs > 0 ? (timestamp % barIntervalMs) / barIntervalMs : 0;

    const now = this.audioContext.currentTime;
    const ramp = 0.05;

    const bassTarget = isPlaying ? 0.75 * easedPulse : 0;
    const midTarget = isPlaying ? 0.35 * Math.abs(Math.sin(Math.PI * 2 * beatPhase)) : 0;
    const highTarget = isPlaying ? 0.18 * (0.3 + Math.abs(Math.sin(Math.PI * 6 * barPhase))) : 0;
    const noiseTarget = isPlaying ? 0.08 + 0.12 * easedPulse : 0;

    this.syntheticSources.bass.gain.gain.setTargetAtTime(bassTarget, now, ramp);
    this.syntheticSources.mid.gain.gain.setTargetAtTime(midTarget, now, ramp);
    this.syntheticSources.high.gain.gain.setTargetAtTime(highTarget, now, ramp);

    if (this.syntheticNoise?.gain) {
      this.syntheticNoise.gain.gain.setTargetAtTime(noiseTarget, now, ramp);
    }

    this.syntheticSources.bass.osc.frequency.setTargetAtTime(
      this.syntheticSources.bass.baseFrequency * (1 + 0.04 * beatPulse),
      now,
      ramp
    );
    this.syntheticSources.mid.osc.frequency.setTargetAtTime(
      this.syntheticSources.mid.baseFrequency * (1 + 0.08 * Math.sin(Math.PI * 2 * barPhase)),
      now,
      ramp
    );
    this.syntheticSources.high.osc.frequency.setTargetAtTime(
      this.syntheticSources.high.baseFrequency * (1 + 0.1 * Math.sin(timestamp / 350)),
      now,
      ramp
    );

    this.lastSyntheticUpdate = timestamp;
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
          preserveDrawingBuffer: true,  // Enable for Govee color extraction
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
          { alpha: true, antialias: true, depth: false, stencil: false, preserveDrawingBuffer: true },
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

      // Ensure synthetic audio graph exists before wiring into Butterchurn
      this.setupSyntheticAudio();

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

      if (this.visualizer && this.syntheticGainNode && !this.syntheticAudioConnected) {
        try {
          this.visualizer.connectAudio(this.syntheticGainNode);
          this.syntheticAudioConnected = true;
          console.log('[MilkdropPlugin] Connected synthetic audio graph to Butterchurn');
        } catch (error) {
          console.warn('[MilkdropPlugin] Failed to connect synthetic audio source to Butterchurn:', error);
        }
      } else if (!this.syntheticGainNode) {
        console.warn('[MilkdropPlugin] Synthetic audio graph missing – Milkdrop may appear static');
      }

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

    // Drive synthetic audio regardless of real playback availability
    this.updateSyntheticAudio(data);

    // Track playing state to control animation
    const wasPlaying = this.isPlaying;
    const playbackState = data?.playback ?? {};
    const nextPlayingState = playbackState.isPlaying;
    this.isPlaying = nextPlayingState ?? true;

    // Log state changes
    if (wasPlaying !== this.isPlaying) {
      console.log(`[MilkdropPlugin] Playing state changed:`, this.isPlaying);

      if (this.audioContext) {
        if (this.isPlaying && this.audioContext.state === 'suspended') {
          this.audioContext.resume().catch(err => {
            console.warn('[MilkdropPlugin] Failed to resume AudioContext on play:', err);
          });
        }
      }
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

    const syntheticActive = !!this.syntheticSources;

    if (!syntheticActive && !this.isPlaying && this.renderCount > 0) {
      // Skip rendering while paused after the first frame to freeze the visual
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

    if (this.syntheticSources) {
      for (const source of Object.values(this.syntheticSources)) {
        try {
          source.osc.stop();
        } catch (error) {
          // Oscillator already stopped
        }
        try {
          source.osc.disconnect();
        } catch (error) {
          // Ignore
        }
        try {
          source.gain.disconnect();
        } catch (error) {
          // Ignore
        }
      }
      this.syntheticSources = null;
    }

    if (this.syntheticNoise) {
      try {
        this.syntheticNoise.source.stop();
      } catch (error) {
        // Already stopped
      }
      try {
        this.syntheticNoise.source.disconnect();
      } catch (error) {
        // Ignore
      }
      try {
        this.syntheticNoise.gain.disconnect();
      } catch (error) {
        // Ignore
      }
      this.syntheticNoise = null;
    }

    if (this.syntheticGainNode) {
      try {
        this.syntheticGainNode.disconnect();
      } catch (error) {
        // Ignore
      }
      this.syntheticGainNode = null;
    }

    if (this.syntheticOutputGain) {
      try {
        this.syntheticOutputGain.disconnect();
      } catch (error) {
        // Ignore
      }
      this.syntheticOutputGain = null;
    }

    this.syntheticAudioConnected = false;
    this.lastSyntheticUpdate = 0;

    // Note: We don't close audioContext as it might be shared
    // or needed by other parts of the app

    console.log(`[MilkdropPlugin] Destroyed: ${this.presetName}`);
  }
}
