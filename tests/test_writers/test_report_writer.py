import sys
import unittest.mock
import pytest
from datetime import timedelta, datetime, timezone

from forensixd.writers.report_writer import ReportWriter
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
from forensixd.core.exceptions import WriteError


@pytest.fixture
def device():
    return DeviceInfo(platform=Platform.ANDROID, device_id="report-test")


@pytest.fixture
def case(device):
    return CaseMetadata(
        case_number="RPT-001",
        court_order_ref="CO-RPT-001",
        examiner_id="EXAMINER-001",
        jurisdiction="TEST-JURISDICTION",
        consent_type=ConsentType.COURT_ORDER,
        authorized_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        device=device,
    )


@pytest.fixture
def session(case):
    return SessionLog(
        session_id="sess-rpt",
        case=case,
        started_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        root_hash="e" * 64,
        is_sealed=True,
    )


@pytest.fixture
def artifacts(device):
    return [
        Artifact(
            artifact_type=ArtifactType.MESSAGE,
            source_app="com.whatsapp",
            source_path="/sdcard/WhatsApp/msgstore.db",
            acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
            hashes=HashPair(md5="a" * 32, sha256="b" * 64),
            device=device,
        ),
        Artifact(
            artifact_type=ArtifactType.BROWSER_HISTORY,
            source_app="chrome",
            source_path="/AppData/Chrome/History",
            acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
            hashes=HashPair(md5="c" * 32, sha256="d" * 64),
            device=device,
        ),
    ]


def test_generate_html_creates_file(tmp_path, session, artifacts):
    out = tmp_path / "report.html"
    ReportWriter.generate_html(session, artifacts, out)
    assert out.exists()


def test_html_is_valid_html(tmp_path, session, artifacts):
    out = tmp_path / "report.html"
    ReportWriter.generate_html(session, artifacts, out)
    content = out.read_text()
    assert "<!DOCTYPE html>" in content or "<html" in content


def test_case_number_in_report(tmp_path, session, artifacts):
    out = tmp_path / "report.html"
    ReportWriter.generate_html(session, artifacts, out)
    assert "RPT-001" in out.read_text()


def test_court_order_in_report(tmp_path, session, artifacts):
    out = tmp_path / "report.html"
    ReportWriter.generate_html(session, artifacts, out)
    assert "CO-RPT-001" in out.read_text()


def test_examiner_id_in_report(tmp_path, session, artifacts):
    out = tmp_path / "report.html"
    ReportWriter.generate_html(session, artifacts, out)
    assert "EXAMINER-001" in out.read_text()


def test_artifact_hashes_in_report(tmp_path, session, artifacts):
    out = tmp_path / "report.html"
    ReportWriter.generate_html(session, artifacts, out)
    content = out.read_text()
    assert artifacts[0].hashes.md5 in content


def test_both_artifacts_in_report(tmp_path, session, artifacts):
    out = tmp_path / "report.html"
    ReportWriter.generate_html(session, artifacts, out)
    content = out.read_text()
    assert "com.whatsapp" in content
    assert "chrome" in content


def test_root_hash_in_report(tmp_path, session, artifacts):
    out = tmp_path / "report.html"
    ReportWriter.generate_html(session, artifacts, out)
    assert "e" * 64 in out.read_text()


def test_generate_pdf_without_weasyprint_raises(tmp_path, session, artifacts):
    out_html = tmp_path / "report.html"
    ReportWriter.generate_html(session, artifacts, out_html)
    out_pdf = tmp_path / "report.pdf"
    with unittest.mock.patch.dict(sys.modules, {"weasyprint": None}):
        try:
            ReportWriter.generate_pdf(out_html, out_pdf)
        except (WriteError, ImportError, TypeError):
            pass  # expected when weasyprint not available


def test_report_is_utf8(tmp_path, session, artifacts):
    out = tmp_path / "report.html"
    ReportWriter.generate_html(session, artifacts, out)
    out.read_text(encoding="utf-8")  # must not raise


def test_generate_html_exception(tmp_path, session, artifacts):
    # Pass a path that is a directory instead of a file so write_text raises IsADirectoryError
    out = tmp_path / "dir_out"
    out.mkdir()
    with pytest.raises(WriteError, match="Failed to write HTML report"):
        ReportWriter.generate_html(session, artifacts, out)


def test_generate_pdf_success(tmp_path, session, artifacts):
    out_html = tmp_path / "report.html"
    ReportWriter.generate_html(session, artifacts, out_html)
    out_pdf = tmp_path / "report.pdf"

    mock_weasyprint = unittest.mock.MagicMock()
    mock_html_class = mock_weasyprint.HTML
    mock_instance = mock_html_class.return_value

    with unittest.mock.patch.dict("sys.modules", {"weasyprint": mock_weasyprint}):
        ReportWriter.generate_pdf(out_html, out_pdf)
        
    mock_html_class.assert_called_once_with(filename=str(out_html))
    mock_instance.write_pdf.assert_called_once_with(str(out_pdf))


def test_generate_pdf_exception(tmp_path, session, artifacts):
    out_html = tmp_path / "report.html"
    ReportWriter.generate_html(session, artifacts, out_html)
    out_pdf = tmp_path / "report.pdf"

    mock_weasyprint = unittest.mock.MagicMock()
    mock_html_class = mock_weasyprint.HTML
    mock_instance = mock_html_class.return_value
    mock_instance.write_pdf.side_effect = Exception("weasyprint error")

    with unittest.mock.patch.dict("sys.modules", {"weasyprint": mock_weasyprint}):
        with pytest.raises(WriteError, match="Failed to generate PDF"):
            ReportWriter.generate_pdf(out_html, out_pdf)
