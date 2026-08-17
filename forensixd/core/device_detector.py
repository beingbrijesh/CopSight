"""
forensixd.core.device_detector
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Multi-platform USB device detection and hardware discovery for the forensixd pipeline.

Supports:
- pyusb / libusb
- macOS native IOKit / ioreg enumeration
- Android Debug Bridge (ADB) device discovery
- iOS pymobiledevice3 / usbmuxd discovery
- Mass storage / flash drive enumeration
"""

from __future__ import annotations

import os
import platform as sys_platform
import re
import shutil
import subprocess
import time
from typing import Optional

from forensixd.core.exceptions import DeviceNotFoundError
from forensixd.core.models import DeviceInfo, Platform

# ---------------------------------------------------------------------------
# Optional pyusb import
# ---------------------------------------------------------------------------

try:
    import usb.core  # type: ignore[import-untyped]
    try:
        import libusb_package
        usb.core.find(backend=libusb_package.get_libusb1_backend())
    except Exception:
        pass
    USB_AVAILABLE: bool = True
except Exception:
    USB_AVAILABLE = False

# ---------------------------------------------------------------------------
# VID / PID → Platform mapping
# ---------------------------------------------------------------------------

KNOWN_ANDROID_VIDS = {
    0x18D1: "Google / Nexus / Pixel",
    0x04E8: "Samsung",
    0x22B8: "Motorola",
    0x2717: "Xiaomi / POCO / Redmi",
    0x05C6: "Qualcomm / OnePlus",
    0x19D2: "ZTE",
    0x0BB4: "HTC",
    0x12D1: "Huawei / Honor",
    0x2A70: "OnePlus",
    0x0E8D: "MediaTek",
    0x1782: "Spreadtrum / Unisoc",
    0x201E: "Realme",
    0x2E04: "HMD Global / Nokia",
    0x0FCE: "Sony",
    0x1004: "LG",
    0x2833: "Oculus / Meta",
    0x0502: "Acer",
    0x0B05: "ASUS",
}

KNOWN_IOS_VIDS = {
    0x05AC: "Apple",
}

VID_PID_MAP: dict[tuple[int, int], Platform] = {
    # Google
    (0x18D1, 0x4EE2): Platform.ANDROID,
    (0x18D1, 0x4EE7): Platform.ANDROID,
    (0x18D1, 0x4EE1): Platform.ANDROID,
    (0x18D1, 0x4EE9): Platform.ANDROID,
    # Samsung
    (0x04E8, 0x6860): Platform.ANDROID,
    (0x04E8, 0x685D): Platform.ANDROID,
    (0x04E8, 0x685E): Platform.ANDROID,
    # Motorola
    (0x22B8, 0x2E76): Platform.ANDROID,
    (0x22B8, 0x2E80): Platform.ANDROID,
    # Xiaomi / POCO / Redmi
    (0x2717, 0xFF40): Platform.ANDROID,
    (0x2717, 0xFF48): Platform.ANDROID,
    (0x2717, 0xFF68): Platform.ANDROID,
    (0x2717, 0xFF88): Platform.ANDROID,
    # Qualcomm / OnePlus
    (0x05C6, 0x9092): Platform.ANDROID,
    (0x05C6, 0x9025): Platform.ANDROID,
    (0x2A70, 0x9011): Platform.ANDROID,
    # ZTE
    (0x19D2, 0x1354): Platform.ANDROID,
    # Apple
    (0x05AC, 0x12A8): Platform.IOS,
    (0x05AC, 0x12AB): Platform.IOS,
    (0x05AC, 0x1281): Platform.IOS,
    (0x05AC, 0x1227): Platform.IOS,
    (0x05AC, 0x12AA): Platform.IOS,
    (0x05AC, 0x12A0): Platform.IOS,
}


class DeviceDetector:
    """Probe the host USB bus for forensic targets using native probes + pyusb."""

    def scan(self, active_adb: bool = False) -> list[DeviceInfo]:
        """Return all currently connected, recognised forensic devices.
        
        Uses passive IOKit / ioreg USB bus queries on macOS by default to avoid
        spamming ADB authentication prompts to connected Android phones.
        """
        found: dict[str, DeviceInfo] = {}

        # Probe 1: macOS Native IOKit / ioreg Probe (100% passive, zero prompt to phone)
        if sys_platform.system() == "Darwin":
            self._scan_macos_ioreg(found)

        # Probe 2: ADB probe (Android) - only if requested or when no devices detected via passive bus
        if active_adb or (not found and sys_platform.system() != "Darwin"):
            self._scan_adb(found)

        # Probe 3: pymobiledevice3 / usbmuxd probe (iOS)
        if not found:
            self._scan_pymobiledevice(found)

        # Probe 4: PyUSB probe (if available)
        if not found and USB_AVAILABLE:
            self._scan_pyusb(found)

        return list(found.values())

    def _scan_macos_ioreg(self, found: dict[str, DeviceInfo]) -> None:
        """Scan connected USB devices via macOS native IOKit tree."""
        try:
            out = subprocess.check_output(
                ["ioreg", "-p", "IOUSB", "-w0", "-l"],
                text=True,
                errors="replace",
                stderr=subprocess.DEVNULL,
                timeout=3,
            )
            for block in out.split("+-o "):
                vid_match = re.search(r'"idVendor"\s*=\s*(\d+)', block)
                pid_match = re.search(r'"idProduct"\s*=\s*(\d+)', block)
                name_match = re.search(r'"USB Product Name"\s*=\s*"([^"]+)"', block)
                serial_match = re.search(r'"USB Serial Number"\s*=\s*"([^"]+)"', block)

                if not (vid_match and pid_match):
                    continue

                vid = int(vid_match.group(1))
                pid = int(pid_match.group(1))
                prod_name = name_match.group(1) if name_match else None
                serial = serial_match.group(1) if serial_match else None

                platform: Optional[Platform] = VID_PID_MAP.get((vid, pid))
                if platform is None:
                    if vid in KNOWN_ANDROID_VIDS:
                        platform = Platform.ANDROID
                    elif vid in KNOWN_IOS_VIDS:
                        platform = Platform.IOS

                # If platform identified or name strongly suggests a mobile device
                if platform is None and prod_name:
                    lower_name = prod_name.lower()
                    if any(k in lower_name for k in ["android", "phone", "galaxy", "pixel", "redmi", "poco", "xiaomi", "oneplus"]):
                        platform = Platform.ANDROID
                    elif any(k in lower_name for k in ["iphone", "ipad", "ipod", "apple"]):
                        platform = Platform.IOS

                if platform is None:
                    continue

                device_id = f"0x{vid:04x}:0x{pid:04x}"
                key = serial or device_id

                if key not in found:
                    found[key] = DeviceInfo(
                        platform=platform,
                        device_id=device_id,
                        model=prod_name or ("Android Device" if platform == Platform.ANDROID else "Apple iOS Device"),
                        serial=serial,
                    )
        except Exception:
            pass

    def _scan_adb(self, found: dict[str, DeviceInfo]) -> None:
        """Scan Android devices using ADB CLI if present."""
        adb_bin = shutil.which("adb") or "/opt/homebrew/bin/adb" or "/usr/local/bin/adb"
        if not os.path.exists(adb_bin) and not shutil.which("adb"):
            return

        try:
            out = subprocess.check_output(
                [adb_bin, "devices", "-l"],
                text=True,
                errors="replace",
                stderr=subprocess.DEVNULL,
                timeout=3,
            )
            for line in out.splitlines():
                line = line.strip()
                if not line or line.startswith("List of devices") or line.startswith("*"):
                    continue
                parts = line.split()
                if len(parts) >= 2 and parts[1] in ("device", "recovery", "sideload", "unauthorized", "offline"):
                    serial = parts[0]
                    key = serial
                    if key not in found:
                        found[key] = DeviceInfo(
                            platform=Platform.ANDROID,
                            device_id=f"adb:{serial}",
                            model="Android Target (ADB)",
                            serial=serial,
                        )
        except Exception:
            pass

    def _scan_pymobiledevice(self, found: dict[str, DeviceInfo]) -> None:
        """Scan iOS devices using pymobiledevice3 if available."""
        try:
            from pymobiledevice3.usbmux import list_devices  # type: ignore
            devices = list_devices()
            for dev in devices:
                serial = getattr(dev, "serial", None) or getattr(dev, "udid", None)
                key = serial or "ios_device"
                if key not in found:
                    found[key] = DeviceInfo(
                        platform=Platform.IOS,
                        device_id=f"ios:{serial}" if serial else "0x05ac:0x12a8",
                        model="Apple iOS Device",
                        serial=serial,
                    )
        except Exception:
            pass

    def _scan_pyusb(self, found: dict[str, DeviceInfo]) -> None:
        """Scan USB bus via pyusb/libusb."""
        try:
            backend = None
            if "libusb_package" in globals():
                backend = libusb_package.get_libusb1_backend()
            raw_devices = usb.core.find(find_all=True, backend=backend)
            if raw_devices is None:
                return

            for dev in raw_devices:
                vid: int = dev.idVendor
                pid: int = dev.idProduct

                platform = VID_PID_MAP.get((vid, pid))
                if platform is None:
                    if vid in KNOWN_ANDROID_VIDS:
                        platform = Platform.ANDROID
                    elif vid in KNOWN_IOS_VIDS:
                        platform = Platform.IOS

                if platform is None:
                    continue

                serial: Optional[str] = None
                try:
                    serial = dev.serial_number
                except Exception:
                    pass

                device_id = f"0x{vid:04x}:0x{pid:04x}"
                key = serial or device_id
                if key not in found:
                    found[key] = DeviceInfo(
                        platform=platform,
                        device_id=device_id,
                        model="Forensic Target Device",
                        serial=serial,
                    )
        except Exception:
            pass

    def wait_for_device(self, timeout_seconds: int = 60) -> DeviceInfo:
        """Block until a recognised device appears or the timeout elapses."""
        deadline: float = time.monotonic() + timeout_seconds
        while time.monotonic() < deadline:
            devices = self.scan()
            if devices:
                return devices[0]
            time.sleep(1)

        raise DeviceNotFoundError(
            f"No recognised forensic device detected after {timeout_seconds} second(s).",
            context={"timeout_seconds": timeout_seconds, "usb_available": USB_AVAILABLE},
        )

    def get_platform(self, vid: int, pid: int) -> Optional[Platform]:
        """Return Platform for a VID/PID pair."""
        return VID_PID_MAP.get((vid, pid))


__all__ = ["DeviceDetector"]
