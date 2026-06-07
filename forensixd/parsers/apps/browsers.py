"""
forensixd.parsers.apps.browsers
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Parser for various browser history databases (Chrome, Firefox, Safari).
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from forensixd.core.exceptions import ParseError
from forensixd.core.models import Artifact, ArtifactType, ParsedRecord
from forensixd.parsers.base import AbstractParser, ParserRegistry
from forensixd.parsers.sqlite_parser import SQLiteParser

__all__ = ["BrowserParser"]

_CHROME_EPOCH = datetime(1601, 1, 1, tzinfo=timezone.utc)


@ParserRegistry.register("History", "places.db", "com.android.chrome", "firefox")
class BrowserParser(AbstractParser):
    """Parse Chrome, Firefox, and Safari browser history databases."""

    @property
    def app_name(self) -> str:
        return "Browser"

    def can_parse(self, artifact: Artifact) -> bool:
        lower = artifact.source_path.lower()
        return any(
            kw in lower
            for kw in ["history", "places.db", "chrome", "firefox", "safari"]
        )

    def parse(self, artifact: Artifact) -> list[ParsedRecord]:
        path = Path(artifact.source_path)
        lower_path = str(path).lower()

        if "chrome" in lower_path:
            browser_name = "Chrome"
        elif "firefox" in lower_path:
            browser_name = "Firefox"
        elif "safari" in lower_path:
            browser_name = "Safari"
        else:
            browser_name = "Browser"

        if SQLiteParser.table_exists(path, "urls") and SQLiteParser.table_exists(
            path, "visits"
        ):
            return self._parse_chrome(path, artifact, browser_name)
        elif SQLiteParser.table_exists(
            path, "moz_places"
        ) and SQLiteParser.table_exists(path, "moz_historyvisits"):
            return self._parse_firefox(path, artifact, browser_name)
        else:
            raise ParseError(
                "Unrecognized browser database schema.",
                context={"db_path": str(path), "artifact_id": artifact.artifact_id},
            )

    def _parse_chrome(
        self, db: Path, artifact: Artifact, browser_name: str
    ) -> list[ParsedRecord]:
        sql = (
            "SELECT u.url, u.title, u.visit_count, v.visit_time "
            "FROM urls u JOIN visits v ON u.id = v.url "
            "ORDER BY v.visit_time DESC LIMIT 100000"
        )
        rows = SQLiteParser.query(db, sql)

        now = datetime.now(tz=timezone.utc)
        records: list[ParsedRecord] = []

        for row in rows:
            raw_ts: Any = row.get("visit_time")
            try:
                ts = _CHROME_EPOCH + timedelta(microseconds=float(raw_ts))
            except (TypeError, ValueError, OSError):
                ts = now

            fields: dict[str, Any] = {
                "url": row.get("url"),
                "title": row.get("title"),
                "visit_count": row.get("visit_count"),
                "timestamp": ts.isoformat(),
                "browser_name": browser_name,
            }

            records.append(
                ParsedRecord(
                    record_type=ArtifactType.BROWSER_HISTORY,
                    source_artifact_id=artifact.artifact_id,
                    parsed_at=now,
                    confidence=0.99,
                    fields=fields,
                    app_name=browser_name,
                )
            )

        return records

    def _parse_firefox(
        self, db: Path, artifact: Artifact, browser_name: str
    ) -> list[ParsedRecord]:
        sql = (
            "SELECT p.url, p.title, p.visit_count, h.visit_date "
            "FROM moz_places p JOIN moz_historyvisits h ON p.id = h.place_id "
            "ORDER BY h.visit_date DESC LIMIT 100000"
        )
        rows = SQLiteParser.query(db, sql)

        now = datetime.now(tz=timezone.utc)
        records: list[ParsedRecord] = []

        for row in rows:
            raw_ts: Any = row.get("visit_date")
            try:
                ts = datetime.fromtimestamp(float(raw_ts) / 1e6, tz=timezone.utc)
            except (TypeError, ValueError, OSError):
                ts = now

            fields: dict[str, Any] = {
                "url": row.get("url"),
                "title": row.get("title"),
                "visit_count": row.get("visit_count"),
                "timestamp": ts.isoformat(),
                "browser_name": browser_name,
            }

            records.append(
                ParsedRecord(
                    record_type=ArtifactType.BROWSER_HISTORY,
                    source_artifact_id=artifact.artifact_id,
                    parsed_at=now,
                    confidence=0.99,
                    fields=fields,
                    app_name=browser_name,
                )
            )

        return records
