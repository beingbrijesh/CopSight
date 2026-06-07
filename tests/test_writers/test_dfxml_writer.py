import pytest
from datetime import timedelta, datetime, timezone
from lxml import etree

from forensixd.writers.dfxml_writer import DFXMLWriter
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
    return DeviceInfo(platform=Platform.ANDROID, device_id="dfxml-test")


@pytest.fixture
def case(device):
    return CaseMetadata(
        case_number="DFXML-001",
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
        session_id="sess-001",
        case=case,
        started_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        root_hash="c" * 64,
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


def test_finalize_creates_file(tmp_path, session):
    out = tmp_path / "test.dfxml"
    DFXMLWriter(out, session).finalize()
    assert out.exists()


def test_output_is_valid_xml(tmp_path, session):
    out = tmp_path / "test.dfxml"
    DFXMLWriter(out, session).finalize()
    etree.parse(str(out))  # must not raise


def test_root_element_has_dfxml_in_tag(tmp_path, session):
    out = tmp_path / "test.dfxml"
    DFXMLWriter(out, session).finalize()
    root = etree.parse(str(out)).getroot()
    assert "dfxml" in root.tag.lower()


def test_artifact_creates_fileobject(tmp_path, session, artifact):
    out = tmp_path / "test.dfxml"
    w = DFXMLWriter(out, session)
    w.append_artifact(artifact)
    w.finalize()
    assert "fileobject" in out.read_text()


def test_md5_in_output(tmp_path, session, artifact):
    out = tmp_path / "test.dfxml"
    w = DFXMLWriter(out, session)
    w.append_artifact(artifact)
    w.finalize()
    assert artifact.hashes.md5 in out.read_text()


def test_sha256_in_output(tmp_path, session, artifact):
    out = tmp_path / "test.dfxml"
    w = DFXMLWriter(out, session)
    w.append_artifact(artifact)
    w.finalize()
    assert artifact.hashes.sha256 in out.read_text()


def test_case_number_in_output(tmp_path, session):
    out = tmp_path / "test.dfxml"
    DFXMLWriter(out, session).finalize()
    assert "DFXML-001" in out.read_text()


def test_five_artifacts_five_fileobjects(tmp_path, session, device):
    out = tmp_path / "test.dfxml"
    w = DFXMLWriter(out, session)
    for i in range(5):
        w.append_artifact(
            Artifact(
                artifact_type=ArtifactType.MEDIA,
                source_app="t",
                source_path=f"/t/{i}.jpg",
                acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
                hashes=HashPair(md5="a" * 32, sha256="b" * 64),
                device=device,
            )
        )
    w.finalize()
    assert len(etree.parse(str(out)).findall(".//{*}fileobject")) == 5


def test_output_is_utf8(tmp_path, session):
    out = tmp_path / "test.dfxml"
    DFXMLWriter(out, session).finalize()
    out.read_text(encoding="utf-8")  # must not raise
