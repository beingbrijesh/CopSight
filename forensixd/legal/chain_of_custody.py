"""
forensixd.legal.chain_of_custody
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Chain of Custody tracking and document generation.
"""

from datetime import timedelta, datetime, timezone
from pathlib import Path
from typing import Optional, List

from jinja2 import Environment, BaseLoader

from forensixd.core.models import SessionLog, AcquisitionEvent
from forensixd.core.logger import AuditLogger

VALID_COC_EVENTS = [
    "DEVICE_RECEIVED", "EXAMINATION_STARTED", "ACQUISITION_STARTED",
    "ACQUISITION_COMPLETE", "HASH_VERIFIED", "PARSING_COMPLETE",
    "REPORT_GENERATED", "DEVICE_RETURNED", "CASE_CLOSED"
]

COC_TEMPLATE = """CHAIN OF CUSTODY DOCUMENT
==========================
Case:         {{ session.case.case_number }}
Court Order:  {{ session.case.court_order_ref }}
Examiner:     {{ session.case.examiner_id }}
Jurisdiction: {{ session.case.jurisdiction }}
Session Hash: {{ session.root_hash }}
Generated:    {{ generated_at }}

EVENTS
------
{% for e in events %}
[{{ loop.index | string | rjust(3) }}] {{ e.occurred_at.strftime('%Y-%m-%d %H:%M:%S IST') }}
     Event:  {{ e.event_type }}
     Actor:  {{ e.actor }}
     Detail: {{ e.description }}
{% endfor %}
==========================
END OF DOCUMENT
"""

class ChainOfCustodyEngine:
    """Manages the forensic Chain of Custody lifecycle and document generation."""

    def __init__(self, session: SessionLog, logger: Optional[AuditLogger] = None):
        """
        Initialize the Chain of Custody engine.

        Args:
            session (SessionLog): The forensic session log context.
            logger (Optional[AuditLogger]): The audit logger to write events to.
        """
        self.session = session
        self.logger = logger
        self._events: List[AcquisitionEvent] = []

    def record(self, event_type: str, actor: str, description: str) -> AcquisitionEvent:
        """
        Record a new chain of custody event.

        Args:
            event_type (str): The type of the event (must be in VALID_COC_EVENTS).
            actor (str): The identifier of the actor performing the event.
            description (str): A description of the event.

        Returns:
            AcquisitionEvent: The recorded event.

        Raises:
            ValueError: If the event_type is not in VALID_COC_EVENTS.
        """
        if event_type not in VALID_COC_EVENTS:
            raise ValueError(f"Event type '{event_type}' is not a valid COC event.")

        event = AcquisitionEvent(
            event_type=event_type,
            occurred_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
            actor=actor,
            description=description
        )
        self._events.append(event)

        if self.logger:
            self.logger.write(event_type, {"actor": actor, "desc": description})

        return event

    def export_text(self, output_path: Path) -> Path:
        """
        Export the Chain of Custody as a plain text document.

        Args:
            output_path (Path): The path where the text document should be written.

        Returns:
            Path: The path to the written text document.
        """
        env = Environment(loader=BaseLoader())
        env.filters["rjust"] = lambda s, w: str(s).rjust(w)
        template = env.from_string(COC_TEMPLATE)
        generated_at = datetime.now(timezone(timedelta(hours=5, minutes=30))).strftime('%Y-%m-%d %H:%M:%S IST')
        rendered = template.render(
            session=self.session,
            generated_at=generated_at,
            events=self._events
        )
        output_path.write_text(rendered, encoding="utf-8")
        return output_path

    def export_html(self, output_path: Path) -> Path:
        """
        Export the Chain of Custody as an HTML document.

        Args:
            output_path (Path): The path where the HTML document should be written.

        Returns:
            Path: The path to the written HTML document.
        """
        env = Environment(loader=BaseLoader())
        env.filters["rjust"] = lambda s, w: str(s).rjust(w)
        template = env.from_string(COC_TEMPLATE)
        generated_at = datetime.now(timezone(timedelta(hours=5, minutes=30))).strftime('%Y-%m-%d %H:%M:%S IST')
        rendered = template.render(
            session=self.session,
            generated_at=generated_at,
            events=self._events
        )
        html_content = f"<html><body><pre>\n{rendered}\n</pre></body></html>"
        output_path.write_text(html_content, encoding="utf-8")
        return output_path

__all__ = ["ChainOfCustodyEngine", "VALID_COC_EVENTS"]
