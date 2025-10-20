# musicViz MVP Requirements Document

## Project Overview

**Product Name:** musicViz
**Version:** 1.0 (MVP)
**Target Platform:** Nvidia Shield Pro (Android TV)
**Development Platform:** macOS (for local testing and development)
**Output Resolution:** 4K (3840x2160) @ 60Hz
**Last Updated:** October 19, 2025

## Executive Summary

musicViz is an intelligent music visualization application that creates dynamic, self-evolving visual experiences based on multi-dimensional audio and metadata analysis. The system integrates spectral audio analysis, lyrical content interpretation, and musical metadata to generate adaptive 4K visualizations optimized for streaming hi-definition audio services.

## Core Objectives

1. Deliver immersive, high-fidelity music visualizations for streaming audio
2. Create adaptive visualizations that evolve based on musical context
3. Implement user feedback loop for personalized visual preferences
4. Maintain consistent 4K 60Hz performance on Nvidia Shield Pro hardware
5. Enable rapid development and testing on macOS desktop environment

## Platform Specifications

### Target Production Platform: Nvidia Shield Pro

#### Hardware Requirements
- **Device:** Nvidia Shield Pro
- **Processor:** Tegra X1+ (4x ARM Cortex-A57 + 4x ARM Cortex-A53)
- **GPU:** 256-core Nvidia Maxwell GPU
- **RAM:** 3GB DDR4
- **Display Output:** HDMI 2.0b (4K @ 60Hz HDR)
- **OS:** Android TV 11+

#### Performance Targets
- **Frame Rate:** Consistent 60 FPS at 4K resolution
- **Latency:** <50ms audio-to-visual response time
- **Memory Usage:** <1.5GB RAM footprint
- **GPU Utilization:** <80% average load

### Development Platform: macOS

#### Development Requirements
- **OS:** macOS 12 (Monterey) or later
- **Processor:** Apple Silicon (M1/M2/M3) or Intel Core i5+
- **GPU:** Integrated or discrete GPU with Metal support
- **RAM:** 8GB minimum, 16GB recommended
- **Display:** Any resolution (1080p to 4K+)
- **Audio:** System audio capture from streaming service desktop apps/web players

#### Development Benefits
- **Rapid Iteration:** Faster compile and test cycles on desktop
- **Debugging Tools:** Full desktop debugging capabilities
- **Real Streaming Testing:** Test with actual streaming services (Tidal, Spotify, Apple Music, Amazon Music) via system audio capture
- **Performance Profiling:** Use macOS Instruments and browser dev tools
- **Mouse/Keyboard Input:** Easier UI testing before remote control implementation

#### Development Workflow
- Primary development and testing on macOS
- Regular testing on Nvidia Shield Pro for performance validation
- Cross-platform code sharing via Tauri
- Platform-specific optimizations where necessary

## Functional Requirements

### 1. Audio Input & Processing

#### 1.1 Streaming Service Integration
- **FR-1.1.1:** Support audio from major streaming services:
  - **Tidal** (Hi-Fi, Hi-Fi Plus with MQA)
  - **Spotify** (Premium, Hi-Fi when available)
  - **Apple Music** (Lossless, Hi-Res Lossless)
  - **Amazon Music** (HD, Ultra HD)
- **FR-1.1.2:** Handle multiple audio formats (FLAC, ALAC, AAC, MP3, Ogg Vorbis, MQA)
- **FR-1.1.3:** Support sample rates: 44.1kHz, 48kHz, 88.2kHz, 96kHz, 192kHz
- **FR-1.1.4:** Support bit depths: 16-bit, 24-bit, 32-bit float
- **FR-1.1.5:** Maintain audio passthrough to output device (no interruption to playback)

#### 1.1a Streaming Service Integration (Android TV/Shield Pro)
- **FR-1.1a.1:** Integrate with streaming service Android TV apps via API/SDK
- **FR-1.1a.2:** System-level audio capture if SDK integration unavailable
- **FR-1.1a.3:** Background service for continuous audio monitoring
- **FR-1.1a.4:** Handle app switching and audio focus changes
- **FR-1.1a.5:** Automatic detection of active streaming service

#### 1.1b Streaming Service Testing (macOS Development)
- **FR-1.1b.1:** System audio capture from streaming service desktop apps
- **FR-1.1b.2:** Support capture from:
  - Tidal desktop app
  - Spotify desktop app
  - Apple Music app (native macOS)
  - Amazon Music desktop app
  - Web players (Chrome, Safari, Firefox)
- **FR-1.1b.3:** Audio routing that doesn't interrupt playback
- **FR-1.1b.4:** Configurable audio input source selection
- **FR-1.1b.5:** Loopback audio device support (BlackHole, Soundflower, etc.)

#### 1.2 Spectral Audio Analysis
- **FR-1.2.1:** Real-time FFT analysis with configurable window sizes (1024, 2048, 4096 samples)
- **FR-1.2.2:** Frequency band extraction (sub-bass, bass, low-mid, mid, high-mid, presence, brilliance)
- **FR-1.2.3:** Beat detection and BPM analysis
- **FR-1.2.4:** Dynamic range and amplitude envelope tracking
- **FR-1.2.5:** Onset detection for transient events
- **FR-1.2.6:** Harmonic/percussive source separation for refined analysis

### 2. Content Analysis

#### 2.1 Lyrical Content Analysis
- **FR-2.1.1:** Fetch synchronized lyrics from streaming service metadata or external API
- **FR-2.1.2:** Parse lyrics for emotional sentiment (positive, negative, neutral, energetic)
- **FR-2.1.3:** Identify key phrases and recurring themes
- **FR-2.1.4:** Detect lyrical timing/sync points for word-level animation
- **FR-2.1.5:** Extract lyrical mood indicators (anger, joy, sadness, excitement, calm)
#### 2.2 Musical Metadata Analysis
- **FR-2.2.1:** Extract track metadata from streaming service (artist, album, title, year, label)
- **FR-2.2.2:** Genre classification and sub-genre identification
- **FR-2.2.3:** Fetch artist imagery (photos, album art, promotional images)
- **FR-2.2.4:** Retrieve album artwork at highest available resolution
- **FR-2.2.5:** Access artist biographical data and visual themes
- **FR-2.2.6:** Identify musical era and style characteristics
- **FR-2.2.7:** Utilize streaming service metadata APIs for rich content

### 3. Visualization Engine

#### 3.1 Core Visualization Types

##### 3.1.1 Frequency Spectrum (Bars)
- Vertical bar visualization with 32-128 frequency bands
- Logarithmic frequency scaling for musical perception
- Configurable bar styles (solid, gradient, outlined)
- Responsive color mapping based on amplitude and frequency range
- Smooth interpolation and decay curves

##### 3.1.2 Waveform Display
- Dual-channel waveform for stereo audio
- Configurable time window (1-10 seconds)
- Mirror/symmetrical display options
- Amplitude-based color intensity
- Historical waveform trails

##### 3.1.3 Circular/Radial Patterns
- Circular spectrum analyzer
- Radial waveform displays
- Concentric ring visualizations responding to frequency bands
- Rotation and pulsation based on beat detection
- Mandala-style symmetric patterns

##### 3.1.4 Particle Systems
- Dynamic particle generation based on audio events
- Particle behavior influenced by frequency content
- Collision and physics simulation
- Color and size variation based on spectral analysis
- Particle count scaling (1K-100K particles)

##### 3.1.5 Lyrical Splashes
- Animated text display of current lyrics
- Word-by-word or phrase-by-phrase animation
- Typography effects (fade, scale, rotation, distortion)
- Position and movement based on lyrical mood
- Color schemes derived from emotional content

##### 3.1.6 Artist Montages
- Dynamic photo/artwork composition
- Album art integration and animation
- Artist imagery blending and transitions
- Era-appropriate visual filters and effects
- Metadata-driven layout generation

#### 3.2 Adaptive Visualization System
- **FR-3.2.1:** Real-time blending between visualization types
- **FR-3.2.2:** Automatic mode switching based on musical intensity and structure
- **FR-3.2.3:** Smooth transitions between visualization states (2-5 second blends)
- **FR-3.2.4:** Context-aware parameter adjustment based on genre and mood
- **FR-3.2.5:** Visual composition hierarchy (background, mid-ground, foreground layers)

#### 3.3 Self-Evolving Intelligence
- **FR-3.3.1:** Track user preferences via thumbs up/down feedback
- **FR-3.3.2:** Store visualization configurations per track/artist/genre
- **FR-3.3.3:** Generate variation algorithms for parameter exploration
- **FR-3.3.4:** Learning system to predict preferred visual styles
- **FR-3.3.5:** Automatic parameter tuning based on feedback history

### 4. User Interface

#### 4.1 Minimal UI Mode
- **FR-4.1.1:** Full-screen visualization as default mode
- **FR-4.1.2:** Overlay UI triggered by remote control input (Shield) or key press (macOS)
- **FR-4.1.3:** Auto-hide UI after 5 seconds of inactivity
- **FR-4.1.4:** Now playing information (track, artist, album)
- **FR-4.1.5:** Minimal status indicators (streaming service connection, buffering, loading)

#### 4.2 Feedback Controls
- **FR-4.2.1:** Thumbs Up button saves current visualization configuration
- **FR-4.2.2:** Thumbs Down triggers immediate visualization revision
- **FR-4.2.3:** Visual confirmation of feedback submission
- **FR-4.2.4:** Feedback history accessible in settings
- **FR-4.2.5:** Quick toggle between saved favorite configurations

#### 4.3 Input Handling

##### Android TV (Production)
- **FR-4.3.1:** D-pad navigation for UI elements
- **FR-4.3.2:** Remote control button mapping (play, pause, select, back)
- **FR-4.3.3:** Voice command support for basic controls
- **FR-4.3.4:** Quick settings access via menu button

##### macOS (Development)
- **FR-4.3.5:** Keyboard shortcuts for all remote control functions
  - Space: Play/Pause
  - Arrow keys: Navigate UI
  - Enter: Select/Confirm
  - Escape: Back/Exit UI
  - Up Arrow: Thumbs Up
  - Down Arrow: Thumbs Down
  - F: Toggle fullscreen
  - D: Toggle debug overlay
- **FR-4.3.6:** Mouse/trackpad support for UI interaction
- **FR-4.3.7:** Menu bar or toolbar for development features
- **FR-4.3.8:** Debug overlay showing FPS, audio analysis metrics, current state

### 5. Data Management

#### 5.1 User Preferences
- **FR-5.1.1:** Local storage of visualization preferences (SQLite or JSON)
- **FR-5.1.2:** Track-level preference persistence
- **FR-5.1.3:** Artist/genre-level preference defaults
- **FR-5.1.4:** Export/import preference profiles
- **FR-5.1.5:** Preference sync (future: cloud backup)
- **FR-5.1.6:** (Dev) Preference file location accessible for debugging

#### 5.2 Asset Caching
- **FR-5.2.1:** Cache album artwork locally (LRU cache, max 500MB)
- **FR-5.2.2:** Cache artist imagery (LRU cache, max 1GB)
- **FR-5.2.3:** Cache lyrics and metadata (max 100MB)
- **FR-5.2.4:** Automatic cache cleanup and size management
- **FR-5.2.5:** Preload assets for upcoming tracks in playlist
- **FR-5.2.6:** (Dev) Cache location configurable, cache inspection tools

## Non-Functional Requirements

### Performance Requirements

#### Production (Nvidia Shield Pro)
- **NFR-1.1:** Maintain 60 FPS during all visualization modes at 4K
- **NFR-1.2:** Audio analysis processing time <16ms per frame
- **NFR-1.3:** Visualization render time <16ms per frame
- **NFR-1.4:** Application startup time <5 seconds
- **NFR-1.5:** Track transition time <2 seconds

#### Development (macOS)
- **NFR-1.6:** Maintain 60 FPS at native resolution (1080p-4K)
- **NFR-1.7:** Hot reload time <2 seconds for UI changes
- **NFR-1.8:** Application startup time <3 seconds in dev mode
- **NFR-1.9:** Acceptable performance on older Intel Macs (reduced quality if needed)

### Quality Requirements
- **NFR-2.1:** Visual output must be artifact-free at target resolution
- **NFR-2.2:** No audio dropouts or glitches during visualization
- **NFR-2.3:** Smooth transitions without visual stuttering
- **NFR-2.4:** Color accuracy and HDR support (Shield) or standard color space (macOS)

### Reliability Requirements
- **NFR-3.1:** Application uptime >99% during playback sessions
- **NFR-3.2:** Graceful degradation if network/metadata unavailable
- **NFR-3.3:** Auto-recovery from GPU/rendering errors
- **NFR-3.4:** Crash reporting and error logging
- **NFR-3.5:** (Dev) Detailed error messages and stack traces for debugging

### Compatibility Requirements
- **NFR-4.1:** Support Nvidia Shield Pro (2019 model and later)
- **NFR-4.2:** Compatible with Android TV 11+
- **NFR-4.3:** Work with standard HDMI 2.0b displays
- **NFR-4.4:** Support both SDR and HDR10 output modes
- **NFR-4.5:** Support macOS 12+ (Intel and Apple Silicon)
- **NFR-4.6:** Cross-platform code sharing >90%

## Technical Architecture

### Cross-Platform Strategy
- **Tauri** as cross-platform runtime (macOS desktop and Android TV)
- Shared codebase for visualization engine and audio processing
- Platform-specific modules for input handling and audio capture
- Conditional compilation for platform-specific features
- Feature flags for development-only functionality

### Frontend Stack (Tauri + Svelte)
- **Svelte 5** for reactive UI components
- **SvelteKit** for routing and state management
- **Tailwind CSS** or custom CSS for styling
- **WebGL/WebGPU** for visualization rendering (cross-platform)

### Audio Processing
- **Web Audio API** for spectral analysis (works on both platforms)
- **FFT implementation** (optimized for real-time)
- **Rust backend** for performance-critical audio processing
- **Platform-specific audio capture:**
  - macOS: System audio loopback (BlackHole, Soundflower) or Core Audio API
  - Android TV: Streaming service SDK integration or system audio capture API

### Graphics Rendering
- **WebGL 2.0** as primary rendering API (maximum compatibility)
- **WebGPU** optional path for future optimization
- **Three.js** or custom shader pipelines for 3D visualizations
- **Canvas 2D API** for text and UI overlays
- **GPU-accelerated particles** and effects
- Platform-agnostic shader code (GLSL ES 3.0)

### Machine Learning / Intelligence
- **Local inference** for preference prediction
- **Simple neural network** or decision tree for parameter selection
- **Reinforcement learning** approach for self-evolution
- **Rust-based ML** (burn, candle) or JavaScript (TensorFlow.js lite)
- Cross-platform model format

### Data Sources

#### Streaming Service Integration (Both Platforms)
- **Primary Services:**
  - **Tidal:** SDK/API for metadata, Connect API for playback control
  - **Spotify:** SDK/API for metadata, Web API for track info
  - **Apple Music:** MusicKit (iOS/macOS), Android SDK
  - **Amazon Music:** SDK/API for Android, potential web API for macOS
- **Metadata Sources:**
  - Streaming service native metadata (preferred)
  - Lyrics API (Musixmatch, Genius, or service-provided)
  - Music metadata APIs (MusicBrainz, Last.fm, Discogs) as fallback
  - Artist image APIs (service-provided, Last.fm, Fanart.tv)

#### Platform-Specific Implementation
- **Android TV/Shield Pro:**
  - Native streaming service Android TV app integration
  - SDK-based metadata retrieval
  - Direct audio stream access where available
  - System audio capture as fallback

- **macOS Development:**
  - System audio capture from streaming service desktop apps or web players
  - Web API access for metadata (when desktop app SDK unavailable)
  - Same metadata APIs as production for consistency
  - Streaming service account required for testing

## MVP Feature Prioritization

### Phase 1: Core Foundation (Weeks 1-3)
- [ ] Tauri app architecture setup for macOS and Android TV
- [ ] System audio capture setup on macOS (BlackHole/Soundflower)
- [ ] Audio input integration via Web Audio API
- [ ] Basic FFT-based spectral analysis
- [ ] Simple frequency spectrum bar visualization
- [ ] Basic waveform display
- [ ] Minimal UI overlay with now playing info
- [ ] Keyboard controls for macOS testing
- [ ] Debug overlay for development (FPS, audio levels, frequency bands)

### Phase 2: Enhanced Visualizations (Weeks 4-6)
- [ ] Circular/radial pattern visualizations
- [ ] Basic particle system implementation
- [ ] Streaming service metadata integration (start with one service)
- [ ] Album artwork fetching and display
- [ ] Artist imagery integration
- [ ] Visualization blending and transitions
- [ ] Performance optimization for 4K 60Hz
- [ ] Cross-platform testing (macOS and Shield)

### Phase 3: Intelligence & Content (Weeks 7-9)
- [ ] Lyrical content fetching from streaming service or Lyrics API
- [ ] Lyrical splash visualization
- [ ] Artist montage implementation
- [ ] Sentiment analysis integration
- [ ] Genre-based visualization adaptation
- [ ] Beat detection and rhythm responsiveness
- [ ] Multi-service metadata support (Spotify, Tidal, Apple Music, Amazon Music)

### Phase 4: Self-Evolution System (Weeks 10-12)
- [ ] Thumbs up/down feedback UI (keyboard + remote)
- [ ] Preference storage system
- [ ] Visualization parameter variation engine
- [ ] Learning algorithm implementation
- [ ] Track/artist preference persistence
- [ ] Automatic visualization revision logic
- [ ] Cross-platform preference syncing

### Phase 5: Production Integration (Weeks 13-14)
- [ ] Android TV streaming service SDK integration
- [ ] System audio capture on Android (if SDK unavailable)
- [ ] Android TV-specific optimizations
- [ ] Remote control refinement and testing
- [ ] Asset caching implementation for album art and metadata
- [ ] Final performance tuning for Shield Pro 4K 60Hz
- [ ] Error handling and edge cases (network issues, service unavailable)

### Phase 6: Polish & Testing (Weeks 15-16)
- [ ] Comprehensive testing on both platforms
- [ ] User testing on Shield Pro
- [ ] macOS development experience refinement
- [ ] Documentation for development workflow
- [ ] Release build configuration
- [ ] App store preparation (if applicable)

## Development Workflow

### Local Development Cycle (macOS)
1. Set up system audio capture (BlackHole, Soundflower, or built-in loopback)
2. Launch streaming service app (Tidal, Spotify, Apple Music, Amazon Music)
3. Edit code in preferred IDE
4. Run `npm run tauri dev` for hot-reload development
5. Test with streaming audio via system audio capture
6. Use keyboard shortcuts for interaction testing
7. Monitor debug overlay for performance metrics (FPS, audio levels, frequency data)
8. Iterate rapidly on visualizations and features

### Testing on Target Platform (Shield Pro)
1. Build Android APK: `npm run tauri build -- --target aarch64`
2. Deploy to Shield Pro via ADB or sideloading
3. Test with streaming service integration
4. Verify 4K performance and remote control
5. Collect logs and performance data
6. Iterate based on findings

### Continuous Integration
- Automated builds for both macOS and Android
- Unit tests for audio analysis and visualization logic
- Performance benchmarking on macOS
- Periodic Shield Pro testing for regressions

## Success Metrics

### User Experience
- Average session duration >30 minutes
- Thumbs up rate >70% after initial learning period
- User retention rate >60% after first week

### Technical Performance (Shield Pro)
- Consistent 60 FPS achievement rate >95%
- Audio-visual sync latency <50ms
- Memory usage within 1.5GB limit
- Zero critical crashes per 10-hour session

### Development Productivity (macOS)
- Code change to test cycle <10 seconds
- Feature development velocity maintained across platforms
- Developer satisfaction with tooling and workflow

### Visual Quality
- 4K output quality confirmed on reference displays
- Smooth transitions rated satisfactory by test users
- Visualization variety and adaptation perceived as "intelligent"

## Out of Scope for MVP

The following features are explicitly excluded from the MVP but may be considered for future releases:

- Multi-user profiles and accounts
- Cloud synchronization of preferences
- Social sharing features
- VR/AR visualization modes
- MIDI input support
- Manual visualization editing/creation tools
- Plugin/extension system
- iOS, tvOS, Windows, Linux support
- Custom shader programming interface
- Real-time collaboration features
- Web-based version
- Mobile companion app

## Risks & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Nvidia Shield performance insufficient for 4K 60Hz | High | Medium | Early performance prototyping; macOS testing helps identify issues; fallback to 1080p or 30fps |
| Streaming service API limitations | High | Medium | Design abstraction layer; test with files on macOS first |
| Lyrical content unavailable for tracks | Medium | High | Graceful degradation to audio-only visualizations |
| ML model too complex for local inference | Medium | Medium | Use simpler heuristic-based adaptation initially; prototype on macOS |
| Audio analysis CPU/GPU overhead | High | Medium | Optimize with Rust backend; profile on macOS before Shield testing |
| Android TV deployment complexity | Medium | Low | Tauri handles platform abstraction; test early and often |
| macOS-to-Shield performance gap | High | Medium | Regular Shield testing; performance budgets; profiling tools |
| Cross-platform code divergence | Medium | Medium | Strict code review; shared modules; integration tests |

## Dependencies

### External Services
- **Streaming Services (Required):**
  - Tidal API/SDK
  - Spotify Web API / SDK
  - Apple Music API (MusicKit)
  - Amazon Music API/SDK
- **Content APIs:**
  - Lyrics API (Musixmatch, Genius, or streaming service-provided)
  - Music metadata API (MusicBrainz, Last.fm, or streaming service)
  - Artist imagery API (Fanart.tv, Last.fm, or streaming service-provided)

### Development Tools
- **macOS Development:**
  - Xcode Command Line Tools
  - Homebrew (optional but recommended)
  - Rust toolchain (1.70+)
  - Node.js (18+) and npm
  - IDE (VS Code, WebStorm, etc.)
  - System audio loopback tool (BlackHole, Soundflower, or similar)
  - At least one streaming service account (Tidal, Spotify, Apple Music, or Amazon Music)
- **Android Development:**
  - Android SDK and NDK
  - Tauri CLI with Android target support
  - ADB (Android Debug Bridge)
  - Nvidia Shield Pro development device
- **Cross-Platform:**
  - Git version control
  - Tauri v2 with multi-platform support

### Third-Party Libraries (Proposed)
- **Audio:** Web Audio API, aubio (Rust binding), or essentia for advanced analysis
- **Graphics:** Three.js or Babylon.js, WebGL utilities
- **ML:** TensorFlow.js lite or Rust ML libraries (burn, candle)
- **UI:** Svelte 5, SvelteKit, Tailwind CSS
- **Data:** Tauri SQLite plugin, IndexedDB fallback
- **Streaming SDKs:**
  - Spotify Web API SDK
  - Tidal SDK (if available)
  - Apple MusicKit JS
  - Amazon Music SDK
- **Cross-platform:** Tauri plugins for platform detection and adaptation

## Platform-Specific Considerations

### macOS Development Features
- **System Audio Capture:** BlackHole, Soundflower, or Core Audio loopback for capturing streaming service audio
- **Web Audio API:** Cross-platform audio processing and analysis
- **Streaming Service Apps:** Desktop apps for Tidal, Spotify, Apple Music (native), Amazon Music
- **Web Player Support:** Alternative testing via browser-based streaming players
- **Performance Tools:** Safari Web Inspector, Chrome DevTools, Xcode Instruments
- **Distribution:** DMG packaging for easy installation (optional for internal testing)

### Android TV Production Features
- **Leanback UI:** Android TV-optimized UI components
- **Remote Control:** D-pad navigation, media keys
- **Performance:** GPU optimization for Tegra X1+
- **Distribution:** APK sideloading or app store submission
- **Background Behavior:** Handle app backgrounding gracefully

## Glossary

- **FFT:** Fast Fourier Transform - algorithm for spectral analysis
- **BPM:** Beats Per Minute - tempo measurement
- **HDR:** High Dynamic Range - enhanced color and brightness range
- **LRU:** Least Recently Used - cache eviction strategy
- **Onset:** Beginning of a musical note or sound event
- **Spectral Analysis:** Frequency domain analysis of audio signals
- **WebGL:** Web Graphics Library - JavaScript API for rendering graphics
- **Cross-Platform:** Running on multiple operating systems with shared code
- **Hot Reload:** Automatic application update when code changes (development)

## Appendix

### References
- Tauri Documentation: https://tauri.app/
- Tauri Android Support: https://tauri.app/develop/android/
- Web Audio API Specification: https://webaudio.github.io/web-audio-api/
- Nvidia Shield Pro Specifications: https://www.nvidia.com/en-us/shield/
- Android TV Development Guidelines: https://developer.android.com/tv
- Svelte Documentation: https://svelte.dev/
- WebGL Specification: https://www.khronos.org/webgl/

### Development Environment Setup

#### macOS Setup Steps
```bash
# Install Homebrew (if not already installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Node.js
brew install node

# Install system audio loopback (BlackHole - free, open source)
brew install blackhole-2ch

# Install Tauri CLI
npm install --save-dev @tauri-apps/cli

# Clone and setup project
cd musicViz
npm install

# Configure audio routing:
# 1. Open Audio MIDI Setup (Applications > Utilities)
# 2. Create Multi-Output Device with your speakers + BlackHole
# 3. Set Multi-Output as system output
# OR use BlackHole directly and monitor in DAW/audio app

# Install streaming service app(s)
# - Tidal: https://tidal.com/download
# - Spotify: https://www.spotify.com/download
# - Apple Music: Pre-installed on macOS
# - Amazon Music: https://music.amazon.com/apps

# Run in development mode
npm run tauri dev
```

#### Android Build Setup
```bash
# Install Android SDK (via Android Studio or command line tools)
# Set environment variables
export ANDROID_HOME=$HOME/Library/Android/sdk
export NDK_HOME=$ANDROID_HOME/ndk/<version>

# Add Android target
rustup target add aarch64-linux-android

# Initialize Tauri Android
npm run tauri android init

# Build for Android
npm run tauri android build
```

### Streaming Service Notes

**Important Integration Considerations:**

1. **API Access:** Most streaming services require developer accounts and API keys:
   - Spotify: Register app at https://developer.spotify.com
   - Apple Music: Requires Apple Developer account + MusicKit
   - Tidal: May require partnership/developer agreement
   - Amazon Music: Requires Amazon Developer account

2. **Audio Access Approaches:**
   - **Preferred:** Official SDK integration (best quality, metadata access)
   - **Fallback:** System audio capture (universal but may lose some metadata)
   - **Hybrid:** SDK for metadata + system capture for audio analysis

3. **Privacy & Terms:**
   - Review each service's terms of service for visualization apps
   - Ensure compliance with audio capture and analysis policies
   - User must have valid subscription to respective services

### Document History
- v1.0 - October 19, 2025 - Initial MVP requirements document
- v1.1 - October 19, 2025 - Added macOS local testing support
- v1.2 - October 19, 2025 - Updated to focus on streaming service integration (Tidal, Spotify, Apple Music, Amazon Music)
