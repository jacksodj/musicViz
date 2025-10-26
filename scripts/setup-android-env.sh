#!/bin/bash

# Android Environment Setup Script for musicViz
# This script configures environment variables for Android development

set -e

echo "=== Android Environment Setup ==="
echo ""

# Detect shell configuration file
if [ -f "$HOME/.zshrc" ]; then
    SHELL_RC="$HOME/.zshrc"
    SHELL_NAME="zsh"
elif [ -f "$HOME/.bash_profile" ]; then
    SHELL_RC="$HOME/.bash_profile"
    SHELL_NAME="bash"
elif [ -f "$HOME/.bashrc" ]; then
    SHELL_RC="$HOME/.bashrc"
    SHELL_NAME="bash"
else
    echo "❌ Could not find shell configuration file (.zshrc or .bash_profile)"
    exit 1
fi

echo "📝 Detected shell: $SHELL_NAME"
echo "📝 Configuration file: $SHELL_RC"
echo ""

# Check if Android Studio is installed
if [ ! -d "/Applications/Android Studio.app" ]; then
    echo "❌ Android Studio not found at /Applications/Android Studio.app"
    echo "Please install Android Studio first"
    exit 1
fi

echo "✅ Android Studio found"

# Check for Android SDK
ANDROID_HOME_PATH="$HOME/Library/Android/sdk"
if [ ! -d "$ANDROID_HOME_PATH" ]; then
    echo "⚠️  Android SDK not found at $ANDROID_HOME_PATH"
    echo "Please complete Android SDK installation via Android Studio:"
    echo "   Settings → System Settings → Android SDK → Install SDK Platform and Tools"
    echo ""
    echo "After installing SDK, run this script again."
    exit 1
fi

echo "✅ Android SDK found at $ANDROID_HOME_PATH"

# Find NDK version
NDK_DIR="$ANDROID_HOME_PATH/ndk"
if [ ! -d "$NDK_DIR" ]; then
    echo "⚠️  NDK not found"
    echo "Please install NDK via Android Studio:"
    echo "   Settings → Android SDK → SDK Tools → NDK (Side by side)"
    echo ""
    echo "After installing NDK, run this script again."
    exit 1
fi

# Get latest NDK version
NDK_VERSION=$(ls -1 "$NDK_DIR" | sort -V | tail -n 1)
if [ -z "$NDK_VERSION" ]; then
    echo "❌ No NDK version found in $NDK_DIR"
    exit 1
fi

NDK_HOME_PATH="$NDK_DIR/$NDK_VERSION"
echo "✅ NDK found: version $NDK_VERSION"

# Java Home from Android Studio
JAVA_HOME_PATH="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
if [ ! -d "$JAVA_HOME_PATH" ]; then
    echo "❌ Java Runtime not found at $JAVA_HOME_PATH"
    exit 1
fi

echo "✅ Java Runtime found"
echo ""

# Check if variables already exist
if grep -q "export ANDROID_HOME=" "$SHELL_RC"; then
    echo "⚠️  ANDROID_HOME already set in $SHELL_RC"
    echo "Do you want to update it? (y/n)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        echo "Skipping..."
        exit 0
    fi

    # Remove old entries
    echo "🔄 Removing old Android environment variables..."
    sed -i.backup '/export ANDROID_HOME=/d' "$SHELL_RC"
    sed -i.backup '/export NDK_HOME=/d' "$SHELL_RC"
    sed -i.backup '/export JAVA_HOME=.*Android Studio/d' "$SHELL_RC"
    sed -i.backup '/export PATH=.*ANDROID_HOME/d' "$SHELL_RC"
fi

# Add environment variables
echo ""
echo "📝 Adding Android environment variables to $SHELL_RC..."

cat >> "$SHELL_RC" << EOF

# Android Development Environment (added by setup-android-env.sh)
export ANDROID_HOME="$ANDROID_HOME_PATH"
export NDK_HOME="$NDK_HOME_PATH"
export JAVA_HOME="$JAVA_HOME_PATH"
export PATH="\$PATH:\$ANDROID_HOME/platform-tools:\$ANDROID_HOME/tools:\$ANDROID_HOME/tools/bin"
EOF

echo "✅ Environment variables added"
echo ""

# Verify
echo "=== Configuration Summary ==="
echo "ANDROID_HOME=$ANDROID_HOME_PATH"
echo "NDK_HOME=$NDK_HOME_PATH"
echo "JAVA_HOME=$JAVA_HOME_PATH"
echo ""

echo "✅ Setup complete!"
echo ""
echo "⚠️  IMPORTANT: You must reload your shell configuration:"
echo "   source $SHELL_RC"
echo ""
echo "Or restart your terminal/IDE for changes to take effect."
echo ""
echo "To verify, run:"
echo "   echo \$ANDROID_HOME"
echo "   echo \$NDK_HOME"
echo "   echo \$JAVA_HOME"
