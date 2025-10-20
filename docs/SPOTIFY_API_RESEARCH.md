# Spotify API Research - Audio Visualization Options

**Research Date:** 2025-10-20

---

## Critical Finding: Spotify Web Playback SDK Audio Limitations

### The Problem

**Spotify Web Playback SDK uses Encrypted Media Extensions (EME) to protect audio streams.** The audio is NOT accessible for analysis via Web Audio API.

### Sources
- GitHub Issue: https://github.com/spotify/web-playback-sdk/issues/25 (opened 2018, still unresolved as of 2025)
- GitHub Issue: https://github.com/spotify/web-api/issues/846
- Stack Overflow: https://stackoverflow.com/questions/51014022/reading-output-audio-data-from-spotify-web-playback-stream

### Technical Reason

Audio is wrapped in iframes with encrypted-media permissions. No `<audio>` element exists in the DOM that can be connected to an AnalyserNode. Attempting to find and connect to Spotify's audio element will always fail because the audio stream is protected by DRM.

---

## Option 1: System Audio Capture (Not Recommended for Tauri/macOS)

### Method: getDisplayMedia() API

**API:** `navigator.mediaDevices.getDisplayMedia({ audio: true, video: true })`

### How it works
- Prompts user to share screen/tab/window
- Can capture audio output from selected source
- Audio stream can be connected to Web Audio API's AnalyserNode

### Browser Support
- ✅ Chrome/Edge on Windows: Full support
- ✅ Chrome/Edge on Linux: Full support
- ❌ Chrome on macOS: Video only, **no audio capture**
- ⚠️ Tauri: Limited compared to Electron's `desktopCapturer`

### References
- MDN: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia
- Electron Issue: https://github.com/electron/electron/issues/25120
- Stack Overflow: https://stackoverflow.com/questions/71766536/audio-capture-with-getdisplaymedia-is-not-worked-with-chrome-in-my-macbook

### Verdict
❌ **Not viable for macOS Tauri app** - Primary development platform doesn't support audio capture

---

## Option 2: Spotify Audio Analysis API ✅ RECOMMENDED

### Official API Endpoint

**Endpoint:** `GET https://api.spotify.com/v1/audio-analysis/{id}`

**Documentation:** https://developer.spotify.com/documentation/web-api/reference/get-audio-analysis

**Authentication:** OAuth 2.0 token (same token used for Web Playback SDK)

### Data Structure

All temporal elements include `start` (seconds), `duration` (seconds), and `confidence` (0.0-1.0)

#### Bars
- Musical measures (e.g., 4 beats in 4/4 time)
- Average: 50-100 per song
- Use for: Large-scale pulses, section transitions

#### Beats
- Individual beat timestamps
- Average: 200-400 per song
- Use for: **Primary animation sync, pulse effects**

#### Tatums
- Subdivisions of beats (fastest perceived pulse)
- Average: 400-1000 per song
- Use for: Rapid animations, particle bursts

#### Sections
- Large structural boundaries (intro, verse, chorus, bridge, outro)
- Average: 5-15 per song
- Each includes: `key`, `mode`, `time_signature`, `tempo`
- Use for: Major visual theme changes

#### Segments
- Small chunks of consistent sound (~0.3-0.5s)
- Average: 400-800 per song
- **Most detailed audio information**

### Segment-Level Features

#### Timbre (12 float values, unbounded, roughly centered at 0)

```javascript
[45.2, -12.3, 8.9, -3.4, 22.1, -8.7, 5.6, -15.2, 18.9, -4.3, 9.8, -11.5]
```

- Represents spectral shape (brightness, attack, harmonicity)
- Derived from MFCC (Mel-frequency cepstral coefficients)
- **Use for: Color palettes, visual textures, shape variations**

#### Pitches (12 float values, 0.0-1.0)

```javascript
[0.123, 0.987, 0.456, 0.234, 0.789, 0.345, 0.678, 0.234, 0.890, 0.123, 0.567, 0.345]
// C      C#      D       D#      E       F       F#      G       G#      A       A#      B
```

- Chroma vector (pitch class profile)
- 1.0 = pitch is very present, 0.0 = pitch is absent
- **Use for: Pitch-based color mapping, harmonic visualization, chromagram wheel**

#### Loudness

```javascript
{
  loudness_start: -23.456,  // dB at segment start
  loudness_max: -8.234,     // dB peak
  loudness_max_time: 0.123  // Time of peak (relative to start)
}
```

- Use for: Scale, opacity, intensity modulation

### Example API Response

```json
{
  "meta": {
    "analyzer_version": "4.0.0",
    "platform": "Linux",
    "detailed_status": "OK",
    "status_code": 0,
    "timestamp": 1495193577,
    "analysis_time": 6.93906,
    "input_process": "libvorbisfile L+R 44100->22050"
  },
  "track": {
    "duration": 255.349,
    "tempo": 118.211,
    "tempo_confidence": 0.73,
    "key": 1,
    "key_confidence": 0.408,
    "mode": 0,
    "mode_confidence": 0.485,
    "time_signature": 4,
    "time_signature_confidence": 0.994
  },
  "bars": [
    {"start": 0.49567, "duration": 2.02404, "confidence": 0.925}
  ],
  "beats": [
    {"start": 0.49567, "duration": 0.50626, "confidence": 0.665}
  ],
  "tatums": [
    {"start": 0.49567, "duration": 0.25313, "confidence": 0.794}
  ],
  "segments": [
    {
      "start": 0.0,
      "duration": 0.51479,
      "confidence": 0.0,
      "loudness_start": -60.0,
      "loudness_max_time": 0.05219,
      "loudness_max": -23.957,
      "pitches": [0.123, 0.987, 0.456, 0.234, 0.789, 0.345, 0.678, 0.234, 0.890, 0.123, 0.567, 0.345],
      "timbre": [45.229, -12.345, 8.901, -3.456, 22.123, -8.765, 5.678, -15.234, 18.901, -4.321, 9.876, -11.543]
    }
  ],
  "sections": [
    {
      "start": 0.0,
      "duration": 28.13906,
      "confidence": 1.0,
      "loudness": -14.938,
      "tempo": 118.211,
      "tempo_confidence": 0.73,
      "key": 1,
      "key_confidence": 0.408,
      "mode": 0,
      "mode_confidence": 0.485,
      "time_signature": 4,
      "time_signature_confidence": 0.994
    }
  ]
}
```

### Real-World Implementation Example: Kaleidosync

**Project:** Kaleidosync
**GitHub:** https://github.com/zachwinter/kaleidosync
**Demo:** https://kaleidosync.com
**Tech Stack:** Vue.js, D3.js, Three.js, WebGL

**Features:**
- Beat-synchronized kaleidoscope patterns
- Timbre-driven color schemes
- Automatic drift correction (re-syncs every beat)
- Multiple visualization modes
- Works entirely with Audio Analysis API (no audio capture)

**Key Implementation Strategy:**

```javascript
// Sync to playback position
const sync = () => {
  const position = player.currentTime * 1000; // Current position in ms

  // Find active intervals
  const activeBeat = beats.find(b =>
    position >= b.start * 1000 && position < (b.start + b.duration) * 1000
  );
  const activeSegment = segments.find(s =>
    position >= s.start * 1000 && position < (s.start + s.duration) * 1000
  );

  // Animate based on progress within interval
  const beatProgress = (position - activeBeat.start * 1000) / (activeBeat.duration * 1000);

  // Apply timbre to visual properties
  const colors = mapTimbreToColors(activeSegment.timbre);
  const geometry = mapTimbreToGeometry(activeSegment.timbre);

  render(colors, geometry, beatProgress);
};

// Run at 60fps
requestAnimationFrame(sync);
```

**Drift Correction Strategy:**
- Every beat/bar crossing: adjust sync offset
- Use `confidence` values to weight adjustments
- Accumulate small corrections rather than sudden jumps
- Compare expected beat time vs actual playback position
- Apply 10% of drift as correction each beat

---

## Spotify Metadata APIs

### 1. Album Artwork ✅ Official API

**Access:** Via Web Playback SDK state object

```javascript
const state = await player.getCurrentState();
const images = state.track_window.current_track.album.images;

// Images array (widest first):
[
  { url: "https://i.scdn.co/image/...", height: 640, width: 640 },
  { url: "https://i.scdn.co/image/...", height: 300, width: 300 },
  { url: "https://i.scdn.co/image/...", height: 64, width: 64 }
]
```

**Spotify Branding Guidelines:**
- **Must link back to Spotify** (track/album/artist page)
- Cannot modify or distort images
- Must maintain aspect ratio
- Source: https://developer.spotify.com/documentation/general/design-and-branding

---

### 2. Track Metadata ✅ Official API

**Access:** Via Web Playback SDK `getCurrentState()`

```javascript
const state = await player.getCurrentState();
const track = state.track_window.current_track;

// Available fields:
{
  name: "Song Title",
  id: "spotify_track_id",
  uri: "spotify:track:...",
  duration_ms: 255349,
  artists: [
    { name: "Artist Name", uri: "spotify:artist:..." }
  ],
  album: {
    name: "Album Name",
    uri: "spotify:album:...",
    images: [...]
  }
}
```

**Additional data via Web API:** `GET /v1/tracks/{id}`
- Release date
- Popularity (0-100)
- Explicit flag
- ISRC code
- Available markets

---

### 3. Canvas (Video Loops) ⚠️ Unofficial API

**What:** 3-8 second vertical (9:16) looping MP4 videos that play behind tracks on Spotify mobile

**Official API:** ❌ None available
**Unofficial Solutions:** ✅ Reverse-engineered

**GitHub Project:** Spotify Canvas API
**Repo:** https://github.com/Paxsenix0/Spotify-Canvas-API
**Method:** Undocumented Spotify endpoint using Protobuf

**Alternative:** Canvas Downloader
**Website:** https://www.canvasdownloader.com/about
**Note:** Uses unofficial Protobuf API

**Unofficial Endpoint Example:**

```javascript
// Endpoint (subject to change, requires auth)
GET https://spclient.wg.spotify.com/canvaz-cache/v0/canvases

// Response format:
{
  "canvases": [
    {
      "id": "track_id",
      "url": "https://video-ssl.spotifycdn.com/...",
      "file_id": "...",
      "type": "VIDEO",
      "entity_uri": "spotify:track:..."
    }
  ]
}
```

**Canvas Specifications:**
- **Duration:** 3-8 seconds
- **Format:** MP4 (H.264)
- **Aspect ratio:** 9:16 (vertical)
- **Resolution:** 720×1280 or 1080×1920
- **Loop:** Must be seamless
- Source: https://support.spotify.com/us/artists/article/canvas-guidelines/

**Impact Stats (from Spotify):**
- **120% increase in streams** for tracks with Canvas
- **114% increase in saves**
- Source: https://ads.spotify.com/en-GB/news-and-insights/introducing-canvas-for-ads/

**Coverage:** Not all tracks have Canvas (artist-uploaded content)

**Risks:**
- ⚠️ Unofficial API - can break anytime
- ⚠️ Possible ToS violation
- ⚠️ May require authentication token
- ⚠️ No SLA or support

---

### 4. Synchronized Lyrics ⚠️ Unofficial API

**Integration:** Spotify uses Musixmatch for lyrics

**Official API:** ❌ Lyrics not in Spotify Web API
**Unofficial Solutions:** ✅ Multiple projects

**Primary Project:** Spotify Lyrics API
**Repo:** https://github.com/akashrchandran/spotify-lyrics-api
**Method:** Reverse-engineered Spotify internal endpoint

**Alternative Projects:**
- https://github.com/lyricstify/api
- https://github.com/ksamirdev/sync-lyrics

**Data Format:**

```json
{
  "lyrics": {
    "syncType": "LINE_SYNCED",
    "lines": [
      {
        "startTimeMs": "0",
        "words": "First line of lyrics",
        "syllables": [],
        "endTimeMs": "3500"
      },
      {
        "startTimeMs": "3500",
        "words": "Second line of lyrics",
        "syllables": [],
        "endTimeMs": "7200"
      }
    ],
    "provider": "Musixmatch",
    "language": "en"
  }
}
```

**Sync Types:**
- **LINE_SYNCED:** Timestamp per line (Spotify supports this)
- **WORD_SYNCED:** Timestamp per word (Musixmatch has, Spotify doesn't display yet)
- **UNSYNCED:** Plain text lyrics without timestamps

**Implementation Example:**

```javascript
// Sync lyrics to playback position
const position_ms = state.position;

const currentLine = lyrics.lines.find(line =>
  position_ms >= parseInt(line.startTimeMs) &&
  position_ms < parseInt(line.endTimeMs)
);

// Highlight active line
if (currentLine) {
  document.querySelector('.active-lyric').textContent = currentLine.words;
}
```

**For Artists:**
- Free Musixmatch account to add/edit/sync lyrics
- Line synced and word synced both supported on Musixmatch platform
- Spotify currently only displays line synced
- Source: https://support.spotify.com/us/artists/article/lyrics/

**Risks:**
- ⚠️ Unofficial - ToS concerns
- ⚠️ Could break with Spotify updates
- ⚠️ May require valid auth tokens
- ⚠️ No SLA or support

---

## Implementation References

### Tauri 2 DevTools

**Issue:** Production builds need devtools feature flag

**Solution:**

```toml
# src-tauri/Cargo.toml
[dependencies]
tauri = { version = "2", features = ["devtools"] }
```

**Access DevTools:**
- **Keyboard Shortcut:** Cmd+Option+I (macOS) or Ctrl+Shift+I (Windows/Linux)
- **Right-click:** "Inspect Element" option appears when devtools enabled

**Documentation:** https://v2.tauri.app/develop/debug/

---

### Web Playback SDK State Polling

**Issue:** `player_state_changed` event doesn't fire frequently enough for smooth progress bars

**Solution:**

```javascript
// Poll getCurrentState() for UI updates
setInterval(async () => {
  const state = await player.getCurrentState();
  if (state) {
    updateProgressBar(state.position);
    updateCurrentBeat(state.position);
  }
}, 100); // 100ms = smooth 10fps updates for progress bar

// Use requestAnimationFrame for 60fps visualization updates
function animationLoop() {
  updateVisualizations();
  requestAnimationFrame(animationLoop);
}
requestAnimationFrame(animationLoop);
```

**Source:** https://github.com/spotify/web-playback-sdk/issues/106

---

### Playback Initiation

**Issue:** Web Playback SDK can't initiate playback on its own

**Problem:**
- `player.resume()`, `player.pause()`, `player.togglePlay()` only work on active playback
- If nothing is playing, these methods fail

**Solution:** Use Web API `/v1/me/player/play` endpoint

```javascript
async function startPlayback(deviceId, options = {}) {
  const token = getAccessToken();

  const body = {};
  if (options.context_uri) body.context_uri = options.context_uri; // Album/playlist
  if (options.uris) body.uris = options.uris; // Specific tracks array
  if (options.offset) body.offset = options.offset; // Starting position

  const response = await fetch(
    `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to start playback: ${error.error.message}`);
  }
}

// Usage examples:
// Resume last playback context
await startPlayback(deviceId, {});

// Play specific album
await startPlayback(deviceId, {
  context_uri: 'spotify:album:...'
});

// Play specific tracks
await startPlayback(deviceId, {
  uris: ['spotify:track:...', 'spotify:track:...']
});
```

**Documentation:** https://developer.spotify.com/documentation/web-api/reference/start-a-users-playback

---

## Recommended Architecture

### Data Flow

```
Spotify Web Playback SDK
  ↓ (playback control)
Player State Updates
  ↓
playerStore (Svelte store)
  ↓ (track change detected)
SpotifyAnalysisService.getAnalysis(trackId)
  ↓ (fetch from API)
Audio Analysis Data
  ↓
analysisStore (Svelte store)
  ↓ (60fps sync loop)
SyncEngine (position → active beat/segment)
  ↓
Visualization Components (BeatPulse, PitchWheel, etc.)
```

### Key Services

**SpotifyAnalysisService:**
- Fetches audio analysis from API
- Caches per track ID
- Returns bars, beats, segments, etc.

**SyncEngine:**
- Polls player.getCurrentState() at 60fps
- Finds active beat/bar/segment for current position
- Applies drift correction
- Provides data to visualization components

**SpotifyMetadataService (optional):**
- Fetches Canvas video (unofficial)
- Fetches lyrics (unofficial)
- Handles errors gracefully

### Caching Strategy

```javascript
class SpotifyAnalysisService {
  constructor() {
    this.cache = new Map(); // trackId → analysis data
    this.maxCacheSize = 50; // Limit memory usage
  }

  async getAnalysis(trackId, accessToken) {
    // Check cache
    if (this.cache.has(trackId)) {
      return this.cache.get(trackId);
    }

    // Fetch from API
    const response = await fetch(
      `https://api.spotify.com/v1/audio-analysis/${trackId}`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch analysis: ${response.statusText}`);
    }

    const data = await response.json();

    // Cache with LRU eviction
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(trackId, data);
    return data;
  }
}
```

---

## Performance Targets

- **60fps** visualization updates
- **<100ms** to fetch cached analysis
- **<500ms** to fetch new analysis from API
- **<50ms** drift correction threshold
- **Smooth transitions** between tracks, no jank
- **4K capable** (3840×2160 @ 60fps)

---

## Conclusion

**Chosen Approach:** Option 2 (Audio Analysis API)

**Reasons:**
1. ✅ Works on all platforms (especially macOS)
2. ✅ Official Spotify API - no ToS violations
3. ✅ Rich musical context (beats, timbre, pitch, sections)
4. ✅ Proven by Kaleidosync and other projects
5. ✅ Can combine with official metadata (album art, track info)
6. ✅ Optional unofficial APIs for Canvas and lyrics

**Trade-off:** Not real-time FFT spectrum, but beat-reactive with musical structure awareness

**Next Steps:** See implementation plan in main project documentation
