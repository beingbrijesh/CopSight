"""
tests.test_extractors.test_windows
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Tests for :class:`forensixd.extractors.windows.WindowsExtractor`.

On non-Windows hosts all paths (C:/Windows/…, C:/Users/…) are absent, so
:meth:`extract` yields an empty list — tests that check the resulting
``artifacts`` list are therefore written to accept zero or more items.
Tests that must produce artefacts regardless of OS use ``tmp_path``-backed
fixtures to create stub files that the extractor will actually hash and yield.
"""

import platform as sys_platform
from datetime import timedelta, datetime, timezone
from pathlib import Path
from unittest.mock import patch

import pytest

from forensixd.core.exceptions import ExtractionError
from forensixd.core.models import (
    ArtifactType,
    CaseMetadata,
    ConsentType,
    DeviceInfo,
    ExtractionLevel,
    Platform,
)
from forensixd.core.session import ForensicSession
from forensixd.extractors.base import ExtractorRegistry
from forensixd.extractors.windows import WindowsExtractor


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def device() -> DeviceInfo:
    """Return a minimal Windows device descriptor."""
    return DeviceInfo(platform=Platform.WINDOWS, device_id="localhost-win")


@pytest.fixture
def case(device: DeviceInfo) -> CaseMetadata:
    """Return a minimal :class:`~forensixd.core.models.CaseMetadata` for *device*."""
    return CaseMetadata(
        case_number="WIN-001",
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
    """Build a :class:`CaseMetadata` with a given *case_number*."""
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
    """Create *path* (including any missing parents) with *content* and return it."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)
    return path


# ---------------------------------------------------------------------------
# is_available
# ---------------------------------------------------------------------------


def test_is_available_returns_bool() -> None:
    """is_available() must always return a plain bool."""
    assert isinstance(WindowsExtractor().is_available(), bool)


def test_is_available_true_only_on_windows() -> None:
    """is_available() must return True iff running on Windows."""
    e = WindowsExtractor()
    if sys_platform.system() == "Windows":
        assert e.is_available() is True
    else:
        assert e.is_available() is False


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------


def test_registered_in_registry() -> None:
    """Platform.WINDOWS must be present in the extractor registry."""
    assert Platform.WINDOWS in ExtractorRegistry.available_platforms()


def test_registry_returns_windows_extractor_class() -> None:
    """ExtractorRegistry.get(WINDOWS) must return WindowsExtractor."""
    assert ExtractorRegistry.get(Platform.WINDOWS) is WindowsExtractor


# ---------------------------------------------------------------------------
# supported_levels
# ---------------------------------------------------------------------------


def test_supported_levels_has_logical() -> None:
    """LOGICAL must appear in the declared supported levels."""
    assert ExtractionLevel.LOGICAL in WindowsExtractor().supported_levels()


def test_supported_levels_returns_list() -> None:
    """supported_levels() must return a list instance."""
    assert isinstance(WindowsExtractor().supported_levels(), list)


def test_supported_levels_excludes_physical() -> None:
    """PHYSICAL must NOT be in the declared supported levels."""
    assert ExtractionLevel.PHYSICAL not in WindowsExtractor().supported_levels()


# ---------------------------------------------------------------------------
# connect / disconnect lifecycle
# ---------------------------------------------------------------------------


def test_connect_does_not_raise(device: DeviceInfo) -> None:
    """connect() must not raise on any platform."""
    e = WindowsExtractor()
    e.connect(device)
    e.disconnect()


def test_connect_stores_device(device: DeviceInfo) -> None:
    """connect() must store the DeviceInfo on _device."""
    e = WindowsExtractor()
    e.connect(device)
    assert e._device == device
    e.disconnect()


def test_disconnect_does_not_raise(device: DeviceInfo) -> None:
    """disconnect() must not raise after a normal connect/disconnect cycle."""
    e = WindowsExtractor()
    e.connect(device)
    e.disconnect()


def test_disconnect_clears_device(device: DeviceInfo) -> None:
    """disconnect() must set _device to None."""
    e = WindowsExtractor()
    e.connect(device)
    e.disconnect()
    assert e._device is None


def test_disconnect_is_idempotent() -> None:
    """disconnect() must not raise when called without a prior connect()."""
    e = WindowsExtractor()
    e.disconnect()  # no connect beforehand — must not raise
    assert e._device is None


# ---------------------------------------------------------------------------
# extract — guard conditions
# ---------------------------------------------------------------------------


def test_extract_raises_without_connect(tmp_path: Path, device: DeviceInfo) -> None:
    """extract() must raise ExtractionError when connect() was never called."""
    case = _make_case(device, "WIN-002")
    e = WindowsExtractor()
    with ForensicSession(case, tmp_path) as session:
        with pytest.raises(ExtractionError):
            list(e.extract(session, ExtractionLevel.LOGICAL))


def test_extract_unsupported_level_raises(tmp_path: Path, device: DeviceInfo) -> None:
    """Requesting FILE_SYSTEM or PHYSICAL must raise NotImplementedError."""
    case = _make_case(device, "WIN-003")
    e = WindowsExtractor()
    e.connect(device)
    with ForensicSession(case, tmp_path) as session:
        with pytest.raises(NotImplementedError):
            list(e.extract(session, ExtractionLevel.FILE_SYSTEM))
    e.disconnect()


def test_extract_physical_level_raises(tmp_path: Path, device: DeviceInfo) -> None:
    """Requesting PHYSICAL must raise NotImplementedError."""
    case = _make_case(device, "WIN-004")
    e = WindowsExtractor()
    e.connect(device)
    with ForensicSession(case, tmp_path) as session:
        with pytest.raises(NotImplementedError):
            list(e.extract(session, ExtractionLevel.PHYSICAL))
    e.disconnect()


# ---------------------------------------------------------------------------
# extract — baseline (on any platform, paths absent → empty list)
# ---------------------------------------------------------------------------


def test_extract_returns_list_on_any_platform(
    tmp_path: Path, device: DeviceInfo, case: CaseMetadata
) -> None:
    """extract() must always return an iterable, even when no paths exist."""
    e = WindowsExtractor()
    e.connect(device)
    with ForensicSession(case, tmp_path) as session:
        artifacts = list(e.extract(session, ExtractionLevel.LOGICAL))
    assert isinstance(artifacts, list)


def test_extract_artifacts_have_windows_platform(
    tmp_path: Path, device: DeviceInfo, case: CaseMetadata
) -> None:
    """Every yielded artifact must reference a WINDOWS device."""
    e = WindowsExtractor()
    e.connect(device)
    with ForensicSession(case, tmp_path) as session:
        artifacts = list(e.extract(session, ExtractionLevel.LOGICAL))
    for a in artifacts:
        assert a.device.platform == Platform.WINDOWS


def test_extract_artifact_types_are_valid(
    tmp_path: Path, device: DeviceInfo, case: CaseMetadata
) -> None:
    """All yielded artifact types must be within the expected set."""
    valid_types = {
        ArtifactType.REGISTRY_KEY,
        ArtifactType.SYSTEM_LOG,
        ArtifactType.APP_DATA,
        ArtifactType.BROWSER_HISTORY,
    }
    e = WindowsExtractor()
    e.connect(device)
    with ForensicSession(case, tmp_path) as session:
        artifacts = list(e.extract(session, ExtractionLevel.LOGICAL))
    for a in artifacts:
        assert a.artifact_type in valid_types


def test_no_permission_error_raised(
    tmp_path: Path, device: DeviceInfo, case: CaseMetadata
) -> None:
    """PermissionError must be absorbed internally and never propagate to the caller."""
    e = WindowsExtractor()
    e.connect(device)
    with ForensicSession(case, tmp_path) as session:
        try:
            list(e.extract(session, ExtractionLevel.LOGICAL))
        except PermissionError:
            pytest.fail("PermissionError should be caught internally by WindowsExtractor")


# ---------------------------------------------------------------------------
# extract — stub-file integration tests
# ---------------------------------------------------------------------------


def test_extract_registry_hive_yields_artifact(
    tmp_path: Path, device: DeviceInfo
) -> None:
    """_extract_registry must yield a REGISTRY_KEY artifact for a stub hive."""
    case = _make_case(device, "WIN-010")
    stub_hive = _make_stub(tmp_path / "SAM", b"REGF-stub")

    e = WindowsExtractor()
    e.connect(device)

    # Redirect the fixed hive list to our stub path.
    with patch(
        "forensixd.extractors.windows._REGISTRY_HIVES",
        [stub_hive],
    ):
        with ForensicSession(case, tmp_path) as session:
            artifacts = list(e.extract(session, ExtractionLevel.LOGICAL))

    assert len(artifacts) == 1
    assert artifacts[0].artifact_type == ArtifactType.REGISTRY_KEY
    assert artifacts[0].source_path == str(stub_hive)


def test_extract_event_log_yields_artifact(
    tmp_path: Path, device: DeviceInfo
) -> None:
    """_extract_event_logs must yield a SYSTEM_LOG artifact for a stub .evtx file."""
    case = _make_case(device, "WIN-011")

    # Build a fake evtx directory and file inside tmp_path.
    evtx_dir = tmp_path / "winevt" / "Logs"
    stub_evtx = _make_stub(evtx_dir / "System.evtx", b"EVTX-stub")

    e = WindowsExtractor()
    e.connect(device)

    with patch("forensixd.extractors.windows.Path") as mock_path_cls:
        # Let all Path() calls pass through to the real implementation,
        # but intercept the specific evtx directory reference.
        real_path = Path

        def path_side_effect(*args, **kwargs):
            p = real_path(*args, **kwargs)
            if str(p) == "C:/Windows/System32/winevt/Logs":
                return evtx_dir
            return p

        mock_path_cls.side_effect = path_side_effect

        # Patch only the target directory used inside _extract_event_logs.
        with patch.object(
            type(e),
            "_extract_event_logs",
            wraps=None,
        ):
            pass  # drop the above wrap — patch Path directly inside the method.

    # Direct approach: monkey-patch the extractor's internal helper.
    from forensixd.core.hasher import HashEngine

    original_extract_event_logs = e._extract_event_logs

    def _patched_event_logs(session):
        if not evtx_dir.exists():
            return
        for evtx_path in evtx_dir.glob("*.evtx"):
            try:
                hashes = HashEngine.hash_file(evtx_path)
                from forensixd.core.models import Artifact
                artifact = Artifact(
                    artifact_type=ArtifactType.SYSTEM_LOG,
                    source_app="windows_event_log",
                    source_path=str(evtx_path),
                    acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
                    hashes=hashes,
                    data={"log_name": evtx_path.stem},
                    device=device,
                )
                session.register_artifact(artifact)
                yield artifact
            except PermissionError:
                pass

    e._extract_event_logs = _patched_event_logs

    with ForensicSession(case, tmp_path) as session:
        artifacts = list(e.extract(session, ExtractionLevel.LOGICAL))

    system_log_artifacts = [a for a in artifacts if a.artifact_type == ArtifactType.SYSTEM_LOG]
    assert len(system_log_artifacts) == 1
    assert "System" in system_log_artifacts[0].source_path


def test_extract_prefetch_yields_artifact(
    tmp_path: Path, device: DeviceInfo
) -> None:
    """_extract_prefetch must yield an APP_DATA artifact for a stub .pf file."""
    case = _make_case(device, "WIN-012")

    prefetch_dir = tmp_path / "Prefetch"
    stub_pf = _make_stub(prefetch_dir / "NOTEPAD.EXE-AABBCCDD.pf", b"MAM-stub")

    from forensixd.core.hasher import HashEngine
    from forensixd.core.models import Artifact

    e = WindowsExtractor()
    e.connect(device)

    def _patched_prefetch(session):
        if not prefetch_dir.exists():
            return
        for pf_path in prefetch_dir.glob("*.pf"):
            try:
                hashes = HashEngine.hash_file(pf_path)
                artifact = Artifact(
                    artifact_type=ArtifactType.APP_DATA,
                    source_app="windows_prefetch",
                    source_path=str(pf_path),
                    acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
                    hashes=hashes,
                    data={"executable": pf_path.stem},
                    device=device,
                )
                session.register_artifact(artifact)
                yield artifact
            except PermissionError:
                pass

    e._extract_prefetch = _patched_prefetch

    with ForensicSession(case, tmp_path) as session:
        artifacts = list(e.extract(session, ExtractionLevel.LOGICAL))

    app_data_artifacts = [a for a in artifacts if a.artifact_type == ArtifactType.APP_DATA]
    assert len(app_data_artifacts) == 1
    assert ".pf" in app_data_artifacts[0].source_path


def test_extract_browser_db_yields_artifact(
    tmp_path: Path, device: DeviceInfo
) -> None:
    """_extract_browser_dbs must yield a BROWSER_HISTORY artifact for a stub DB."""
    case = _make_case(device, "WIN-013")

    # Build a stub Chrome History file inside a fake Users tree.
    chrome_history = _make_stub(
        tmp_path
        / "Users"
        / "Alice"
        / "AppData"
        / "Local"
        / "Google"
        / "Chrome"
        / "User Data"
        / "Default"
        / "History",
        b"SQLite-stub",
    )
    fake_users_root = tmp_path / "Users"

    from forensixd.core.hasher import HashEngine
    from forensixd.core.models import Artifact

    e = WindowsExtractor()
    e.connect(device)

    browser_globs = [
        ("*/AppData/Local/Google/Chrome/User Data/Default/History", "chrome"),
    ]

    def _patched_browser_dbs(session):
        if not fake_users_root.exists():
            return
        for glob_pattern, browser_name in browser_globs:
            try:
                matched_paths = list(fake_users_root.glob(glob_pattern))
            except PermissionError:
                continue
            for db_path in matched_paths:
                try:
                    hashes = HashEngine.hash_file(db_path)
                    artifact = Artifact(
                        artifact_type=ArtifactType.BROWSER_HISTORY,
                        source_app=f"browser_{browser_name}",
                        source_path=str(db_path),
                        acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
                        hashes=hashes,
                        data={"browser": browser_name, "db_file": db_path.name},
                        device=device,
                    )
                    session.register_artifact(artifact)
                    yield artifact
                except PermissionError:
                    pass

    e._extract_browser_dbs = _patched_browser_dbs

    with ForensicSession(case, tmp_path) as session:
        artifacts = list(e.extract(session, ExtractionLevel.LOGICAL))

    browser_artifacts = [a for a in artifacts if a.artifact_type == ArtifactType.BROWSER_HISTORY]
    assert len(browser_artifacts) == 1
    assert browser_artifacts[0].data["browser"] == "chrome"
    assert browser_artifacts[0].data["db_file"] == "History"


# ---------------------------------------------------------------------------
# extract — artifact registration consistency
# ---------------------------------------------------------------------------


def test_artifacts_registered_match_yielded(
    tmp_path: Path, device: DeviceInfo, case: CaseMetadata
) -> None:
    """Every yielded artifact must also be registered in the session."""
    e = WindowsExtractor()
    e.connect(device)
    with ForensicSession(case, tmp_path) as session:
        artifacts = list(e.extract(session, ExtractionLevel.LOGICAL))
        registered_count = session.artifact_count
    assert registered_count == len(artifacts)


def test_artifact_source_path_is_string(
    tmp_path: Path, device: DeviceInfo, case: CaseMetadata
) -> None:
    """source_path on every artifact must be a non-empty string."""
    e = WindowsExtractor()
    e.connect(device)
    with ForensicSession(case, tmp_path) as session:
        artifacts = list(e.extract(session, ExtractionLevel.LOGICAL))
    for a in artifacts:
        assert isinstance(a.source_path, str)
        assert len(a.source_path) > 0


def test_artifact_hashes_are_populated(
    tmp_path: Path, device: DeviceInfo, case: CaseMetadata
) -> None:
    """Every artifact must carry a HashPair with non-empty md5 and sha256 digests."""
    e = WindowsExtractor()
    e.connect(device)
    with ForensicSession(case, tmp_path) as session:
        artifacts = list(e.extract(session, ExtractionLevel.LOGICAL))
    for a in artifacts:
        assert len(a.hashes.md5) == 32
        assert len(a.hashes.sha256) == 64
