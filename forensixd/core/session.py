"""
forensixd.core.session
~~~~~~~~~~~~~~~~~~~~~~

Context-manager wrapper that ties together a :class:`~forensixd.core.models.CaseMetadata`,
an :class:`~forensixd.core.logger.AuditLogger`, and the running list of
:class:`~forensixd.core.models.Artifact` objects collected during an acquisition.

Lifecycle
---------
1. Instantiate :class:`ForensicSession` (or use it as a ``with`` block).
2. Call :meth:`ForensicSession.register_artifact` for every acquired artefact.
3. Call :meth:`ForensicSession.record_event` for arbitrary chain-of-custody events.
4. Call :meth:`ForensicSession.close` (or exit the ``with`` block) to seal the session
   and receive a :class:`~forensixd.core.models.SessionLog`.

Thread safety
-------------
All mutations to shared state are protected by ``self._lock``.  Individual
property reads that return immutable or atomic values are lock-free.
"""

from __future__ import annotations

import hashlib
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

from forensixd.core.models import CaseMetadata, Artifact, SessionLog, AcquisitionEvent
from forensixd.core.hasher import HashEngine  # noqa: F401 – available for callers
from forensixd.core.logger import AuditLogger
from forensixd.core.exceptions import SessionAlreadyClosedError

__all__ = ["ForensicSession"]

# ---------------------------------------------------------------------------
# ForensicSession
# ---------------------------------------------------------------------------


class ForensicSession:
    """Orchestrator for a single forensic acquisition session.

    The session creates a dedicated sub-directory under *output_dir* named
    after the case number, opens a hash-chained :class:`AuditLogger` for the
    session, and exposes helpers to register artefacts and arbitrary
    chain-of-custody events.  Calling :meth:`close` (or exiting the ``with``
    block) seals the log and returns an immutable :class:`SessionLog`.

    Parameters
    ----------
    case:
        Legal and jurisdictional metadata for the acquisition.
    output_dir:
        Root directory under which the case-specific sub-directory will be
        created.  The sub-directory is ``output_dir / case.case_number``.

    Examples
    --------
    >>> with ForensicSession(case, Path("/evidence")) as session:
    ...     session.register_artifact(artifact)
    ...     log = session.close()
    """

    def __init__(self, case: CaseMetadata, output_dir: Path) -> None:
        # Create case-specific output directory.
        case_dir: Path = output_dir / case.case_number
        case_dir.mkdir(parents=True, exist_ok=True)

        self._session_id: str = str(uuid.uuid4())
        self._case: CaseMetadata = case
        self._case_dir: Path = case_dir
        self._closed: bool = False
        self._artifacts: list[Artifact] = []
        self._lock: threading.Lock = threading.Lock()
        self._started_at: datetime = datetime.now(timezone.utc)

        # Initialise the hash-chained audit log for this session.
        log_path: Path = self._case_dir / f"{self._session_id}.audit.jsonl"
        self._logger: AuditLogger = AuditLogger(log_path, self._session_id)

        # Record the opening event.
        self._logger.write(
            "SESSION_OPENED",
            {
                "case_number": case.case_number,
                "examiner_id": case.examiner_id,
            },
        )

    # ------------------------------------------------------------------
    # Context-manager support
    # ------------------------------------------------------------------

    def __enter__(self) -> "ForensicSession":
        """Return *self* to support use as a context manager."""
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: object,
    ) -> None:
        """Seal the session on context-manager exit if not already closed."""
        if not self._closed:
            self.close()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def register_artifact(self, artifact: Artifact) -> None:
        """Append *artifact* to the session and write an audit record.

        Parameters
        ----------
        artifact:
            A fully constructed :class:`~forensixd.core.models.Artifact` to
            register with this session.

        Raises
        ------
        SessionAlreadyClosedError
            If the session has already been closed via :meth:`close`.
        """
        if self._closed:
            raise SessionAlreadyClosedError(
                "Cannot register an artifact on a closed session.",
                context={"session_id": self._session_id},
            )

        with self._lock:
            self._artifacts.append(artifact)
            self._logger.write(
                "ARTIFACT_REGISTERED",
                {
                    "artifact_id": artifact.artifact_id,
                    "source_path": artifact.source_path,
                },
            )

    def record_event(
        self,
        event_type: str,
        description: str,
        metadata: dict | None = None,
    ) -> AcquisitionEvent:
        """Create and log an arbitrary chain-of-custody event.

        Parameters
        ----------
        event_type:
            Short, uppercase label describing the class of event
            (e.g. ``"DEVICE_CONNECTED"``).
        description:
            Human-readable description of what occurred.
        metadata:
            Optional mapping of additional structured context for the event.
            Must be JSON-serialisable.

        Returns
        -------
        AcquisitionEvent
            The newly created and logged event.

        Raises
        ------
        SessionAlreadyClosedError
            If the session has already been closed via :meth:`close`.
        """
        if self._closed:
            raise SessionAlreadyClosedError(
                "Cannot record an event on a closed session.",
                context={"session_id": self._session_id},
            )

        event = AcquisitionEvent(
            event_type=event_type,
            occurred_at=datetime.now(timezone.utc),
            actor=self._case.examiner_id,
            description=description,
            metadata=metadata or {},
        )

        self._logger.write(
            event_type,
            {
                "event_id": event.event_id,
                "description": description,
                **(metadata or {}),
            },
        )

        return event

    def close(self) -> SessionLog:
        """Seal the session and return a completed :class:`SessionLog`.

        Computes a root hash over all registered artefact SHA-256 digests
        (or the hash of ``b"empty"`` when no artefacts were registered),
        writes a ``SESSION_CLOSED`` audit record, seals the
        :class:`AuditLogger`, and returns an immutable
        :class:`~forensixd.core.models.SessionLog`.

        Returns
        -------
        SessionLog
            A fully populated, sealed session log.

        Raises
        ------
        SessionAlreadyClosedError
            If :meth:`close` has already been called on this session.
        """
        if self._closed:
            raise SessionAlreadyClosedError(
                "Session is already closed.",
                context={"session_id": self._session_id},
            )

        self._closed = True

        # Compute root hash — deterministic combination of all artefact digests.
        if not self._artifacts:
            root_hash: str = hashlib.sha256(b"empty").hexdigest()
        else:
            combined: str = "|".join(a.hashes.sha256 for a in self._artifacts)
            root_hash = hashlib.sha256(combined.encode()).hexdigest()

        ended_at: datetime = datetime.now(timezone.utc)

        self._logger.write(
            "SESSION_CLOSED",
            {
                "artifact_count": len(self._artifacts),
                "root_hash": root_hash,
            },
        )

        # Seal the audit log — writes SESSION_SEALED sentinel and closes the file.
        self._logger.seal()

        return SessionLog(
            session_id=self._session_id,
            case=self._case,
            started_at=self._started_at,
            ended_at=ended_at,
            artifacts=list(self._artifacts),
            root_hash=root_hash,
            is_sealed=True,
        )

    # ------------------------------------------------------------------
    # Properties
    # ------------------------------------------------------------------

    @property
    def session_id(self) -> str:
        """Unique identifier for this acquisition session (UUID v4)."""
        return self._session_id

    @property
    def artifact_count(self) -> int:
        """Number of artefacts registered in this session so far."""
        return len(self._artifacts)

    @property
    def is_closed(self) -> bool:
        """``True`` once the session has been sealed via :meth:`close`."""
        return self._closed

    @property
    def output_dir(self) -> Path:
        """Filesystem path to the case-specific output directory."""
        return self._case_dir
