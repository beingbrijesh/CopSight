"""
forensixd.parsers.apps.imessage
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Parser for Apple iMessage / SMS and CallHistory databases.
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from forensixd.core.exceptions import ParseError
from forensixd.core.models import Artifact, ArtifactType, ParsedRecord
from forensixd.parsers.base import AbstractParser, ParserRegistry
from forensixd.parsers.sqlite_parser import SQLiteParser

__all__ = ["IMessageParser"]

_APPLE_EPOCH_OFFSET: int = 978_307_200


@ParserRegistry.register("com.apple.MobileSMS", "sms.db")
class IMessageParser(AbstractParser):
    """Parse Apple iMessage and CallHistory databases."""

    @property
    def app_name(self) -> str:
        return "iMessage"

    def can_parse(self, artifact: Artifact) -> bool:
        lower = artifact.source_path.lower()
        return "sms.db" in lower or "mobilesms" in lower

    def parse(self, artifact: Artifact) -> list[ParsedRecord]:
        path = Path(artifact.source_path)
        records = self._parse_messages(path, artifact)
        
        call_history_path = path.parent / "CallHistory.storedata"
        if call_history_path.exists():
            try:
                records.extend(self._parse_calls(call_history_path, artifact))
            except ParseError:
                pass
                
        return records

    def _parse_messages(self, db: Path, artifact: Artifact) -> list[ParsedRecord]:
        if not SQLiteParser.table_exists(db, "message"):
            raise ParseError(
                "Required table 'message' not found in iMessage database.",
                context={"db_path": str(db), "artifact_id": artifact.artifact_id},
            )

        sql = (
            "SELECT m.text, m.date, m.is_from_me, m.service, "
            "h.id AS handle_id, m.cache_has_attachments "
            "FROM message m LEFT JOIN handle h ON m.handle_id = h.rowid "
            "WHERE m.text IS NOT NULL ORDER BY m.date"
        )
        rows = SQLiteParser.query(db, sql)

        now = datetime.now(tz=timezone.utc)
        records: list[ParsedRecord] = []

        for row in rows:
            raw_ts: Any = row.get("date")
            try:
                date_val = float(raw_ts)
                if date_val > 1e12:
                    date_val /= 1e9
                ts = datetime.fromtimestamp(_APPLE_EPOCH_OFFSET + date_val, tz=timezone.utc)
            except (TypeError, ValueError, OSError):
                ts = now

            fields: dict[str, Any] = {
                "body": row.get("text"),
                "timestamp": ts.isoformat(),
                "is_from_me": bool(row.get("is_from_me")),
                "handle": row.get("handle_id"),
                "service": row.get("service"),
                "has_attachment": bool(row.get("cache_has_attachments")),
            }

            records.append(
                ParsedRecord(
                    record_type=ArtifactType.MESSAGE,
                    source_artifact_id=artifact.artifact_id,
                    parsed_at=now,
                    confidence=0.99,
                    fields=fields,
                    app_name=self.app_name,
                )
            )

        return records

    def _parse_calls(self, db: Path, artifact: Artifact) -> list[ParsedRecord]:
        if not SQLiteParser.table_exists(db, "ZCALLRECORD"):
            raise ParseError(
                "Required table 'ZCALLRECORD' not found in CallHistory database.",
                context={"db_path": str(db), "artifact_id": artifact.artifact_id},
            )

        sql = (
            "SELECT ZDURATION, ZDATE, ZADDRESS, ZORIGINATED "
            "FROM ZCALLRECORD"
        )
        rows = SQLiteParser.query(db, sql)

        now = datetime.now(tz=timezone.utc)
        records: list[ParsedRecord] = []

        for row in rows:
            raw_ts: Any = row.get("ZDATE")
            try:
                date_val = float(raw_ts)
                if date_val > 1e12:
                    date_val /= 1e9
                ts = datetime.fromtimestamp(_APPLE_EPOCH_OFFSET + date_val, tz=timezone.utc)
            except (TypeError, ValueError, OSError):
                ts = now

            fields: dict[str, Any] = {
                "duration": row.get("ZDURATION"),
                "timestamp": ts.isoformat(),
                "address": row.get("ZADDRESS"),
                "originated": bool(row.get("ZORIGINATED")),
            }

            records.append(
                ParsedRecord(
                    record_type=ArtifactType.CALL_LOG,
                    source_artifact_id=artifact.artifact_id,
                    parsed_at=now,
                    confidence=0.99,
                    fields=fields,
                    app_name=self.app_name,
                )
            )

        return records
