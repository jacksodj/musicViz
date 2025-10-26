# Utility Scripts

This folder contains utility scripts for setting up and maintaining the musicViz project.

## Available Scripts

### `setup-claude-plugins.sh`
Initial setup script for Claude Code plugins and project configuration.

**Usage:**
```bash
./scripts/setup-claude-plugins.sh
```

### `setup-android-env.sh`
Configures Android development environment variables for NVIDIA Shield deployment.

**What it does:**
- Detects shell configuration file (.zshrc or .bash_profile)
- Verifies Android Studio and SDK installation
- Finds installed NDK version
- Adds environment variables to shell configuration:
  - `ANDROID_HOME`
  - `NDK_HOME`
  - `JAVA_HOME`
  - Updates `PATH`

**Prerequisites:**
- Android Studio must be installed
- Android SDK must be installed via Android Studio's SDK Manager
- NDK must be installed via SDK Manager

**Usage:**
```bash
./scripts/setup-android-env.sh
```

After running, reload your shell:
```bash
source ~/.zshrc  # or source ~/.bash_profile
```

### `install-android-targets.sh`
Installs Rust compilation targets required for Android development.

**What it does:**
- Verifies rustup is installed
- Installs all required Android targets:
  - `aarch64-linux-android` (ARM64 - used by NVIDIA Shield)
  - `armv7-linux-androideabi` (ARM32)
  - `i686-linux-android` (x86)
  - `x86_64-linux-android` (x86-64)

**Usage:**
```bash
./scripts/install-android-targets.sh
```

## Android Development Workflow

1. **First Time Setup:**
   ```bash
   # Install SDK via Android Studio first
   # Then run:
   ./scripts/setup-android-env.sh
   source ~/.zshrc
   ./scripts/install-android-targets.sh
   ```

2. **Initialize Android Project:**
   ```bash
   npm run tauri android init
   ```

3. **Build APK:**
   ```bash
   npm run tauri android build -- --apk --target aarch64
   ```

4. **Install on Shield:**
   ```bash
   adb connect <SHIELD_IP>
   adb install <path-to-apk>
   ```

## See Also

- [Android & NVIDIA Shield Setup Guide](../docs/ANDROID_SHIELD_SETUP.md) - Complete documentation
- [Tauri Android Prerequisites](https://v2.tauri.app/start/prerequisites/)
- [NVIDIA Shield Developer Portal](https://developer.nvidia.com/develop4shield)
