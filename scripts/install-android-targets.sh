#!/bin/bash

# Rust Android Targets Installation Script for musicViz
# This script installs the required Rust compilation targets for Android

set -e

echo "=== Rust Android Targets Installation ==="
echo ""

# Check if rustup is installed
if ! command -v rustup &> /dev/null; then
    echo "❌ rustup not found"
    echo "Please install Rust from https://rustup.rs/"
    exit 1
fi

echo "✅ rustup found"
echo ""

# Check current Rust version
RUST_VERSION=$(rustc --version)
echo "📦 Current Rust version: $RUST_VERSION"
echo ""

# List of Android targets to install
TARGETS=(
    "aarch64-linux-android"
    "armv7-linux-androideabi"
    "i686-linux-android"
    "x86_64-linux-android"
)

echo "📦 Installing Android compilation targets..."
echo ""

# Install each target
for target in "${TARGETS[@]}"; do
    echo "Installing $target..."
    rustup target add "$target"
done

echo ""
echo "✅ All Android targets installed successfully!"
echo ""

# Verify installation
echo "=== Installed Android Targets ==="
rustup target list --installed | grep android
echo ""

echo "✅ Setup complete!"
echo ""
echo "You can now run:"
echo "   npm run tauri android init"
