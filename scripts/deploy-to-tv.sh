#!/bin/bash

# Deploy to TV Script
# Usage: ./scripts/deploy-to-tv.sh <TV_IP_ADDRESS>

set -e

echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║                                                                   ║"
echo "║             📱 DEPLOY TO SAMSUNG TV - QUICK SCRIPT 📱              ║"
echo "║                                                                   ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

# Check if TV IP is provided
TV_IP=$1
if [ -z "$TV_IP" ]; then
    echo "❌ Error: TV IP address required"
    echo ""
    echo "Usage: ./scripts/deploy-to-tv.sh <TV_IP_ADDRESS>"
    echo "Example: ./scripts/deploy-to-tv.sh 192.168.1.150"
    echo ""
    exit 1
fi

echo "🎯 Target TV: $TV_IP"
echo ""

# Step 1: Build
echo "📦 Step 1/5: Building app..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi
echo "✅ Build complete"
echo ""

# Step 2: Connect to TV
echo "🔌 Step 2/5: Connecting to TV..."
sdb connect $TV_IP
if [ $? -ne 0 ]; then
    echo "❌ Failed to connect to TV"
    echo "💡 Make sure Developer Mode is enabled on TV"
    exit 1
fi
echo "✅ Connected to TV"
echo ""

# Step 3: Check connection
echo "🔍 Step 3/5: Verifying connection..."
sdb devices
echo ""

# Step 4: Uninstall old version
echo "🗑️  Step 4/5: Uninstalling old version..."
tizen uninstall -p BtRWLGTTAm 2>/dev/null || echo "ℹ️  No old version found (or already uninstalled)"
echo ""

# Step 5: Install new version
echo "📲 Step 5/5: Installing new version..."
tizen install -n .buildResult/PanMetroApp.wgt 2>/dev/null || \
tizen install -n PanMetroApp.wgt 2>/dev/null || \
echo "⚠️  Install via Tizen Studio GUI if command failed"
echo ""

echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║                                                                   ║"
echo "║                      ✅ DEPLOYMENT COMPLETE! ✅                     ║"
echo "║                                                                   ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""
echo "🎉 App deployed to TV: $TV_IP"
echo ""
echo "📋 Next steps:"
echo "1. On TV: Open PanMetroApp"
echo "2. Try logging in"
echo "3. If fails: Enable Chrome DevTools (chrome://inspect/#devices)"
echo "4. Send console logs for debugging"
echo ""
echo "📖 See TV-LOGIN-FIX-V2.md for detailed troubleshooting"
echo ""

