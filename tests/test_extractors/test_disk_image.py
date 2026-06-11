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
from pathlib import Path
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


# ---------------------------------------------------------------------------
# _artifact_type_for_tsk_path
# ---------------------------------------------------------------------------

def test_artifact_type_for_tsk_path() -> None:
    from forensixd.extractors.disk_image import _artifact_type_for_tsk_path
    from forensixd.core.models import ArtifactType
    
    assert _artifact_type_for_tsk_path("/DCIM/photo.jpg") == ArtifactType.MEDIA
    assert _artifact_type_for_tsk_path("/data/sms.db") == ArtifactType.MESSAGE
    assert _artifact_type_for_tsk_path("/calls.db") == ArtifactType.CALL_LOG
    assert _artifact_type_for_tsk_path("/contacts.db") == ArtifactType.CONTACT
    assert _artifact_type_for_tsk_path("/Chrome/History") == ArtifactType.BROWSER_HISTORY
    assert _artifact_type_for_tsk_path("/mail/Outlook") == ArtifactType.EMAIL
    assert _artifact_type_for_tsk_path("/location/geo") == ArtifactType.LOCATION
    assert _artifact_type_for_tsk_path("/var/log/syslog") == ArtifactType.SYSTEM_LOG
    assert _artifact_type_for_tsk_path("/other/random.dat") == ArtifactType.APP_DATA


# ---------------------------------------------------------------------------
# _walk_image mocks
# ---------------------------------------------------------------------------

class MockMeta:
    def __init__(self, type_val, size=100):
        self.type = type_val
        self.size = size

class MockName:
    def __init__(self, name_bytes):
        self.name = name_bytes

class MockInfo:
    def __init__(self, name_bytes=None, meta_type=None, meta_size=100):
        self.name = MockName(name_bytes) if name_bytes is not None else None
        self.meta = MockMeta(meta_type, meta_size) if meta_type is not None else None

class MockEntry:
    def __init__(self, name_bytes=None, meta_type=None, data=b"data", meta_size=100):
        self.info = MockInfo(name_bytes, meta_type, meta_size)
        self._data = data
        
    def read_random(self, offset, size):
        return self._data

class MockDir:
    def __init__(self, entries):
        self.entries = entries
        
    def __iter__(self):
        return iter(self.entries)

class MockFS:
    def __init__(self, dirs):
        self.dirs = dirs
        
    def open_dir(self, path):
        if path in self.dirs:
            return self.dirs[path]
        raise Exception("Dir not found")

def test_walk_image_success(tmp_path: Path, device: DeviceInfo, case: CaseMetadata) -> None:
    e = DiskImageExtractor()
    e.connect(device)
    
    import pytsk3  # type: ignore
    
    entries_root = [
        MockEntry(b".", pytsk3.TSK_FS_META_TYPE_DIR),
        MockEntry(b"..", pytsk3.TSK_FS_META_TYPE_DIR),
        MockEntry(b"test.txt", pytsk3.TSK_FS_META_TYPE_REG, b"hello", 5),
        MockEntry(b"sub", pytsk3.TSK_FS_META_TYPE_DIR),
        MockEntry(b"bad_meta", None), # Missing meta
    ]
    
    entries_sub = [
        MockEntry(b"pic.jpg", pytsk3.TSK_FS_META_TYPE_REG, b"jpeg", 4),
    ]
    
    fs = MockFS({
        "/": MockDir(entries_root),
        "/sub": MockDir(entries_sub),
    })

    with patch("forensixd.extractors.disk_image.TSK_AVAILABLE", True):
        with patch("pytsk3.Img_Info"):
            with patch("pytsk3.FS_Info", return_value=fs):
                with ForensicSession(case, tmp_path) as session:
                    artifacts = list(e.extract(session, ExtractionLevel.LOGICAL))
                    
    assert len(artifacts) == 2
    paths = [a.source_path for a in artifacts]
    assert "/test.txt" in paths
    assert "/sub/pic.jpg" in paths


def test_walk_image_exceptions(tmp_path: Path, device: DeviceInfo, case: CaseMetadata) -> None:
    e = DiskImageExtractor()
    e.connect(device)
    
    with patch("forensixd.extractors.disk_image.TSK_AVAILABLE", True):
        # 1. Img_Info raises
        with patch("pytsk3.Img_Info", side_effect=Exception("img error")):
            with ForensicSession(case, tmp_path) as session:
                with pytest.raises(ExtractionError, match="Failed to open disk image"):
                    list(e.extract(session, ExtractionLevel.LOGICAL))
        
        # 2. FS_Info raises
        with patch("pytsk3.Img_Info"):
            with patch("pytsk3.FS_Info", side_effect=Exception("fs error")):
                with ForensicSession(case, tmp_path) as session:
                    with pytest.raises(ExtractionError, match="No supported file system"):
                        list(e.extract(session, ExtractionLevel.LOGICAL))
        
        # 3. open_dir("/") raises
        class MockFSBadRoot:
            def open_dir(self, path): raise Exception("root error")
            
        with patch("pytsk3.Img_Info"):
            with patch("pytsk3.FS_Info", return_value=MockFSBadRoot()):
                with ForensicSession(case, tmp_path) as session:
                    with pytest.raises(ExtractionError, match="Cannot open root directory"):
                        list(e.extract(session, ExtractionLevel.LOGICAL))


def test_walk_dir_exceptions(tmp_path: Path, device: DeviceInfo, case: CaseMetadata) -> None:
    e = DiskImageExtractor()
    e.connect(device)
    import pytsk3  # type: ignore
    
    class BadDirIter:
        def __iter__(self):
            raise Exception("dir iter error")
            
    class BadSubDirFS:
        def open_dir(self, path):
            if path == "/":
                return MockDir([MockEntry(b"sub", pytsk3.TSK_FS_META_TYPE_DIR)])
            raise Exception("sub dir error")

    with patch("forensixd.extractors.disk_image.TSK_AVAILABLE", True):
        with patch("pytsk3.Img_Info"):
            # Test dir iteration error
            with patch("pytsk3.FS_Info", return_value=MockFS({"/": BadDirIter()})):
                with ForensicSession(case, tmp_path) as session:
                    artifacts = list(e.extract(session, ExtractionLevel.LOGICAL))
                    assert len(artifacts) == 0
            
            # Test sub dir open error
            with patch("pytsk3.FS_Info", return_value=BadSubDirFS()):
                with ForensicSession(case, tmp_path) as session:
                    artifacts = list(e.extract(session, ExtractionLevel.LOGICAL))
                    assert len(artifacts) == 0


def test_extract_file_artifact_exceptions(tmp_path: Path, device: DeviceInfo, case: CaseMetadata) -> None:
    e = DiskImageExtractor()
    e.connect(device)
    import pytsk3  # type: ignore
    
    # Missing size
    class MockMetaNoSize:
        def __init__(self):
            self.type = pytsk3.TSK_FS_META_TYPE_REG
        @property
        def size(self):
            raise Exception("no size")
            
    class EntryNoSize:
        def __init__(self):
            self.info = MockInfo(b"file", None)
            self.info.meta = MockMetaNoSize()  # type: ignore[assignment]

    # Read error
    class EntryBadRead(MockEntry):
        def read_random(self, offset, size):
            raise Exception("read error")

    entries = [
        EntryNoSize(),
        EntryBadRead(b"badread", pytsk3.TSK_FS_META_TYPE_REG, b"", 100),
    ]
    
    fs = MockFS({"/": MockDir(entries)})

    with patch("forensixd.extractors.disk_image.TSK_AVAILABLE", True):
        with patch("pytsk3.Img_Info"):
            with patch("pytsk3.FS_Info", return_value=fs):
                with ForensicSession(case, tmp_path) as session:
                    artifacts = list(e.extract(session, ExtractionLevel.LOGICAL))
                    assert len(artifacts) == 0
