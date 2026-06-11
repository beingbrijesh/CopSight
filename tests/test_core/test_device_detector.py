"""
tests.test_core.test_device_detector
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Unit tests for :class:`forensixd.core.device_detector.DeviceDetector`.

These tests are intentionally hardware-agnostic: no physical USB device is
required.  The :meth:`~DeviceDetector.scan` method returns an empty list when
``pyusb`` is not installed or when no known device is attached, which is the
expected state in a CI environment.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from forensixd.core.device_detector import DeviceDetector, VID_PID_MAP
from forensixd.core.models import Platform, DeviceInfo
from forensixd.core.exceptions import DeviceNotFoundError

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_usb_device(vid: int, pid: int, serial: str | None = None) -> MagicMock:
    """Return a mock that looks like a usb.core.Device."""
    dev = MagicMock()
    dev.idVendor = vid
    dev.idProduct = pid
    dev.serial_number = serial
    return dev


# ---------------------------------------------------------------------------
# list_known_vids
# ---------------------------------------------------------------------------


def test_known_vids_returns_list() -> None:
    """list_known_vids() must return a non-empty list."""
    known = DeviceDetector.list_known_vids()
    assert isinstance(known, list)
    assert len(known) > 0


def test_known_vids_contains_android_entry() -> None:
    """At least one entry in list_known_vids() must reference an Android device."""
    known = DeviceDetector.list_known_vids()
    android_entries = [v for v in known if "android" in v.lower()]
    assert len(android_entries) > 0


def test_known_vids_contains_ios_entry() -> None:
    """At least one entry in list_known_vids() must reference an iOS device."""
    known = DeviceDetector.list_known_vids()
    ios_entries = [v for v in known if "ios" in v.lower()]
    assert len(ios_entries) > 0


def test_known_vids_are_sorted() -> None:
    """list_known_vids() must return entries in lexicographic order."""
    known = DeviceDetector.list_known_vids()
    assert known == sorted(known)


def test_known_vids_format() -> None:
    """Every entry must match the '0xVVVV:0xPPPP -> PLATFORM' format."""
    known = DeviceDetector.list_known_vids()
    for entry in known:
        # Expected shape: "0xhhhh:0xhhhh -> WORD"
        parts = entry.split(" -> ")
        assert len(parts) == 2, f"Unexpected format: {entry!r}"
        vid_pid, platform_name = parts
        assert ":" in vid_pid, f"Missing colon in VID:PID part: {vid_pid!r}"
        assert platform_name.strip(), f"Empty platform name in: {entry!r}"


# ---------------------------------------------------------------------------
# get_platform
# ---------------------------------------------------------------------------


def test_get_platform_known_android() -> None:
    """Google Nexus/Pixel VID:PID must resolve to Platform.ANDROID."""
    d = DeviceDetector()
    result = d.get_platform(0x18D1, 0x4EE2)
    assert result == Platform.ANDROID


def test_get_platform_known_ios() -> None:
    """Apple VID:PID must resolve to Platform.IOS."""
    d = DeviceDetector()
    result = d.get_platform(0x05AC, 0x12A8)
    assert result == Platform.IOS


def test_get_platform_unknown_returns_none() -> None:
    """An unrecognised VID:PID must return None, not raise."""
    d = DeviceDetector()
    result = d.get_platform(0x9999, 0x9999)
    assert result is None


def test_get_platform_case_insensitive_lookup() -> None:
    """get_platform must work regardless of hex casing used by the caller."""
    d = DeviceDetector()
    # VID_PID_MAP stores keys as plain ints; these are all equivalent.
    assert d.get_platform(0x18d1, 0x4ee2) == Platform.ANDROID
    assert d.get_platform(0x18D1, 0x4EE2) == Platform.ANDROID


# ---------------------------------------------------------------------------
# scan
# ---------------------------------------------------------------------------


def test_scan_returns_list() -> None:
    """scan() must always return a list — even when no USB backend is available."""
    d = DeviceDetector()
    with patch("forensixd.core.device_detector.usb") as mock_usb:
        mock_usb.core.find.return_value = []
        result = d.scan()
    assert isinstance(result, list)


def test_scan_returns_device_info_objects() -> None:
    """scan() items must be DeviceInfo instances when a known device is present."""
    fake_dev = _make_usb_device(0x18D1, 0x4EE2, serial="ABC123")
    d = DeviceDetector()
    with patch("forensixd.core.device_detector.usb") as mock_usb:
        mock_usb.core.find.return_value = [fake_dev]
        mock_usb.core.NoBackendError = Exception  # prevent accidental catch mismatch
        devices = d.scan()
    assert len(devices) == 1
    assert isinstance(devices[0], DeviceInfo)


def test_scan_device_info_has_platform() -> None:
    """DeviceInfo items must carry the correct Platform resolved from VID_PID_MAP."""
    fake_dev = _make_usb_device(0x05AC, 0x12A8)  # Apple iOS
    d = DeviceDetector()
    with patch("forensixd.core.device_detector.usb") as mock_usb:
        mock_usb.core.find.return_value = [fake_dev]
        mock_usb.core.NoBackendError = Exception
        devices = d.scan()
    assert devices[0].platform == Platform.IOS


def test_scan_device_info_has_device_id() -> None:
    """DeviceInfo items must have a non-empty device_id string."""
    fake_dev = _make_usb_device(0x18D1, 0x4EE7)
    d = DeviceDetector()
    with patch("forensixd.core.device_detector.usb") as mock_usb:
        mock_usb.core.find.return_value = [fake_dev]
        mock_usb.core.NoBackendError = Exception
        devices = d.scan()
    assert devices[0].device_id == "0x18d1:0x4ee7"


# ---------------------------------------------------------------------------
# wait_for_device
# ---------------------------------------------------------------------------


def test_wait_for_device_times_out() -> None:
    """wait_for_device must raise DeviceNotFoundError when scan always returns []."""
    d = DeviceDetector()
    # Override scan to simulate no device present.
    d.scan = lambda: []  # type: ignore[method-assign]
    with pytest.raises(DeviceNotFoundError):
        d.wait_for_device(timeout_seconds=1)


def test_wait_for_device_returns_on_first_device(monkeypatch: pytest.MonkeyPatch) -> None:
    """wait_for_device must return immediately once scan() yields a device."""
    from forensixd.core.models import DeviceInfo

    fake_device = DeviceInfo(platform=Platform.ANDROID, device_id="0x18d1:0x4ee2")

    d = DeviceDetector()
    monkeypatch.setattr(d, "scan", lambda: [fake_device])

    result = d.wait_for_device(timeout_seconds=5)
    assert result == fake_device


def test_wait_for_device_error_carries_timeout_context() -> None:
    """DeviceNotFoundError raised on timeout must include timeout_seconds in context."""
    d = DeviceDetector()
    d.scan = lambda: []  # type: ignore[method-assign]

    with pytest.raises(DeviceNotFoundError) as exc_info:
        d.wait_for_device(timeout_seconds=1)

    assert exc_info.value.context is not None
    assert exc_info.value.context.get("timeout_seconds") == 1


# ---------------------------------------------------------------------------
# VID_PID_MAP integrity
# ---------------------------------------------------------------------------


def test_vid_pid_map_has_entries() -> None:
    """VID_PID_MAP must contain at least 8 entries."""
    assert len(VID_PID_MAP) >= 8


def test_vid_pid_map_values_are_platforms() -> None:
    """Every value in VID_PID_MAP must be a Platform member."""
    for (vid, pid), platform in VID_PID_MAP.items():
        assert isinstance(platform, Platform)
        assert isinstance(vid, int)
        assert isinstance(pid, int)


def test_vid_pid_map_contains_apple_vendor() -> None:
    """VID_PID_MAP must include at least one Apple (0x05AC) entry."""
    apple_entries = [(v, p) for (v, p) in VID_PID_MAP if v == 0x05AC]
    assert len(apple_entries) > 0


def test_vid_pid_map_contains_google_vendor() -> None:
    """VID_PID_MAP must include at least one Google (0x18D1) entry."""
    google_entries = [(v, p) for (v, p) in VID_PID_MAP if v == 0x18D1]
    assert len(google_entries) > 0
