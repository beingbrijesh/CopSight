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

    version = "2.0.27"
    if len(sys.argv) > 1:
        version = sys.argv[1].lstrip('v')

    print(f"=== Building CopSight macOS Desktop App v{version} ===")

    # 1. Build Frontend
    print("[1/5] Compiling React desktop UI...")
    run_cmd("npx vite build", cwd=str(macos_app_dir))

    # 2. Compile Native Cocoa Application Bundle with osacompile
    print("[2/5] Compiling native macOS Cocoa Mach-O bundle...")
    dist_dir.mkdir(parents=True, exist_ok=True)
    if app_bundle_dir.exists():
        shutil.rmtree(app_bundle_dir)

    applescript_source = """on run
    set resourcesDir to (path to me as text) & "Contents:Resources:"
    set scriptPath to POSIX path of resourcesDir & "start_services.sh"
    
    do shell script "/bin/bash " & quoted form of scriptPath
    delay 0.5
    open location "http://localhost:5174"
end run

on reopen
    open location "http://localhost:5174"
end reopen

on quit
    continue quit
end quit
"""

    temp_as_file = dist_dir / "copsight_bundle.applescript"
    with open(temp_as_file, "w") as f:
        f.write(applescript_source)

    run_cmd(f'osacompile -o "{app_bundle_dir}" "{temp_as_file}"')
    if temp_as_file.exists():
        temp_as_file.unlink()

    # 3. Write start_services.sh helper into Bundle Resources
    print("[3/5] Installing service lifecycle manager...")
    python_bin = sys.executable or "/Library/Frameworks/Python.framework/Versions/3.11/bin/python3"
    services_script = f"""#!/bin/bash
export PATH="/Library/Frameworks/Python.framework/Versions/3.11/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="{str(root_dir)}"
UI_DIR="$DIR/ui"

PYTHON_BIN="{python_bin}"
if [ ! -x "$PYTHON_BIN" ]; then
  if command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="$(which python3)"
  elif [ -x "/opt/homebrew/bin/python3" ]; then
    PYTHON_BIN="/opt/homebrew/bin/python3"
  elif [ -x "/usr/local/bin/python3" ]; then
    PYTHON_BIN="/usr/local/bin/python3"
  fi
fi

export PYTHONPATH="$ROOT_DIR:$PYTHONPATH"

# 1. Daemon check on port 54322 (only start if not already responding)
if ! curl -s --max-time 1 http://127.0.0.1:54322/health >/dev/null 2>&1; then
    nohup "$PYTHON_BIN" -m apps.macos.daemon.server --port 54322 > /tmp/copsight_daemon.log 2>&1 &
fi

# 2. UI check on port 5174 (only start if not already responding)
if ! curl -s --max-time 1 http://127.0.0.1:5174/ >/dev/null 2>&1; then
    cd "$UI_DIR" && nohup "$PYTHON_BIN" -m http.server 5174 > /tmp/copsight_ui.log 2>&1 &
fi

exit 0
"""
    services_script_path = resources_dir / "start_services.sh"
    with open(services_script_path, "w") as f:
        f.write(services_script)
    services_script_path.chmod(0o755)

    # 4. Copy Assets & App Icon into Bundle
    print("[4/5] Copying web assets and app icon...")
    ui_dist_src = macos_app_dir / "dist"
    ui_dist_dst = resources_dir / "ui"
    if ui_dist_dst.exists():
        shutil.rmtree(ui_dist_dst)
    shutil.copytree(ui_dist_src, ui_dist_dst)

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
    <string>applet</string>
    <key>CFBundleIconFile</key>
    <string>applet</string>
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

    # 5. Build ZIP Release Asset
    print("[5/5] Packaging ZIP and DMG distribution assets...")
    zip_path = dist_dir / f"CopSight-macOS-v{version}.zip"
    if zip_path.exists():
        zip_path.unlink()
    
    run_cmd(f'zip -r -y "{zip_path}" CopSight.app', cwd=str(dist_dir))
    print(f"[Success] Created macOS ZIP bundle: {zip_path}")

    dmg_path = dist_dir / f"CopSight-macOS-v{version}.dmg"
    dmg_stage = dist_dir / "dmg_stage"

    if dmg_stage.exists():
        shutil.rmtree(dmg_stage)
    dmg_stage.mkdir(parents=True, exist_ok=True)

    shutil.copytree(app_bundle_dir, dmg_stage / "CopSight.app")

    if shutil.which("hdiutil"):
        if dmg_path.exists():
            dmg_path.unlink()
        ret = run_cmd(f'hdiutil create -volname "CopSight" -srcfolder "{dmg_stage}" -ov -format UDZO "{dmg_path}"', check=False)
        if ret == 0 and dmg_path.exists():
            print(f"[Success] Created macOS DMG installer: {dmg_path}")
        else:
            print("[Notice] DMG creation skipped; CopSight.app & ZIP distribution assets are fully compiled and ready.")
        if dmg_stage.exists():
            shutil.rmtree(dmg_stage)
    else:
        print("[Notice] hdiutil not found; CopSight.app & ZIP are fully ready.")


if __name__ == "__main__":
    main()
