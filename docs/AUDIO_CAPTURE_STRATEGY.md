# Audio Capture Strategy - Cross-Platform

**Version:** 1.0
**Date:** October 19, 2025

---

## Overview

musicViz needs to capture audio from streaming services on **two different platforms** with completely different approaches:

1. **macOS** (Development/Testing) - System audio loopback
2. **Nvidia Shield Pro** (Production) - Android TV audio capture

---

## Platform-Specific Approaches

### macOS Development (Local Testing)

#### Method: Virtual Audio Loopback

**Tool:** BlackHole (macOS-specific virtual audio driver)

**How it works:**
```
Streaming Service App (Spotify/Tidal)
    ↓ audio output
BlackHole Virtual Device (loopback)
    ↓ appears as input device
musicViz Web Audio API (getUserMedia)
    ↓ capture and analyze
```

**Pros:**
- Works with ANY streaming service
- No SDK integration required
- Full audio fidelity
- Universal solution for testing

**Cons:**
- **macOS-only** (won't work on Android)
- Requires user setup (Multi-Output Device)
- Indirect approach (not official API)

**Setup:**
```bash
brew install blackhole-2ch
# Configure Multi-Output Device in Audio MIDI Setup
```

---

### Nvidia Shield Pro (Production)

#### Method 1: Streaming Service SDK Integration (PREFERRED)

**How it works:**
```
Streaming Service Android TV App
    ↓ official SDK/API
musicViz Native Module (Kotlin/Java)
    ↓ audio stream access
Tauri Bridge (JNI/FFI)
    ↓ pass to analysis
Web Audio API or Rust FFT
    ↓ visualization
```

**Approach per service:**

**Spotify:**
- Use Spotify Android SDK
- Direct audio access via SDK
- Metadata included
- **Best integration option**

**Tidal:**
- May require partnership/developer agreement
- SDK availability unclear (need to investigate)
- Fallback to Method 2 if unavailable

**Apple Music:**
- Apple Music Android app
- MusicKit for Android (limited)
- May require fallback to Method 2

**Amazon Music:**
- Amazon Music SDK for Android
- Developer program access needed
- Good integration potential

**Pros:**
- Official, supported approach
- Best audio quality
- Metadata access (track info, lyrics, artwork)
- Lower latency
- Legal compliance

**Cons:**
- Requires SDK integration per service
- Developer accounts needed
- API keys/authentication
- Service-specific code
- May have usage restrictions

---

#### Method 2: Android System Audio Capture (FALLBACK)

**APIs:** MediaProjection + AudioPlaybackCapture (Android 10+)

**How it works:**
```
ANY Streaming Service App
    ↓ plays audio
Android Audio System
    ↓ AudioPlaybackCapture API
musicViz Background Service
    ↓ capture PCM audio
Rust Audio Analysis
    ↓ visualization
```

**Implementation:**
```kotlin
// Android manifest permission
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />

// Kotlin/Java service
class AudioCaptureService : Service() {
    private var audioPlaybackCapture: AudioPlaybackCapture? = null

    fun startCapture() {
        val config = AudioPlaybackCaptureConfiguration.Builder(mediaProjection)
            .addMatchingUsage(AudioAttributes.USAGE_MEDIA)
            .build()

        audioRecord = AudioRecord.Builder()
            .setAudioPlaybackCaptureConfig(config)
            .build()

        audioRecord.startRecording()
        // Stream audio data to Rust analysis module
    }
}
```

**Pros:**
- Works with ANY streaming service
- No SDK integration needed
- Universal solution
- Single implementation for all services

**Cons:**
- Requires user permission (MediaProjection)
- No metadata access (no track info, lyrics, etc.)
- Slightly higher latency (~10-20ms)
- System-wide capture (captures ALL audio)
- May violate some service ToS

**Android Version Requirements:**
- Android 10+ (API level 29+) for AudioPlaybackCapture
- Nvidia Shield Pro runs Android TV 11+ ✅

---

## Recommended Hybrid Approach

### Phase 1-3 (macOS Development)
```
Use: BlackHole system audio capture
Why: Quick setup, universal testing, no API keys needed
Goal: Validate visualization algorithms
```

### Phase 4 (MVP Metadata Integration)
```
Use: Streaming service Web APIs (macOS)
Why: Test metadata integration before Android deployment
APIs: Spotify Web API, Apple MusicKit JS, etc.
Goal: Integrate track info, lyrics, artwork
```

### Phase 5 (Android TV/Shield Pro Production)

**Primary Strategy:** SDK Integration (per service)
- Spotify → Spotify Android SDK
- Tidal → Tidal SDK or fallback
- Apple Music → MusicKit Android or fallback
- Amazon Music → Amazon Music SDK

**Fallback Strategy:** AudioPlaybackCapture (universal)
- Works with all services
- Deployed if SDK integration fails or unavailable
- Graceful degradation (no metadata, audio-only visualization)

**User Experience:**
```
App detects which streaming service is playing
    ↓
If SDK available and authenticated:
    Use SDK for audio + metadata ✅
Else:
    Use AudioPlaybackCapture for audio only ⚠️
    Show message: "Limited mode - no track info available"
```

---

## Implementation Roadmap

### Phase 1: macOS Foundation (Weeks 1-3)
- ✅ Use BlackHole for system audio capture
- ✅ Implement Web Audio API FFT analysis
- ✅ Build core visualization engine
- ⬜ Test with multiple streaming services
- **No Android code yet**

### Phase 2-3: Enhanced Visuals (Weeks 4-9)
- ✅ Continue using BlackHole on macOS
- ✅ Add metadata via streaming service Web APIs
- ✅ Build advanced visualizations
- **Still macOS-only**

### Phase 4: Android Audio Research (Week 10)
- ⬜ Research SDK availability per service:
  - Spotify SDK docs
  - Tidal developer program
  - Apple Music Android capabilities
  - Amazon Music developer program
- ⬜ Prototype AudioPlaybackCapture fallback
- ⬜ Test on Android emulator or test device

### Phase 5: Android TV Integration (Weeks 13-14)
- ⬜ Implement SDK integrations (priority order: Spotify → Amazon → Apple → Tidal)
- ⬜ Implement AudioPlaybackCapture fallback
- ⬜ Build Android native module with JNI bridge to Rust
- ⬜ Deploy to Nvidia Shield Pro
- ⬜ Test end-to-end with real streaming services

---

## Architecture: Audio Module Abstraction

To support both platforms, we'll use an abstraction layer:

```rust
// src-tauri/src/audio/mod.rs

pub trait AudioSource {
    fn initialize(&mut self) -> Result<(), AudioError>;
    fn start_capture(&mut self) -> Result<(), AudioError>;
    fn stop_capture(&mut self) -> Result<(), AudioError>;
    fn get_samples(&self) -> &[f32];
    fn get_metadata(&self) -> Option<TrackMetadata>;
}

// macOS implementation
#[cfg(target_os = "macos")]
pub struct MacOSAudioSource {
    // Uses Web Audio API via WebView
    // Or Core Audio directly via Rust bindings
}

impl AudioSource for MacOSAudioSource {
    // Implementation using system audio capture
}

// Android implementation
#[cfg(target_os = "android")]
pub struct AndroidAudioSource {
    capture_method: AndroidCaptureMethod,
    // JNI interface to Android AudioPlaybackCapture
    // Or SDK integration
}

enum AndroidCaptureMethod {
    SpotifySDK,
    TidalSDK,
    AppleMusicSDK,
    AmazonMusicSDK,
    SystemCapture, // Fallback
}

impl AudioSource for AndroidAudioSource {
    // Implementation using Android APIs
}
```

**Usage in app:**
```rust
let mut audio_source: Box<dyn AudioSource> = if cfg!(target_os = "macos") {
    Box::new(MacOSAudioSource::new())
} else if cfg!(target_os = "android") {
    Box::new(AndroidAudioSource::new())
} else {
    panic!("Unsupported platform");
};

audio_source.initialize()?;
audio_source.start_capture()?;

// Platform-agnostic from here
let samples = audio_source.get_samples();
let metadata = audio_source.get_metadata();
```

---

## HUMAN Tasks (Updated)

### macOS Setup (Phase 1)
- [x] Install BlackHole: `brew install blackhole-2ch`
- [x] Configure Multi-Output Device
- [x] Test with streaming services

### Android TV Setup (Phase 5)
- [ ] **Research SDK Access:**
  - [ ] Apply for Spotify Developer account
  - [ ] Investigate Tidal developer program
  - [ ] Check Apple Music Android SDK availability
  - [ ] Register for Amazon Music developer access

- [ ] **Obtain API Keys:**
  - [ ] Spotify: Client ID, Client Secret
  - [ ] Apple Music: Developer token
  - [ ] Amazon Music: API credentials

- [ ] **Test on Shield Pro:**
  - [ ] Enable developer mode on Shield Pro
  - [ ] Install via ADB
  - [ ] Test with each streaming service installed
  - [ ] Verify audio capture working
  - [ ] Check metadata retrieval

- [ ] **User Permissions:**
  - [ ] Document permission requests for users
  - [ ] Create clear UI for granting audio capture
  - [ ] Handle permission denials gracefully

---

## Legal & Privacy Considerations

### Terms of Service Review

**Before production deployment, review:**

| Service | Audio Capture | Visualization | Notes |
|---------|--------------|---------------|-------|
| Spotify | Check ToS | Usually OK | SDK has usage guidelines |
| Tidal | Check ToS | Usually OK | May require partnership |
| Apple Music | Check ToS | Usually OK | MusicKit has restrictions |
| Amazon Music | Check ToS | Usually OK | Developer agreement needed |

**General Guidelines:**
- ✅ Audio analysis for visualization (generally permitted)
- ✅ Personal use visualizers (usually OK)
- ❌ Recording/storing audio (violation)
- ❌ Redistributing content (violation)
- ❌ DRM circumvention (illegal)

### Privacy
- **Audio data:** Process in real-time, never store
- **Metadata:** Cache locally, don't transmit without consent
- **User preferences:** Store locally, offer export/delete
- **Analytics:** Anonymized, opt-in only

---

## Testing Strategy Per Platform

### macOS Testing (Phase 1-4)
```bash
# Start streaming service
open -a Spotify  # or Tidal, Apple Music

# Verify BlackHole is capturing
npm run tauri dev

# Test visualization
# Play various genres, volumes, dynamics
```

**Test Matrix:**
| Service | Audio Quality | Metadata | Status |
|---------|--------------|----------|--------|
| Spotify | Desktop App | Web API | ✅ Primary |
| Tidal | Desktop App | Web API | ✅ Secondary |
| Apple Music | Native App | MusicKit | ✅ Secondary |
| Amazon Music | Desktop App | Web API | ⬜ If needed |

### Android TV Testing (Phase 5)
```bash
# Build APK
npm run tauri android build

# Deploy to Shield Pro
adb install -r target/android/app/release/app-release.apk

# Launch and test
adb shell am start -n com.dennisjackson.musicviz/.MainActivity
```

**Test Matrix:**
| Service | Capture Method | Metadata | Performance |
|---------|---------------|----------|-------------|
| Spotify | SDK (preferred) | Full | Target 4K60 |
| Spotify | System capture | None | Fallback |
| Tidal | SDK or system | Varies | Target 4K60 |
| Apple Music | System capture | None | Fallback |
| Amazon Music | SDK or system | Varies | Target 4K60 |

---

## FAQ

### Q: Why not just use system audio capture everywhere?
**A:**
- SDK integration provides metadata (track, artist, lyrics, artwork)
- System capture is audio-only (no context)
- SDK is officially supported (ToS compliant)
- System capture may have latency or quality issues

### Q: What if a streaming service doesn't have an Android SDK?
**A:**
- Fall back to AudioPlaybackCapture (system audio)
- Visualizations still work, just without metadata
- User sees "Limited mode" indicator

### Q: Can we use the same code for both platforms?
**A:**
- Visualization engine: YES (Svelte + WebGL is cross-platform)
- Audio analysis: YES (Rust FFT works everywhere)
- Audio capture: NO (platform-specific APIs)
- Metadata fetching: MOSTLY (Web APIs work on both)

### Q: What about iOS/tvOS support?
**A:**
- Out of scope for MVP
- Would require similar SDK approach
- Core viz engine would work (Tauri supports iOS)
- Audio capture would need AVAudioEngine (iOS) implementation

### Q: How do we test Android audio without Shield Pro?
**A:**
- Use Android emulator with audio input
- Test on any Android 10+ phone/tablet
- Remote testing on cloud Android devices
- Borrow/buy a cheaper Android TV box for testing

---

## Decision: Recommended Path Forward

### For Phase 1-3 (Now → Week 9)
**Use:** BlackHole on macOS exclusively
**Why:**
- Fastest development iteration
- No API keys needed yet
- Universal testing across services
- Focus on visualization quality

### For Phase 4 (Week 10-12)
**Add:** Streaming service Web APIs for metadata
**Services:** Start with Spotify Web API (easiest)
**Why:**
- Test metadata integration on macOS first
- Prove out UI for track info, lyrics, artwork
- Easier debugging on desktop

### For Phase 5 (Week 13-14)
**Implement:** Android audio capture
**Priority:**
1. Spotify SDK (most popular, best docs)
2. AudioPlaybackCapture fallback (universal)
3. Amazon Music SDK (if available)
4. Tidal/Apple Music (system capture fallback)

**Why:**
- Spotify SDK is best documented and most reliable
- Fallback ensures all services work (even without SDK)
- Can expand SDK support post-MVP

---

## Summary Table

| Platform | Method | Tool/API | Metadata | Status |
|----------|--------|----------|----------|--------|
| **macOS** | System Audio | BlackHole | Web API | Phase 1-4 |
| **Android (SDK)** | Service API | Spotify SDK | Native | Phase 5 (preferred) |
| **Android (Fallback)** | System Audio | AudioPlaybackCapture | None | Phase 5 (backup) |

---

**Key Takeaway:** BlackHole is for **macOS development only**. When we deploy to Nvidia Shield Pro, we'll use **Android-specific audio capture** (SDK integration + system capture fallback).

---

**Last Updated:** October 19, 2025
