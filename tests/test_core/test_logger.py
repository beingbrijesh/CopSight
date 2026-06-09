"""Tests for forensixd.core.logger.AuditLogger"""

import json
import pytest
from pathlib import Path
from forensixd.core.logger import AuditLogger


def test_logger_creates_file(tmp_path: Path) -> None:
    log_file = tmp_path / "test.jsonl"
    log = AuditLogger(log_file, "sess-001")
    log.write("TEST", {"a": 1})
    log.seal()
    assert log_file.exists()


def test_logger_writes_valid_json_lines(tmp_path: Path) -> None:
    log_file = tmp_path / "test.jsonl"
    log = AuditLogger(log_file, "sess-001")
    log.write("EVENT_ONE", {"key": "value"})
    log.seal()
    lines = log_file.read_text().strip().split("\n")
    for line in lines:
        parsed = json.loads(line)  # must not raise
        assert "line_hash" in parsed
        assert "ts" in parsed
        assert "seq" in parsed


def test_logger_seq_increments(tmp_path: Path) -> None:
    log_file = tmp_path / "test.jsonl"
    log = AuditLogger(log_file, "sess-001")
    log.write("EV1", {})
    log.write("EV2", {})
    log.write("EV3", {})
    log.seal()
    lines = [json.loads(l) for l in log_file.read_text().strip().split("\n")]
    seqs = [l["seq"] for l in lines]
    assert seqs[0] == 0
    assert seqs[1] == 1
    assert seqs[2] == 2


def test_logger_prev_hash_chain(tmp_path: Path) -> None:
    log_file = tmp_path / "test.jsonl"
    log = AuditLogger(log_file, "sess-001")
    log.write("EV1", {})
    log.write("EV2", {})
    log.seal()
    lines = [json.loads(l) for l in log_file.read_text().strip().split("\n")]
    # First line prev_hash must be "0" * 64
    assert lines[0]["prev_hash"] == "0" * 64
    # Second line prev_hash must equal first line line_hash
    assert lines[1]["prev_hash"] == lines[0]["line_hash"]


def test_logger_verify_passes_untampered(tmp_path: Path) -> None:
    log_file = tmp_path / "test.jsonl"
    log = AuditLogger(log_file, "sess-001")
    log.write("ACQUISITION_STARTED", {"device": "android"})
    log.write("ARTIFACT_REGISTERED", {"path": "/sdcard/test.db"})
    log.seal()
    log2 = AuditLogger.from_file(log_file)
    assert log2.verify() is True


def test_logger_verify_fails_if_tampered(tmp_path: Path) -> None:
    log_file = tmp_path / "test.jsonl"
    log = AuditLogger(log_file, "sess-001")
    log.write("REAL_EVENT", {"data": "real"})
    log.seal()
    # Tamper: open file and change content
    content = log_file.read_text()
    tampered = content.replace('"real"', '"TAMPERED"')
    log_file.write_text(tampered)
    log2 = AuditLogger.from_file(log_file)
    assert log2.verify() is False


def test_logger_seal_returns_hash(tmp_path: Path) -> None:
    log_file = tmp_path / "test.jsonl"
    log = AuditLogger(log_file, "sess-001")
    log.write("EVENT", {})
    seal_hash = log.seal()
    assert isinstance(seal_hash, str)
    assert len(seal_hash) == 64


def test_logger_from_file_restores_state(tmp_path: Path) -> None:
    log_file = tmp_path / "test.jsonl"
    log = AuditLogger(log_file, "sess-001")
    log.write("EV1", {})
    log.write("EV2", {})
    # Do NOT seal — simulate reopening mid-session
    log2 = AuditLogger.from_file(log_file)
    log2.write("EV3", {})
    log2.seal()
    lines = [json.loads(l) for l in log_file.read_text().strip().split("\n")]
    # Should have EV1, EV2, EV3, SESSION_SEALED = 4 lines
    assert len(lines) == 4


def test_logger_session_sealed_event_present(tmp_path: Path) -> None:
    log_file = tmp_path / "test.jsonl"
    log = AuditLogger(log_file, "sess-001")
    log.write("START", {})
    log.seal()
    lines = [json.loads(l) for l in log_file.read_text().strip().split("\n")]
    events = [l["event"] for l in lines]
    assert "SESSION_SEALED" in events
