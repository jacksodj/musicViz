#!/bin/bash

# Claude Code Plugin Setup Script
# Note: These /plugin commands must be run inside Claude Code
# This script serves as documentation and can be source for copy/paste

echo "================================================================"
echo "Claude Code Plugin Setup Commands"
echo "================================================================"
echo ""
echo "Copy and paste these commands into Claude Code to set up plugins:"
echo ""
echo "# Step 1: Add primary marketplaces"
echo "/plugin marketplace add jeremylongshore/claude-code-plugins"
echo "/plugin marketplace add https://github.com/wshobson/agents"
echo "/plugin marketplace add anthropics/skills"
echo "/plugin marketplace add EveryInc/every-marketplace"
echo ""
echo "# Step 2: Install essential full-stack development plugins"
echo "/plugin install fullstack-starter-pack@claude-code-plugins-plus"
echo "/plugin install full-stack-development@wshobson"
echo "/plugin install testing-quality-suite@wshobson"
echo "/plugin install devops-automation-pack@claude-code-plugins-plus"
echo "/plugin install security-pro-pack@claude-code-plugins-plus"
echo ""
echo "================================================================"
echo ""

# These can be run outside Claude Code:
echo "Setting up local environment..."

# Install productivity tools (already done but included for completeness)
if [ ! -d "$HOME/.claude/commands" ]; then
    echo "Installing CCPlugins productivity tools..."
    curl -sSL https://raw.githubusercontent.com/brennercruvinel/CCPlugins/main/install.sh | bash
else
    echo "CCPlugins already installed at $HOME/.claude/commands"
fi

# Create skill directories for the music visualization project
echo "Creating skill directories for Tauri music app..."
mkdir -p .claude/skills/tauri-music-app
mkdir -p .claude/skills/streaming-integration
mkdir -p .claude/skills/audio-visualization

echo ""
echo "Skill directories created:"
echo "  - .claude/skills/tauri-music-app"
echo "  - .claude/skills/streaming-integration"
echo "  - .claude/skills/audio-visualization"
echo ""
echo "================================================================"
echo "Setup complete!"
echo "Now copy the /plugin commands above into Claude Code to finish."
echo "================================================================"