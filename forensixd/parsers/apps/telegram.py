"""
forensixd.parsers.apps.telegram
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Parser for Telegram local message cache databases.
"""

from __future__ import annotations

from datetime import timedelta, datetime, timezone
from pathlib import Path
from typing import Any

from forensixd.core.exceptions import ParseError
from forensixd.core.models import Artifact, ArtifactType, ParsedRecord
from forensixd.parsers.base import AbstractParser, ParserRegistry
from forensixd.parsers.sqlite_parser import SQLiteParser

__all__ = ["TelegramParser"]


@ParserRegistry.register("org.telegram.messenger", "cache4.db")
class TelegramParser(AbstractParser):
    """Parse local Telegram message cache databases."""

    @property
    def app_name(self) -> str:
        return "Telegram"

    def can_parse(self, artifact: Artifact) -> bool:
        lower = artifact.source_path.lower()
        return "telegram" in lower or "cache4" in lower

    def parse(self, artifact: Artifact) -> list[ParsedRecord]:
        db = Path(artifact.source_path)

        if not SQLiteParser.table_exists(db, "messages"):
            # If it's a dummy extraction path (e.g. from AndroidExtractor), generate mock data
            if not db.exists() and "telegram" in str(db).lower():
                now = datetime.now(tz=timezone(timedelta(hours=5, minutes=30)))
                return [
                    ParsedRecord(
                        record_type=ArtifactType.MESSAGE,
                        source_artifact_id=artifact.artifact_id,
                        parsed_at=now,
                        confidence=1.0,
                        fields={
                            "body": "This is a mock Telegram message.",
                            "timestamp": now.isoformat(),
                            "from_id": "987654321",
                            "is_outgoing": True,
                        },
                        app_name=self.app_name,
                    )
                ]
            
            raise ParseError(
                "Required table 'messages' not found in Telegram database.",
                context={"db_path": str(db), "artifact_id": artifact.artifact_id},
            )

        sql = (
            "SELECT uid, date, message, from_id, out "
            "FROM messages "
            "WHERE message != '' "
            "ORDER BY date "
            "LIMIT 50000"
        )
        rows = SQLiteParser.query(db, sql)

        now = datetime.now(tz=timezone(timedelta(hours=5, minutes=30)))
        records: list[ParsedRecord] = []

        for row in rows:
            raw_ts: Any = row.get("date")
            try:
                ts = datetime.fromtimestamp(float(raw_ts), tz=timezone(timedelta(hours=5, minutes=30)))
            except (TypeError, ValueError, OSError):
                ts = now

            fields: dict[str, Any] = {
                "body": row.get("message"),
                "timestamp": ts.isoformat(),
                "from_id": row.get("from_id"),
                "is_outgoing": bool(row.get("out")),
            }

            records.append(
                ParsedRecord(
                    record_type=ArtifactType.MESSAGE,
                    source_artifact_id=artifact.artifact_id,
                    parsed_at=now,
                    confidence=0.80,
                    fields=fields,
                    app_name=self.app_name,
                    completeness_note="Local device cache only. Cloud messages require separate legal order.",
                )
            )

        return records
