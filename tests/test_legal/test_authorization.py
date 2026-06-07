import yaml  # type: ignore
import pytest
from pathlib import Path
from datetime import datetime, timezone, timedelta
from unittest.mock import patch

from forensixd.legal.authorization import AuthorizationManager
from forensixd.core.models import (
    DeviceInfo,
    Platform,
    CaseMetadata,
    ConsentType
)
from forensixd.core.exceptions import AuthorizationError


@pytest.fixture
def device():
    return DeviceInfo(platform=Platform.ANDROID, device_id="auth-test")


def test_capture_interactively_success(device):
    inputs = ["AUTH-002", "CO-002", "EX-002", "JURISDICTION-TEST", "1"]
    with patch("rich.prompt.Prompt.ask", side_effect=inputs):
        with patch("rich.prompt.Confirm.ask", return_value=True):
            case = AuthorizationManager.capture_interactively(device)
            assert case.case_number == "AUTH-002"
            assert case.consent_type == ConsentType.COURT_ORDER


def test_capture_interactively_empty_fields_raises(device):
    inputs = ["AUTH-002", "", "EX-002", "JURISDICTION-TEST"]
    with patch("rich.prompt.Prompt.ask", side_effect=inputs):
        with pytest.raises(AuthorizationError, match="All fields must be provided and cannot be empty"):
            AuthorizationManager.capture_interactively(device)


def test_capture_interactively_decline_raises(device):
    inputs = ["AUTH-003", "CO-003", "EX-003", "JURISDICTION", "1"]
    with patch("rich.prompt.Prompt.ask", side_effect=inputs):
        with patch("rich.prompt.Confirm.ask", return_value=False):
            with pytest.raises(AuthorizationError, match="Declined by examiner"):
                AuthorizationManager.capture_interactively(device)


def test_from_yaml_missing_file_raises():
    with pytest.raises(AuthorizationError, match="Authorization file not found"):
        AuthorizationManager.from_yaml(Path("/no/such/auth.yaml"))


def test_from_yaml_invalid_yaml(tmp_path):
    f = tmp_path / "bad.yaml"
    f.write_text(":")
    with pytest.raises(AuthorizationError, match="Failed to load YAML file"):
        AuthorizationManager.from_yaml(f)


def test_from_yaml_empty_file(tmp_path):
    f = tmp_path / "empty.yaml"
    f.write_text("")
    with pytest.raises(AuthorizationError, match="Authorization file is empty or invalid format"):
        AuthorizationManager.from_yaml(f)


def test_from_yaml_missing_field(tmp_path, device):
    data = {
        "court_order_ref": "CO-1",
        "examiner_id": "EX-1",
        "jurisdiction": "JUR",
        "consent_type": "VOLUNTARY",
        "device": {"platform": "ANDROID", "device_id": "1"}
    }
    f = tmp_path / "miss.yaml"
    f.write_text(yaml.dump(data))
    with pytest.raises(AuthorizationError, match="Missing or empty required field: case_number"):
        AuthorizationManager.from_yaml(f)


def test_from_yaml_empty_whitespace_field(tmp_path, device):
    data = {
        "case_number": "   ",
        "court_order_ref": "CO-1",
        "examiner_id": "EX-1",
        "jurisdiction": "JUR",
        "consent_type": "VOLUNTARY",
        "device": {"platform": "ANDROID", "device_id": "1"}
    }
    f = tmp_path / "white.yaml"
    f.write_text(yaml.dump(data))
    with pytest.raises(AuthorizationError, match="Required field cannot be empty whitespace: case_number"):
        AuthorizationManager.from_yaml(f)


def test_from_yaml_device_not_dict(tmp_path):
    data = {
        "case_number": "CASE-1",
        "court_order_ref": "CO-1",
        "examiner_id": "EX-1",
        "jurisdiction": "JUR",
        "consent_type": "VOLUNTARY",
        "device": "not a dict"
    }
    f = tmp_path / "dev.yaml"
    f.write_text(yaml.dump(data))
    with pytest.raises(AuthorizationError, match="Device field must be a dictionary"):
        AuthorizationManager.from_yaml(f)


def test_from_yaml_invalid_device(tmp_path):
    data = {
        "case_number": "CASE-1",
        "court_order_ref": "CO-1",
        "examiner_id": "EX-1",
        "jurisdiction": "JUR",
        "consent_type": "VOLUNTARY",
        "device": {"platform": "UNKNOWN", "device_id": "1"}
    }
    f = tmp_path / "dev2.yaml"
    f.write_text(yaml.dump(data))
    with pytest.raises(AuthorizationError, match="Invalid device information"):
        AuthorizationManager.from_yaml(f)


def test_from_yaml_invalid_consent(tmp_path):
    data = {
        "case_number": "CASE-1",
        "court_order_ref": "CO-1",
        "examiner_id": "EX-1",
        "jurisdiction": "JUR",
        "consent_type": "NOT_A_CONSENT",
        "device": {"platform": "ANDROID", "device_id": "1"}
    }
    f = tmp_path / "cons.yaml"
    f.write_text(yaml.dump(data))
    with pytest.raises(AuthorizationError, match="Invalid consent type"):
        AuthorizationManager.from_yaml(f)


def test_from_yaml_invalid_metadata(tmp_path):
    data = {
        "case_number": "C",  # Too short, will trigger CaseMetadata validator
        "court_order_ref": "CO-1",
        "examiner_id": "EX-1",
        "jurisdiction": "JUR",
        "consent_type": "VOLUNTARY",
        "device": {"platform": "ANDROID", "device_id": "1"}
    }
    f = tmp_path / "meta.yaml"
    f.write_text(yaml.dump(data))
    with pytest.raises(AuthorizationError, match="Failed to build CaseMetadata"):
        AuthorizationManager.from_yaml(f)


def test_from_yaml_success(tmp_path):
    data = {
        "case_number": "CASE-123",
        "court_order_ref": "CO-1",
        "examiner_id": "EX-1",
        "jurisdiction": "JUR",
        "consent_type": "VOLUNTARY",
        "device": {"platform": "ANDROID", "device_id": "1"},
        "notes": "some notes"
    }
    f = tmp_path / "ok.yaml"
    f.write_text(yaml.dump(data))
    result = AuthorizationManager.from_yaml(f)
    assert result.case_number == "CASE-123"
    assert result.notes == "some notes"
