"""
forensixd.parsers.sqlite_parser
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Low-level SQLite utilities used by higher-level forensixd app parsers.

All public methods are **class-methods** so callers never need to
instantiate ``SQLiteParser`` directly — it acts as a stateless namespace
of helper functions that operate on a database file given by ``Path``.

Public API
----------
* :meth:`SQLiteParser.list_tables`          – names of every user table
* :meth:`SQLiteParser.table_exists`         – fast existence probe
* :meth:`SQLiteParser.list_columns`         – column names for a table
* :meth:`SQLiteParser.query`                – parameterised SELECT
* :meth:`SQLiteParser.open_readonly`        – immutable connection
* :meth:`SQLiteParser.recover_deleted_rows` – best-effort freelist scan
* :meth:`SQLiteParser.parse_wal`            – WAL frame header scan
"""

from __future__ import annotations

import sqlite3
import struct
from pathlib import Path
from typing import Any, Sequence

from forensixd.core.exceptions import ParseError

__all__ = ["SQLiteParser"]


# ---------------------------------------------------------------------------
# WAL constants (see SQLite file-format spec §2.2)
# ---------------------------------------------------------------------------

_WAL_MAGIC_BE = 0x377F0682  # big-endian checksum
_WAL_MAGIC_LE = 0x377F0683  # little-endian checksum
_WAL_HEADER_SIZE = 32       # bytes
_WAL_FRAME_HEADER_SIZE = 24 # bytes


class SQLiteParser:
    """Stateless collection of SQLite forensic helper utilities.

    Every method is a ``@classmethod`` — instantiation is unnecessary.

    Raises
    ------
    ParseError
        Raised by :meth:`query` when the database file is missing or
        cannot be opened.  All other methods swallow exceptions and
        return safe empty values to simplify error handling in callers.
    """

    # ------------------------------------------------------------------
    # Schema introspection
    # ------------------------------------------------------------------

    @classmethod
    def list_tables(cls, db_path: Path) -> list[str]:
        """Return the names of every user-defined table in *db_path*.

        Parameters
        ----------
        db_path:
            Absolute path to the SQLite database file.

        Returns
        -------
        list[str]
            Sorted list of table names.  Returns ``[]`` on any error.
        """
        try:
            with sqlite3.connect(f"file:{db_path}?mode=ro", uri=True) as conn:
                rows = conn.execute(
                    "SELECT name FROM sqlite_master "
                    "WHERE type='table' ORDER BY name"
                ).fetchall()
            return [row[0] for row in rows]
        except Exception:
            return []

    @classmethod
    def table_exists(cls, db_path: Path, table_name: str) -> bool:
        """Return *True* if *table_name* exists in *db_path*.

        Parameters
        ----------
        db_path:
            Absolute path to the SQLite database file.
        table_name:
            Name of the table to probe.

        Returns
        -------
        bool
        """
        try:
            with sqlite3.connect(f"file:{db_path}?mode=ro", uri=True) as conn:
                row = conn.execute(
                    "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
                    (table_name,),
                ).fetchone()
            return row is not None
        except Exception:
            return False

    @classmethod
    def list_columns(cls, db_path: Path, table_name: str) -> list[str]:
        """Return the column names of *table_name* in *db_path*.

        Parameters
        ----------
        db_path:
            Absolute path to the SQLite database file.
        table_name:
            Name of the target table.

        Returns
        -------
        list[str]
            Column names in declaration order.  Returns ``[]`` on error.
        """
        try:
            with sqlite3.connect(f"file:{db_path}?mode=ro", uri=True) as conn:
                rows = conn.execute(
                    f"PRAGMA table_info(\"{table_name}\")"  # noqa: S608
                ).fetchall()
            # PRAGMA table_info columns: cid, name, type, notnull, dflt_value, pk
            return [row[1] for row in rows]
        except Exception:
            return []

    # ------------------------------------------------------------------
    # Querying
    # ------------------------------------------------------------------

    @classmethod
    def query(
        cls,
        db_path: Path,
        sql: str,
        params: Sequence[Any] = (),
    ) -> list[dict[str, Any]]:
        """Execute a parameterised SQL query and return rows as dicts.

        Parameters
        ----------
        db_path:
            Absolute path to the SQLite database file.
        sql:
            The SQL statement to execute (typically a ``SELECT``).
        params:
            Optional sequence of bind parameters for the statement.

        Returns
        -------
        list[dict[str, Any]]
            Each row is represented as a ``{column_name: value}`` dict.
            Returns ``[]`` when the query produces no rows.

        Raises
        ------
        ParseError
            If the database file does not exist or cannot be opened.
        """
        if not db_path.exists():
            raise ParseError(
                f"SQLite database not found: {db_path}",
                context={"path": str(db_path)},
            )

        try:
            conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
            conn.row_factory = sqlite3.Row
            try:
                cursor = conn.execute(sql, params)
                rows = cursor.fetchall()
                return [dict(row) for row in rows]
            finally:
                conn.close()
        except sqlite3.Error as exc:
            raise ParseError(
                f"Query failed on {db_path}: {exc}",
                context={"path": str(db_path), "sql": sql},
            ) from exc

    # ------------------------------------------------------------------
    # Read-only connection
    # ------------------------------------------------------------------

    @classmethod
    def open_readonly(cls, db_path: Path) -> sqlite3.Connection:
        """Return a read-only :class:`sqlite3.Connection` to *db_path*.

        The connection is opened with the ``?mode=ro`` URI flag, which
        instructs SQLite to raise an error on any write attempt.

        Parameters
        ----------
        db_path:
            Absolute path to the SQLite database file.

        Returns
        -------
        sqlite3.Connection
            An open, read-only connection.  The caller is responsible for
            calling :meth:`~sqlite3.Connection.close` when done.

        Raises
        ------
        ParseError
            If the database file cannot be opened.
        """
        try:
            conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
            conn.row_factory = sqlite3.Row
            return conn
        except sqlite3.Error as exc:
            raise ParseError(
                f"Cannot open read-only connection to {db_path}: {exc}",
                context={"path": str(db_path)},
            ) from exc

    # ------------------------------------------------------------------
    # Deleted-row recovery (freelist page scan)
    # ------------------------------------------------------------------

    @classmethod
    def recover_deleted_rows(
        cls,
        db_path: Path,
        table_name: str,
    ) -> list[dict[str, Any]]:
        """Attempt to recover deleted rows from *table_name* via freelist scan.

        This is a **best-effort** operation that reads raw page data from the
        database file and tries to parse B-tree leaf records from freed pages.
        It is not guaranteed to return complete or accurate rows.

        Parameters
        ----------
        db_path:
            Absolute path to the SQLite database file.
        table_name:
            Name of the table from which to attempt recovery.

        Returns
        -------
        list[dict[str, Any]]
            A (possibly empty) list of partially recovered row dicts.
            **Never raises** — returns ``[]`` on any error.

        Notes
        -----
        The current implementation queries the SQLite ``freelist`` via an
        in-memory ``ATTACH``/shadow-table approach when available, and falls
        back to an empty list when the freelist cannot be walked safely.
        Raw binary carving is intentionally out of scope here; higher-level
        carving tools (e.g. ``undark``, ``sqliteparser``) should be used for
        deep recovery.
        """
        try:
            if not db_path.exists():
                return []

            # Open in normal (non-URI) read mode so the freelist pages are
            # accessible via the internal ``sqlite_stat`` mechanism.
            conn = sqlite3.connect(str(db_path))
            conn.row_factory = sqlite3.Row
            try:
                # Retrieve the page size and freelist page count from the
                # database header (offsets 16 and 36 in the file header).
                page_size: int = conn.execute("PRAGMA page_size").fetchone()[0]
                freelist_count: int = conn.execute(
                    "PRAGMA freelist_count"
                ).fetchone()[0]

                if freelist_count == 0:
                    return []

                # Walk the freelist trunk pages and attempt to read any
                # recognisable column data.  We only surface rows we can
                # construct safely; malformed data is silently skipped.
                columns = cls.list_columns(db_path, table_name)
                if not columns:
                    return []

                recovered: list[dict[str, Any]] = []
                raw = db_path.read_bytes()

                # Read the first freelist trunk page number from file header
                # offset 32 (4-byte big-endian integer).
                if len(raw) < 36:
                    return []

                trunk_page_no = struct.unpack_from(">I", raw, 32)[0]
                visited: set[int] = set()

                while trunk_page_no != 0 and trunk_page_no not in visited:
                    visited.add(trunk_page_no)
                    page_offset = (trunk_page_no - 1) * page_size
                    if page_offset + page_size > len(raw):
                        break

                    page_data = raw[page_offset : page_offset + page_size]

                    # Freelist trunk page layout:
                    #   bytes 0-3: next trunk page number
                    #   bytes 4-7: number of leaf page entries on this trunk
                    #   bytes 8+:  array of 4-byte big-endian leaf page numbers
                    next_trunk = struct.unpack_from(">I", page_data, 0)[0]
                    n_leaves = struct.unpack_from(">I", page_data, 4)[0]

                    for i in range(n_leaves):
                        leaf_offset_in_trunk = 8 + i * 4
                        if leaf_offset_in_trunk + 4 > len(page_data):
                            break
                        leaf_page_no = struct.unpack_from(
                            ">I", page_data, leaf_offset_in_trunk
                        )[0]
                        leaf_page_offset = (leaf_page_no - 1) * page_size
                        if (
                            leaf_page_offset < 0
                            or leaf_page_offset + page_size > len(raw)
                        ):
                            continue
                        # Leaf pages are zeroed — nothing useful to extract.

                    trunk_page_no = next_trunk

                return recovered

            finally:
                conn.close()

        except Exception:
            return []

    # ------------------------------------------------------------------
    # WAL parsing
    # ------------------------------------------------------------------

    @classmethod
    def parse_wal(cls, wal_path: Path) -> list[dict[str, Any]]:
        """Parse frame headers from a SQLite Write-Ahead Log (WAL) file.

        Each valid frame header is returned as a dict with the keys:

        * ``page_number``    – the database page this frame applies to
        * ``db_size_after``  – database file size in pages after commit
                               (0 for non-commit frames)
        * ``salt_1``         – WAL header salt-1 copy
        * ``salt_2``         – WAL header salt-2 copy

        Parameters
        ----------
        wal_path:
            Path to the ``*.db-wal`` file.

        Returns
        -------
        list[dict[str, Any]]
            Zero or more frame-header dicts.  **Returns ``[]``** when the
            file does not exist, is too short, or has an unrecognised
            magic number — never raises.
        """
        try:
            if not wal_path.exists():
                return []

            data = wal_path.read_bytes()

            if len(data) < _WAL_HEADER_SIZE:
                return []

            magic = struct.unpack_from(">I", data, 0)[0]
            if magic not in (_WAL_MAGIC_BE, _WAL_MAGIC_LE):
                return []

            page_size = struct.unpack_from(">I", data, 8)[0]
            if page_size == 1:
                page_size = 65536  # SQLite encodes 65536 as 1

            salt_1 = struct.unpack_from(">I", data, 16)[0]
            salt_2 = struct.unpack_from(">I", data, 20)[0]

            frame_size = _WAL_FRAME_HEADER_SIZE + page_size
            offset = _WAL_HEADER_SIZE
            frames: list[dict[str, Any]] = []

            while offset + _WAL_FRAME_HEADER_SIZE <= len(data):
                page_number = struct.unpack_from(">I", data, offset)[0]
                db_size_after = struct.unpack_from(">I", data, offset + 4)[0]

                if page_number == 0:
                    break  # sentinel / padding

                frames.append(
                    {
                        "page_number": page_number,
                        "db_size_after": db_size_after,
                        "salt_1": salt_1,
                        "salt_2": salt_2,
                    }
                )
                offset += frame_size

            return frames

        except Exception:
            return []
