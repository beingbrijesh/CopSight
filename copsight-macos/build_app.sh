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
    <key>CFBundleDevelopmentRegion</key>
    <string>en</string>
    <key>CFBundleDisplayName</key>
    <string>$APP_NAME</string>
    <key>CFBundleExecutable</key>
    <string>$EXECUTABLE_NAME</string>
    <key>CFBundleIdentifier</key>
    <string>$BUNDLE_IDENTIFIER</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>$APP_NAME</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>$VERSION</string>
    <key>CFBundleVersion</key>
    <string>$VERSION</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon.icns</string>
    <key>CFBundleIconName</key>
    <string>AppIcon</string>
    <key>LSApplicationCategoryType</key>
    <string>public.app-category.utilities</string>
    <key>LSMinimumSystemVersion</key>
    <string>14.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>NSRequiresAquaSystemAppearance</key>
    <false/>
    <key>NSSupportsAutomaticGraphicsSwitching</key>
    <true/>
</dict>
</plist>
EOF

echo "==> Signing App Bundle (Ad-hoc signature)..."
if command -v codesign &> /dev/null; then
    codesign --force --deep -s - "$APP_DIR" || echo "Warning: codesign returned non-zero, continuing..."
fi

echo "==> Application bundle '$APP_DIR' successfully assembled."

# 3. Create DMG & ZIP if in release mode or if requested
if [ "$MODE" == "release" ]; then
    DIST_DIR="dist"
    mkdir -p "$DIST_DIR"
    
    ZIP_NAME="CopSight-AI-macOS-v${VERSION}.zip"
    DMG_NAME="CopSight-AI-macOS-v${VERSION}.dmg"
    
    echo "==> Packaging ZIP: $DIST_DIR/$ZIP_NAME..."
    rm -f "$DIST_DIR/$ZIP_NAME"
    ditto -c -k --sequesterRsrc --keepParent "$APP_DIR" "$DIST_DIR/$ZIP_NAME"
    
    echo "==> Packaging high-DPI DMG with 128px drag-and-drop icons..."
    RW_DMG="copsight_rw.dmg"
    VOL_NAME="CopSight AI"
    MOUNT_DIR="/Volumes/$VOL_NAME"
    
    # Unmount any stale volume
    hdiutil detach "$MOUNT_DIR" 2>/dev/null || true
    rm -f "$RW_DMG" "$DIST_DIR/$DMG_NAME"
    
    if command -v hdiutil &> /dev/null; then
        # Create temporary read-write HFS+ DMG
        hdiutil create -size 350m -fs HFS+ -volname "$VOL_NAME" -ov "$RW_DMG" 2>/dev/null || true
        
        if [ -f "$RW_DMG" ]; then
            hdiutil attach "$RW_DMG" -mountpoint "$MOUNT_DIR" 2>/dev/null || true
            
            if [ -d "$MOUNT_DIR" ]; then
                cp -R "$APP_DIR" "$MOUNT_DIR/"
                ln -s /Applications "$MOUNT_DIR/Applications" 2>/dev/null || true
                
                # AppleScript to set 128px icons and side-by-side positioning
                if command -v osascript &> /dev/null; then
                    osascript <<EOF || true
tell application "Finder"
    tell disk "$VOL_NAME"
        open
        set current view of container window to icon view
        set toolbar visible of container window to false
        set statusbar visible of container window to false
        set the bounds of container window to {100, 100, 960, 680}
        set theViewOptions to the icon view options of container window
        set icon size of theViewOptions to 128
        set text size of theViewOptions to 14
        set arrangement of theViewOptions to not arranged
        set position of item "$APP_NAME.app" of container window to {140, 175}
        set position of item "Applications" of container window to {410, 175}
        update without registering applications
        delay 2
        close
    end tell
end tell
EOF
                fi
                
                sync
                sleep 1
                hdiutil detach "$MOUNT_DIR" 2>/dev/null || hdiutil detach "$MOUNT_DIR" -force 2>/dev/null || true
                hdiutil convert "$RW_DMG" -format UDZO -imagekey zlib-level=9 -o "$DIST_DIR/$DMG_NAME" 2>/dev/null || true
                rm -f "$RW_DMG"
            fi
        fi
    fi
    
    # Fallback to standard DMG if advanced styling didn't produce the file
    if [ ! -f "$DIST_DIR/$DMG_NAME" ]; then
        echo "==> Fallback standard DMG creation..."
        DMG_TMP="dmg_tmp"
        rm -rf "$DMG_TMP" "$DIST_DIR/$DMG_NAME"
        mkdir -p "$DMG_TMP"
        cp -R "$APP_DIR" "$DMG_TMP/"
        ln -s /Applications "$DMG_TMP/Applications"
        hdiutil create -volname "$VOL_NAME" -srcfolder "$DMG_TMP" -ov -format UDZO "$DIST_DIR/$DMG_NAME"
        rm -rf "$DMG_TMP"
    fi
    
    echo "=================================================="
    echo " Release artifacts ready in $DIST_DIR/:"
    echo "  - $DIST_DIR/$ZIP_NAME"
    echo "  - $DIST_DIR/$DMG_NAME"
    echo "=================================================="
fi
