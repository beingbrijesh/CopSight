#!/bin/bash
set -e

# ==============================================================================
# CopSight AI macOS Application Builder
# Builds native Swift executable, packages .app bundle, and creates .dmg / .zip
# ==============================================================================

APP_NAME="CopSight AI"
EXECUTABLE_NAME="CopSightAI"
BUNDLE_IDENTIFIER="com.copsight.unified.macos"
VERSION="${2:-1.0.0}"
MODE="debug"

if [ "$1" == "--release" ] || [ "$1" == "release" ]; then
    MODE="release"
fi

echo "=================================================="
echo " Building $APP_NAME (v$VERSION - $MODE)"
echo "=================================================="

# Ensure we're in the right directory
if [ ! -f "Package.swift" ]; then
    echo "Error: Must be run from the copsight-macos directory."
    exit 1
fi

BUILD_DIR=".build/$MODE"
APP_DIR="$APP_NAME.app"
CONTENTS_DIR="$APP_DIR/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"

# 1. Compile Swift Package
echo "==> Compiling Swift Package ($MODE mode)..."
if [ "$MODE" == "release" ]; then
    swift build -c release
else
    swift build
fi

# 2. Assemble App Bundle
echo "==> Creating App Bundle Structure..."
rm -rf "$APP_DIR"
mkdir -p "$MACOS_DIR"
mkdir -p "$RESOURCES_DIR"

echo "==> Copying executable binary..."
cp "$BUILD_DIR/$EXECUTABLE_NAME" "$MACOS_DIR/"
chmod +x "$MACOS_DIR/$EXECUTABLE_NAME"

echo "==> Copying Resources & Assets..."
if [ -d "Sources/CopSightAI/Resources" ]; then
    cp -R Sources/CopSightAI/Resources/* "$RESOURCES_DIR/" 2>/dev/null || true
fi

echo "==> Generating Info.plist..."
cat > "$CONTENTS_DIR/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>$EXECUTABLE_NAME</string>
    <key>CFBundleIdentifier</key>
    <string>$BUNDLE_IDENTIFIER</string>
    <key>CFBundleName</key>
    <string>$APP_NAME</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>$VERSION</string>
    <key>CFBundleVersion</key>
    <string>$VERSION</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>CFBundleIconName</key>
    <string>AppIcon</string>
    <key>LSMinimumSystemVersion</key>
    <string>14.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>NSSupportsAutomaticGraphicsSwitching</key>
    <true/>
</dict>
</plist>
EOF

echo "==> Application bundle '$APP_DIR' successfully assembled."

# 3. Create DMG & ZIP if in release mode or if requested
if [ "$MODE" == "release" ]; then
    DIST_DIR="dist"
    mkdir -p "$DIST_DIR"
    
    ZIP_NAME="CopSight-AI-macOS-v${VERSION}.zip"
    DMG_NAME="CopSight-AI-macOS-v${VERSION}.dmg"
    
    echo "==> Packaging ZIP: $DIST_DIR/$ZIP_NAME..."
    ditto -c -k --sequesterRsrc --keepParent "$APP_DIR" "$DIST_DIR/$ZIP_NAME"
    
    echo "==> Packaging DMG: $DIST_DIR/$DMG_NAME..."
    DMG_TMP="dmg_tmp"
    rm -rf "$DMG_TMP" "$DIST_DIR/$DMG_NAME"
    mkdir -p "$DMG_TMP"
    cp -R "$APP_DIR" "$DMG_TMP/"
    ln -s /Applications "$DMG_TMP/Applications"
    
    hdiutil create -volname "CopSight AI v$VERSION" -srcfolder "$DMG_TMP" -ov -format UDZO "$DIST_DIR/$DMG_NAME"
    rm -rf "$DMG_TMP"
    
    echo "=================================================="
    echo " Release artifacts ready in $DIST_DIR/:"
    echo "  - $DIST_DIR/$ZIP_NAME"
    echo "  - $DIST_DIR/$DMG_NAME"
    echo "=================================================="
fi
