import os
import sys
import shutil
import plistlib

def main():
    if len(sys.argv) < 3:
        print("Usage: build_macos_bundle.py <path_to_forensixd_bin> <app_version>")
        sys.exit(1)
        
    bin_path = sys.argv[1]
    app_version = sys.argv[2].lstrip('v')
    
    app_dir = "dist/CopSight.app"
    macos_dir = os.path.join(app_dir, "Contents", "MacOS")
    resources_dir = os.path.join(app_dir, "Contents", "Resources")
    
    os.makedirs(macos_dir, exist_ok=True)
    os.makedirs(resources_dir, exist_ok=True)
    
    # Move binary
    target_bin = os.path.join(macos_dir, "forensixd")
    shutil.move(bin_path, target_bin)
    os.chmod(target_bin, 0o755)
    
    # Copy icon
    icon_src = "forensixd/logo.icns"
    if os.path.exists(icon_src):
        shutil.copy(icon_src, os.path.join(resources_dir, "logo.icns"))
        
    # Write launcher script
    launcher_path = os.path.join(macos_dir, "CopSight")
    with open(launcher_path, "w") as f:
        f.write('#!/bin/bash\nDIR="$(cd "$(dirname "$0")" && pwd)"\nopen -a Terminal "$DIR/forensixd"\n')
    os.chmod(launcher_path, 0o755)
    
    # Write Info.plist
    plist_data = {
        'CFBundleExecutable': 'CopSight',
        'CFBundleIconFile': 'logo.icns',
        'CFBundleIdentifier': 'com.copsight.app',
        'CFBundleName': 'CopSight',
        'CFBundleDisplayName': 'CopSight',
        'CFBundlePackageType': 'APPL',
        'CFBundleShortVersionString': app_version,
        'CFBundleVersion': app_version,
        'LSMinimumSystemVersion': '11.0',
        'NSHighResolutionCapable': True
    }
    plist_path = os.path.join(app_dir, "Contents", "Info.plist")
    with open(plist_path, "wb") as f:
        plistlib.dump(plist_data, f)
        
    print(f"CopSight.app bundle created successfully with version {app_version}")

if __name__ == "__main__":
    main()
