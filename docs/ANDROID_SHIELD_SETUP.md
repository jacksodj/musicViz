# Android & NVIDIA Shield Deployment Setup

This guide covers setting up the development environment for building musicViz for NVIDIA Shield (Android TV).

## Prerequisites

✅ **Android Studio Installed**: Located at `/Applications/Android Studio.app`
✅ **Java Runtime**: Bundled with Android Studio at `/Applications/Android Studio.app/Contents/jbr/Contents/Home`

## Step 1: Android SDK Setup (Manual - One Time Only)

Since Android Studio is freshly installed, you need to complete the SDK setup:

### 1.1 Launch Android Studio
```bash
open -a "Android Studio"
```

### 1.2 Install Android SDK Components

Open **Android Studio → Settings/Preferences → Appearance & Behavior → System Settings → Android SDK**

Install the following components:

#### SDK Platforms Tab:
- ✅ Android 14.0 (API 34) - Latest
- ✅ Android 7.0 (API 24) - Minimum for Tauri (required)

#### SDK Tools Tab (check "Show Package Details"):
- ✅ Android SDK Build-Tools (latest)
- ✅ Android SDK Command-line Tools (latest)
- ✅ Android SDK Platform-Tools
- ✅ NDK (Side by side) - Select version 25.x or 26.x
- ✅ CMake (if not installed)

Click **Apply** and wait for installation to complete.

### 1.3 Note Your SDK Locations

After installation, note these paths (shown in SDK Manager):
- **Android SDK Location**: Usually `$HOME/Library/Android/sdk`
- **NDK Location**: Usually `$HOME/Library/Android/sdk/ndk/<version>`

## Step 2: Environment Variables Setup (Automated)

Run the automated setup script:

```bash
cd /Users/dennisjackson/Code/musicViz
./scripts/setup-android-env.sh
```

Or manually add to `~/.zshrc` (or `~/.bash_profile`):

```bash
# Android Development
export ANDROID_HOME="$HOME/Library/Android/sdk"
export NDK_HOME="$ANDROID_HOME/ndk/26.3.11579264"  # Adjust version as needed
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/tools"
```

Then reload:
```bash
source ~/.zshrc  # or source ~/.bash_profile
```

Verify:
```bash
echo $ANDROID_HOME
echo $NDK_HOME
echo $JAVA_HOME
```

## Step 3: Install Rust Android Targets (Automated)

Run:
```bash
./scripts/install-android-targets.sh
```

Or manually:
```bash
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
```

Verify:
```bash
rustup target list --installed | grep android
```

Should show:
- aarch64-linux-android
- armv7-linux-androideabi
- i686-linux-android
- x86_64-linux-android

## Step 4: Initialize Tauri Android Project

```bash
cd /Users/dennisjackson/Code/musicViz
npm run tauri android init
```

This creates:
- `src-tauri/gen/android/` - Android Studio project structure
- AndroidManifest.xml
- Gradle configuration files

## Step 5: Configure for NVIDIA Shield TV

The AndroidManifest will be automatically configured with:
- Touchscreen not required
- Android TV leanback support
- Controller/gamepad support
- Proper permissions

## Step 6: Build APK for NVIDIA Shield

For ARM64 (Shield uses this architecture):
```bash
npm run tauri android build -- --apk --target aarch64
```

Output location:
```
src-tauri/gen/android/app/build/outputs/apk/aarch64/release/app-aarch64-release.apk
```

## Step 7: Install on NVIDIA Shield

### Method 1: ADB (Recommended)
```bash
# Enable Developer Options on Shield:
# Settings → Device Preferences → About → Build (tap 7 times)
# Settings → Developer Options → USB Debugging (enable)

# Connect Shield to network (note IP address)
adb connect <SHIELD_IP_ADDRESS>
adb devices  # Verify connection
adb install src-tauri/gen/android/app/build/outputs/apk/aarch64/release/app-aarch64-release.apk
```

### Method 2: File Transfer
1. Copy APK to USB drive
2. Install file manager on Shield (e.g., X-plore)
3. Navigate to APK and install
4. Enable "Install from Unknown Sources" if prompted

### Method 3: Android Studio
1. Connect Shield via ADB
2. Open `src-tauri/gen/android` in Android Studio
3. Select Shield device in device dropdown
4. Click Run

## NVIDIA Shield Specific Considerations

### Controller Support
- Current UI is designed for mouse/keyboard
- Shield remote uses D-pad navigation
- May need to implement focus management for TV navigation
- Test with Shield remote and game controllers

### UI Adjustments for 10-Foot Interface
- Text sizes may need to be larger
- Buttons and interactive elements should be bigger
- Consider TV-safe areas (overscan margins)
- High contrast colors for TV viewing

### Performance
- Shield Pro has Tegra X1+ processor with 256-core GPU
- Should handle Butterchurn/Milkdrop shaders well
- Test at 4K resolution (3840x2160)
- Monitor frame rates during complex visualizations

### Network Features
- Spotify authentication via OAuth
- Govee light discovery via UDP multicast
- Ensure Shield is on same network as Govee devices

## Known Issues & Limitations

### Spotify SDK on Android TV
⚠️ **Important**: The Spotify Web Playback SDK may not work on Android TV:
- Web Playback SDK requires Chromium features not available on TV WebView
- May need to use native Android Spotify SDK or Cast integration
- Consider alternative: Use Spotify Connect to cast to Shield

### OAuth Deep Linking
- The OAuth callback URL scheme needs Android configuration
- Test the auth flow thoroughly on actual Shield device

### Govee UDP Discovery
- May require `INTERNET` and `ACCESS_NETWORK_STATE` permissions
- Multicast may be restricted on some networks
- Test on same network as development machine

## Troubleshooting

### "SDK location not found"
- Verify `ANDROID_HOME` is set correctly
- Restart terminal after setting environment variables
- Check SDK was actually installed in Android Studio

### "NDK not found"
- Install NDK via Android Studio SDK Manager
- Update `NDK_HOME` to match installed version
- Check `$ANDROID_HOME/ndk/` for installed versions

### Build fails with "No toolchains found"
- Run `rustup target add aarch64-linux-android`
- Verify Rust is up to date: `rustup update`

### APK won't install on Shield
- Enable Developer Options and USB Debugging
- Enable "Install from Unknown Sources"
- Check if previous version needs to be uninstalled
- Verify APK architecture matches (ARM64)

### App crashes on launch
- Check logcat: `adb logcat | grep musicViz`
- Verify all permissions are granted
- Check for missing native libraries

## Development Workflow

### Iterative Development
```bash
# Make changes to code
npm run build

# Build APK
npm run tauri android build -- --apk --target aarch64

# Install on Shield
adb connect <SHIELD_IP>
adb install -r src-tauri/gen/android/app/build/outputs/apk/aarch64/release/app-aarch64-release.apk

# View logs
adb logcat | grep musicViz
```

### Using Android Studio for Development
```bash
# Open Android project
cd src-tauri/gen/android
open -a "Android Studio" .
```

Benefits:
- Visual layout editor
- Better debugging tools
- Profiler for performance analysis
- Direct device deployment

## Next Steps

1. ✅ Complete Android SDK installation
2. ✅ Set up environment variables
3. ✅ Install Rust targets
4. ⏳ Initialize Android project
5. ⏳ Build first APK
6. ⏳ Test on NVIDIA Shield
7. 🔄 Iterate on UI for TV experience
8. 🔄 Implement controller navigation
9. 🔄 Test Spotify integration on TV
10. 🔄 Optimize performance for Shield

## Resources

- [Tauri 2 Android Guide](https://v2.tauri.app/start/prerequisites/)
- [NVIDIA Shield Developer](https://developer.nvidia.com/develop4shield)
- [Android TV Development](https://developer.android.com/tv)
- [Android TV Deployment Checklist](https://developer.nvidia.com/android-tv-deployment-checklist)
- [Designing for NVIDIA Shield](https://developer.nvidia.com/designing-nvidia-shield)

## Support

If you encounter issues:
1. Check Android Studio's event log for errors
2. Review Tauri CLI output carefully
3. Check `adb logcat` for runtime errors
4. Consult Tauri Discord for Android-specific help
