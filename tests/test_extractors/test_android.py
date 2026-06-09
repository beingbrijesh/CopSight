"""
tests.test_extractors.test_android
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Tests for :class:`forensixd.extractors.android.AndroidExtractor`.

All tests that exercise :meth:`connect` patch ``ADB_AVAILABLE`` to ``True``
so the suite passes in environments where ``adb_shell`` is not installed.
Tests that verify the root-guard for FILE_SYSTEM extraction rely on the
default ``is_rooted=False`` value on :class:`~forensixd.core.models.DeviceInfo`
rather than attempting to override the ``_is_rooted`` property directly.
"""

import pytest
from datetime import timedelta, datetime, timezone
from unittest.mock import MagicMock, patch

from forensixd.extractors.android import AndroidExtractor
from forensixd.core.models import DeviceInfo, Platform, ExtractionLevel
from forensixd.core.exceptions import ExtractionError


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def device() -> DeviceInfo:
    """Return a non-rooted Android device descriptor."""
    return DeviceInfo(platform=Platform.ANDROID, device_id="emulator-5554")


@pytest.fixture
def rooted_device() -> DeviceInfo:
    """Return a rooted Android device descriptor."""
    return DeviceInfo(platform=Platform.ANDROID, device_id="rooted-5556", is_rooted=True)


@pytest.fixture
def extractor() -> AndroidExtractor:
    """Return a fresh, unconnected :class:`AndroidExtractor`."""
    return AndroidExtractor()


def _make_case(device: DeviceInfo, case_number: str = "AND-001"):
    """Build a minimal :class:`~forensixd.core.models.CaseMetadata` for *device*."""
    from forensixd.core.models import CaseMetadata, ConsentType

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


def test_is_available_returns_bool(extractor: AndroidExtractor) -> None:
    """is_available() must always return a plain bool."""
    result = extractor.is_available()
    assert isinstance(result, bool)


# ---------------------------------------------------------------------------
# supported_levels
# ---------------------------------------------------------------------------


def test_supported_levels_contains_logical(extractor: AndroidExtractor) -> None:
    """LOGICAL must be in the declared supported levels."""
    levels = extractor.supported_levels()
    assert ExtractionLevel.LOGICAL in levels


def test_supported_levels_contains_file_system(extractor: AndroidExtractor) -> None:
    """FILE_SYSTEM must be in the declared supported levels."""
    levels = extractor.supported_levels()
    assert ExtractionLevel.FILE_SYSTEM in levels


def test_supported_levels_returns_list(extractor: AndroidExtractor) -> None:
    """supported_levels() must return a list instance."""
    assert isinstance(extractor.supported_levels(), list)


# ---------------------------------------------------------------------------
# connect / disconnect lifecycle
# ---------------------------------------------------------------------------


def test_connect_stores_device(extractor: AndroidExtractor, device: DeviceInfo) -> None:
    """connect() must store the DeviceInfo on _device."""
    with patch("forensixd.extractors.android.ADB_AVAILABLE", True):
        extractor.connect(device)
        assert extractor._device == device
        extractor.disconnect()


def test_connect_sets_connected_flag(extractor: AndroidExtractor, device: DeviceInfo) -> None:
    """connect() must set _connected to True."""
    with patch("forensixd.extractors.android.ADB_AVAILABLE", True):
        extractor.connect(device)
        assert extractor._connected is True
        extractor.disconnect()


def test_disconnect_sets_not_connected(extractor: AndroidExtractor, device: DeviceInfo) -> None:
    """disconnect() must set _connected to False."""
    with patch("forensixd.extractors.android.ADB_AVAILABLE", True):
        extractor.connect(device)
        extractor.disconnect()
        assert extractor._connected is False


def test_disconnect_is_idempotent(extractor: AndroidExtractor) -> None:
    """disconnect() must not raise even when never connected."""
    extractor.disconnect()  # no connect beforehand — must not raise
    assert extractor._connected is False


def test_connect_raises_when_adb_unavailable(
    extractor: AndroidExtractor, device: DeviceInfo
) -> None:
    """connect() must raise ExtractionError when adb_shell is absent."""
    with patch("forensixd.extractors.android.ADB_AVAILABLE", False):
        with pytest.raises(ExtractionError):
            extractor.connect(device)


# ---------------------------------------------------------------------------
# LOGICAL extraction
# ---------------------------------------------------------------------------


def test_extract_logical_yields_artifacts(
    tmp_path, device: DeviceInfo
) -> None:
    """LOGICAL extraction must yield at least one Artifact and register each one."""
    from forensixd.core.session import ForensicSession

    case = _make_case(device, "AND-001")

    with patch("forensixd.extractors.android.ADB_AVAILABLE", True):
        extractor = AndroidExtractor()
        extractor.connect(device)
        with ForensicSession(case, tmp_path) as session:
            artifacts = list(extractor.extract(session, ExtractionLevel.LOGICAL))

    assert isinstance(artifacts, list)
    assert len(artifacts) > 0


def test_extract_logical_artifact_source_app(
    tmp_path, device: DeviceInfo
) -> None:
    """All LOGICAL artifacts must carry source_app='adb_logical'."""
    from forensixd.core.session import ForensicSession

    case = _make_case(device, "AND-004")

    with patch("forensixd.extractors.android.ADB_AVAILABLE", True):
        extractor = AndroidExtractor()
        extractor.connect(device)
        with ForensicSession(case, tmp_path) as session:
            artifacts = list(extractor.extract(session, ExtractionLevel.LOGICAL))

    for a in artifacts:
        assert a.source_app == "adb_logical"


def test_extract_logical_artifact_method_field(
    tmp_path, device: DeviceInfo
) -> None:
    """All LOGICAL artifacts must have data['method'] == 'adb_logical'."""
    from forensixd.core.session import ForensicSession

    case = _make_case(device, "AND-005")

    with patch("forensixd.extractors.android.ADB_AVAILABLE", True):
        extractor = AndroidExtractor()
        extractor.connect(device)
        with ForensicSession(case, tmp_path) as session:
            artifacts = list(extractor.extract(session, ExtractionLevel.LOGICAL))

    for a in artifacts:
        assert a.data.get("method") == "adb_logical"


def test_extract_logical_artifacts_registered_in_session(
    tmp_path, device: DeviceInfo
) -> None:
    """Each LOGICAL artifact yielded must be registered in the session."""
    from forensixd.core.session import ForensicSession

    case = _make_case(device, "AND-006")

    with patch("forensixd.extractors.android.ADB_AVAILABLE", True):
        extractor = AndroidExtractor()
        extractor.connect(device)
        with ForensicSession(case, tmp_path) as session:
            artifacts = list(extractor.extract(session, ExtractionLevel.LOGICAL))
            registered_count = session.artifact_count

    assert registered_count == len(artifacts)


# ---------------------------------------------------------------------------
# FILE_SYSTEM extraction — root guard
# ---------------------------------------------------------------------------


def test_extract_fs_without_root_raises(
    extractor: AndroidExtractor, device: DeviceInfo, tmp_path
) -> None:
    """FILE_SYSTEM extraction must raise ExtractionError on a non-rooted device."""
    from forensixd.core.session import ForensicSession

    # device fixture has is_rooted=False by default.
    case = _make_case(device, "AND-002")

    with patch("forensixd.extractors.android.ADB_AVAILABLE", True):
        extractor.connect(device)
        with ForensicSession(case, tmp_path) as session:
            with pytest.raises(ExtractionError):
                list(extractor.extract(session, ExtractionLevel.FILE_SYSTEM))


def test_extract_fs_with_root_yields_artifacts(
    tmp_path, rooted_device: DeviceInfo
) -> None:
    """FILE_SYSTEM extraction on a rooted device must yield at least one Artifact."""
    from forensixd.core.session import ForensicSession

    case = _make_case(rooted_device, "AND-007")

    with patch("forensixd.extractors.android.ADB_AVAILABLE", True):
        extractor = AndroidExtractor()
        extractor.connect(rooted_device)
        with ForensicSession(case, tmp_path) as session:
            artifacts = list(extractor.extract(session, ExtractionLevel.FILE_SYSTEM))

    assert len(artifacts) > 0


# ---------------------------------------------------------------------------
# Unsupported extraction level
# ---------------------------------------------------------------------------


def test_extract_unsupported_level_raises(
    extractor: AndroidExtractor, device: DeviceInfo, tmp_path
) -> None:
    """Requesting PHYSICAL extraction must raise NotImplementedError."""
    from forensixd.core.session import ForensicSession

    case = _make_case(device, "AND-003")

    with patch("forensixd.extractors.android.ADB_AVAILABLE", True):
        extractor.connect(device)
        with ForensicSession(case, tmp_path) as session:
            with pytest.raises(NotImplementedError):
                list(extractor.extract(session, ExtractionLevel.PHYSICAL))
