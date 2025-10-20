# musicViz

**Real-time music visualization with adaptive, self-evolving visuals**

![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Android%20TV-blue)
![Status](https://img.shields.io/badge/status-Phase%201-yellow)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Overview

musicViz is an intelligent music visualization application that creates dynamic, context-aware visual experiences for hi-definition audio streaming services. Built with Tauri + Svelte, it runs on both macOS (development) and Nvidia Shield Pro (production).

### Key Features

- 🎵 **Spotify SDK Integration** - Native audio streaming and metadata
- 📊 **Real-time Audio Analysis** - FFT-based spectral analysis with frequency band extraction
- 🎨 **Multiple Visualization Modes** - Spectrum bars, waveform, radial patterns, particles
- 🤖 **Self-Evolving Intelligence** - Learns user preferences via thumbs up/down feedback
- 📺 **4K @ 60Hz Output** - Optimized for Nvidia Shield Pro and high-resolution displays
- 🎯 **Adaptive Visuals** - Responds to lyrics, genre, mood, and artist metadata

---

## Quick Start

### Prerequisites

- **macOS 12+** (Intel or Apple Silicon)
- **Node.js 18+**
- **Rust 1.70+**
- **Spotify Premium Account** (required for SDK)
- **Spotify Developer Account** (free)

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/musicViz.git
cd musicViz

# Install dependencies
npm install

# Create .env file with your Spotify credentials
cp .env.example .env
# Edit .env and add your Spotify Client ID and Secret

# Run development server
npm run tauri dev
```

### First-Time Setup

1. **Create Spotify App:**
   - Go to https://developer.spotify.com/dashboard
   - Click "Create App"
   - Add redirect URI: `musicviz://callback`
   - Copy Client ID and Client Secret

2. **Configure Environment:**
   ```bash
   # Edit .env file
   VITE_SPOTIFY_CLIENT_ID=your_client_id_here
   VITE_SPOTIFY_CLIENT_SECRET=your_client_secret_here
   ```

3. **Launch and Connect:**
   - Run `npm run tauri dev`
   - Click "Connect Spotify"
   - Authorize the app
   - Start playing music!

For detailed setup instructions, see [`docs/HUMAN_TASKS.md`](docs/HUMAN_TASKS.md)

---

## Architecture

musicViz uses a cross-platform architecture with shared visualization code:

```
┌─────────────────────────────────────────────────────┐
│ Spotify SDK (macOS / Android)                       │
│ ├─ Audio Streaming (PCM)                            │
│ └─ Metadata (Track, Artist, Album, Lyrics)          │
└────────────────────┬────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────┐
│ Tauri Native Layer (Rust)                           │
│ ├─ Audio Buffer Management                          │
│ ├─ FFT Processing (2048 samples)                    │
│ └─ Feature Extraction (frequency bands, volume)     │
└────────────────────┬────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────┐
│ State Management (Svelte Stores)                    │
│ ├─ Audio Data Store                                 │
│ ├─ Metadata Store                                   │
│ └─ Visualization Config Store                       │
└────────────────────┬────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────┐
│ Visualization Engine (Svelte + WebGL)               │
│ ├─ Spectrum Bars Renderer                           │
│ ├─ Waveform Renderer                                │
│ ├─ Particle System (Phase 2)                        │
│ ├─ Lyric Splash (Phase 3)                           │
│ └─ Artist Montage (Phase 3)                         │
└────────────────────┬────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────┐
│ Display Output (60 FPS @ 1080p-4K)                  │
└─────────────────────────────────────────────────────┘
```

For detailed diagrams, see [`docs/PROCESSING_PIPELINE.md`](docs/PROCESSING_PIPELINE.md)

---

## Project Structure

```
musicViz/
├── src/                          # Svelte frontend
│   ├── routes/
│   │   └── +page.svelte          # Main app page
│   └── lib/
│       ├── audio/                # Audio capture & analysis
│       ├── components/           # UI components
│       ├── visualizations/       # Visualization renderers
│       └── stores/               # Svelte stores
├── src-tauri/                    # Rust backend
│   └── src/
│       ├── main.rs               # Tauri entry point
│       ├── spotify_auth.rs       # OAuth & token management
│       └── audio_analysis.rs     # FFT & feature extraction
├── docs/                         # Documentation
│   ├── HUMAN_TASKS.md            # Setup checklist
│   ├── MVP_REQUIREMENTS.md       # Product requirements
│   ├── PHASE1_ARCHITECTURE.md    # Technical architecture
│   ├── PROCESSING_PIPELINE.md    # System diagrams
│   ├── AUDIO_CAPTURE_STRATEGY.md # Platform audio strategies
│   └── SPOTIFY_SDK_SETUP.md      # Spotify integration guide
├── static/                       # Static assets
├── .env                          # Environment config (not committed)
└── README.md                     # This file
```

---

## Development Roadmap

### Phase 1: Core Foundation (Weeks 1-3) - **IN PROGRESS**
- [x] Project setup (Tauri + Svelte)
- [ ] Spotify OAuth integration
- [ ] Audio capture via Spotify SDK
- [ ] FFT-based audio analysis
- [ ] Spectrum bars visualization
- [ ] Waveform visualization
- [ ] Debug overlay

### Phase 2: Enhanced Visuals (Weeks 4-6)
- [ ] Circular/radial patterns
- [ ] Particle system
- [ ] Album artwork integration
- [ ] Performance optimization for 4K
- [ ] Cross-platform testing

### Phase 3: Intelligence & Content (Weeks 7-9)
- [ ] Lyrics fetching and parsing
- [ ] Lyrical splash visualization
- [ ] Artist montage
- [ ] Sentiment analysis
- [ ] Genre-based adaptation
- [ ] Beat detection

### Phase 4: Self-Evolution (Weeks 10-12)
- [ ] Thumbs up/down UI
- [ ] Preference storage
- [ ] Learning algorithm
- [ ] Automatic parameter tuning

### Phase 5: Production (Weeks 13-14)
- [ ] Android TV deployment
- [ ] Nvidia Shield Pro optimization
- [ ] Remote control support
- [ ] Final performance tuning

### Phase 6: Polish (Weeks 15-16)
- [ ] User testing
- [ ] Bug fixes
- [ ] Documentation
- [ ] Release preparation

---

## Technology Stack

### Frontend
- **Framework:** Svelte 5 + SvelteKit
- **Build Tool:** Vite 6
- **Graphics:** WebGL 2.0 (Canvas 2D for Phase 1)
- **Styling:** CSS3 (custom)

### Backend
- **Runtime:** Tauri v2 (Rust)
- **Audio Analysis:** Web Audio API + Rust FFT
- **Platform:** macOS (dev), Android TV (prod)

### External Services
- **Streaming:** Spotify SDK (Web Playback SDK for macOS, Android SDK for Shield Pro)
- **APIs:** Spotify Web API, Musixmatch (lyrics), Last.fm (metadata)

---

## Performance Targets

| Platform | Resolution | Frame Rate | Latency | CPU | GPU |
|----------|-----------|------------|---------|-----|-----|
| **macOS Dev** | 1080p-4K | 60 FPS | <20ms | <30% | <60% |
| **Shield Pro** | 4K | 60 FPS | <50ms | <80% | <80% |

---

## Documentation

- **[HUMAN_TASKS.md](docs/HUMAN_TASKS.md)** - Setup checklist for developers
- **[MVP_REQUIREMENTS.md](docs/MVP_REQUIREMENTS.md)** - Complete product requirements
- **[PHASE1_ARCHITECTURE.md](docs/PHASE1_ARCHITECTURE.md)** - Technical architecture details
- **[PROCESSING_PIPELINE.md](docs/PROCESSING_PIPELINE.md)** - System flow diagrams (Mermaid)
- **[AUDIO_CAPTURE_STRATEGY.md](docs/AUDIO_CAPTURE_STRATEGY.md)** - Cross-platform audio approaches
- **[SPOTIFY_SDK_SETUP.md](docs/SPOTIFY_SDK_SETUP.md)** - Spotify integration guide

---

## Contributing

Contributions welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) first.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test thoroughly (see [docs/HUMAN_TASKS.md](docs/HUMAN_TASKS.md))
5. Commit with descriptive messages
6. Push to your fork
7. Open a Pull Request

---

## Testing

```bash
# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build

# Build for Android TV (Phase 5)
npm run tauri android build
```

### Manual Testing Checklist

See [docs/HUMAN_TASKS.md](docs/HUMAN_TASKS.md) for complete testing checklist including:
- Spotify authentication flow
- Audio visualization accuracy
- Performance benchmarks
- Cross-genre testing
- UI/UX verification

---

## Troubleshooting

### Common Issues

**"Invalid Client ID" Error**
- Check `.env` file has correct Spotify credentials
- Restart dev server after changing `.env`

**"Premium Required" Error**
- Spotify SDK requires Premium subscription
- Free tier is not supported

**No Visualization**
- Ensure Spotify is playing audio
- Check browser console for errors
- Verify app is connected (check debug overlay)

**Performance Issues**
- Monitor CPU/GPU usage in Activity Monitor
- Try reducing bar count or resolution
- Profile with browser DevTools

For detailed troubleshooting, see [docs/HUMAN_TASKS.md#troubleshooting](docs/HUMAN_TASKS.md#-troubleshooting)

---

## License

MIT License - see [LICENSE](LICENSE) file for details

---

## Acknowledgments

- **Spotify** for the Web Playback SDK and Web API
- **Tauri** for the amazing cross-platform framework
- **Svelte** for the reactive UI framework
- **Web Audio API** for powerful audio analysis capabilities

---

## Contact

- **Project:** [github.com/yourusername/musicViz](https://github.com/yourusername/musicViz)
- **Issues:** [github.com/yourusername/musicViz/issues](https://github.com/yourusername/musicViz/issues)
- **Discussions:** [github.com/yourusername/musicViz/discussions](https://github.com/yourusername/musicViz/discussions)

---

**Status:** Phase 1 - In Development
**Last Updated:** October 19, 2025

---

## Quick Links

- 📖 [Full Documentation](docs/)
- 🚀 [Getting Started](docs/HUMAN_TASKS.md)
- 🏗️ [Architecture](docs/PHASE1_ARCHITECTURE.md)
- 🎵 [Spotify Setup](docs/SPOTIFY_SDK_SETUP.md)
- 📊 [Pipeline Diagrams](docs/PROCESSING_PIPELINE.md)
