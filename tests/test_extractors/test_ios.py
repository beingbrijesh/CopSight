"""
tests.test_extractors.test_ios
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Tests for :class:`forensixd.extractors.ios.IosExtractor`.

When ``pymobiledevice3`` is **not** installed, :meth:`connect` raises
:class:`~forensixd.core.exceptions.ExtractionError`, so tests that need an
active extractor bypass :meth:`connect` by setting ``_connected`` and
``_device`` directly.  Tests that exercise :meth:`_backup_extract` use
``tmp_path``-backed stub trees so they run on every platform without any iOS
device present.
"""

import pytest
from datetime import timedelta, datetime, timezone
from pathlib import Path
from unittest.mock import patch

from forensixd.extractors.ios import IosExtractor, PYMOBILE_AVAILABLE
from forensixd.extractors.base import ExtractorRegistry
from forensixd.core.models import (
    ArtifactType,
    CaseMetadata,
    ConsentType,
    DeviceInfo,
    ExtractionLevel,
    Platform,
)
from forensixd.core.exceptions import ExtractionError
from forensixd.core.session import ForensicSession


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def device() -> DeviceInfo:
    """Return a minimal iOS device descriptor."""
    return DeviceInfo(platform=Platform.IOS, device_id="iphone-test-001")


@pytest.fixture
def case(device: DeviceInfo) -> CaseMetadata:
    """Return a minimal :class:`~forensixd.core.models.CaseMetadata` for *device*."""
    return CaseMetadata(
        case_number="IOS-001",
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


def _make_stub(path: Path, content: bytes = b"stub") -> Path:
    """Create *path* (and any missing parents) with *content* and return it."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)
    return path


def _connected_extractor(device: DeviceInfo, backup_dir: Path | None = None) -> IosExtractor:
    """Return an :class:`IosExtractor` that bypasses :meth:`connect`.

    Useful on environments where ``pymobiledevice3`` is absent: sets the
    internal flags directly so extraction helpers can be called without
    triggering the library-availability guard.
    """
    e = IosExtractor()
    if PYMOBILE_AVAILABLE:
        e.connect(device, backup_dir=backup_dir)
    else:
        e._device = device
        e._backup_dir = backup_dir
        e._connected = True
    return e


# ---------------------------------------------------------------------------
# is_available
# ---------------------------------------------------------------------------


def test_is_available_returns_bool() -> None:
    """is_available() must always return a plain bool."""
    assert isinstance(IosExtractor().is_available(), bool)


def test_is_available_matches_module_flag() -> None:
    """is_available() must agree with the module-level PYMOBILE_AVAILABLE sentinel."""
    assert IosExtractor().is_available() is PYMOBILE_AVAILABLE


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------


def test_registered_in_registry() -> None:
    """Platform.IOS must be present in the extractor registry after module import."""
    assert Platform.IOS in ExtractorRegistry.available_platforms()


def test_registry_returns_ios_extractor_class() -> None:
    """ExtractorRegistry.get(IOS) must return IosExtractor itself."""
    assert ExtractorRegistry.get(Platform.IOS) is IosExtractor


# ---------------------------------------------------------------------------
# supported_levels
# ---------------------------------------------------------------------------


def test_supported_levels_has_logical() -> None:
    """LOGICAL must appear in the declared supported levels."""
    assert ExtractionLevel.LOGICAL in IosExtractor().supported_levels()


def test_supported_levels_returns_list() -> None:
    """supported_levels() must return a list instance."""
    assert isinstance(IosExtractor().supported_levels(), list)


def test_supported_levels_no_physical() -> None:
    """PHYSICAL must NOT appear in the declared supported levels."""
    assert ExtractionLevel.PHYSICAL not in IosExtractor().supported_levels()


def test_supported_levels_no_file_system() -> None:
    """FILE_SYSTEM must NOT appear in the declared supported levels."""
    assert ExtractionLevel.FILE_SYSTEM not in IosExtractor().supported_levels()


# ---------------------------------------------------------------------------
# connect — library guard
# ---------------------------------------------------------------------------


def test_connect_without_library_raises_extraction_error(device: DeviceInfo) -> None:
    """connect() must raise ExtractionError when pymobiledevice3 is absent.

    ``PYMOBILE_AVAILABLE`` is patched to ``False`` so the guard is always
    exercised regardless of whether the real library is installed.
    """
    with patch("forensixd.extractors.ios.PYMOBILE_AVAILABLE", False):
        e = IosExtractor()
        with pytest.raises(ExtractionError):
            e.connect(device)


def test_connect_stores_device(device: DeviceInfo) -> None:
    """A successful connect() must persist the DeviceInfo on _device."""
    e = _connected_extractor(device)
    assert e._device == device
    e.disconnect()


def test_connect_sets_connected_flag(device: DeviceInfo) -> None:
    """A successful connect() must set _connected to True."""
    e = _connected_extractor(device)
    assert e._connected is True
    e.disconnect()


def test_connect_stores_backup_dir(device: DeviceInfo, tmp_path: Path) -> None:
    """connect(backup_dir=…) must persist the backup directory on _backup_dir."""
    e = _connected_extractor(device, backup_dir=tmp_path)
    assert e._backup_dir == tmp_path
    e.disconnect()


# ---------------------------------------------------------------------------
# disconnect
# ---------------------------------------------------------------------------


def test_disconnect_does_not_raise(device: DeviceInfo) -> None:
    """disconnect() must not raise when called after a successful connect."""
    e = IosExtractor()
    e._connected = False
    e.disconnect()


def test_disconnect_clears_connected_flag(device: DeviceInfo) -> None:
    """disconnect() must set _connected to False."""
    e = _connected_extractor(device)
    e.disconnect()
    assert e._connected is False


def test_disconnect_is_idempotent() -> None:
    """disconnect() must not raise when called without a prior connect()."""
    e = IosExtractor()
    e.disconnect()  # no connect beforehand — must not raise
    assert e._connected is False


# ---------------------------------------------------------------------------
# extract — guard conditions
# ---------------------------------------------------------------------------


def test_extract_raises_without_connect(
    tmp_path: Path, device: DeviceInfo
) -> None:
    """extract() must raise ExtractionError when connect() was never called."""
    case = _make_case(device, "IOS-002")
    e = IosExtractor()
    with ForensicSession(case, tmp_path) as session:
        with pytest.raises(ExtractionError):
            list(e.extract(session, ExtractionLevel.LOGICAL))


def test_physical_level_raises(
    tmp_path: Path, device: DeviceInfo, case: CaseMetadata
) -> None:
    """extract() must raise ExtractionError for ExtractionLevel.PHYSICAL."""
    e = _connected_extractor(device)
    with ForensicSession(case, tmp_path) as session:
        with pytest.raises(ExtractionError):
            list(e.extract(session, ExtractionLevel.PHYSICAL))
        session.close()


def test_file_system_level_raises(
    tmp_path: Path, device: DeviceInfo, case: CaseMetadata
) -> None:
    """extract() must raise ExtractionError for ExtractionLevel.FILE_SYSTEM."""
    e = IosExtractor()
    e._connected = True
    e._device = device
    with ForensicSession(case, tmp_path) as session:
        with pytest.raises(ExtractionError):
            list(e.extract(session, ExtractionLevel.FILE_SYSTEM))
        session.close()


# ---------------------------------------------------------------------------
# extract — no backup_dir supplied
# ---------------------------------------------------------------------------


def test_extract_no_backup_dir_yields_empty(
    tmp_path: Path, device: DeviceInfo
) -> None:
    """extract() with no backup_dir must yield an empty list (with a warning)."""
    case = _make_case(device, "IOS-010")
    e = _connected_extractor(device, backup_dir=None)
    with ForensicSession(case, tmp_path) as session:
        artifacts = list(e.extract(session, ExtractionLevel.LOGICAL))
    assert artifacts == []


def test_extract_nonexistent_backup_dir_yields_empty(
    tmp_path: Path, device: DeviceInfo
) -> None:
    """extract() with a non-existent backup_dir must yield an empty list."""
    case = _make_case(device, "IOS-011")
    missing_dir = tmp_path / "no_such_backup"
    e = _connected_extractor(device, backup_dir=missing_dir)
    with ForensicSession(case, tmp_path) as session:
        artifacts = list(e.extract(session, ExtractionLevel.LOGICAL))
    assert artifacts == []


# ---------------------------------------------------------------------------
# _backup_extract — ArtifactType classification
# ---------------------------------------------------------------------------


def test_backup_extract_dcim_yields_media(
    tmp_path: Path, device: DeviceInfo
) -> None:
    """Files under a DCIM directory must be classified as MEDIA."""
    case = _make_case(device, "IOS-020")
    backup_root = tmp_path / "backup"
    _make_stub(backup_root / "DCIM" / "photo.jpg", b"\xff\xd8\xff")

    e = _connected_extractor(device, backup_dir=backup_root)
    with ForensicSession(case, tmp_path) as session:
        artifacts = list(e.extract(session, ExtractionLevel.LOGICAL))

    assert len(artifacts) == 1
    assert artifacts[0].artifact_type == ArtifactType.MEDIA


def test_backup_extract_sms_yields_message(
    tmp_path: Path, device: DeviceInfo
) -> None:
    """Files whose path contains 'SMS' must be classified as MESSAGE."""
    case = _make_case(device, "IOS-021")
    backup_root = tmp_path / "backup"
    _make_stub(backup_root / "SMS" / "sms.db", b"SQLite")

    e = _connected_extractor(device, backup_dir=backup_root)
    with ForensicSession(case, tmp_path) as session:
        artifacts = list(e.extract(session, ExtractionLevel.LOGICAL))

    assert len(artifacts) == 1
    assert artifacts[0].artifact_type == ArtifactType.MESSAGE


def test_backup_extract_callhistory_yields_call_log(
    tmp_path: Path, device: DeviceInfo
) -> None:
    """Files whose path contains 'CallHistory' must be classified as CALL_LOG."""
    case = _make_case(device, "IOS-022")
    backup_root = tmp_path / "backup"
    _make_stub(backup_root / "CallHistory" / "call_history.db", b"SQLite")

    e = _connected_extractor(device, backup_dir=backup_root)
    with ForensicSession(case, tmp_path) as session:
        artifacts = list(e.extract(session, ExtractionLevel.LOGICAL))

    assert len(artifacts) == 1
    assert artifacts[0].artifact_type == ArtifactType.CALL_LOG


def test_backup_extract_unknown_path_yields_app_data(
    tmp_path: Path, device: DeviceInfo
) -> None:
    """Files with no recognised path segment must default to APP_DATA."""
    case = _make_case(device, "IOS-023")
    backup_root = tmp_path / "backup"
    _make_stub(backup_root / "AppData" / "preferences.plist", b"bplist00")

    e = _connected_extractor(device, backup_dir=backup_root)
    with ForensicSession(case, tmp_path) as session:
        artifacts = list(e.extract(session, ExtractionLevel.LOGICAL))

    assert len(artifacts) == 1
    assert artifacts[0].artifact_type == ArtifactType.APP_DATA


# ---------------------------------------------------------------------------
# _backup_extract — artifact content correctness
# ---------------------------------------------------------------------------


def test_backup_extract_artifact_source_path_is_string(
    tmp_path: Path, device: DeviceInfo
) -> None:
    """source_path on every artifact must be a non-empty string."""
    case = _make_case(device, "IOS-030")
    backup_root = tmp_path / "backup"
    _make_stub(backup_root / "DCIM" / "img.png", b"PNG")

    e = _connected_extractor(device, backup_dir=backup_root)
    with ForensicSession(case, tmp_path) as session:
        artifacts = list(e.extract(session, ExtractionLevel.LOGICAL))

    for a in artifacts:
        assert isinstance(a.source_path, str)
        assert len(a.source_path) > 0


def test_backup_extract_artifact_hashes_populated(
    tmp_path: Path, device: DeviceInfo
) -> None:
    """Every artifact must carry a HashPair with 32-char MD5 and 64-char SHA-256."""
    case = _make_case(device, "IOS-031")
    backup_root = tmp_path / "backup"
    _make_stub(backup_root / "SMS" / "db.sqlite", b"data")

    e = _connected_extractor(device, backup_dir=backup_root)
    with ForensicSession(case, tmp_path) as session:
        artifacts = list(e.extract(session, ExtractionLevel.LOGICAL))

    assert len(artifacts) == 1
    assert len(artifacts[0].hashes.md5) == 32
    assert len(artifacts[0].hashes.sha256) == 64


def test_backup_extract_artifact_platform_is_ios(
    tmp_path: Path, device: DeviceInfo
) -> None:
    """Every artifact must reference an iOS device."""
    case = _make_case(device, "IOS-032")
    backup_root = tmp_path / "backup"
    _make_stub(backup_root / "notes.txt", b"hello")

    e = _connected_extractor(device, backup_dir=backup_root)
    with ForensicSession(case, tmp_path) as session:
        artifacts = list(e.extract(session, ExtractionLevel.LOGICAL))

    for a in artifacts:
        assert a.device.platform == Platform.IOS


def test_backup_extract_artifact_source_app(
    tmp_path: Path, device: DeviceInfo
) -> None:
    """Every artifact must carry source_app == 'ios_backup'."""
    case = _make_case(device, "IOS-033")
    backup_root = tmp_path / "backup"
    _make_stub(backup_root / "data.bin", b"\x00\x01\x02")

    e = _connected_extractor(device, backup_dir=backup_root)
    with ForensicSession(case, tmp_path) as session:
        artifacts = list(e.extract(session, ExtractionLevel.LOGICAL))

    assert len(artifacts) == 1
    assert artifacts[0].source_app == "ios_backup"


def test_backup_extract_data_contains_relative_path(
    tmp_path: Path, device: DeviceInfo
) -> None:
    """The 'relative_path' key in artifact.data must be set and non-empty."""
    case = _make_case(device, "IOS-034")
    backup_root = tmp_path / "backup"
    _make_stub(backup_root / "DCIM" / "vid.mov", b"ftyp")

    e = _connected_extractor(device, backup_dir=backup_root)
    with ForensicSession(case, tmp_path) as session:
        artifacts = list(e.extract(session, ExtractionLevel.LOGICAL))

    assert len(artifacts) == 1
    assert "relative_path" in artifacts[0].data
    assert len(artifacts[0].data["relative_path"]) > 0


# ---------------------------------------------------------------------------
# _backup_extract — multi-file and session consistency
# ---------------------------------------------------------------------------


def test_backup_extract_multiple_files(
    tmp_path: Path, device: DeviceInfo
) -> None:
    """_backup_extract must yield one artifact per regular file in the tree."""
    case = _make_case(device, "IOS-040")
    backup_root = tmp_path / "backup"
    _make_stub(backup_root / "DCIM" / "a.jpg", b"JPG1")
    _make_stub(backup_root / "SMS" / "sms.db", b"SMS1")
    _make_stub(backup_root / "CallHistory" / "call.db", b"CALL")
    _make_stub(backup_root / "misc" / "pref.plist", b"PLIST")

    e = _connected_extractor(device, backup_dir=backup_root)
    with ForensicSession(case, tmp_path) as session:
        artifacts = list(e.extract(session, ExtractionLevel.LOGICAL))

    assert len(artifacts) == 4


def test_artifacts_registered_match_yielded(
    tmp_path: Path, device: DeviceInfo
) -> None:
    """Every yielded artifact must also be registered in the session."""
    case = _make_case(device, "IOS-041")
    backup_root = tmp_path / "backup"
    _make_stub(backup_root / "DCIM" / "photo.jpg", b"JPG")
    _make_stub(backup_root / "SMS" / "sms.db", b"DB")

    e = _connected_extractor(device, backup_dir=backup_root)
    with ForensicSession(case, tmp_path) as session:
        artifacts = list(e.extract(session, ExtractionLevel.LOGICAL))
        registered_count = session.artifact_count

    assert registered_count == len(artifacts)


def test_backup_extract_returns_iterable(
    tmp_path: Path, device: DeviceInfo
) -> None:
    """extract() must always return something iterable even with an empty backup dir."""
    case = _make_case(device, "IOS-042")
    backup_root = tmp_path / "empty_backup"
    backup_root.mkdir()

    e = _connected_extractor(device, backup_dir=backup_root)
    with ForensicSession(case, tmp_path) as session:
        result = list(e.extract(session, ExtractionLevel.LOGICAL))

    assert result == []


def test_backup_extract_skips_directories(
    tmp_path: Path, device: DeviceInfo
) -> None:
    """Subdirectories inside backup_dir must not be yielded as artifacts."""
    case = _make_case(device, "IOS-043")
    backup_root = tmp_path / "backup"
    subdir = backup_root / "DCIM" / "subdir"
    subdir.mkdir(parents=True, exist_ok=True)
    _make_stub(backup_root / "DCIM" / "photo.jpg", b"JPG")

    e = _connected_extractor(device, backup_dir=backup_root)
    with ForensicSession(case, tmp_path) as session:
        artifacts = list(e.extract(session, ExtractionLevel.LOGICAL))

    # Only the file, not the directory, should be yielded.
    assert len(artifacts) == 1
    assert artifacts[0].artifact_type == ArtifactType.MEDIA
