"""
forensixd.core.device_detector
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

USB device detection and platform identification for the forensixd pipeline.

This module probes the host USB bus for known forensic targets (Android and iOS
devices) using the ``pyusb`` library.  When ``pyusb`` is not installed the
module degrades gracefully: :meth:`DeviceDetector.scan` returns an empty list
and :meth:`DeviceDetector.wait_for_device` raises
:exc:`~forensixd.core.exceptions.DeviceNotFoundError` immediately after the
timeout elapses (no USB access is attempted).

Typical usage::

    from forensixd.core.device_detector import DeviceDetector

    detector = DeviceDetector()

    # Non-blocking scan — returns whatever is plugged in right now.
    devices = detector.scan()

    # Blocking scan — waits up to 30 s for the first device to appear.
    device = detector.wait_for_device(timeout_seconds=30)
"""

from __future__ import annotations

import time
from typing import Optional

from forensixd.core.exceptions import DeviceNotFoundError
from forensixd.core.models import DeviceInfo, Platform

# ---------------------------------------------------------------------------
# Optional pyusb import
# ---------------------------------------------------------------------------

try:
    import usb.core  # type: ignore[import-untyped]

    USB_AVAILABLE: bool = True
except ImportError:  # pragma: no cover
    USB_AVAILABLE = False

# ---------------------------------------------------------------------------
# VID / PID → Platform mapping
# ---------------------------------------------------------------------------

#: Known USB Vendor-ID / Product-ID pairs and their associated platform.
#:
#: Keys are ``(idVendor, idProduct)`` tuples (both as :class:`int`).
#: Values are :class:`~forensixd.core.models.Platform` members.
VID_PID_MAP: dict[tuple[int, int], Platform] = {
    # Google (Nexus / Pixel) — Android
    (0x18D1, 0x4EE2): Platform.ANDROID,
    (0x18D1, 0x4EE7): Platform.ANDROID,
    # Samsung — Android
    (0x04E8, 0x6860): Platform.ANDROID,
    (0x04E8, 0x685D): Platform.ANDROID,
    # Motorola — Android
    (0x22B8, 0x2E76): Platform.ANDROID,
    # Xiaomi — Android
    (0x2717, 0xFF40): Platform.ANDROID,
    # Qualcomm (generic) — Android
    (0x05C6, 0x9092): Platform.ANDROID,
    # ZTE — Android
    (0x19D2, 0x1354): Platform.ANDROID,
    # Apple — iOS
    (0x05AC, 0x12A8): Platform.IOS,
    (0x05AC, 0x12AB): Platform.IOS,
    (0x05AC, 0x1281): Platform.IOS,
    (0x05AC, 0x1227): Platform.IOS,
}


# ---------------------------------------------------------------------------
# DeviceDetector
# ---------------------------------------------------------------------------


class DeviceDetector:
    """Probe the host USB bus for known forensic target devices.

    The detector consults :data:`VID_PID_MAP` to classify each enumerated USB
    device as Android or iOS.  All operations degrade gracefully when
    ``pyusb`` (``usb.core``) is unavailable — no exception is raised at
    import or construction time.

    Examples
    --------
    >>> detector = DeviceDetector()
    >>> devices = detector.scan()          # immediate, non-blocking
    >>> device  = detector.wait_for_device(timeout_seconds=30)
    """

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    def scan(self) -> list[DeviceInfo]:
        """Return all currently connected, recognised forensic devices.

        The USB bus is enumerated once synchronously.  For each device whose
        ``(idVendor, idProduct)`` pair appears in :data:`VID_PID_MAP` a
        :class:`~forensixd.core.models.DeviceInfo` instance is constructed.
        The ``device_id`` field is set to ``"0xVID:0xPID"`` (zero-padded,
        lower-case hex).  A best-effort attempt is made to read the USB
        serial-number descriptor; any :class:`usb.core.USBError` encountered
        during that read is silently swallowed and ``serial`` is left as
        ``None``.

        Returns
        -------
        list[DeviceInfo]
            Matched devices in enumeration order, or an empty list when
            ``pyusb`` is not installed or no recognised device is found.
        """
        if not USB_AVAILABLE:
            return []

        matched: list[DeviceInfo] = []

        try:
            raw_devices = usb.core.find(find_all=True)
        except usb.core.NoBackendError:
            # libusb / OpenUSB native driver not present on this machine.
            return []
        if raw_devices is None:
            return []

        for dev in raw_devices:
            vid: int = dev.idVendor  # type: ignore[attr-defined]
            pid: int = dev.idProduct  # type: ignore[attr-defined]

            platform: Optional[Platform] = VID_PID_MAP.get((vid, pid))

            if platform is None:
                # Fallback to Vendor ID matching for robust detection across USB modes (MTP vs ADB)
                # Google, Samsung, Motorola, Xiaomi, Qualcomm, ZTE
                if vid in (0x18D1, 0x04E8, 0x22B8, 0x2717, 0x05C6, 0x19D2):
                    platform = Platform.ANDROID
                # Apple
                elif vid == 0x05AC:
                    platform = Platform.IOS

            if platform is None:
                continue

            device_id: str = f"0x{vid:04x}:0x{pid:04x}"

            serial: Optional[str] = None
            try:
                serial = dev.serial_number  # type: ignore[attr-defined]
            except usb.core.USBError:
                pass

            matched.append(
                DeviceInfo(
                    platform=platform,
                    device_id=device_id,
                    serial=serial,
                )
            )

        return matched

    def wait_for_device(self, timeout_seconds: int = 60) -> DeviceInfo:
        """Block until a recognised device appears or the timeout elapses.

        The USB bus is polled via :meth:`scan` once per second.  The first
        :class:`~forensixd.core.models.DeviceInfo` found is returned
        immediately without waiting for the remaining timeout.

        Parameters
        ----------
        timeout_seconds:
            Maximum number of seconds to wait before giving up.  Defaults to
            ``60``.

        Returns
        -------
        DeviceInfo
            The first recognised device detected on the bus.

        Raises
        ------
        DeviceNotFoundError
            When no recognised device is found within *timeout_seconds*.
        """
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
        """Return the :class:`~forensixd.core.models.Platform` for a VID/PID pair.

        Parameters
        ----------
        vid:
            USB Vendor ID (e.g. ``0x18D1`` for Google).
        pid:
            USB Product ID (e.g. ``0x4EE2`` for a Nexus device in ADB mode).

        Returns
        -------
        Platform | None
            The matching :class:`~forensixd.core.models.Platform` member, or
            ``None`` when the pair is not in :data:`VID_PID_MAP`.
        """
        return VID_PID_MAP.get((vid, pid))

    @staticmethod
    def list_known_vids() -> list[str]:
        """Return a sorted list of human-readable VID/PID → platform strings.

        Each entry is formatted as::

            "0xVVVV:0xPPPP -> PLATFORM"

        where ``VVVV`` and ``PPPP`` are zero-padded four-digit lower-case
        hexadecimal numbers.

        Returns
        -------
        list[str]
            Sorted list of ``"0xVID:0xPID -> platform"`` strings covering
            every entry in :data:`VID_PID_MAP`.
        """
        return sorted(
            f"0x{vid:04x}:0x{pid:04x} -> {platform.value}"
            for (vid, pid), platform in VID_PID_MAP.items()
        )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

__all__ = ["DeviceDetector"]
