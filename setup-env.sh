#!/bin/bash

# Load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

# Load Homebrew
eval "$(/opt/homebrew/bin/brew shellenv)"

# Set pnpm registry to Chinese mirror for better download speed
pnpm config set registry https://registry.npmmirror.com

echo "✅ Environment setup complete!"
echo "Node.js version: $(node --version)"
echo "pnpm version: $(pnpm --version)"
echo "npm version: $(npm --version)" 