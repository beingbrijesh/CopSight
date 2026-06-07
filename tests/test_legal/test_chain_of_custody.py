import pytest
from datetime import timedelta, datetime, timezone

from forensixd.legal.chain_of_custody import ChainOfCustodyEngine, VALID_COC_EVENTS
from forensixd.core.models import (
    SessionLog,
    CaseMetadata,
    DeviceInfo,
    Platform,
    ConsentType,
    AcquisitionEvent
)


@pytest.fixture
def device():
    return DeviceInfo(platform=Platform.ANDROID, device_id="coc-test")


@pytest.fixture
def case(device):
    return CaseMetadata(
        case_number="COC-001",
        court_order_ref="CO-001",
        examiner_id="EX-001",
        jurisdiction="TEST",
        consent_type=ConsentType.COURT_ORDER,
        authorized_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        device=device
    )


@pytest.fixture
def session(case):
    return SessionLog(
        session_id="sess-coc",
        case=case,
        started_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        root_hash="f" * 64,
        is_sealed=True
    )


def test_valid_events_list_not_empty():
    assert len(VALID_COC_EVENTS) > 0


def test_valid_events_are_strings():
    for e in VALID_COC_EVENTS:
        assert isinstance(e, str)


def test_record_returns_acquisition_event(session):
    engine = ChainOfCustodyEngine(session)
    ev = engine.record("DEVICE_RECEIVED", "EX-001", "Device received from owner")
    assert isinstance(ev, AcquisitionEvent)


def test_record_invalid_event_raises(session):
    engine = ChainOfCustodyEngine(session)
    with pytest.raises(ValueError):
        engine.record("INVALID_EVENT_TYPE", "EX-001", "Should fail")


def test_events_accumulate(session):
    engine = ChainOfCustodyEngine(session)
    engine.record("DEVICE_RECEIVED", "EX-001", "Received")
    engine.record("EXAMINATION_STARTED", "EX-001", "Started")
    assert len(engine._events) == 2


def test_export_text_creates_file(tmp_path, session):
    engine = ChainOfCustodyEngine(session)
    engine.record("DEVICE_RECEIVED", "EX-001", "Received device")
    out = tmp_path / "coc.txt"
    result = engine.export_text(out)
    assert result.exists()


def test_export_text_contains_case_number(tmp_path, session):
    engine = ChainOfCustodyEngine(session)
    engine.record("EXAMINATION_STARTED", "EX-001", "Started examination")
    out = tmp_path / "coc.txt"
    engine.export_text(out)
    assert "COC-001" in out.read_text(encoding="utf-8")


def test_export_text_contains_event_type(tmp_path, session):
    engine = ChainOfCustodyEngine(session)
    engine.record("ACQUISITION_COMPLETE", "EX-001", "All files extracted")
    out = tmp_path / "coc.txt"
    engine.export_text(out)
    assert "ACQUISITION_COMPLETE" in out.read_text(encoding="utf-8")


def test_export_html_creates_file(tmp_path, session):
    engine = ChainOfCustodyEngine(session)
    engine.record("REPORT_GENERATED", "EX-001", "Report created")
    out = tmp_path / "coc.html"
    result = engine.export_html(out)
    assert result.exists()


def test_record_event_has_utc_timestamp(session):
    engine = ChainOfCustodyEngine(session)
    ev = engine.record("DEVICE_RETURNED", "EX-001", "Returned to owner")
    assert ev.occurred_at.tzinfo is not None
