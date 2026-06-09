"""
tests/test_core/test_session.py
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Pytest test suite for forensixd.core.session.ForensicSession.
"""

import pytest
from datetime import timedelta, datetime, timezone
from pathlib import Path

from forensixd.core.session import ForensicSession
from forensixd.core.models import (
    CaseMetadata,
    DeviceInfo,
    Platform,
    ConsentType,
    Artifact,
    ArtifactType,
    HashPair,
    SessionLog,
)
from forensixd.core.exceptions import SessionAlreadyClosedError


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def device() -> DeviceInfo:
    """Minimal Android device descriptor for test cases."""
    return DeviceInfo(platform=Platform.ANDROID, device_id="test-device-001")


@pytest.fixture
def case_meta(device: DeviceInfo) -> CaseMetadata:
    """CaseMetadata bound to the test device fixture."""
    return CaseMetadata(
        case_number="TEST-CASE-001",
        court_order_ref="CO-TEST-001",
        examiner_id="EXAMINER-001",
        jurisdiction="TEST-JURISDICTION",
        consent_type=ConsentType.COURT_ORDER,
        authorized_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        device=device,
    )


@pytest.fixture
def sample_artifact(device: DeviceInfo) -> Artifact:
    """A minimal Artifact with deterministic hash values."""
    return Artifact(
        artifact_type=ArtifactType.APP_DATA,
        source_app="test_app",
        source_path="/sdcard/test.db",
        acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        hashes=HashPair(md5="a" * 32, sha256="b" * 64),
        device=device,
    )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_session_creates_output_directory(tmp_path: Path, case_meta: CaseMetadata) -> None:
    """ForensicSession must create <output_dir>/<case_number> on construction."""
    with ForensicSession(case_meta, tmp_path) as s:
        s.close()
    assert (tmp_path / "TEST-CASE-001").exists()


def test_session_creates_audit_log(tmp_path: Path, case_meta: CaseMetadata) -> None:
    """Exactly one .audit.jsonl file must exist inside the case directory."""
    with ForensicSession(case_meta, tmp_path) as s:
        s.close()
    audit_files = list((tmp_path / "TEST-CASE-001").glob("*.audit.jsonl"))
    assert len(audit_files) == 1


def test_session_id_is_unique(tmp_path: Path, case_meta: CaseMetadata) -> None:
    """Each ForensicSession instance must receive a distinct session_id."""
    ids: set[str] = set()
    for _ in range(3):
        with ForensicSession(case_meta, tmp_path) as s:
            ids.add(s.session_id)
            s.close()
    assert len(ids) == 3


def test_register_artifact_increments_count(
    tmp_path: Path, case_meta: CaseMetadata, sample_artifact: Artifact
) -> None:
    """artifact_count must reflect the number of registered artifacts."""
    with ForensicSession(case_meta, tmp_path) as s:
        assert s.artifact_count == 0
        s.register_artifact(sample_artifact)
        assert s.artifact_count == 1
        s.close()


def test_close_returns_session_log(tmp_path: Path, case_meta: CaseMetadata) -> None:
    """close() must return a sealed SessionLog instance."""
    with ForensicSession(case_meta, tmp_path) as s:
        log = s.close()
    assert isinstance(log, SessionLog)
    assert log.is_sealed is True


def test_close_session_log_has_root_hash(tmp_path: Path, case_meta: CaseMetadata) -> None:
    """The SessionLog returned by close() must carry a 64-character root hash."""
    with ForensicSession(case_meta, tmp_path) as s:
        log = s.close()
    assert log.root_hash is not None
    assert len(log.root_hash) == 64


def test_session_log_contains_registered_artifacts(
    tmp_path: Path, case_meta: CaseMetadata, sample_artifact: Artifact
) -> None:
    """Artifacts registered before close() must appear in the SessionLog."""
    with ForensicSession(case_meta, tmp_path) as s:
        s.register_artifact(sample_artifact)
        log = s.close()
    assert len(log.artifacts) == 1
    assert log.artifacts[0].artifact_id == sample_artifact.artifact_id


def test_double_close_raises(tmp_path: Path, case_meta: CaseMetadata) -> None:
    """Calling close() on an already-closed session must raise SessionAlreadyClosedError."""
    s = ForensicSession(case_meta, tmp_path)
    s.close()
    with pytest.raises(SessionAlreadyClosedError):
        s.close()


def test_register_after_close_raises(
    tmp_path: Path, case_meta: CaseMetadata, sample_artifact: Artifact
) -> None:
    """register_artifact() must raise SessionAlreadyClosedError after close()."""
    with ForensicSession(case_meta, tmp_path) as s:
        s.close()
    with pytest.raises(SessionAlreadyClosedError):
        s.register_artifact(sample_artifact)


def test_context_manager_auto_closes(tmp_path: Path, case_meta: CaseMetadata) -> None:
    """Exiting the context manager without an explicit close() must seal the session."""
    with ForensicSession(case_meta, tmp_path) as s:
        pass  # __exit__ should call close()
    assert s.is_closed is True


def test_record_event_after_close_raises(tmp_path: Path, case_meta: CaseMetadata) -> None:
    """record_event() must raise SessionAlreadyClosedError after close()."""
    with ForensicSession(case_meta, tmp_path) as s:
        s.close()
    with pytest.raises(SessionAlreadyClosedError):
        s.record_event("TEST", "should fail")


def test_root_hash_changes_with_different_artifacts(
    tmp_path: Path, case_meta: CaseMetadata, device: DeviceInfo
) -> None:
    """Sessions with different artifact hashes must produce different root hashes."""
    hp1 = HashPair(md5="a" * 32, sha256="a" * 64)
    hp2 = HashPair(md5="b" * 32, sha256="b" * 64)
    a1 = Artifact(
        artifact_type=ArtifactType.MEDIA,
        source_app="t",
        source_path="/p1",
        acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        hashes=hp1,
        device=device,
    )
    a2 = Artifact(
        artifact_type=ArtifactType.MEDIA,
        source_app="t",
        source_path="/p2",
        acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        hashes=hp2,
        device=device,
    )
    with ForensicSession(case_meta, tmp_path) as s1:
        s1.register_artifact(a1)
        log1 = s1.close()
    with ForensicSession(case_meta, tmp_path) as s2:
        s2.register_artifact(a2)
        log2 = s2.close()
    assert log1.root_hash != log2.root_hash
