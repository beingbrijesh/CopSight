import zipfile
import pytest
from datetime import timedelta, datetime, timezone

from forensixd.writers.ufdr_writer import UFDRWriter
from forensixd.core.models import (
    SessionLog,
    CaseMetadata,
    DeviceInfo,
    Platform,
    ConsentType,
    Artifact,
    ArtifactType,
    HashPair,
)


@pytest.fixture
def device():
    return DeviceInfo(platform=Platform.ANDROID, device_id="ufdr-test")


@pytest.fixture
def case(device):
    return CaseMetadata(
        case_number="CopSight AI-001",
        court_order_ref="CO-001",
        examiner_id="EX-001",
        jurisdiction="TEST",
        consent_type=ConsentType.COURT_ORDER,
        authorized_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        device=device,
    )


@pytest.fixture
def session(case):
    return SessionLog(
        session_id="sess-ufdr",
        case=case,
        started_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        root_hash="d" * 64,
        is_sealed=True,
    )


@pytest.fixture
def artifact(device):
    return Artifact(
        artifact_type=ArtifactType.MESSAGE,
        source_app="com.whatsapp",
        source_path="/sdcard/WhatsApp/msgstore.db",
        acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        hashes=HashPair(md5="a" * 32, sha256="b" * 64),
        device=device,
    )


def test_build_creates_ufdr_file(tmp_path, session, artifact):
    out = tmp_path / "test.ufdr"
    UFDRWriter(out, session).build([artifact])
    assert out.exists()


def test_output_is_valid_zip(tmp_path, session, artifact):
    out = tmp_path / "test.ufdr"
    UFDRWriter(out, session).build([artifact])
    assert zipfile.is_zipfile(str(out))


def test_report_xml_in_zip(tmp_path, session, artifact):
    out = tmp_path / "test.ufdr"
    UFDRWriter(out, session).build([artifact])
    with zipfile.ZipFile(str(out)) as z:
        assert "report.xml" in z.namelist()


def test_index_xml_in_zip(tmp_path, session, artifact):
    out = tmp_path / "test.ufdr"
    UFDRWriter(out, session).build([artifact])
    with zipfile.ZipFile(str(out)) as z:
        assert "index.xml" in z.namelist()


def test_report_xml_contains_case_number(tmp_path, session, artifact):
    out = tmp_path / "test.ufdr"
    UFDRWriter(out, session).build([artifact])
    with zipfile.ZipFile(str(out)) as z:
        content = z.read("report.xml").decode()
    assert "CopSight AI-001" in content


def test_index_xml_contains_artifact_id(tmp_path, session, artifact):
    out = tmp_path / "test.ufdr"
    UFDRWriter(out, session).build([artifact])
    with zipfile.ZipFile(str(out)) as z:
        content = z.read("index.xml").decode()
    assert artifact.artifact_id in content


def test_index_contains_hashes(tmp_path, session, artifact):
    out = tmp_path / "test.ufdr"
    UFDRWriter(out, session).build([artifact])
    with zipfile.ZipFile(str(out)) as z:
        content = z.read("index.xml").decode()
    assert artifact.hashes.md5 in content
    assert artifact.hashes.sha256 in content


def test_empty_artifacts_still_valid_zip(tmp_path, session):
    out = tmp_path / "empty.ufdr"
    UFDRWriter(out, session).build([])
    assert zipfile.is_zipfile(str(out))


def test_ufdr_extension_added_if_missing(tmp_path, session):
    out = tmp_path / "test"
    result = UFDRWriter(out, session).build([])
    assert str(result).endswith(".ufdr")
