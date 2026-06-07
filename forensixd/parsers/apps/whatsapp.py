"""
forensixd.parsers.apps.whatsapp
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Parser for WhatsApp message databases on Android and iOS.

Supported formats
-----------------
* **Android plain**       – ``msgstore.db`` (unencrypted SQLite)
* **Android crypt15**     – ``msgstore.db.crypt15`` (AES-256-GCM encrypted)
* **iOS**                 – ``ChatStorage.sqlite`` (SQLite, Apple epoch timestamps)

The parser is registered under four identifiers so that
:class:`~forensixd.parsers.base.ParserRegistry` can discover it from any
artifact whose ``source_path`` or ``source_app`` contains one of:

* ``"com.whatsapp"``
* ``"msgstore.db"``
* ``"chatstorage.sqlite"``
* ``"whatsapp"``

Encryption
----------
Crypt15 decryption requires the ``pycryptodome`` package
(``pip install pycryptodome``).  If the package is unavailable,
:meth:`WhatsAppParser._parse_android_encrypted` raises
:class:`~forensixd.core.exceptions.EncryptionError` immediately rather
than silently returning an empty list.
"""

from __future__ import annotations

import tempfile
from datetime import timedelta, datetime, timezone
from pathlib import Path
from typing import Any

from forensixd.core.exceptions import EncryptionError, ParseError
from forensixd.core.models import Artifact, ArtifactType, ParsedRecord
from forensixd.parsers.base import AbstractParser, ParserRegistry
from forensixd.parsers.sqlite_parser import SQLiteParser

# ---------------------------------------------------------------------------
# Optional crypto dependency
# ---------------------------------------------------------------------------

try:
    from Crypto.Cipher import AES  # pycryptodome

    CRYPTO_AVAILABLE = True
except ImportError:  # pragma: no cover
    CRYPTO_AVAILABLE = False

__all__ = ["WhatsAppParser", "CRYPTO_AVAILABLE"]

# ---------------------------------------------------------------------------
# Apple CoreData epoch offset (seconds between 2001-01-01 and 1970-01-01)
# ---------------------------------------------------------------------------

_APPLE_EPOCH_OFFSET: int = 978_307_200

# ---------------------------------------------------------------------------
# Parser
# ---------------------------------------------------------------------------


@ParserRegistry.register("com.whatsapp", "msgstore.db", "chatstorage.sqlite", "whatsapp")
class WhatsAppParser(AbstractParser):
    """Parse WhatsApp message databases on Android and iOS.

    Android
    -------
    * Plain ``msgstore.db`` – passed directly to :meth:`_extract_android_messages`.
    * Crypt15 ``msgstore.db.crypt15`` – decrypted in-memory (or via a
      temporary file) then passed to :meth:`_extract_android_messages`.

    iOS
    ---
    * ``ChatStorage.sqlite`` – uses the ``ZWAMESSAGE`` table with Apple
      CoreData epoch timestamps (seconds since 2001-01-01 UTC).

    Notes
    -----
    The key file for crypt15 is resolved as a sibling of the encrypted
    database named ``key`` (the file WhatsApp writes to
    ``/data/data/com.whatsapp/files/key``).  If that file is absent the
    parser raises :class:`~forensixd.core.exceptions.EncryptionError`.
    """

    # ------------------------------------------------------------------
    # AbstractParser interface
    # ------------------------------------------------------------------

    @property
    def app_name(self) -> str:
        """Human-readable identifier for this parser."""
        return "WhatsApp"

    def can_parse(self, artifact: Artifact) -> bool:
        """Return *True* when the artifact path contains a WhatsApp keyword.

        Parameters
        ----------
        artifact:
            Candidate forensic artifact.

        Returns
        -------
        bool
            ``True`` if any of ``"whatsapp"``, ``"msgstore"``, or
            ``"chatstorage"`` appear (case-insensitively) in
            ``artifact.source_path``.
        """
        lower = artifact.source_path.lower()
        return any(kw in lower for kw in ("whatsapp", "msgstore", "chatstorage"))

    def parse(self, artifact: Artifact) -> list[ParsedRecord]:
        """Dispatch to the correct sub-parser based on the file name/suffix.

        Routing rules
        -------------
        * File name contains ``"crypt"``  → :meth:`_parse_android_encrypted`
        * File suffix is ``.sqlite``       → :meth:`_parse_ios`
        * Otherwise                        → :meth:`_parse_android_plain`

        Parameters
        ----------
        artifact:
            The forensic artifact to parse.

        Returns
        -------
        list[ParsedRecord]
            Zero or more structured message records.

        Raises
        ------
        ParseError
            If the underlying database is malformed or the expected schema
            is absent.
        EncryptionError
            If the crypt15 blob cannot be decrypted (missing key file,
            unavailable ``pycryptodome``, or corrupted ciphertext).
        """
        path = Path(artifact.source_path)

        if "crypt" in path.name.lower():
            return self._parse_android_encrypted(path, artifact)
        if path.suffix.lower() == ".sqlite":
            return self._parse_ios(artifact)
        return self._parse_android_plain(path, artifact)

    # ------------------------------------------------------------------
    # Private: Android encrypted (crypt15)
    # ------------------------------------------------------------------

    @staticmethod
    def _decrypt_crypt15(key_path: Path, db_path: Path) -> bytes:
        """Decrypt a WhatsApp crypt15 database blob and return raw SQLite bytes.

        The crypt15 layout is:
        * bytes   0–34  : file header / magic (skipped)
        * bytes  35–66  : 32-byte AES-256 key
        * *(encrypted file)*
        * bytes  67–82  : 16-byte GCM nonce / IV
        * bytes  83–(n-17) : ciphertext
        * bytes  (n-16)–n  : 16-byte GCM authentication tag

        Parameters
        ----------
        key_path:
            Path to the WhatsApp ``key`` file extracted from the device.
        db_path:
            Path to the ``msgstore.db.crypt15`` blob.

        Returns
        -------
        bytes
            Decrypted SQLite database bytes.

        Raises
        ------
        EncryptionError
            * ``pycryptodome`` is not installed.
            * Key file is shorter than 67 bytes.
            * GCM authentication tag verification fails (tampered data).
        """
        if not CRYPTO_AVAILABLE:
            raise EncryptionError(
                "pycryptodome is required for crypt15 decryption. "
                "Install it with: pip install pycryptodome",
                context={"db_path": str(db_path)},
            )

        key_data = key_path.read_bytes()
        if len(key_data) < 67:
            raise EncryptionError(
                f"Key file is too short ({len(key_data)} bytes); expected at least 67 bytes.",
                context={"key_path": str(key_path)},
            )

        aes_key: bytes = key_data[35:67]  # 32-byte AES-256 key

        db_data = db_path.read_bytes()
        iv: bytes = db_data[67:83]           # 16-byte GCM nonce
        ciphertext: bytes = db_data[83:-16]  # variable-length encrypted payload
        tag: bytes = db_data[-16:]           # 16-byte GCM authentication tag

        cipher = AES.new(aes_key, AES.MODE_GCM, nonce=iv)  # type: ignore[attr-defined]
        try:
            return cipher.decrypt_and_verify(ciphertext, tag)
        except ValueError as exc:
            raise EncryptionError(
                f"crypt15 GCM authentication failed — data may be corrupted or tampered: {exc}",
                context={"db_path": str(db_path)},
            ) from exc

    def _parse_android_encrypted(
        self, path: Path, artifact: Artifact
    ) -> list[ParsedRecord]:
        """Decrypt a crypt15 blob, write it to a temp file, and extract records.

        The sibling ``key`` file is expected to live in the same directory as
        the encrypted database (the path WhatsApp uses on-device:
        ``/data/data/com.whatsapp/files/key``).

        Parameters
        ----------
        path:
            Path to the ``.crypt15`` file.
        artifact:
            Source artifact (forwarded to :meth:`_extract_android_messages`).

        Returns
        -------
        list[ParsedRecord]

        Raises
        ------
        EncryptionError
            If the ``key`` file is missing or decryption fails.
        ParseError
            If the decrypted database does not contain the expected schema.
        """
        key_path = path.parent / "key"
        if not key_path.exists():
            raise EncryptionError(
                f"WhatsApp key file not found at expected location: {key_path}",
                context={"key_path": str(key_path), "db_path": str(path)},
            )

        plaintext = self._decrypt_crypt15(key_path, path)

        # Write decrypted bytes to a temporary file so SQLiteParser can open it.
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
            tmp_path = Path(tmp.name)
            tmp.write(plaintext)

        try:
            return self._extract_android_messages(tmp_path, artifact)
        finally:
            try:
                tmp_path.unlink(missing_ok=True)
            except OSError:
                pass  # Best-effort cleanup; do not mask parse errors.

    def _parse_android_plain(
        self, path: Path, artifact: Artifact
    ) -> list[ParsedRecord]:
        """Parse an unencrypted Android ``msgstore.db`` directly.

        Parameters
        ----------
        path:
            Path to the plain ``msgstore.db`` file.
        artifact:
            Source artifact.

        Returns
        -------
        list[ParsedRecord]

        Raises
        ------
        ParseError
            If the file does not exist or the schema is unexpected.
        """
        return self._extract_android_messages(path, artifact)

    # ------------------------------------------------------------------
    # Private: Android message extraction
    # ------------------------------------------------------------------

    def _extract_android_messages(
        self, db: Path, artifact: Artifact
    ) -> list[ParsedRecord]:
        """Query the ``messages`` table and convert rows to :class:`ParsedRecord`.

        Parameters
        ----------
        db:
            Path to an accessible (plain) SQLite database.
        artifact:
            The source artifact whose ``artifact_id`` is embedded in each
            record.

        Returns
        -------
        list[ParsedRecord]
            Up to 50 000 message records.

        Raises
        ------
        ParseError
            If the ``messages`` table does not exist in the database.
        """
        if not SQLiteParser.table_exists(db, "messages"):
            raise ParseError(
                "Required table 'messages' not found in Android WhatsApp database.",
                context={"db_path": str(db), "artifact_id": artifact.artifact_id},
            )

        sql = (
            "SELECT key_remote_jid, data, timestamp, key_from_me, media_url "
            "FROM messages "
            "WHERE data IS NOT NULL "
            "LIMIT 50000"
        )
        rows = SQLiteParser.query(db, sql)

        now = datetime.now(tz=timezone(timedelta(hours=5, minutes=30)))
        records: list[ParsedRecord] = []

        for row in rows:
            raw_ts: Any = row.get("timestamp")
            try:
                ts = datetime.fromtimestamp(int(raw_ts) / 1000, tz=timezone(timedelta(hours=5, minutes=30)))
            except (TypeError, ValueError, OSError):
                ts = now

            fields: dict[str, Any] = {
                "body": row.get("data"),
                "timestamp": ts.isoformat(),
                "from": row.get("key_remote_jid"),
                "is_from_me": bool(row.get("key_from_me")),
                "media_url": row.get("media_url"),
            }

            records.append(
                ParsedRecord(
                    record_type=ArtifactType.MESSAGE,
                    source_artifact_id=artifact.artifact_id,
                    parsed_at=now,
                    confidence=0.98,
                    fields=fields,
                    app_name=self.app_name,
                )
            )

        return records

    # ------------------------------------------------------------------
    # Private: iOS (ChatStorage.sqlite)
    # ------------------------------------------------------------------

    def _parse_ios(self, artifact: Artifact) -> list[ParsedRecord]:
        """Parse an iOS ``ChatStorage.sqlite`` database.

        The ``ZWAMESSAGE`` table stores message timestamps as seconds since
        the Apple CoreData epoch (2001-01-01 00:00:00 UTC), rather than the
        Unix epoch.  The offset is 978 307 200 seconds.

        Parameters
        ----------
        artifact:
            The forensic artifact to parse.

        Returns
        -------
        list[ParsedRecord]
            Up to 50 000 message records with ``confidence=0.97``.

        Raises
        ------
        ParseError
            If the ``ZWAMESSAGE`` table is absent from the database.
        """
        db = Path(artifact.source_path)

        if not SQLiteParser.table_exists(db, "ZWAMESSAGE"):
            raise ParseError(
                "Required table 'ZWAMESSAGE' not found in iOS WhatsApp database.",
                context={"db_path": str(db), "artifact_id": artifact.artifact_id},
            )

        sql = (
            "SELECT ZFROMJID, ZTEXT, ZMESSAGEDATE, ZISFROMME, ZMEDIAURL "
            "FROM ZWAMESSAGE "
            "WHERE ZTEXT IS NOT NULL "
            "LIMIT 50000"
        )
        rows = SQLiteParser.query(db, sql)

        now = datetime.now(tz=timezone(timedelta(hours=5, minutes=30)))
        records: list[ParsedRecord] = []

        for row in rows:
            raw_ts: Any = row.get("ZMESSAGEDATE")
            try:
                ts = datetime.fromtimestamp(
                    _APPLE_EPOCH_OFFSET + float(raw_ts), tz=timezone(timedelta(hours=5, minutes=30))
                )
            except (TypeError, ValueError, OSError):
                ts = now

            fields: dict[str, Any] = {
                "body": row.get("ZTEXT"),
                "timestamp": ts.isoformat(),
                "from": row.get("ZFROMJID"),
                "is_from_me": bool(row.get("ZISFROMME")),
                "media_url": row.get("ZMEDIAURL"),
            }

            records.append(
                ParsedRecord(
                    record_type=ArtifactType.MESSAGE,
                    source_artifact_id=artifact.artifact_id,
                    parsed_at=now,
                    confidence=0.97,
                    fields=fields,
                    app_name=self.app_name,
                )
            )

        return records
