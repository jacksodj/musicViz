# HUMAN TASKS - Phase 1 MVP Setup (Spotify SDK)

This document outlines all tasks that require manual human intervention before and during Phase 1 development.

**Updated:** October 19, 2025
**Approach:** Spotify SDK (macOS + Android)

---

## 🚨 CRITICAL - Must Complete Before Development Starts

### 1. Spotify Developer Setup
**Time Required:** 10-15 minutes
**Status:** ⬜ Not Started

Since you already have a Spotify Developer account, we need to configure the app:

#### Create Spotify App

1. Go to **Spotify Developer Dashboard**
   - URL: https://developer.spotify.com/dashboard
   - Login with your Spotify account

2. Click **"Create App"**

3. Fill in app details:
   ```
   App Name: musicViz
   App Description: Real-time music visualization with adaptive visuals
   Website: (leave blank or add your URL)
   Redirect URIs:
     - musicviz://callback
     - http://localhost:3000/callback
   ```

4. Check the terms agreement box

5. Click **"Create"**

6. **Save these credentials:**
   ```
   Client ID: [copy this - you'll need it]
   Client Secret: [click "Show Client Secret" and copy]
   ```

   **⚠️ IMPORTANT:** Keep Client Secret private! Never commit to git.

#### Configure API Scopes

The following scopes will be requested during OAuth:
- ✅ `user-read-playback-state` - Current playback info
- ✅ `user-modify-playback-state` - Control playback
- ✅ `user-read-currently-playing` - Track metadata
- ✅ `streaming` - Audio streaming (required!)
- ✅ `user-read-email` - User identification
- ✅ `user-read-private` - User profile

These are configured in code, not the dashboard.

---

### 2. Environment Configuration
**Time Required:** 5 minutes
**Status:** ⬜ Not Started

#### Create `.env` File

```bash
cd ~/Code/musicViz

# Create .env file
cat > .env << 'EOF'
# Spotify API Credentials
VITE_SPOTIFY_CLIENT_ID=your_client_id_here
VITE_SPOTIFY_CLIENT_SECRET=your_client_secret_here
VITE_SPOTIFY_REDIRECT_URI=musicviz://callback

# Development
VITE_DEV_MODE=true
EOF
```

#### Replace with your actual credentials:
1. Open `.env` in your editor
2. Replace `your_client_id_here` with your Spotify Client ID
3. Replace `your_client_secret_here` with your Spotify Client Secret
4. Save the file

#### Verify .gitignore

```bash
# Check that .env is ignored
grep -q "^\.env$" .gitignore || echo ".env" >> .gitignore
```

**⚠️ SECURITY:** Never commit `.env` file to version control!

---

### 3. Spotify Premium Account
**Time Required:** 5 minutes (if upgrading needed)
**Status:** ⬜ Not Started

**Required:** Spotify Premium subscription

The Spotify Web Playback SDK (which we're using for macOS development) **requires Premium**.

- ✅ Already have Premium? Great, skip this!
- ⬜ Need Premium? Upgrade at https://www.spotify.com/premium/

**Why Premium?**
- Free tier doesn't support SDK playback
- Premium required for audio streaming API
- Standard for all music visualization apps

**Tip:** Spotify offers student discounts and free trial periods

---

### 4. Development Environment Setup
**Time Required:** 30-45 minutes
**Status:** ⬜ Not Started

#### Install Prerequisites

```bash
# Install Homebrew (if not already installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Rust (if not already installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
rustc --version  # Verify installation

# Install Node.js (if not already installed)
brew install node
node --version   # Should be 18+
npm --version

# Install Xcode Command Line Tools (if not already installed)
xcode-select --install
```

#### Setup Project

```bash
# Navigate to project
cd ~/Code/musicViz

# Install dependencies
npm install

# Verify Tauri works
npm run tauri dev
```

**Expected Result:** App window opens (may be blank - that's OK for now)

---

### 5. Test Spotify Connection
**Time Required:** 5-10 minutes
**Status:** ⬜ Pending Development

Once we implement the Spotify integration, you'll test:

1. Launch app: `npm run tauri dev`
2. Click "Connect Spotify" button
3. Browser opens to Spotify OAuth page
4. Login if needed
5. Click "Agree" to grant permissions
6. Redirected back to musicViz
7. See "Connected ✓" status
8. Play a song on Spotify
9. Verify visualization responds to audio

---

## 🔧 OPTIONAL - Recommended Enhancements

### 6. Create Spotify Test Playlists
**Time Required:** 20-30 minutes
**Status:** ⬜ Not Started

Create diverse playlists for testing different visualization scenarios:

#### "Bass Test" Playlist
Purpose: Test low-frequency visualization

Example tracks:
- Electronic/EDM (Deadmau5, Daft Punk, Porter Robinson)
- Hip-hop (Dr. Dre, Kendrick Lamar, Travis Scott)
- Dubstep (Skrillex, Excision)

What to check:
- Sub-bass bars respond strongly
- No clipping or distortion
- Smooth bass transitions

#### "Vocal Test" Playlist
Purpose: Test mid-frequency clarity

Example tracks:
- Acoustic (Ed Sheeran, Norah Jones, Jack Johnson)
- Jazz vocals (Ella Fitzgerald, Diana Krall)
- A cappella (Pentatonix)

What to check:
- Mid-range bars prominent
- Clarity during vocal passages
- Waveform shows articulation

#### "Full Spectrum" Playlist
Purpose: Test entire frequency range

Example tracks:
- Orchestral (Hans Zimmer, John Williams)
- Rock (Tool, Muse, Radiohead)
- Progressive (Pink Floyd, Yes)

What to check:
- All frequency bars active
- Balanced visualization
- Dynamic range handling

#### "Dynamic Range" Playlist
Purpose: Test quiet-to-loud transitions

Example tracks:
- Classical (Beethoven Symphony No. 5, Mahler)
- Progressive rock (Led Zeppelin - Stairway to Heaven)
- Post-rock (Explosions in the Sky)

What to check:
- Visualization responds to quiet passages
- No clipping during loud sections
- Smooth dynamic transitions

---

### 7. Install Performance Monitoring Tools
**Time Required:** 10 minutes
**Status:** ⬜ Not Started

#### Built-in macOS Tools

**Activity Monitor:**
- Applications > Utilities > Activity Monitor
- Monitor CPU, GPU, Memory during playback
- Target: <30% CPU, <60% GPU

**Safari Web Inspector:**
- Safari > Develop > Show Web Inspector (Cmd+Option+I)
- Profile JavaScript performance
- Monitor memory usage

**Chrome DevTools (if using Chrome):**
- View > Developer > Developer Tools
- Performance profiler
- Memory profiler

#### External Tools (Optional)

**Stats (Menu Bar Monitor):**
```bash
brew install stats
```
- Real-time CPU/GPU/Memory in menu bar
- Free, open-source

**GPU Monitor:**
```bash
sudo powermetrics --samplers gpu_power -i 1000
```
- Terminal-based GPU monitoring
- See real-time GPU usage

---

## 📋 Testing Checklist (After Development)

### Phase 1 Core Functionality
**Status:** ⬜ Pending Development

Once Phase 1 is complete, verify:

#### Spotify Integration
- ⬜ OAuth flow completes successfully
- ⬜ App shows "Connected" status
- ⬜ Can control playback (play/pause)
- ⬜ Track metadata displays (title, artist)
- ⬜ Token refreshes automatically

#### Audio Visualization
- ⬜ Spectrum bars respond to audio
- ⬜ Waveform displays correctly
- ⬜ 60 FPS maintained at 1080p
- ⬜ 60 FPS maintained at 4K (or 55+ FPS)
- ⬜ No visual glitches or artifacts

#### Audio Analysis Accuracy
- ⬜ Bass notes → low-frequency bars
- ⬜ High notes → high-frequency bars
- ⬜ Volume changes → intensity changes
- ⬜ Audio-visual sync tight (<50ms)
- ⬜ Frequency bands match audio content

#### User Experience
- ⬜ Keyboard shortcuts work:
  - Space: Play/Pause
  - D: Toggle debug
  - C: Controls
  - F: Fullscreen
  - Esc: Exit/close overlays
- ⬜ Debug overlay shows accurate info
- ⬜ Fullscreen works correctly
- ⬜ Window resize handles gracefully

#### Performance
- ⬜ Consistent 60 FPS during playback
- ⬜ CPU usage reasonable (<30%)
- ⬜ GPU usage reasonable (<60%)
- ⬜ Memory stable (<500MB)
- ⬜ No memory leaks over 1-hour session

#### Music Genre Testing
- ⬜ Electronic music visualizes well
- ⬜ Classical music handles dynamics
- ⬜ Rock music shows full spectrum
- ⬜ Jazz shows mid-range subtlety
- ⬜ Hip-hop emphasizes bass

---

## 🎯 Design Decisions (Your Input Needed)

During development, you'll make these decisions:

### Decision 1: Color Scheme
**When:** Week 1, Days 5-7
**Status:** ⬜ Pending

**Options:**
- A) Purple/violet gradient (current plan, matches Spotify brand)
- B) Rainbow spectrum (classic visualizer look)
- C) Monochrome white/gray (minimalist)
- D) Dynamic (changes based on album art colors)

**How to decide:**
- We'll implement option A first
- You can try others by tweaking CSS
- Choose based on aesthetic preference

---

### Decision 2: Spectrum Bar Count
**When:** Week 1, Day 6
**Status:** ⬜ Pending

**Options:**
- 32 bars: Chunkier, retro look
- 64 bars: Balanced (current plan)
- 128 bars: Smooth, detailed

**How to decide:**
- Test each with different music
- Consider: visual clarity vs detail
- Balance: performance vs aesthetics

---

### Decision 3: Waveform Style
**When:** Week 1, Day 7
**Status:** ⬜ Pending

**Options:**
- Mirror: Symmetrical reflection (top/bottom)
- Dual: Left/right channels separate
- Mono: Single unified waveform
- Circular: Radial waveform around center

**How to decide:**
- Try each mode
- Consider: screen real estate
- Choose most visually appealing

---

### Decision 4: Performance Trade-offs (If Needed)
**When:** Week 2, Days 11-12
**Status:** ⬜ Pending

**If performance is below 60 FPS at 4K:**

**Options:**
- Reduce bar count (fewer bars)
- Lower to 30 FPS (half frame rate)
- Simplify rendering (basic shapes)
- Reduce resolution (render at 1440p, upscale)

**How to decide:**
- Profile bottlenecks first
- Optimize before compromising
- User testing for acceptable trade-offs

---

## 🐛 Troubleshooting

### "Invalid Client ID" Error

**Cause:** Client ID not set correctly in `.env`

**Fix:**
```bash
# Verify .env file
cat .env

# Check for typos, extra spaces, quotes
# Should look like:
VITE_SPOTIFY_CLIENT_ID=abc123...xyz
# NOT:
VITE_SPOTIFY_CLIENT_ID="abc123...xyz"
# NOT:
VITE_SPOTIFY_CLIENT_ID= abc123...xyz
```

**Then restart dev server:**
```bash
npm run tauri dev
```

---

### "Redirect URI Mismatch" Error

**Cause:** Redirect URI not configured in Spotify Dashboard

**Fix:**
1. Go to https://developer.spotify.com/dashboard
2. Click your musicViz app
3. Click "Edit Settings"
4. Under "Redirect URIs" add:
   - `musicviz://callback`
   - `http://localhost:3000/callback`
5. Click "Save"
6. Restart app and try again

---

### "Premium Required" Error

**Cause:** Spotify Free account detected

**Fix:**
- Upgrade to Spotify Premium
- OR use a Premium trial
- OR use a different Premium account for testing

**Note:** Free tier will NOT work with SDK - this is a Spotify limitation.

---

### "Token Expired" Error

**Cause:** Access token expired (after ~1 hour)

**Fix:**
- Should auto-refresh (if refresh token logic implemented)
- Manual fix: Disconnect and reconnect Spotify
- Check console for token refresh errors

---

### "No Audio" / Visualization Not Responding

**Possible causes:**
1. Spotify not actually playing
2. App not connected to Spotify
3. Audio analysis not initialized
4. Browser permissions not granted

**Debug steps:**
```javascript
// In browser console (Cmd+Option+I)

// Check connection status
console.log($audioStore); // Should show audio data

// Check Spotify player state
player.getCurrentState().then(state => {
  console.log('Playing:', state && !state.paused);
});

// Check audio context
console.log(audioContext.state); // Should be "running"
```

---

### High CPU/GPU Usage

**Target:** <30% CPU, <60% GPU

**If higher:**
1. Check Activity Monitor
2. Identify bottleneck:
   - CPU high → Optimize analysis (FFT, feature extraction)
   - GPU high → Optimize rendering (fewer draw calls, simpler shaders)
3. Profile with Safari/Chrome DevTools
4. Consider reducing bar count or resolution

---

## 📝 Pre-Development Checklist

Before starting implementation, ensure all critical tasks complete:

- ⬜ Spotify Developer app created
- ⬜ Client ID and Client Secret obtained
- ⬜ `.env` file configured with credentials
- ⬜ `.env` added to `.gitignore`
- ⬜ Spotify Premium account active
- ⬜ Development environment installed (Rust, Node, Xcode CLI)
- ⬜ `npm install` completed successfully
- ⬜ `npm run tauri dev` runs without errors

**All checked?** ✅ Ready to begin implementation!

---

## 🚀 Next Steps

Once all HUMAN tasks complete:

1. **Implement OAuth Flow** (Week 1, Days 1-2)
   - SpotifyAuth.js module
   - Token storage in Rust
   - Test authentication

2. **Integrate Web Playback SDK** (Week 1, Days 3-4)
   - Load SDK
   - Initialize player
   - Connect to Web Audio API

3. **Implement Audio Analysis** (Week 1, Days 3-4)
   - FFT setup
   - Frequency band extraction
   - Svelte store updates

4. **Build Visualizations** (Week 1, Days 5-7)
   - Spectrum bars
   - Waveform
   - Render loop

5. **Polish & Optimize** (Week 2)
   - Debug overlay
   - Keyboard controls
   - Performance tuning
   - Testing

---

## 📚 Resources

**Spotify Developer:**
- Dashboard: https://developer.spotify.com/dashboard
- Web API Docs: https://developer.spotify.com/documentation/web-api
- Web Playback SDK: https://developer.spotify.com/documentation/web-playback-sdk
- OAuth Guide: https://developer.spotify.com/documentation/general/guides/authorization-guide/

**musicViz Docs:**
- See `docs/SPOTIFY_SDK_SETUP.md` for detailed integration guide
- See `docs/PROCESSING_PIPELINE.md` for architecture diagrams
- See `docs/PHASE1_ARCHITECTURE.md` for complete technical spec

---

**Last Updated:** October 19, 2025
**Status:** Ready for your Spotify Developer setup!
