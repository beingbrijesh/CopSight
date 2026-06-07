"""
forensixd.parsers.apps.signal
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Parser for Signal secure messenger databases.
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from forensixd.core.exceptions import EncryptionError, ParseError
from forensixd.core.models import Artifact, ArtifactType, ParsedRecord
from forensixd.parsers.base import AbstractParser, ParserRegistry
from forensixd.parsers.sqlite_parser import SQLiteParser

__all__ = ["SignalParser"]


@ParserRegistry.register("org.thoughtcrime.securesms", "signal.db")
class SignalParser(AbstractParser):
    """Parse Signal messenger databases."""

    @property
    def app_name(self) -> str:
        return "Signal"

    def can_parse(self, artifact: Artifact) -> bool:
        return "signal" in artifact.source_path.lower()

    def parse(self, artifact: Artifact) -> list[ParsedRecord]:
        db = Path(artifact.source_path)

        # Check for encryption or corruption by querying the schema directly
        # rather than using table_exists(), which swallows errors.
        try:
            check_rows = SQLiteParser.query(
                db, "SELECT 1 FROM sqlite_master WHERE type='table' AND name='sms'"
            )
        except ParseError as exc:
            msg = str(exc).lower()
            if "encrypted" in msg or "not a database" in msg:
                raise EncryptionError(
                    "Signal database is SQLCipher-encrypted. "
                    "Root ADB access required to extract key from Android Keystore.",
                    context={"db_path": str(db), "artifact_id": artifact.artifact_id},
                ) from exc
            raise

        if not check_rows:
            raise ParseError(
                "Required table 'sms' not found in Signal database.",
                context={"db_path": str(db), "artifact_id": artifact.artifact_id},
            )

        sql = (
            "SELECT address, date, body, type "
            "FROM sms "
            "WHERE body IS NOT NULL "
            "LIMIT 50000"
        )
        rows = SQLiteParser.query(db, sql)

        now = datetime.now(tz=timezone.utc)
        records: list[ParsedRecord] = []

        for row in rows:
            raw_ts: Any = row.get("date")
            try:
                # Signal dates are typically milliseconds since epoch
                ts = datetime.fromtimestamp(int(raw_ts) / 1000, tz=timezone.utc)
            except (TypeError, ValueError, OSError):
                ts = now

            # type: 1=received, 2=sent
            is_sent = row.get("type") == 2

            fields: dict[str, Any] = {
                "body": row.get("body"),
                "timestamp": ts.isoformat(),
                "address": row.get("address"),
                "is_from_me": is_sent,
            }

            records.append(
                ParsedRecord(
                    record_type=ArtifactType.MESSAGE,
                    source_artifact_id=artifact.artifact_id,
                    parsed_at=now,
                    confidence=0.95,
                    fields=fields,
                    app_name=self.app_name,
                )
            )

        return records
