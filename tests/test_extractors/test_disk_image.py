"""
tests.test_extractors.test_disk_image
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Tests for :class:`forensixd.extractors.disk_image.DiskImageExtractor`.

Strategy
--------
* Registry, interface, and connect/disconnect tests run unconditionally on
  every platform because they do not invoke ``pytsk3``.
* The ``extract()`` unavailability guard test is skipped when ``pytsk3`` **is**
  installed (TSK_AVAILABLE == True), because in that environment the guard
  branch is never reached during a normal test run.  It is exercised instead
  via ``unittest.mock.patch`` so the guard can be tested regardless of whether
  the real library is present.
* No test attempts a real pytsk3 walk; the disk-image walk tests would require
  a valid forensic image file, which is impractical in a unit-test environment.
"""

import pytest
from datetime import timedelta, datetime, timezone
from unittest.mock import patch

from forensixd.extractors.disk_image import DiskImageExtractor, TSK_AVAILABLE
from forensixd.extractors.base import ExtractorRegistry
from forensixd.core.models import (
    DeviceInfo,
    Platform,
    ExtractionLevel,
    CaseMetadata,
    ConsentType,
)
from forensixd.core.exceptions import ExtractionError
from forensixd.core.session import ForensicSession


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def device(tmp_path):
    """Return a :class:`DeviceInfo` whose ``device_id`` points to a real file."""
    img = tmp_path / "test.dd"
    img.write_bytes(b"\x00" * 1024)
    return DeviceInfo(platform=Platform.DISK_IMAGE, device_id=str(img))


@pytest.fixture
def case(device):
    """Return a minimal :class:`CaseMetadata` for *device*."""
    return CaseMetadata(
        case_number="DISK-001",
        court_order_ref="CO-001",
        examiner_id="EX-001",
        jurisdiction="TEST",
        consent_type=ConsentType.COURT_ORDER,
        authorized_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        device=device,
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_case(device: DeviceInfo, case_number: str) -> CaseMetadata:
    """Build a :class:`CaseMetadata` with a custom *case_number*."""
    return CaseMetadata(
        case_number=case_number,
        court_order_ref="CO-001",
        examiner_id="EX-001",
        jurisdiction="TEST",
        consent_type=ConsentType.COURT_ORDER,
        authorized_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        device=device,
    )


# ---------------------------------------------------------------------------
# is_available
# ---------------------------------------------------------------------------


def test_is_available_returns_bool() -> None:
    """is_available() must always return a plain bool."""
    assert isinstance(DiskImageExtractor().is_available(), bool)


def test_is_available_matches_module_flag() -> None:
    """is_available() must agree with the module-level TSK_AVAILABLE sentinel."""
    assert DiskImageExtractor().is_available() is TSK_AVAILABLE


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------


def test_registered_in_registry() -> None:
    """Platform.DISK_IMAGE must appear in the registry after module import."""
    assert Platform.DISK_IMAGE in ExtractorRegistry.available_platforms()


def test_registry_returns_disk_image_extractor_class() -> None:
    """ExtractorRegistry.get(DISK_IMAGE) must return DiskImageExtractor itself."""
    assert ExtractorRegistry.get(Platform.DISK_IMAGE) is DiskImageExtractor


# ---------------------------------------------------------------------------
# supported_levels
# ---------------------------------------------------------------------------


def test_supported_levels_has_all_three() -> None:
    """All three ExtractionLevel values must be reported as supported."""
    levels = DiskImageExtractor().supported_levels()
    assert ExtractionLevel.LOGICAL in levels
    assert ExtractionLevel.FILE_SYSTEM in levels
    assert ExtractionLevel.PHYSICAL in levels


def test_supported_levels_returns_list() -> None:
    """supported_levels() must return a list instance."""
    assert isinstance(DiskImageExtractor().supported_levels(), list)


def test_supported_levels_has_three_entries() -> None:
    """supported_levels() must contain exactly three entries."""
    assert len(DiskImageExtractor().supported_levels()) == 3


# ---------------------------------------------------------------------------
# connect
# ---------------------------------------------------------------------------


def test_connect_valid_image_does_not_raise(device: DeviceInfo) -> None:
    """connect() must not raise when device_id is an existing file path."""
    e = DiskImageExtractor()
    e.connect(device)  # must not raise


def test_connect_stores_image_path(device: DeviceInfo) -> None:
    """A successful connect() must persist the resolved Path on _image_path."""
    from pathlib import Path

    e = DiskImageExtractor()
    e.connect(device)
    assert e._image_path == Path(device.device_id)


def test_connect_stores_device(device: DeviceInfo) -> None:
    """A successful connect() must persist the DeviceInfo on _device."""
    e = DiskImageExtractor()
    e.connect(device)
    assert e._device == device


def test_connect_sets_connected_flag(device: DeviceInfo) -> None:
    """A successful connect() must set _connected to True."""
    e = DiskImageExtractor()
    e.connect(device)
    assert e._connected is True


def test_connect_missing_image_raises() -> None:
    """connect() must raise ExtractionError when device_id does not exist."""
    d = DeviceInfo(platform=Platform.DISK_IMAGE, device_id="/no/such/file.dd")
    with pytest.raises(ExtractionError):
        DiskImageExtractor().connect(d)


def test_connect_missing_image_error_mentions_path() -> None:
    """The ExtractionError message must contain the bad path for diagnostics."""
    bad_path = "/absolutely/missing/image.dd"
    d = DeviceInfo(platform=Platform.DISK_IMAGE, device_id=bad_path)
    with pytest.raises(ExtractionError, match=bad_path):
        DiskImageExtractor().connect(d)


# ---------------------------------------------------------------------------
# disconnect
# ---------------------------------------------------------------------------


def test_disconnect_does_not_raise(device: DeviceInfo) -> None:
    """disconnect() must not raise after a successful connect()."""
    e = DiskImageExtractor()
    e.connect(device)
    e.disconnect()  # must not raise


def test_disconnect_clears_connected_flag(device: DeviceInfo) -> None:
    """disconnect() must set _connected to False."""
    e = DiskImageExtractor()
    e.connect(device)
    e.disconnect()
    assert e._connected is False


def test_disconnect_is_idempotent() -> None:
    """disconnect() must not raise when called without a prior connect()."""
    e = DiskImageExtractor()
    e.disconnect()  # no connect beforehand — must not raise
    assert e._connected is False


# ---------------------------------------------------------------------------
# extract — TSK unavailability guard (patched)
# ---------------------------------------------------------------------------


def test_extract_raises_when_tsk_unavailable(
    tmp_path, device: DeviceInfo, case: CaseMetadata
) -> None:
    """extract() must raise ExtractionError with a pip hint when TSK is absent.

    TSK_AVAILABLE is patched to False so the guard is always exercised
    regardless of whether pytsk3 is actually installed in the test environment.
    """
    with patch("forensixd.extractors.disk_image.TSK_AVAILABLE", False):
        e = DiskImageExtractor()
        # connect() does NOT check TSK_AVAILABLE, so it succeeds here.
        e.connect(device)
        with ForensicSession(case, tmp_path) as session:
            with pytest.raises(ExtractionError, match="pytsk3"):
                list(e.extract(session, ExtractionLevel.LOGICAL))


def test_extract_without_tsk_raises(
    tmp_path, device: DeviceInfo, case: CaseMetadata
) -> None:
    """Mirrors the patched test using pytest.skip when pytsk3 is installed.

    When pytsk3 is genuinely absent the guard fires without patching;
    when it is present the test is skipped (the unavailability path is
    already covered by the patched variant above).
    """
    e = DiskImageExtractor()
    if e.is_available():
        pytest.skip("pytsk3 installed — unavailability guard covered by patched test")
    e.connect(device)
    with ForensicSession(case, tmp_path) as session:
        with pytest.raises(ExtractionError):
            list(e.extract(session, ExtractionLevel.LOGICAL))


# ---------------------------------------------------------------------------
# extract — connect guard
# ---------------------------------------------------------------------------


def test_extract_raises_without_connect(
    tmp_path, device: DeviceInfo
) -> None:
    """extract() must raise ExtractionError when connect() was never called."""
    case = _make_case(device, "DISK-010")
    e = DiskImageExtractor()
    with ForensicSession(case, tmp_path) as session:
        with pytest.raises(ExtractionError):
            list(e.extract(session, ExtractionLevel.LOGICAL))


def test_extract_raises_after_disconnect(
    tmp_path, device: DeviceInfo, case: CaseMetadata
) -> None:
    """extract() must raise ExtractionError after disconnect() has been called."""
    e = DiskImageExtractor()
    e.connect(device)
    e.disconnect()
    with ForensicSession(case, tmp_path) as session:
        with pytest.raises(ExtractionError):
            list(e.extract(session, ExtractionLevel.LOGICAL))


# ---------------------------------------------------------------------------
# extract — all levels accepted (when TSK unavailable, guard fires for all)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "level",
    [ExtractionLevel.LOGICAL, ExtractionLevel.FILE_SYSTEM, ExtractionLevel.PHYSICAL],
)
def test_extract_all_levels_raise_tsk_unavailable(
    tmp_path, device: DeviceInfo, case: CaseMetadata, level: ExtractionLevel
) -> None:
    """With TSK patched away, all three levels must raise ExtractionError."""
    with patch("forensixd.extractors.disk_image.TSK_AVAILABLE", False):
        e = DiskImageExtractor()
        e.connect(device)
        with ForensicSession(case, tmp_path) as session:
            with pytest.raises(ExtractionError):
                list(e.extract(session, level))
