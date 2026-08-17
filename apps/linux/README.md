# CopSight Linux Desktop Application

Architecture specifications and roadmap for CopSight Linux distribution.

## Architecture
- **Target OS**: Ubuntu 22.04+, Debian 12+, Fedora 38+, Arch Linux (x86_64, aarch64)
- **USB Subsystem**: Linux `udev` rules with `libusb-1.0` and Android `android-tools-adb`.
- **Frontend**: Minimalist Cyber-Forensic Web Desktop Shell.
- **Backend Daemon**: Standalone ELF executable `forensixd-daemon` communicating via local loopback or UNIX socket `/tmp/copsight.sock`.
- **Packaging**: AppImage, Debian `.deb`, and RPM distributions.
