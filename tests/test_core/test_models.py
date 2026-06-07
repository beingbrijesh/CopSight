"""Tests for forensixd.core.models"""

import pytest
from datetime import timedelta, datetime, timezone
from pydantic import ValidationError

from forensixd.core.models import (
    Platform,
    ExtractionLevel,
    ArtifactType,
    ConsentType,
    HashPair,
    DeviceInfo,
    CaseMetadata,
    Artifact,
    AcquisitionEvent,
    SessionLog,
    ParsedRecord,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def sample_device():
    return DeviceInfo(platform=Platform.ANDROID, device_id="test-001")


@pytest.fixture
def sample_case(sample_device):
    return CaseMetadata(
        case_number="CASE-001",
        court_order_ref="CO-2024-001",
        examiner_id="EX-001",
        jurisdiction="TEST-JURISDICTION",
        consent_type=ConsentType.COURT_ORDER,
        authorized_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        device=sample_device,
    )


# ---------------------------------------------------------------------------
# Enum tests
# ---------------------------------------------------------------------------


def test_platform_enum_values() -> None:
    # Enum values are uppercase strings as defined in Platform(str, Enum).
    assert Platform.ANDROID == "ANDROID"
    assert Platform.IOS == "IOS"
    assert Platform.WINDOWS == "WINDOWS"


# ---------------------------------------------------------------------------
# HashPair tests
# ---------------------------------------------------------------------------


def test_hash_pair_valid() -> None:
    hp = HashPair(md5="a" * 32, sha256="b" * 64)
    assert hp.md5 == "a" * 32


def test_hash_pair_invalid_md5_length() -> None:
    with pytest.raises(ValidationError):
        HashPair(md5="short", sha256="b" * 64)


def test_hash_pair_invalid_sha256_length() -> None:
    with pytest.raises(ValidationError):
        HashPair(md5="a" * 32, sha256="tooshort")


# ---------------------------------------------------------------------------
# DeviceInfo tests
# ---------------------------------------------------------------------------


def test_device_info_defaults() -> None:
    d = DeviceInfo(platform=Platform.IOS, device_id="iphone-001")
    assert d.is_rooted is False
    assert d.model is None


def test_device_info_is_frozen(sample_device) -> None:
    with pytest.raises(Exception):
        sample_device.device_id = "hacked"


# ---------------------------------------------------------------------------
# CaseMetadata tests
# ---------------------------------------------------------------------------


def test_case_metadata_strips_whitespace(sample_device) -> None:
    c = CaseMetadata(
        case_number="  CASE-002  ",
        court_order_ref="CO-002",
        examiner_id="EX-002",
        jurisdiction="JURISDICTION",
        consent_type=ConsentType.VOLUNTARY,
        authorized_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        device=sample_device,
    )
    assert c.case_number == "CASE-002"


def test_case_metadata_rejects_empty_case_number(sample_device) -> None:
    with pytest.raises(ValidationError):
        CaseMetadata(
            case_number="",
            court_order_ref="CO-001",
            examiner_id="EX-001",
            jurisdiction="J",
            consent_type=ConsentType.COURT_ORDER,
            authorized_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
            device=sample_device,
        )


def test_case_metadata_is_frozen(sample_case) -> None:
    with pytest.raises(Exception):
        sample_case.case_number = "MODIFIED"


# ---------------------------------------------------------------------------
# Artifact tests
# ---------------------------------------------------------------------------


def test_artifact_is_mutable(sample_device) -> None:
    from uuid import uuid4

    hp = HashPair(md5="a" * 32, sha256="b" * 64)
    a = Artifact(
        artifact_type=ArtifactType.MESSAGE,
        source_app="test",
        source_path="/test/path",
        acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        hashes=hp,
        device=sample_device,
    )
    a.data["key"] = "value"
    assert a.data["key"] == "value"


# ---------------------------------------------------------------------------
# ParsedRecord tests
# ---------------------------------------------------------------------------


def test_parsed_record_confidence_bounds(sample_device) -> None:
    hp = HashPair(md5="a" * 32, sha256="b" * 64)
    with pytest.raises(ValidationError):
        ParsedRecord(
            record_type=ArtifactType.MESSAGE,
            source_artifact_id="some-id",
            parsed_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
            confidence=1.5,
            fields={},
            app_name="TestApp",
        )


def test_parsed_record_confidence_zero_valid() -> None:
    r = ParsedRecord(
        record_type=ArtifactType.EMAIL,
        source_artifact_id="id-001",
        parsed_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        confidence=0.0,
        fields={"body": "test"},
        app_name="Email",
    )
    assert r.confidence == 0.0


# ---------------------------------------------------------------------------
# SessionLog tests
# ---------------------------------------------------------------------------


def test_session_log_mutable(sample_case) -> None:
    log = SessionLog(
        session_id="sess-001",
        case=sample_case,
        started_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
    )
    log.is_sealed = True
    assert log.is_sealed


# ---------------------------------------------------------------------------
# Type and validation error tests (for coverage)
# ---------------------------------------------------------------------------


def test_case_metadata_invalid_types(sample_device) -> None:
    # case_number not a string
    with pytest.raises(ValidationError, match="case_number must be a string"):
        CaseMetadata(
            case_number=123,  # type: ignore
            court_order_ref="CO-2024-001",
            examiner_id="EX-001",
            jurisdiction="TEST-JURISDICTION",
            consent_type=ConsentType.COURT_ORDER,
            authorized_at="2024-01-01T00:00:00Z",
            device=sample_device,
        )

    # court_order_ref not a string
    with pytest.raises(ValidationError, match="court_order_ref must be a string"):
        CaseMetadata(
            case_number="CASE-123",
            court_order_ref=456,  # type: ignore
            examiner_id="EX-001",
            jurisdiction="TEST-JURISDICTION",
            consent_type=ConsentType.COURT_ORDER,
            authorized_at="2024-01-01T00:00:00Z",
            device=sample_device,
        )

    # empty after stripping
    with pytest.raises(ValidationError, match="court_order_ref cannot be empty after stripping"):
        CaseMetadata(
            case_number="CASE-123",
            court_order_ref="   ",
            examiner_id="EX-001",
            jurisdiction="TEST-JURISDICTION",
            consent_type=ConsentType.COURT_ORDER,
            authorized_at="2024-01-01T00:00:00Z",
            device=sample_device,
        )

    # Invalid datetime
    with pytest.raises(ValidationError, match="authorized_at must be a datetime or ISO-8601 string"):
        CaseMetadata(
            case_number="CASE-123",
            court_order_ref="CO-001",
            examiner_id="EX-001",
            jurisdiction="TEST-JURISDICTION",
            consent_type=ConsentType.COURT_ORDER,
            authorized_at=1234567890,  # type: ignore
            device=sample_device,
        )


def test_datetime_coercion_to_ist(sample_device, sample_case) -> None:
    from zoneinfo import ZoneInfo
    ist = ZoneInfo("Asia/Kolkata")

    # 1. ISO string
    cm = CaseMetadata(
        case_number="CASE-001",
        court_order_ref="CO-001",
        examiner_id="EX-001",
        jurisdiction="J",
        consent_type=ConsentType.COURT_ORDER,
        authorized_at="2024-01-01T12:00:00+00:00",
        device=sample_device,
    )
    assert cm.authorized_at.tzinfo == ist

    # 2. Naive datetime
    naive_dt = datetime(2024, 1, 1, 12, 0)
    evt = AcquisitionEvent(
        event_type="TEST",
        occurred_at=naive_dt,
        actor="System",
        description="Test event",
    )
    assert evt.occurred_at.tzinfo == ist
    assert evt.occurred_at.hour == 12

    hp = HashPair(md5="a"*32, sha256="b"*64)
    art = Artifact(
        artifact_type=ArtifactType.MESSAGE,
        source_app="test",
        source_path="/",
        acquired_at=naive_dt,
        hashes=hp,
        device=sample_device,
    )
    assert art.acquired_at.tzinfo == ist

    log = SessionLog(
        session_id="s1",
        case=sample_case,
        started_at=naive_dt,
        ended_at="2024-01-01T15:00:00+00:00"
    )
    assert log.started_at.tzinfo == ist
    assert log.ended_at is not None and log.ended_at.tzinfo == ist

    pr = ParsedRecord(
        record_type=ArtifactType.MESSAGE,
        source_artifact_id="1",
        parsed_at=naive_dt,
        confidence=1.0,
        fields={},
        app_name="A"
    )
    assert pr.parsed_at.tzinfo == ist


def test_invalid_datetime_types_all_models(sample_device, sample_case) -> None:
    hp = HashPair(md5="a"*32, sha256="b"*64)
    with pytest.raises(ValidationError, match="acquired_at must be a datetime or ISO-8601 string"):
        Artifact(artifact_type=ArtifactType.MESSAGE, source_app="test", source_path="/", acquired_at=123, hashes=hp, device=sample_device)  # type: ignore

    with pytest.raises(ValidationError, match="occurred_at must be a datetime or ISO-8601 string"):
        AcquisitionEvent(event_type="T", occurred_at=123, actor="A", description="D")  # type: ignore

    with pytest.raises(ValidationError, match="Timestamp fields must be datetime or ISO-8601 string"):
        SessionLog(session_id="1", case=sample_case, started_at=123)  # type: ignore

    with pytest.raises(ValidationError, match="parsed_at must be a datetime or ISO-8601 string"):
        ParsedRecord(record_type=ArtifactType.MESSAGE, source_artifact_id="1", parsed_at=123, confidence=1.0, fields={}, app_name="A")  # type: ignore

