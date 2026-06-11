"""
forensixd.parsers.apps.email_parser
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Parser for generic email mailboxes (.mbox) and individual messages (.eml).
"""

from __future__ import annotations

import email
import email.message
import email.utils
import mailbox
from datetime import timedelta, datetime, timezone
from pathlib import Path
from typing import Any

from forensixd.core.exceptions import ParseError
from forensixd.core.models import Artifact, ArtifactType, ParsedRecord
from forensixd.parsers.base import AbstractParser, ParserRegistry

__all__ = ["EmailParser"]


@ParserRegistry.register(".mbox", ".eml", "Mail", "Mailbox")
class EmailParser(AbstractParser):
    """Parse standard .mbox files and .eml single messages."""

    @property
    def app_name(self) -> str:
        return "Email"

    def can_parse(self, artifact: Artifact) -> bool:
        path = Path(artifact.source_path)
        lower_path = str(path).lower()
        return path.suffix.lower() in [".mbox", ".eml"] or "mail" in lower_path

    def parse(self, artifact: Artifact) -> list[ParsedRecord]:
        path = Path(artifact.source_path)
        if path.suffix.lower() == ".eml":
            return self._parse_eml(path, artifact)
        return self._parse_mbox(path, artifact)

    def _extract_message(
        self, msg: email.message.Message, artifact: Artifact
    ) -> ParsedRecord:
        now = datetime.now(tz=timezone(timedelta(hours=5, minutes=30)))

        # Parse Date
        date_header = msg.get("Date")
        ts = now
        if date_header:
            try:
                parsed_date = email.utils.parsedate_to_datetime(date_header)
                if parsed_date.tzinfo is None:
                    parsed_date = parsed_date.replace(tzinfo=timezone(timedelta(hours=5, minutes=30)))
                else:
                    parsed_date = parsed_date.astimezone(timezone(timedelta(hours=5, minutes=30)))
                ts = parsed_date
            except (TypeError, ValueError, OSError):
                pass

        # Parse Body and Attachments
        body_text = ""
        attachment_names: list[str] = []

        for part in msg.walk():
            filename = part.get_filename()
            if filename:
                attachment_names.append(filename)

            if part.get_content_type() == "text/plain" and not filename:
                payload = part.get_payload(decode=True)
                if isinstance(payload, bytes):
                    charset = part.get_content_charset() or "utf-8"
                    try:
                        decoded = payload.decode(charset, errors="replace")
                        body_text += decoded
                    except Exception:
                        pass
                elif isinstance(payload, str):
                    body_text += payload

        # Truncate
        if len(body_text) > 5000:
            body_text = body_text[:5000] + "\n[truncated]"

        fields: dict[str, Any] = {
            "From": msg.get("From", ""),
            "To": msg.get("To", ""),
            "Subject": msg.get("Subject", ""),
            "body": body_text.strip(),
            "attachment_names": attachment_names,
            "timestamp": ts.isoformat(),
        }

        return ParsedRecord(
            record_type=ArtifactType.EMAIL,
            source_artifact_id=artifact.artifact_id,
            parsed_at=now,
            confidence=0.99,
            fields=fields,
            app_name=self.app_name,
        )

    def _parse_mbox(self, path: Path, artifact: Artifact) -> list[ParsedRecord]:
        try:
            mbox = mailbox.mbox(str(path))
        except Exception as exc:
            raise ParseError(
                f"Failed to open mbox file: {exc}",
                context={"path": str(path), "artifact_id": artifact.artifact_id},
            ) from exc

        records: list[ParsedRecord] = []
        for msg in mbox:
            try:
                records.append(self._extract_message(msg, artifact))
            except Exception:
                # Silently skip completely malformed individual messages
                continue

        return records

    def _parse_eml(self, path: Path, artifact: Artifact) -> list[ParsedRecord]:
        try:
            raw_bytes = path.read_bytes()
            msg = email.message_from_bytes(raw_bytes)
            return [self._extract_message(msg, artifact)]
        except Exception as exc:
            raise ParseError(
                f"Failed to parse .eml file: {exc}",
                context={"path": str(path), "artifact_id": artifact.artifact_id},
            ) from exc
