# musicViz Processing Pipeline

**Version:** 1.0
**Date:** October 19, 2025
**Approach:** Spotify SDK (macOS + Android)

---

## Overview

This document visualizes the complete data processing pipeline for musicViz, from streaming service audio input through to 4K visualization output. The architecture is designed to work on both macOS (development) and Nvidia Shield Pro (production) using the Spotify SDK.

---

## Table of Contents

1. [High-Level System Architecture](#high-level-system-architecture)
2. [Audio Input Pipeline](#audio-input-pipeline)
3. [Analysis Pipeline](#analysis-pipeline)
4. [Visualization Pipeline](#visualization-pipeline)
5. [Data Flow Per Frame](#data-flow-per-frame)
6. [Component Interaction](#component-interaction)
7. [Platform Differences](#platform-differences)

---

## High-Level System Architecture

```mermaid
graph TB
    subgraph External["External Services"]
        Spotify[Spotify Streaming Service]
        SpotifyAPI[Spotify Web API<br/>Metadata, Lyrics, Artwork]
    end

    subgraph Platform["Platform Layer (macOS / Android)"]
        SpotifySDK[Spotify SDK<br/>iOS/Android]
        AudioStream[Audio Stream<br/>PCM Data]
        MetadataStream[Metadata Stream<br/>Track Info]
    end

    subgraph Tauri["Tauri Native Layer (Rust)"]
        Bridge[SDK Bridge Module]
        AudioBuffer[Audio Buffer<br/>Ring Buffer]
        MetadataCache[Metadata Cache]
    end

    subgraph Analysis["Audio Analysis (Rust + Web Audio API)"]
        FFT[FFT Engine<br/>2048 samples]
        FreqExtract[Frequency Band Extractor]
        BeatDetect[Beat Detection]
        Features[Feature Extraction<br/>Volume, Peak, RMS]
    end

    subgraph State["State Management (Svelte Stores)"]
        AudioStore[Audio Data Store]
        MetaStore[Metadata Store]
        VizStore[Visualization Config Store]
        DebugStore[Debug Info Store]
    end

    subgraph Visualization["Visualization Engine (Svelte + WebGL)"]
        RenderLoop[Render Loop<br/>60 FPS]
        SpectrumRenderer[Spectrum Bars Renderer]
        WaveformRenderer[Waveform Renderer]
        ParticleRenderer[Particle System<br/>Phase 2+]
        LyricRenderer[Lyric Splash<br/>Phase 3+]
        ArtistRenderer[Artist Montage<br/>Phase 3+]
    end

    subgraph Output["Output"]
        Display[Display Output<br/>1080p-4K @ 60Hz]
    end

    %% Connections
    Spotify --> SpotifySDK
    SpotifyAPI --> MetadataStream
    SpotifySDK --> AudioStream
    SpotifySDK --> MetadataStream

    AudioStream --> Bridge
    MetadataStream --> Bridge

    Bridge --> AudioBuffer
    Bridge --> MetadataCache

    AudioBuffer --> FFT
    FFT --> FreqExtract
    FFT --> BeatDetect
    FreqExtract --> Features
    BeatDetect --> Features

    Features --> AudioStore
    MetadataCache --> MetaStore

    AudioStore --> RenderLoop
    MetaStore --> RenderLoop
    VizStore --> RenderLoop

    RenderLoop --> SpectrumRenderer
    RenderLoop --> WaveformRenderer
    RenderLoop --> ParticleRenderer
    RenderLoop --> LyricRenderer
    RenderLoop --> ArtistRenderer

    SpectrumRenderer --> Display
    WaveformRenderer --> Display
    ParticleRenderer --> Display
    LyricRenderer --> Display
    ArtistRenderer --> Display

    RenderLoop --> DebugStore

    %% Styling
    classDef external fill:#1DB954,stroke:#1ed760,stroke-width:2px,color:#fff
    classDef platform fill:#4a5568,stroke:#718096,stroke-width:2px,color:#fff
    classDef native fill:#dd6b20,stroke:#ed8936,stroke-width:2px,color:#fff
    classDef analysis fill:#805ad5,stroke:#9f7aea,stroke-width:2px,color:#fff
    classDef state fill:#3182ce,stroke:#4299e1,stroke-width:2px,color:#fff
    classDef viz fill:#d53f8c,stroke:#ed64a6,stroke-width:2px,color:#fff
    classDef output fill:#38a169,stroke:#48bb78,stroke-width:2px,color:#fff

    class Spotify,SpotifyAPI external
    class SpotifySDK,AudioStream,MetadataStream platform
    class Bridge,AudioBuffer,MetadataCache native
    class FFT,FreqExtract,BeatDetect,Features analysis
    class AudioStore,MetaStore,VizStore,DebugStore state
    class RenderLoop,SpectrumRenderer,WaveformRenderer,ParticleRenderer,LyricRenderer,ArtistRenderer viz
    class Display output
```

---

## Audio Input Pipeline

### Spotify SDK Integration

```mermaid
sequenceDiagram
    participant User
    participant App as musicViz App
    participant SDK as Spotify SDK
    participant Auth as Spotify Auth
    participant Stream as Spotify Streaming

    User->>App: Launch App
    App->>SDK: Initialize SDK
    SDK->>Auth: Check Auth Status

    alt Not Authenticated
        Auth-->>User: Redirect to Spotify Login
        User->>Auth: Login & Authorize
        Auth-->>SDK: Return Access Token
    else Already Authenticated
        Auth-->>SDK: Valid Token
    end

    App->>SDK: Request Audio Playback
    SDK->>Stream: Start Streaming
    Stream-->>SDK: Audio Chunks (PCM)
    SDK-->>App: Audio Callback

    loop Every ~10ms
        Stream-->>SDK: Audio Buffer
        SDK-->>App: PCM Data + Metadata
        App->>App: Process Audio
        App->>App: Update Visualization
    end

    User->>App: Stop/Pause
    App->>SDK: Stop Playback
    SDK->>Stream: Close Connection
```

### Audio Buffer Management

```mermaid
graph LR
    subgraph Input["Spotify SDK Output"]
        PCM[PCM Audio Chunks<br/>~10ms buffers]
        Meta[Metadata Updates<br/>Track changes]
    end

    subgraph Buffer["Ring Buffer (Rust)"]
        Write[Write Pointer]
        Read[Read Pointer]
        RingBuf[Circular Buffer<br/>2048 samples]
    end

    subgraph Consumer["Analysis Consumer"]
        FFTInput[FFT Input<br/>2048 samples]
        WaveInput[Waveform Input<br/>2048 samples]
    end

    PCM -->|Write| Write
    Write --> RingBuf
    RingBuf --> Read
    Read -->|Read| FFTInput
    Read -->|Read| WaveInput

    Meta -->|Update| TrackInfo[Track Info Cache]

    style PCM fill:#1DB954
    style RingBuf fill:#dd6b20
    style FFTInput fill:#805ad5
    style TrackInfo fill:#3182ce
```

---

## Analysis Pipeline

### FFT Processing Chain

```mermaid
flowchart TD
    Start[Audio Input<br/>PCM Float32 Array] --> Window[Apply Window Function<br/>Hann/Hamming]
    Window --> FFT[FFT Computation<br/>2048 samples → 1024 bins]
    FFT --> MagPhase[Magnitude Calculation<br/>√(real² + imag²)]
    MagPhase --> DbConvert[Convert to dB<br/>20*log10(magnitude)]
    DbConvert --> Normalize[Normalize<br/>Scale to 0.0-1.0]

    Normalize --> FreqBands[Frequency Band Extraction]
    Normalize --> PeakDetect[Peak Frequency Detection]
    Normalize --> SpectrumOut[Spectrum Data<br/>for visualization]

    FreqBands --> SubBass[Sub-Bass<br/>20-60 Hz]
    FreqBands --> Bass[Bass<br/>60-250 Hz]
    FreqBands --> LowMid[Low-Mid<br/>250-500 Hz]
    FreqBands --> Mid[Mid<br/>500-2000 Hz]
    FreqBands --> HighMid[High-Mid<br/>2000-4000 Hz]
    FreqBands --> Presence[Presence<br/>4000-6000 Hz]
    FreqBands --> Brilliance[Brilliance<br/>6000-20000 Hz]

    SubBass --> BandOutput[Band Levels<br/>Output]
    Bass --> BandOutput
    LowMid --> BandOutput
    Mid --> BandOutput
    HighMid --> BandOutput
    Presence --> BandOutput
    Brilliance --> BandOutput

    PeakDetect --> PeakOut[Peak Frequency<br/>Hz]

    BandOutput --> Features[Feature Vector]
    SpectrumOut --> Features
    PeakOut --> Features

    Features --> Store[Update<br/>Svelte Store]

    style Start fill:#1DB954
    style FFT fill:#805ad5
    style Features fill:#3182ce
    style Store fill:#4299e1
```

### Multi-Dimensional Analysis

```mermaid
graph TB
    subgraph Input["Audio Input"]
        AudioIn[Stereo PCM<br/>Left + Right Channels]
    end

    subgraph TimeDomain["Time Domain Analysis"]
        Waveform[Waveform Extraction]
        RMS[RMS Volume]
        Envelope[Amplitude Envelope]
        ZeroCross[Zero Crossing Rate]
    end

    subgraph FreqDomain["Frequency Domain Analysis"]
        FFTProc[FFT Processing]
        SpectralCentroid[Spectral Centroid]
        SpectralFlux[Spectral Flux]
        Bands[Frequency Bands]
    end

    subgraph Rhythm["Rhythm Analysis (Phase 2)"]
        BeatTrack[Beat Tracking]
        TempoEst[Tempo Estimation]
        OnsetDet[Onset Detection]
    end

    subgraph Features["Feature Aggregation"]
        FeatureVector[Combined Feature Vector]
        Smoothing[Temporal Smoothing]
        Normalization[Value Normalization]
    end

    subgraph Output["Analysis Output"]
        VizData[Visualization Data]
        DebugData[Debug Metrics]
    end

    AudioIn --> Waveform
    AudioIn --> RMS
    AudioIn --> Envelope
    AudioIn --> ZeroCross
    AudioIn --> FFTProc

    FFTProc --> SpectralCentroid
    FFTProc --> SpectralFlux
    FFTProc --> Bands
    FFTProc --> BeatTrack

    BeatTrack --> TempoEst
    BeatTrack --> OnsetDet

    Waveform --> FeatureVector
    RMS --> FeatureVector
    Envelope --> FeatureVector
    ZeroCross --> FeatureVector
    SpectralCentroid --> FeatureVector
    SpectralFlux --> FeatureVector
    Bands --> FeatureVector
    TempoEst --> FeatureVector
    OnsetDet --> FeatureVector

    FeatureVector --> Smoothing
    Smoothing --> Normalization
    Normalization --> VizData
    Normalization --> DebugData

    style AudioIn fill:#1DB954
    style FFTProc fill:#805ad5
    style FeatureVector fill:#3182ce
    style VizData fill:#d53f8c
```

---

## Visualization Pipeline

### Render Loop Architecture

```mermaid
flowchart TD
    Start([requestAnimationFrame]) --> GetTime[Get Timestamp<br/>performance.now]
    GetTime --> CalcDelta[Calculate Delta Time<br/>frame timing]
    CalcDelta --> UpdateFPS[Update FPS Counter]

    UpdateFPS --> ReadStore[Read Audio Data<br/>from Svelte Store]
    ReadStore --> CheckData{Data<br/>Available?}

    CheckData -->|No| WaitFrame[Wait for Next Frame]
    CheckData -->|Yes| ClearCanvas[Clear Canvas<br/>Background]

    ClearCanvas --> CheckMode{Visualization<br/>Mode?}

    CheckMode -->|Spectrum| RenderSpectrum[Render Spectrum Bars]
    CheckMode -->|Waveform| RenderWaveform[Render Waveform]
    CheckMode -->|Both| RenderBoth[Render Both]
    CheckMode -->|Particles| RenderParticles[Render Particle System]
    CheckMode -->|Radial| RenderRadial[Render Radial Pattern]

    RenderSpectrum --> Composite
    RenderWaveform --> Composite
    RenderBoth --> Composite
    RenderParticles --> Composite
    RenderRadial --> Composite

    Composite[Composite Layers] --> Overlay{Debug<br/>Enabled?}

    Overlay -->|Yes| RenderDebug[Render Debug Overlay]
    Overlay -->|No| UpdateDebug[Update Debug Store Only]

    RenderDebug --> Complete
    UpdateDebug --> Complete

    Complete[Frame Complete] --> NextFrame{Continue?}
    NextFrame -->|Yes| Start
    NextFrame -->|No| End([Stop])

    WaitFrame --> NextFrame

    style Start fill:#48bb78
    style ReadStore fill:#4299e1
    style RenderSpectrum fill:#d53f8c
    style RenderWaveform fill:#d53f8c
    style Composite fill:#ed64a6
    style End fill:#fc8181
```

### Spectrum Bars Rendering

```mermaid
graph TB
    subgraph Input["Input Data"]
        FreqData[Frequency Array<br/>1024 bins]
        Config[Render Config<br/>colors, bar count, etc.]
    end

    subgraph Processing["Pre-Processing"]
        LogMap[Logarithmic Mapping<br/>1024 bins → 64 bars]
        Smooth[Temporal Smoothing<br/>interpolation]
        Decay[Decay Function<br/>falling bars]
    end

    subgraph Rendering["WebGL Rendering"]
        VertexGen[Generate Vertex Data<br/>bar positions]
        ColorCalc[Calculate Colors<br/>gradient mapping]
        ShaderExec[Execute Shaders<br/>vertex + fragment]
        Draw[Draw Call<br/>instanced rendering]
    end

    subgraph Output["Output"]
        Canvas[Canvas Buffer]
    end

    FreqData --> LogMap
    Config --> LogMap
    LogMap --> Smooth
    Smooth --> Decay

    Decay --> VertexGen
    Config --> ColorCalc
    Decay --> ColorCalc

    VertexGen --> ShaderExec
    ColorCalc --> ShaderExec
    ShaderExec --> Draw
    Draw --> Canvas

    style FreqData fill:#4299e1
    style ShaderExec fill:#d53f8c
    style Canvas fill:#48bb78
```

### Waveform Rendering

```mermaid
graph LR
    subgraph Input["Input"]
        WaveData[Waveform Array<br/>2048 samples]
        Style[Waveform Style<br/>mirror/dual/mono]
    end

    subgraph Process["Processing"]
        Downsample[Downsample<br/>2048 → screen width]
        Interpolate[Interpolate Points<br/>smooth curves]
    end

    subgraph Render["Rendering"]
        GenPath[Generate Path Data]
        ApplyStyle[Apply Style<br/>mirror/transforms]
        DrawLine[Draw Lines<br/>Canvas 2D or WebGL]
    end

    subgraph Out["Output"]
        Display[Canvas]
    end

    WaveData --> Downsample
    Downsample --> Interpolate
    Interpolate --> GenPath
    Style --> ApplyStyle
    GenPath --> ApplyStyle
    ApplyStyle --> DrawLine
    DrawLine --> Display

    style WaveData fill:#4299e1
    style DrawLine fill:#d53f8c
    style Display fill:#48bb78
```

---

## Data Flow Per Frame

### Complete Frame Pipeline (~16.67ms @ 60 FPS)

```mermaid
sequenceDiagram
    participant SDK as Spotify SDK
    participant Rust as Rust Bridge
    participant Analysis as Audio Analysis
    participant Store as Svelte Store
    participant Render as Render Loop
    participant GPU as GPU/Canvas

    Note over SDK,GPU: Frame N (16.67ms window)

    SDK->>Rust: Audio Callback<br/>PCM data (1-2ms)
    Rust->>Rust: Write to Ring Buffer<br/>(0.1ms)

    par Audio Analysis
        Rust->>Analysis: Read Buffer<br/>(0.1ms)
        Analysis->>Analysis: FFT Computation<br/>(2-3ms)
        Analysis->>Analysis: Feature Extraction<br/>(1ms)
        Analysis->>Store: Update Audio Store<br/>(0.1ms)
    and Metadata
        SDK->>Rust: Metadata Update<br/>(if track changed)
        Rust->>Store: Update Metadata Store<br/>(0.1ms)
    end

    Note over Render: requestAnimationFrame fires

    Render->>Store: Read Audio Data<br/>(0.1ms)
    Render->>Store: Read Metadata<br/>(0.1ms)
    Render->>Render: Process Visualization<br/>(1-2ms)

    par Rendering
        Render->>GPU: Render Spectrum<br/>(3-5ms)
        Render->>GPU: Render Waveform<br/>(2-3ms)
        Render->>GPU: Render Overlays<br/>(1ms)
    end

    GPU->>GPU: Composite & Display<br/>(1-2ms)

    Note over SDK,GPU: Frame N Complete<br/>Total: ~14-16ms (within budget)

    Note over SDK,GPU: Frame N+1 begins...
```

### Timing Budget Breakdown

```mermaid
gantt
    title Frame Timing Budget (16.67ms @ 60 FPS)
    dateFormat X
    axisFormat %L ms

    section Audio Input
    SDK Callback :0, 2
    Buffer Write :2, 2.5

    section Analysis
    FFT Computation :2.5, 5.5
    Feature Extract :5.5, 6.5
    Store Update :6.5, 7

    section Rendering
    Read Store :7, 7.5
    Process Viz :7.5, 9.5
    Spectrum Render :9.5, 12.5
    Waveform Render :12.5, 14.5
    Overlay Render :14.5, 15.5

    section GPU
    Composite :15.5, 16.5
```

---

## Component Interaction

### State Flow Diagram

```mermaid
stateDiagram-v2
    [*] --> Initializing

    Initializing --> AuthRequired: SDK Init
    AuthRequired --> Authenticating: User Action
    Authenticating --> Ready: Auth Success
    Authenticating --> AuthFailed: Auth Failure
    AuthFailed --> AuthRequired: Retry

    Ready --> Playing: Start Playback
    Playing --> Analyzing: Audio Data Available
    Analyzing --> Visualizing: Analysis Complete
    Visualizing --> Rendering: Data in Store
    Rendering --> Playing: Frame Complete

    Playing --> Paused: User Pause
    Paused --> Playing: User Resume

    Playing --> TrackChange: Next Track
    TrackChange --> Playing: New Track Loaded

    Playing --> Stopped: User Stop
    Stopped --> Ready: Reset

    Rendering --> Error: Render Error
    Analyzing --> Error: Analysis Error
    Error --> Ready: Recover

    Ready --> [*]: Shutdown
```

### Module Dependencies

```mermaid
graph TB
    subgraph UI["UI Layer (Svelte)"]
        App[App.svelte]
        VizCanvas[VisualizationCanvas.svelte]
        DebugUI[DebugOverlay.svelte]
        ControlUI[ControlOverlay.svelte]
    end

    subgraph State["State Layer"]
        AudioStore[audioStore.js]
        MetaStore[metadataStore.js]
        VizStore[visualizationStore.js]
        DebugStore[debugStore.js]
    end

    subgraph Audio["Audio Layer"]
        SpotifyBridge[SpotifyBridge.js]
        AudioAnalyzer[AudioAnalyzer.js]
        FeatureExtract[FeatureExtractor.js]
    end

    subgraph Viz["Visualization Layer"]
        SpectrumRenderer[SpectrumBars.svelte]
        WaveformRenderer[Waveform.svelte]
        ParticleSystem[ParticleSystem.js]
    end

    subgraph Native["Native Layer (Rust)"]
        TauriBridge[tauri_bridge.rs]
        SpotifySDK[spotify_sdk.rs]
        AudioBuffer[audio_buffer.rs]
        FFTEngine[fft_engine.rs]
    end

    App --> VizCanvas
    App --> DebugUI
    App --> ControlUI

    VizCanvas --> SpectrumRenderer
    VizCanvas --> WaveformRenderer

    SpectrumRenderer --> VizStore
    WaveformRenderer --> VizStore
    SpectrumRenderer --> AudioStore
    WaveformRenderer --> AudioStore

    DebugUI --> DebugStore
    ControlUI --> VizStore

    SpotifyBridge --> AudioStore
    SpotifyBridge --> MetaStore
    AudioAnalyzer --> AudioStore
    FeatureExtract --> AudioStore

    SpotifyBridge --> TauriBridge
    AudioAnalyzer --> FFTEngine

    TauriBridge --> SpotifySDK
    TauriBridge --> AudioBuffer
    AudioBuffer --> FFTEngine

    style App fill:#d53f8c
    style AudioStore fill:#4299e1
    style SpotifySDK fill:#1DB954
    style FFTEngine fill:#805ad5
```

---

## Platform Differences

### macOS vs Android Implementation

```mermaid
graph TB
    subgraph Common["Shared Components (Platform Agnostic)"]
        VizEngine[Visualization Engine<br/>Svelte + WebGL]
        StateManagement[State Management<br/>Svelte Stores]
        AudioAnalysisLogic[Audio Analysis Logic<br/>FFT, Features]
    end

    subgraph macOS["macOS Specific"]
        SpotifyiOS[Spotify iOS SDK]
        CoreAudio[Core Audio<br/>Optional]
        MetalGPU[Metal GPU]
        Keyboard[Keyboard Input]
    end

    subgraph Android["Android Specific"]
        SpotifyAndroid[Spotify Android SDK]
        AudioTrack[AudioTrack API]
        OpenGLES[OpenGL ES GPU]
        RemoteControl[Remote Control Input]
    end

    SpotifyiOS --> |PCM + Metadata| Common
    SpotifyAndroid --> |PCM + Metadata| Common

    Common --> |Render Commands| MetalGPU
    Common --> |Render Commands| OpenGLES

    Keyboard --> Common
    RemoteControl --> Common

    style Common fill:#4299e1
    style SpotifyiOS fill:#1DB954
    style SpotifyAndroid fill:#1DB954
```

### Platform-Specific Audio Path

```mermaid
sequenceDiagram
    participant App as musicViz App
    participant SDK as Spotify SDK
    participant Platform as Platform Audio
    participant Analysis as Analysis Engine

    Note over App,Analysis: macOS Path

    App->>SDK: Initialize (iOS SDK)
    SDK->>Platform: Configure AVAudioSession
    SDK->>App: Ready
    App->>SDK: Request Playback
    SDK->>Platform: AVAudioEngine Stream
    Platform-->>Analysis: PCM Buffer
    Analysis-->>App: Features

    Note over App,Analysis: Android Path

    App->>SDK: Initialize (Android SDK)
    SDK->>Platform: Configure AudioTrack
    SDK->>App: Ready
    App->>SDK: Request Playback
    SDK->>Platform: AudioTrack PCM
    Platform-->>Analysis: PCM Buffer
    Analysis-->>App: Features
```

---

## Performance Considerations

### Optimization Points

```mermaid
mindmap
  root((Performance<br/>Optimization))
    Audio Input
      Buffer Size
        Smaller = lower latency
        Larger = more stable
      Sample Rate
        Match source quality
        Downsample if needed
      Channel Count
        Stereo vs Mono
        Mix to mono for analysis

    Analysis
      FFT Size
        2048 = good balance
        4096 = more detail, slower
        1024 = faster, less detail
      Window Function
        Hann window standard
        Pre-compute coefficients
      Band Extraction
        Cache bin mappings
        SIMD optimization

    Rendering
      Draw Calls
        Batch geometry
        Instanced rendering
      Shader Complexity
        Keep shaders simple
        Avoid conditionals
      Canvas Size
        Match display resolution
        Avoid upscaling
      Frame Budget
        Target 16.67ms
        Profile regularly

    Memory
      Buffer Management
        Ring buffers
        Pool allocations
      Store Updates
        Batch updates
        Avoid allocations
      WebGL Resources
        Reuse buffers
        Texture atlases
```

---

## Summary

The musicViz processing pipeline consists of:

1. **Input**: Spotify SDK provides PCM audio + metadata
2. **Buffering**: Rust ring buffer manages audio flow
3. **Analysis**: FFT + feature extraction (2-3ms)
4. **State**: Svelte stores provide reactive data
5. **Rendering**: WebGL visualizations (5-10ms)
6. **Output**: 60 FPS display output

**Total Latency**: ~10-20ms from audio input to visual update

**Platform Strategy**: Shared visualization engine, platform-specific audio capture

**Scalability**: Designed for 1080p-4K @ 60 FPS

---

**Last Updated:** October 19, 2025
