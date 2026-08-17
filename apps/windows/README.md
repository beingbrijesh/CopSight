# CopSight Windows Desktop Application

Architecture specifications and roadmap for CopSight Windows distribution.

## Architecture
- **Target OS**: Windows 10 / Windows 11 (x64, ARM64)
- **USB Subsystem**: WinUSB / LibUSB driver integration for Android ADB & iOS Apple Mobile Device Support.
- **Frontend**: Minimalist Cyber-Forensic React Desktop Shell.
- **Backend Daemon**: PyInstaller-compiled `forensixd-daemon.exe` running locally on loopback RPC.
- **Packaging**: Inno Setup / WiX Toolset producing signed `.msi` / `.exe` installer.
