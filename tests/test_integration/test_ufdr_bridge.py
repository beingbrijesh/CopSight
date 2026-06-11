import json
import zipfile
import pytest
from pathlib import Path
from datetime import timedelta, datetime, timezone

from forensixd.integration.ufdr_bridge import UFDRBridge, UFDRBridgeConfig
from forensixd.core.models import (
    SessionLog, CaseMetadata, DeviceInfo, Platform,
    ConsentType, Artifact, ArtifactType, HashPair
)
from forensixd.core.exceptions import WriteError


@pytest.fixture
def device():
    return DeviceInfo(platform=Platform.ANDROID, device_id="bridge-test")


@pytest.fixture
def case(device):
    return CaseMetadata(
        case_number="BRIDGE-001",
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
        session_id="sess-bridge",
        case=case,
        started_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        root_hash="g" * 64,
        is_sealed=True
    )


@pytest.fixture
def artifacts(device):
    return [Artifact(
        artifact_type=ArtifactType.MESSAGE,
        source_app="test",
        source_path="/test/path.db",
        acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        hashes=HashPair(md5="a" * 32, sha256="b" * 64),
        device=device
    )]


@pytest.fixture
def ufdr_project(tmp_path):
    proj = tmp_path / "ufdr_project"
    proj.mkdir()
    (proj / "cases").mkdir()
    return proj


@pytest.fixture
def config(ufdr_project):
    return UFDRBridgeConfig(ufdr_project_path=ufdr_project)


def test_config_creation(ufdr_project):
    cfg = UFDRBridgeConfig(ufdr_project_path=ufdr_project)
    assert cfg.ufdr_project_path == ufdr_project


def test_bridge_invalid_path_raises():
    cfg = UFDRBridgeConfig(ufdr_project_path=Path("/no/such/project"))
    with pytest.raises(WriteError):
        UFDRBridge(cfg)


def test_inject_session_creates_ufdr_file(config, session, artifacts):
    bridge = UFDRBridge(config)
    result = bridge.inject_session(session, artifacts)
    assert result.exists()
    assert str(result).endswith(".ufdr")


def test_inject_session_creates_valid_zip(config, session, artifacts):
    bridge = UFDRBridge(config)
    result = bridge.inject_session(session, artifacts)
    assert zipfile.is_zipfile(str(result))


def test_inject_session_creates_case_directory(config, session, artifacts):
    bridge = UFDRBridge(config)
    bridge.inject_session(session, artifacts)
    case_dir = config.ufdr_project_path / "cases" / "BRIDGE-001"
    assert case_dir.exists()


def test_inject_session_updates_index(config, session, artifacts):
    bridge = UFDRBridge(config)
    bridge.inject_session(session, artifacts)
    index = config.ufdr_project_path / "index.json"
    assert index.exists()
    data = json.loads(index.read_text(encoding="utf-8"))
    assert "cases" in data


def test_index_contains_case_number(config, session, artifacts):
    bridge = UFDRBridge(config)
    bridge.inject_session(session, artifacts)
    index = json.loads((config.ufdr_project_path / "index.json").read_text(encoding="utf-8"))
    case_numbers = [c["case_number"] for c in index["cases"]]
    assert "BRIDGE-001" in case_numbers


def test_list_cases_empty_before_inject(config):
    assert UFDRBridge(config).list_cases() == []


def test_list_cases_returns_one_after_inject(config, session, artifacts):
    bridge = UFDRBridge(config)
    bridge.inject_session(session, artifacts)
    assert len(bridge.list_cases()) == 1


def test_from_yaml_creates_config(tmp_path, ufdr_project):
    import yaml  # type: ignore
    data = {"ufdr_project": {
        "path": str(ufdr_project), "cases_dir": "cases", "index_file": "index.json"
    }}
    yaml_file = tmp_path / "forensixd.yaml"
    yaml_file.write_text(yaml.dump(data), encoding="utf-8")
    cfg = UFDRBridgeConfig.from_yaml(yaml_file)
    assert cfg.ufdr_project_path == ufdr_project


def test_update_index_json_decode_error(config, session, artifacts):
    index = config.ufdr_project_path / "index.json"
    index.write_text("{bad json: true}", encoding="utf-8")
    bridge = UFDRBridge(config)
    bridge.inject_session(session, artifacts)
    # the index should be overwritten correctly
    data = json.loads(index.read_text(encoding="utf-8"))
    assert data["cases"][0]["case_number"] == session.case.case_number


def test_update_index_existing_case_replaced(config, session, artifacts):
    bridge = UFDRBridge(config)
    # Inject once
    bridge.inject_session(session, artifacts)
    # Inject again
    bridge.inject_session(session, artifacts)
    
    data = json.loads((config.ufdr_project_path / "index.json").read_text(encoding="utf-8"))
    # Should only have 1 case, not 2
    assert len(data["cases"]) == 1


def test_list_cases_json_decode_error(config):
    index = config.ufdr_project_path / "index.json"
    index.write_text("{bad json}", encoding="utf-8")
    bridge = UFDRBridge(config)
    assert bridge.list_cases() == []
