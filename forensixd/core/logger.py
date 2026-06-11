"""
forensixd.core.logger
~~~~~~~~~~~~~~~~~~~~~
Tamper-evident, hash-chained audit log for forensic sessions.

Each log line is a JSON object containing a running sequence number,
an IST timestamp, the originating session ID, the event name, arbitrary
event data, the hash of the *previous* line, and the SHA-256 hash of
the current line (computed over all other fields with sorted keys).

The resulting chain means that any single-line edit, insertion, or
deletion breaks the hash verification of every subsequent line —
giving a lightweight but strong integrity guarantee for forensic use.
"""

from __future__ import annotations

import json
import hashlib
import threading
from datetime import timedelta, datetime, timezone
from pathlib import Path
from typing import IO, Any

__all__ = ["AuditLogger"]


def _sha256_of(obj: dict[str, Any]) -> str:
    """Return the hex SHA-256 of *obj* serialised with sorted keys."""
    raw = json.dumps(obj, sort_keys=True).encode()
    return hashlib.sha256(raw).hexdigest()


class AuditLogger:
    """Thread-safe, hash-chained JSONL audit logger.

    Each entry written by :meth:`write` is appended as a single JSON
    line containing a ``line_hash`` field.  The hash is computed over
    all *other* fields (including ``prev_hash``, which is the
    ``line_hash`` of the previous entry), forming an immutable chain.

    Parameters
    ----------
    log_path:
        Filesystem path for the JSONL log file.  The file is opened in
        append+text mode and is created if it does not already exist.
    session_id:
        Opaque identifier for the forensic session being recorded.
    """

    def __init__(self, log_path: Path, session_id: str) -> None:
        self._log_path: Path = log_path
        self._session_id: str = session_id
        self._seq: int = 0
        self._prev_hash: str = "0" * 64
        self._lock: threading.Lock = threading.Lock()

        # Ensure parent directories exist, then open in append+text mode.
        log_path.parent.mkdir(parents=True, exist_ok=True)
        self._file: IO[str] = log_path.open("a", encoding="utf-8")

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def write(self, event: str, data: dict[str, Any]) -> None:
        """Append a single hash-chained audit record to the log.

        The method is thread-safe: all mutations of internal state and
        all file I/O occur inside ``self._lock``.

        Parameters
        ----------
        event:
            Short, uppercase identifier for the event type
            (e.g. ``"FILE_HASHED"``, ``"SESSION_SEALED"``).
        data:
            Arbitrary mapping of event-specific fields.  Must be
            JSON-serialisable.
        """
        with self._lock:
            # Build the record in the required key order.
            record: dict[str, Any] = {
                "seq": self._seq,
                "ts": datetime.now(tz=timezone(timedelta(hours=5, minutes=30))).isoformat(),
                "session_id": self._session_id,
                "event": event,
                "data": data,
                "prev_hash": self._prev_hash,
            }

            # Compute the chain hash over the record without line_hash.
            line_hash: str = _sha256_of(record)
            record["line_hash"] = line_hash

            # Persist immediately.
            self._file.write(json.dumps(record) + "\n")
            self._file.flush()

            # Advance chain state.
            self._prev_hash = line_hash
            self._seq += 1

    def seal(self) -> str:
        """Write a ``SESSION_SEALED`` sentinel and close the log file.

        Returns
        -------
        str
            The SHA-256 ``line_hash`` of the final (seal) record,
            which serves as the definitive chain fingerprint for this
            session.
        """
        self.write("SESSION_SEALED", {})
        with self._lock:
            self._file.close()
        return self._prev_hash

    def verify(self) -> bool:
        """Re-read every log line and validate the hash chain.

        For each line the method:

        1. Parses the JSON object.
        2. Pops ``line_hash`` from the parsed dict.
        3. Re-computes SHA-256 over the remaining fields (sorted keys)
           and compares it to the stored ``line_hash``.
        4. Checks that the current line's ``prev_hash`` matches the
           ``line_hash`` of the immediately preceding line
           (``"0" * 64`` for the very first line).

        Returns
        -------
        bool
            ``True`` if every line passes both checks; ``False`` on any
            failure or parse error — this method never raises.
        """
        try:
            with self._lock:
                lines = self._log_path.read_text(encoding="utf-8").splitlines()

            expected_prev: str = "0" * 64

            for raw in lines:
                raw = raw.strip()
                if not raw:
                    continue

                entry: dict[str, Any] = json.loads(raw)

                # Extract the stored hash before recomputing.
                stored_hash: str = entry.pop("line_hash")

                # Validate prev_hash linkage.
                if entry.get("prev_hash") != expected_prev:
                    return False

                # Recompute and compare.
                computed: str = _sha256_of(entry)
                if computed != stored_hash:
                    return False

                expected_prev = stored_hash

        except Exception:  # noqa: BLE001
            return False

        return True

    @classmethod
    def from_file(cls, log_path: Path) -> "AuditLogger":
        """Resume an existing log, restoring chain state from the last line.

        Creates an :class:`AuditLogger` instance bound to *log_path*,
        reads the final line to restore ``_seq`` and ``_prev_hash``,
        then opens the file in append mode ready for new entries.

        Parameters
        ----------
        log_path:
            Path to an existing JSONL audit log produced by this class.

        Returns
        -------
        AuditLogger
            A fully initialised instance ready to continue the chain.

        Raises
        ------
        FileNotFoundError
            If *log_path* does not exist.
        ValueError
            If the file is empty or the last line cannot be parsed.
        """
        with threading.Lock():
            text = log_path.read_text(encoding="utf-8")

        lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
        if not lines:
            raise ValueError(f"Audit log is empty: {log_path}")

        last_entry: dict[str, Any] = json.loads(lines[-1])

        # Manufacture a minimal instance without reopening the file yet.
        instance = cls.__new__(cls)
        instance._log_path = log_path
        instance._session_id = last_entry.get("session_id", "")
        instance._seq = int(last_entry["seq"]) + 1
        instance._prev_hash = last_entry["line_hash"]
        instance._lock = threading.Lock()

        # Open in append mode so the chain can continue.
        instance._file = log_path.open("a", encoding="utf-8")

        return instance
