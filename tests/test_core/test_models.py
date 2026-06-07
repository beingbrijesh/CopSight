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
