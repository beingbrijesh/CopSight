import json
import shutil
from pathlib import Path
from datetime import timedelta, datetime, timezone
from typing import Any

from pydantic import BaseModel

from forensixd.core.models import SessionLog, Artifact
from forensixd.writers.ufdr_writer import UFDRWriter
from forensixd.core.exceptions import WriteError

__all__ = ["UFDRBridge", "UFDRBridgeConfig"]


class UFDRBridgeConfig(BaseModel, frozen=True):
    """Configuration for UFDRBridge."""
    ufdr_project_path: Path
    cases_dir: str = "cases"
    index_file: str = "index.json"

    @classmethod
    def from_yaml(cls, yaml_path: Path) -> "UFDRBridgeConfig":
        """Load configuration from a YAML file."""
        import yaml  # type: ignore
        data = yaml.safe_load(yaml_path.read_text(encoding="utf-8"))
        cfg = data.get("ufdr_project", {})
        return cls(
            ufdr_project_path=Path(cfg.get("path", "")),
            cases_dir=cfg.get("cases_dir", "cases").rstrip("/"),
            index_file=cfg.get("index_file", "index.json")
        )


class UFDRBridge:
    """Bridge for injecting forensic sessions into a UFDR project."""

    def __init__(self, config: UFDRBridgeConfig) -> None:
        """Initialize with config and validate project path."""
        if not config.ufdr_project_path.exists():
            raise WriteError(f"UFDR project path does not exist: {config.ufdr_project_path}")
        self.config = config

    def inject_session(self, session: SessionLog, artifacts: list[Artifact]) -> Path:
        """Build UFDR for a session and update the index."""
        case_dir = self.config.ufdr_project_path / self.config.cases_dir / session.case.case_number
        case_dir.mkdir(parents=True, exist_ok=True)

        ufdr_path = case_dir / f"{session.session_id}.ufdr"
        writer = UFDRWriter(ufdr_path, session)
        writer.build(artifacts)

        self._update_index(session, ufdr_path)
        return ufdr_path

    def _update_index(self, session: SessionLog, ufdr_path: Path) -> None:
        """Atomically update the cases index JSON file."""
        index_path = self.config.ufdr_project_path / self.config.index_file

        index_data: dict[str, list[dict[str, Any]]] = {"cases": []}
        if index_path.exists():
            try:
                with open(index_path, "r", encoding="utf-8") as f:
                    index_data = json.load(f)
            except json.JSONDecodeError:
                pass

        cases = index_data.get("cases", [])

        # Use artifact count from session if available
        artifact_count = len(session.artifacts) if session.artifacts else 0

        entry = {
            "case_number": session.case.case_number,
            "court_order_ref": session.case.court_order_ref,
            "examiner_id": session.case.examiner_id,
            "ufdr_file": str(ufdr_path),
            "artifact_count": artifact_count,
            "root_hash": session.root_hash,
            "last_updated": datetime.now(timezone(timedelta(hours=5, minutes=30))).isoformat()
        }

        # Replace existing entry for same case_number
        updated = False
        for i, case in enumerate(cases):
            if case.get("case_number") == session.case.case_number:
                cases[i] = entry
                updated = True
                break

        if not updated:
            cases.append(entry)

        index_data["cases"] = cases

        # Write atomically
        tmp_path = index_path.with_suffix(".tmp")
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(index_data, f, indent=4)

        shutil.move(str(tmp_path), str(index_path))

    def list_cases(self) -> list[dict[str, Any]]:
        """List all cases from the index file."""
        index_path = self.config.ufdr_project_path / self.config.index_file
        if not index_path.exists():
            return []

        try:
            with open(index_path, "r", encoding="utf-8") as f:
                index_data = json.load(f)
            return index_data.get("cases", [])
        except json.JSONDecodeError:
            return []
