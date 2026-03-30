#!/bin/bash
# E2E Storeroom Kiosk — pull latest changes and restart
# Usage: bash update.sh

set -e

APP_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== E2E Storeroom Kiosk Update ==="

echo ""
echo "=== Pulling latest changes ==="
cd "$APP_DIR"
git pull

echo ""
echo "=== Rebuilding frontend ==="
cd "$APP_DIR/frontend" && npm install && npm run build
cd "$APP_DIR/backend"  && npm install --omit=dev
cd "$APP_DIR"

echo ""
echo "=== Restarting app ==="
pm2 restart predator-kiosk

echo ""
echo "========================================"
echo "  Update complete!"
echo "  Version: $(node -e "console.log(require('./frontend/package.json').version)")"
echo "========================================"
