#!/usr/bin/env python3
"""
Automated builder for CopSight macOS Desktop Application.
Constructs native Cocoa CopSight.app bundle using Apple's native osacompile tool
and packages distribution .zip and .dmg assets.
"""

import os
import sys
import shutil
import subprocess
from pathlib import Path


def run_cmd(cmd, cwd=None, check=True):
    print(f"[Build] Executing: {cmd}")
    res = subprocess.run(cmd, shell=True, cwd=cwd)
    if check and res.returncode != 0:
        print(f"[Build] Error: Command failed with code {res.returncode}")
        sys.exit(res.returncode)
    return res.returncode


def main():
    root_dir = Path(__file__).resolve().parent.parent.parent.parent
    macos_app_dir = root_dir / "apps" / "macos"
    dist_dir = root_dir / "dist"
    app_bundle_dir = dist_dir / "CopSight.app"
    resources_dir = app_bundle_dir / "Contents" / "Resources"

    version = "2.0.28"
    if len(sys.argv) > 1:
        version = sys.argv[1].lstrip('v')

    print(f"=== Building CopSight macOS Desktop App v{version} ===")

    # 1. Build Frontend
    print("[1/5] Compiling React desktop UI...")
    run_cmd("npx vite build", cwd=str(macos_app_dir))

    # 2. Compile Native Cocoa Application Bundle with Clang & WebKit
    print("[2/5] Compiling native macOS Cocoa Mach-O binary with WebKit...")
    dist_dir.mkdir(parents=True, exist_ok=True)
    if app_bundle_dir.exists():
        shutil.rmtree(app_bundle_dir)

    macos_dir = app_bundle_dir / "Contents" / "MacOS"
    macos_dir.mkdir(parents=True, exist_ok=True)
    resources_dir.mkdir(parents=True, exist_ok=True)

    main_m_src = macos_app_dir / "scripts" / "main.m"
    target_bin = macos_dir / "CopSight"
    run_cmd(f'clang -framework Cocoa -framework WebKit -O2 "{main_m_src}" -o "{target_bin}"')
    target_bin.chmod(0o755)

    # 3. Write start_services.sh helper into Bundle Resources
    print("[3/5] Installing service lifecycle manager...")
    services_script = """#!/bin/bash
export PATH="/opt/homebrew/bin:/usr/local/bin:/Library/Frameworks/Python.framework/Versions/3.11/bin:/usr/bin:/bin:$PATH"

DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$DIR/app_core"
UI_DIR="$DIR/ui"

PYTHON_BIN=""
for p in "$ROOT_DIR/forensixd/venv/bin/python3" "/opt/homebrew/bin/python3" "/usr/local/bin/python3" "/Library/Frameworks/Python.framework/Versions/3.11/bin/python3" "$(which python3 2>/dev/null)" "/usr/bin/python3"; do
  if [ -x "$p" ]; then
    PYTHON_BIN="$p"
    break
  fi
done

if [ -z "$PYTHON_BIN" ]; then
  PYTHON_BIN="python3"
fi

export PYTHONPATH="$ROOT_DIR:$PYTHONPATH"

# 1. Daemon check on port 54322 (only start if not already responding)
if ! curl -s --max-time 1 http://127.0.0.1:54322/health >/dev/null 2>&1; then
    cd "$ROOT_DIR" && nohup "$PYTHON_BIN" -m apps.macos.daemon.server --port 54322 </dev/null >/tmp/copsight_daemon.log 2>&1 &
fi

# 2. UI check on port 5174 (only start if not already responding)
if ! curl -s --max-time 1 http://127.0.0.1:5174/ >/dev/null 2>&1; then
    cd "$UI_DIR" && nohup "$PYTHON_BIN" -m http.server 5174 </dev/null >/tmp/copsight_ui.log 2>&1 &
fi

exit 0
"""
    services_script_path = resources_dir / "start_services.sh"
    with open(services_script_path, "w") as f:
        f.write(services_script)
    services_script_path.chmod(0o755)

    # 4. Copy Assets, Python Code Core, & App Icon into Bundle
    print("[4/5] Copying web assets, core python modules, and app icon...")
    ui_dist_src = macos_app_dir / "dist"
    ui_dist_dst = resources_dir / "ui"
    if ui_dist_dst.exists():
        shutil.rmtree(ui_dist_dst)
    shutil.copytree(ui_dist_src, ui_dist_dst)

    # Bundle core python logic
    app_core_dst = resources_dir / "app_core"
    if app_core_dst.exists():
        shutil.rmtree(app_core_dst)
    app_core_dst.mkdir(parents=True, exist_ok=True)
    shutil.copytree(root_dir / "forensixd", app_core_dst / "forensixd", ignore=shutil.ignore_patterns("__pycache__", "*.pyc", "venv", ".venv", "env"))
    shutil.copytree(root_dir / "apps", app_core_dst / "apps", ignore=shutil.ignore_patterns("node_modules", "dist", ".venv", "venv", "__pycache__", "*.pyc"))

    icon_src = root_dir / "forensixd" / "logo.icns"
    if icon_src.exists():
        shutil.copy(icon_src, resources_dir / "applet.icns")
        shutil.copy(icon_src, resources_dir / "logo.icns")

    # Update Info.plist
    plist_path = app_bundle_dir / "Contents" / "Info.plist"
    plist_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>en</string>
    <key>CFBundleDisplayName</key>
    <string>CopSight</string>
    <key>CFBundleExecutable</key>
    <string>CopSight</string>
    <key>CFBundleIconFile</key>
    <string>logo</string>
    <key>CFBundleIdentifier</key>
    <string>com.copsight.forensics.macos</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>CopSight</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>{version}</string>
    <key>CFBundleVersion</key>
    <string>{version}</string>
    <key>LSMinimumSystemVersion</key>
    <string>11.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>NSRequiresAquaSystemAppearance</key>
    <false/>
    <key>NSSupportsAutomaticGraphicsSwitching</key>
    <true/>
    <key>NSUSBUsageDescription</key>
    <string>CopSight requires access to USB interfaces for forensic acquisition of mobile and storage devices.</string>
</dict>
</plist>
"""
    with open(plist_path, "w") as f:
        f.write(plist_content)

    print(f"[Success] Native CopSight.app bundle created at: {app_bundle_dir}")

    # 5. Ad-Hoc Code Signing
    print("[5/6] Applying ad-hoc cryptographic signature to bundle...")
    run_cmd(f'xattr -cr "{app_bundle_dir}"')
    run_cmd(f'codesign --force --deep --sign - "{app_bundle_dir}"')
    run_cmd(f'codesign --verify --deep --strict "{app_bundle_dir}"')

    # 6. Build ZIP Release Asset
    print("[6/6] Packaging ZIP and DMG distribution assets...")
    zip_path = dist_dir / f"CopSight-macOS-v{version}.zip"
    if zip_path.exists():
        zip_path.unlink()
    
    run_cmd(f'zip -r -y "{zip_path}" CopSight.app', cwd=str(dist_dir))
    print(f"[Success] Created macOS ZIP bundle: {zip_path}")

    dmg_path = dist_dir / f"CopSight-macOS-v{version}.dmg"
    rw_dmg = root_dir / "copsight_rw.dmg"

    if shutil.which("hdiutil"):
        if rw_dmg.exists():
            rw_dmg.unlink()
        if dmg_path.exists():
            dmg_path.unlink()

        try:
            # Unmount any stale volume
            subprocess.run(["hdiutil", "detach", "/Volumes/CopSight"], capture_output=True)

            # 1. Create temporary read-write HFS+ DMG
            run_cmd(f'hdiutil create -size 350m -fs HFS+ -volname "CopSight" -ov "{rw_dmg}"')

            # 2. Mount it
            run_cmd(f'hdiutil attach "{rw_dmg}" -mountpoint /Volumes/CopSight')

            # 3. Copy files & create Applications shortcut
            shutil.copytree(app_bundle_dir, "/Volumes/CopSight/CopSight.app")
            os.symlink("/Applications", "/Volumes/CopSight/Applications")

            # 4. AppleScript to set 128px icons and side-by-side position
            as_finder_layout = '''
tell application "Finder"
    tell disk "CopSight"
        open
        set current view of container window to icon view
        set toolbar visible of container window to false
        set statusbar visible of container window to false
        set the bounds of container window to {300, 200, 840, 560}
        set theViewOptions to the icon view options of container window
        set icon size of theViewOptions to 128
        set text size of theViewOptions to 14
        set arrangement of theViewOptions to not arranged
        set position of item "CopSight.app" of container window to {135, 170}
        set position of item "Applications" of container window to {405, 170}
        update without registering applications
        delay 1
        close
    end tell
end tell
'''
            subprocess.run(["osascript", "-e", as_finder_layout], check=False)
            import time
            time.sleep(1)

            # 5. Detach read-write DMG
            subprocess.run(["hdiutil", "detach", "/Volumes/CopSight"], check=True)

            # 6. Convert to compressed UDZO DMG
            run_cmd(f'hdiutil convert "{rw_dmg}" -format UDZO -imagekey zlib-level=9 -o "{dmg_path}"')
            print(f"[Success] Created high-DPI macOS DMG installer with 128px large icons: {dmg_path}")
        except Exception as e:
            print(f"[Notice] Custom Finder DMG layout had notice: {e}. Falling back to standard UDZO DMG.")
            dmg_stage = root_dir / "dmg_stage"
            if dmg_stage.exists():
                shutil.rmtree(dmg_stage)
            dmg_stage.mkdir(parents=True, exist_ok=True)
            shutil.copytree(app_bundle_dir, dmg_stage / "CopSight.app")
            try:
                os.symlink("/Applications", dmg_stage / "Applications")
            except Exception:
                pass
            run_cmd(f'hdiutil create -volname "CopSight" -srcfolder "{dmg_stage}" -ov -format UDZO "{dmg_path}"', check=False)
            if dmg_stage.exists():
                shutil.rmtree(dmg_stage)
        finally:
            if rw_dmg.exists():
                rw_dmg.unlink()
    else:
        print("[Notice] hdiutil not found; CopSight.app & ZIP are fully ready.")


if __name__ == "__main__":
    main()
