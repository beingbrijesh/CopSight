"""Windows Registry hive parser backed by python-registry (optional dependency)."""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any

from pydantic import BaseModel

from forensixd.core.exceptions import ParseError

try:
    import Registry  # python-registry package

    REGISTRY_AVAILABLE: bool = True
except ImportError:  # pragma: no cover
    REGISTRY_AVAILABLE = False

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Windows FILETIME epoch: 1601-01-01 00:00:00 UTC expressed as a Unix
# timestamp (seconds since 1970-01-01).  Negative because 1601 is before 1970.
_FILETIME_EPOCH_DELTA_SECONDS: float = -11_644_473_600.0

# 100-nanosecond intervals per second.
_FILETIME_TICKS_PER_SECOND: int = 10_000_000


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------


class RegistryRecord(BaseModel, frozen=True):
    """Immutable representation of a single Windows Registry value."""

    key_path: str
    """Full registry key path (e.g. ``\\Software\\Microsoft\\Windows``)."""

    value_name: str
    """Registry value name; empty string represents the default value."""

    value_type: str
    """Registry value type string (e.g. ``REG_SZ``, ``REG_DWORD``)."""

    data: Any
    """Parsed value data; type depends on *value_type*."""

    last_written: datetime | None = None
    """UTC timestamp of the key's last write time, or *None* if unavailable."""


# ---------------------------------------------------------------------------
# Parser
# ---------------------------------------------------------------------------


class RegistryParser:
    """Static-method namespace for Windows Registry hive parsing.

    All public methods raise :class:`~forensixd.core.exceptions.ParseError` on
    failure rather than propagating low-level library exceptions.

    Requires the ``python-registry`` package to be installed.  Check
    :meth:`is_available` before use, or handle the resulting
    :class:`~forensixd.core.exceptions.ParseError` gracefully.
    """

    # ------------------------------------------------------------------
    # Availability guard
    # ------------------------------------------------------------------

    @staticmethod
    def is_available() -> bool:
        """Return *True* if the ``python-registry`` library is importable."""
        return REGISTRY_AVAILABLE

    # ------------------------------------------------------------------
    # Hive access
    # ------------------------------------------------------------------

    @staticmethod
    def open_hive(path: Path) -> Any:
        """Open a Registry hive file and return the root :class:`Registry.Registry` object.

        Parameters
        ----------
        path:
            Absolute path to the hive file (e.g. ``NTUSER.DAT``).

        Returns
        -------
        Registry.Registry
            The parsed hive object whose ``.root()`` method exposes the root key.

        Raises
        ------
        ParseError
            If ``python-registry`` is not installed, or if the hive cannot be
            opened (file not found, invalid format, etc.).
        """
        if not REGISTRY_AVAILABLE:
            raise ParseError(
                "python-registry is not installed; cannot parse Windows Registry hives. "
                "Install it with: pip install python-registry",
                context={"path": str(path)},
            )
        try:
            return Registry.Registry(str(path))  # type: ignore[union-attr]
        except Exception as exc:
            raise ParseError(
                f"Failed to open registry hive: {exc}",
                context={"path": str(path)},
            ) from exc

    # ------------------------------------------------------------------
    # Value conversion helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _convert_value(value: Any) -> Any:
        """Convert a raw registry value to a Python-native type.

        Conversion rules
        ----------------
        * ``REG_BINARY``  -> lowercase hex string (``"deadbeef"``).
        * ``REG_MULTI_SZ`` -> :class:`list` of :class:`str`.
        * ``REG_DWORD``, ``REG_QWORD`` -> :class:`int`.
        * ``REG_SZ``, ``REG_EXPAND_SZ`` -> :class:`str`.
        * Everything else -> the raw value returned by python-registry.
        """
        type_name: str = value.value_type_str()
        raw: Any = value.value()

        if type_name == "REG_BINARY":
            if isinstance(raw, (bytes, bytearray)):
                return raw.hex()
            return raw

        if type_name == "REG_MULTI_SZ":
            if isinstance(raw, list):
                return [str(item) for item in raw]
            return raw

        if type_name in ("REG_DWORD", "REG_DWORD_BIG_ENDIAN", "REG_QWORD"):
            return int(raw)

        if type_name in ("REG_SZ", "REG_EXPAND_SZ"):
            return str(raw) if raw is not None else ""

        return raw

    @staticmethod
    def _key_last_written(key: Any) -> datetime | None:
        """Return the IST last-written timestamp of *key*, or *None* on failure."""
        try:
            ts: datetime = key.timestamp()
            if ts.tzinfo is None:
                return ts.replace(tzinfo=timezone(timedelta(hours=5, minutes=30)))
            return ts.astimezone(timezone(timedelta(hours=5, minutes=30)))
        except Exception:  # noqa: BLE001
            return None

    # ------------------------------------------------------------------
    # Public parsing API
    # ------------------------------------------------------------------

    @staticmethod
    def walk_key(path: Path, key_path: str = "\\") -> list[RegistryRecord]:
        """Recursively walk a registry key and return all values as records.

        The traversal starts at *key_path* relative to the hive root.  Both
        the values at the starting key and all descendant sub-keys are
        collected into a flat list.

        Parameters
        ----------
        path:
            Path to the Registry hive file on disk.
        key_path:
            Backslash-separated path inside the hive.  Use ``"\\"`` (or ``""``)
            for the root key.

        Returns
        -------
        list[RegistryRecord]
            Flat list of all :class:`RegistryRecord` objects found under
            *key_path*.  Unreadable keys are silently skipped.

        Raises
        ------
        ParseError
            If the hive cannot be opened, or the starting *key_path* cannot
            be located.
        """
        reg = RegistryParser.open_hive(path)

        try:
            normalized: str = key_path.strip("\\")
            current_key = reg.root()
            if normalized:
                for segment in normalized.split("\\"):
                    current_key = current_key.subkey(segment)
        except Exception as exc:
            raise ParseError(
                f"Registry key not found: {key_path!r}",
                context={"path": str(path), "key_path": key_path},
            ) from exc

        records: list[RegistryRecord] = []
        RegistryParser._recurse_key(current_key, records)
        return records

    @staticmethod
    def _recurse_key(key: Any, records: list[RegistryRecord]) -> None:
        """Recursively collect all values from *key* into *records*.

        Unreadable sub-keys are silently skipped to maximise data recovery.
        """
        try:
            key_path_str: str = key.path()
            last_written: datetime | None = RegistryParser._key_last_written(key)

            for value in key.values():
                try:
                    records.append(
                        RegistryRecord(
                            key_path=key_path_str,
                            value_name=value.name(),
                            value_type=value.value_type_str(),
                            data=RegistryParser._convert_value(value),
                            last_written=last_written,
                        )
                    )
                except Exception:  # noqa: BLE001
                    continue

            for subkey in key.subkeys():
                try:
                    RegistryParser._recurse_key(subkey, records)
                except Exception:  # noqa: BLE001
                    continue

        except Exception:  # noqa: BLE001
            return

    @staticmethod
    def get_value(path: Path, key_path: str, value_name: str) -> Any:
        """Retrieve a single registry value by key path and value name.

        Parameters
        ----------
        path:
            Path to the Registry hive file on disk.
        key_path:
            Backslash-separated path to the containing key inside the hive.
        value_name:
            Name of the value to retrieve.  Pass an empty string for the
            default value.

        Returns
        -------
        Any
            The converted value data, or *None* if the key or value does not
            exist.

        Raises
        ------
        ParseError
            If the hive cannot be opened.
        """
        reg = RegistryParser.open_hive(path)

        try:
            normalized: str = key_path.strip("\\")
            current_key = reg.root()
            if normalized:
                for segment in normalized.split("\\"):
                    current_key = current_key.subkey(segment)
            value = current_key.value(value_name)
            return RegistryParser._convert_value(value)
        except Exception:  # noqa: BLE001
            return None

    # ------------------------------------------------------------------
    # FILETIME utility
    # ------------------------------------------------------------------

    @staticmethod
    def convert_filetime(filetime: int) -> datetime:
        """Convert a Windows FILETIME integer to a timezone-aware IST datetime.

        Windows FILETIME counts 100-nanosecond intervals since
        1601-01-01 00:00:00 UTC.

        Parameters
        ----------
        filetime:
            Raw 64-bit Windows FILETIME value.

        Returns
        -------
        datetime
            Equivalent IST-aware :class:`~datetime.datetime` object.

        Examples
        --------
        >>> RegistryParser.convert_filetime(132_000_000_000_000_000)
        datetime.datetime(2019, 10, 14, 2, 13, 20, tzinfo=datetime.timezone(timedelta(hours=5, minutes=30)))
        """
        total_seconds_since_1601: float = filetime / _FILETIME_TICKS_PER_SECOND
        unix_timestamp: float = total_seconds_since_1601 + _FILETIME_EPOCH_DELTA_SECONDS
        return datetime.fromtimestamp(unix_timestamp, tz=timezone(timedelta(hours=5, minutes=30)))


__all__ = ["RegistryParser", "RegistryRecord"]
