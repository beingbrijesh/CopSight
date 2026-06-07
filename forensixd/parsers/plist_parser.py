"""Parser for Apple Property List (plist) files — both XML and binary formats.

Supports standard ``plistlib`` for all plist variants and optionally leverages
the third-party ``biplist`` library for improved binary plist compatibility when
it is available on the environment.
"""

from __future__ import annotations

import io
import plistlib
from datetime import timedelta, datetime, timezone
from pathlib import Path
from typing import Any

from forensixd.core.exceptions import ParseError

# ---------------------------------------------------------------------------
# Optional biplist integration
# ---------------------------------------------------------------------------

try:
    import biplist  # type: ignore[import-untyped]

    BIPLIST_AVAILABLE: bool = True
except ImportError:  # pragma: no cover
    BIPLIST_AVAILABLE = False

# Magic bytes that identify a binary plist file.
BPLIST_MAGIC: bytes = b"bplist00"

__all__ = ["PlistParser"]


class PlistParser:
    """Static-method collection for parsing Apple Property List files.

    Supports both XML and binary (bplist00) plist formats.  When the optional
    ``biplist`` package is installed, binary plists are parsed through it for
    broader format compatibility; otherwise ``plistlib`` is used as the
    fallback.

    All public methods perform recursive type normalisation via
    :meth:`_convert_types` before returning, ensuring that:

    * Naive :class:`~datetime.datetime` objects are tagged with IST.
    * :class:`bytes` values are hex-encoded strings so that results are safely
      JSON-serialisable.
    """

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    @staticmethod
    def parse(path: Path) -> dict[str, Any]:
        """Parse a plist file from *path* and return its contents as a dict.

        The parser inspects the first eight bytes of the file to detect binary
        plists (``bplist00`` magic).  Binary files are dispatched to
        :meth:`_parse_binary`; all other files are parsed with
        :mod:`plistlib`.

        Parameters
        ----------
        path:
            Absolute or relative filesystem path to the ``.plist`` file.

        Returns
        -------
        dict[str, Any]
            Parsed plist payload with types normalised by
            :meth:`_convert_types`.

        Raises
        ------
        ParseError
            If the file cannot be opened or the plist data is malformed.
        """
        try:
            with open(path, "rb") as fh:
                header: bytes = fh.read(8)

            if header.startswith(BPLIST_MAGIC):
                raw: Any = PlistParser._parse_binary(path)
            else:
                with open(path, "rb") as fh:
                    raw = plistlib.load(fh)

            return PlistParser._convert_types(raw)  # type: ignore[return-value]
        except ParseError:
            raise
        except Exception as exc:
            raise ParseError(
                f"Failed to parse plist file: {path}",
                context={"path": str(path), "error": str(exc)},
            ) from exc

    @staticmethod
    def parse_bytes(data: bytes) -> dict[str, Any]:
        """Parse a plist from an in-memory *data* buffer.

        The same binary-vs-XML detection logic used by :meth:`parse` applies.

        Parameters
        ----------
        data:
            Raw bytes of the plist (file contents already read into memory).

        Returns
        -------
        dict[str, Any]
            Parsed plist payload with types normalised by
            :meth:`_convert_types`.

        Raises
        ------
        ParseError
            If the bytes cannot be decoded as a valid plist.
        """
        try:
            if data[:8].startswith(BPLIST_MAGIC) and BIPLIST_AVAILABLE:
                raw: Any = biplist.readPlistFromString(data)  # type: ignore[attr-defined]
            else:
                raw = plistlib.load(io.BytesIO(data))

            return PlistParser._convert_types(raw)  # type: ignore[return-value]
        except ParseError:
            raise
        except Exception as exc:
            raise ParseError(
                "Failed to parse plist from bytes",
                context={"data_length": len(data), "error": str(exc)},
            ) from exc

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _parse_binary(path: Path) -> Any:
        """Parse a binary plist file, preferring ``biplist`` when available.

        Parameters
        ----------
        path:
            Filesystem path to the binary plist.

        Returns
        -------
        Any
            The raw parsed Python object (dict, list, or scalar) before type
            normalisation.

        Raises
        ------
        Exception
            Any exception raised by the underlying parser is propagated
            to :meth:`parse` for wrapping into a
            :class:`~forensixd.core.exceptions.ParseError`.
        """
        if BIPLIST_AVAILABLE:
            return biplist.readPlist(str(path))  # type: ignore[attr-defined]

        with open(path, "rb") as fh:
            return plistlib.load(fh)

    @staticmethod
    def _convert_types(obj: Any) -> Any:
        """Recursively normalise plist values for safe downstream consumption.

        Transformations applied:

        * :class:`~datetime.datetime` without timezone info → IST-aware.
        * :class:`bytes` → lowercase hex string (e.g. ``"deadbeef"``).
        * :class:`dict` → recurse over values.
        * :class:`list` → recurse over items.
        * All other types are returned unchanged.

        Parameters
        ----------
        obj:
            A Python object returned by ``plistlib`` or ``biplist``.

        Returns
        -------
        Any
            The normalised object.
        """
        if isinstance(obj, datetime):
            if obj.tzinfo is None:
                return obj.replace(tzinfo=timezone(timedelta(hours=5, minutes=30)))
            return obj

        if isinstance(obj, bytes):
            return obj.hex()

        if isinstance(obj, dict):
            return {key: PlistParser._convert_types(value) for key, value in obj.items()}

        if isinstance(obj, list):
            return [PlistParser._convert_types(item) for item in obj]

        return obj
