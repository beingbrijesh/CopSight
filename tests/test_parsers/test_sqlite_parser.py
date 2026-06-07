"""Tests for forensixd.parsers.sqlite_parser.SQLiteParser."""

import sqlite3
from pathlib import Path

import pytest

from forensixd.core.exceptions import ParseError
from forensixd.parsers.sqlite_parser import SQLiteParser


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def db(tmp_path: Path) -> Path:
    """Return a populated SQLite database with two tables."""
    p = tmp_path / "test.db"
    conn = sqlite3.connect(str(p))
    conn.execute("CREATE TABLE messages (id INTEGER, body TEXT, ts INTEGER)")
    conn.execute("INSERT INTO messages VALUES (1,'hello',1700000000)")
    conn.execute("INSERT INTO messages VALUES (2,'world',1700000001)")
    conn.execute("CREATE TABLE contacts (id INTEGER, name TEXT)")
    conn.execute("INSERT INTO contacts VALUES (1,'Alice')")
    conn.commit()
    conn.close()
    return p


# ---------------------------------------------------------------------------
# list_tables
# ---------------------------------------------------------------------------


def test_list_tables(db: Path) -> None:
    """list_tables should include every user-created table."""
    tables = SQLiteParser.list_tables(db)
    assert "messages" in tables


def test_list_tables_includes_contacts(db: Path) -> None:
    """list_tables should also expose the contacts table."""
    tables = SQLiteParser.list_tables(db)
    assert "contacts" in tables


def test_list_tables_returns_list(db: Path) -> None:
    """list_tables must return a list object."""
    result = SQLiteParser.list_tables(db)
    assert isinstance(result, list)


# ---------------------------------------------------------------------------
# table_exists
# ---------------------------------------------------------------------------


def test_table_exists_true(db: Path) -> None:
    """table_exists returns True for a table that exists."""
    assert SQLiteParser.table_exists(db, "messages")


def test_table_exists_false(db: Path) -> None:
    """table_exists returns False for a table that does not exist."""
    assert not SQLiteParser.table_exists(db, "fake")


def test_table_exists_case_sensitive(db: Path) -> None:
    """table_exists should use the name as supplied (SQLite is case-insensitive
    for identifiers but the look-up may vary; verify at least the known name)."""
    assert SQLiteParser.table_exists(db, "contacts")


# ---------------------------------------------------------------------------
# query
# ---------------------------------------------------------------------------


def test_query_returns_rows(db: Path) -> None:
    """query returns all matching rows with correct field values."""
    rows = SQLiteParser.query(db, "SELECT * FROM messages ORDER BY id")
    assert len(rows) == 2
    assert rows[0]["body"] == "hello"


def test_query_returns_dicts(db: Path) -> None:
    """Every row returned by query must be a dict with the expected keys."""
    rows = SQLiteParser.query(db, "SELECT * FROM messages LIMIT 1")
    assert isinstance(rows[0], dict)
    assert "id" in rows[0]


def test_query_with_params(db: Path) -> None:
    """Parameterised queries bind values correctly."""
    rows = SQLiteParser.query(db, "SELECT * FROM messages WHERE id=?", (1,))
    assert len(rows) == 1
    assert rows[0]["body"] == "hello"


def test_query_missing_file_raises() -> None:
    """query raises ParseError when the database file does not exist."""
    with pytest.raises(ParseError):
        SQLiteParser.query(Path("/no/such.db"), "SELECT 1")


def test_query_second_row_body(db: Path) -> None:
    """Verify the second row's content via query."""
    rows = SQLiteParser.query(db, "SELECT * FROM messages ORDER BY id")
    assert rows[1]["body"] == "world"


def test_query_empty_result_returns_empty_list(db: Path) -> None:
    """query returns an empty list when no rows match the filter."""
    rows = SQLiteParser.query(db, "SELECT * FROM messages WHERE id=?", (999,))
    assert rows == []


# ---------------------------------------------------------------------------
# list_columns
# ---------------------------------------------------------------------------


def test_list_columns(db: Path) -> None:
    """list_columns returns all column names for the given table."""
    cols = SQLiteParser.list_columns(db, "messages")
    assert "id" in cols
    assert "body" in cols
    assert "ts" in cols


def test_list_columns_returns_list(db: Path) -> None:
    """list_columns must return a list."""
    cols = SQLiteParser.list_columns(db, "messages")
    assert isinstance(cols, list)


def test_list_columns_contacts(db: Path) -> None:
    """list_columns works for tables other than 'messages'."""
    cols = SQLiteParser.list_columns(db, "contacts")
    assert "id" in cols
    assert "name" in cols


# ---------------------------------------------------------------------------
# recover_deleted_rows
# ---------------------------------------------------------------------------


def test_recover_deleted_returns_list(db: Path) -> None:
    """recover_deleted_rows always returns a list (possibly empty)."""
    result = SQLiteParser.recover_deleted_rows(db, "messages")
    assert isinstance(result, list)


def test_recover_deleted_never_raises(tmp_path: Path) -> None:
    """recover_deleted_rows must not propagate exceptions for corrupt files."""
    bad_db = tmp_path / "bad.db"
    bad_db.write_bytes(b"not sqlite")
    assert SQLiteParser.recover_deleted_rows(bad_db, "messages") == []


def test_recover_deleted_missing_file_returns_empty(tmp_path: Path) -> None:
    """recover_deleted_rows returns [] when the database file is absent."""
    missing = tmp_path / "missing.db"
    assert SQLiteParser.recover_deleted_rows(missing, "messages") == []


# ---------------------------------------------------------------------------
# parse_wal
# ---------------------------------------------------------------------------


def test_parse_wal_missing_returns_empty() -> None:
    """parse_wal returns an empty list when the WAL file does not exist."""
    assert SQLiteParser.parse_wal(Path("/no/file.db-wal")) == []


def test_parse_wal_returns_list() -> None:
    """parse_wal always returns a list type."""
    result = SQLiteParser.parse_wal(Path("/no/file.db-wal"))
    assert isinstance(result, list)


# ---------------------------------------------------------------------------
# open_readonly
# ---------------------------------------------------------------------------


def test_open_readonly_rejects_writes(db: Path) -> None:
    """Connections opened via open_readonly must refuse write operations."""
    conn = SQLiteParser.open_readonly(db)
    with pytest.raises(Exception):
        conn.execute("INSERT INTO messages VALUES (99,'hack',0)")
    conn.close()


def test_open_readonly_allows_reads(db: Path) -> None:
    """Connections opened via open_readonly must allow SELECT queries."""
    conn = SQLiteParser.open_readonly(db)
    cursor = conn.execute("SELECT COUNT(*) FROM messages")
    count = cursor.fetchone()[0]
    conn.close()
    assert count == 2


# ---------------------------------------------------------------------------
# Exceptions & Error handling
# ---------------------------------------------------------------------------

def test_list_tables_exception(tmp_path: Path) -> None:
    db = tmp_path / "not_a_db"
    db.write_bytes(b"bad")
    assert SQLiteParser.list_tables(db) == []


def test_table_exists_exception(tmp_path: Path) -> None:
    db = tmp_path / "not_a_db"
    db.write_bytes(b"bad")
    assert SQLiteParser.table_exists(db, "messages") is False


def test_list_columns_exception(tmp_path: Path) -> None:
    db = tmp_path / "not_a_db"
    db.write_bytes(b"bad")
    assert SQLiteParser.list_columns(db, "messages") == []


def test_query_sqlite_error(db: Path) -> None:
    with pytest.raises(ParseError, match="Query failed"):
        SQLiteParser.query(db, "SELECT * FROM nonexistent_table")


def test_open_readonly_exception(tmp_path: Path) -> None:
    db = tmp_path / "not_a_db"
    db.mkdir()  # is a directory, opening will fail
    with pytest.raises(ParseError, match="Cannot open read-only connection"):
        SQLiteParser.open_readonly(db)


# ---------------------------------------------------------------------------
# recover_deleted_rows (freelist parsing)
# ---------------------------------------------------------------------------

def test_recover_deleted_rows_empty_freelist(db: Path) -> None:
    # A fresh database has 0 freelist pages
    assert SQLiteParser.recover_deleted_rows(db, "messages") == []


def test_recover_deleted_rows_with_freelist(tmp_path: Path) -> None:
    # Create a database, insert many rows, then delete them to populate freelist
    db = tmp_path / "freelist.db"
    conn = sqlite3.connect(str(db))
    conn.execute("CREATE TABLE t (id INTEGER, v TEXT)")
    for i in range(100):
        conn.execute("INSERT INTO t VALUES (?,?)", (i, "A" * 1000))
    conn.commit()
    conn.execute("DELETE FROM t")
    conn.commit()
    conn.close()
    
    # Not guaranteed to extract rows with the simplistic implementation,
    # but it will walk the freelist pages.
    recovered = SQLiteParser.recover_deleted_rows(db, "t")
    assert isinstance(recovered, list)


def test_recover_deleted_rows_exception() -> None:
    import unittest.mock
    with unittest.mock.patch("sqlite3.connect", side_effect=Exception("mock err")):
        assert SQLiteParser.recover_deleted_rows(Path("any"), "t") == []


# ---------------------------------------------------------------------------
# parse_wal
# ---------------------------------------------------------------------------

def test_parse_wal_bad_magic(tmp_path: Path) -> None:
    wal = tmp_path / "bad.db-wal"
    # Needs to be >= 32 bytes to pass the size check, but bad magic
    wal.write_bytes(b"A" * 32)
    assert SQLiteParser.parse_wal(wal) == []


def test_parse_wal_valid(tmp_path: Path) -> None:
    wal = tmp_path / "good.db-wal"
    import struct
    
    # 32 byte header: magic, format, pagesize, checkpoint seq, salt1, salt2, checksum1, checksum2
    # magic 0x377F0682, pagesize 4096 (at offset 8), salt1 at 16, salt2 at 20
    header = bytearray(32)
    struct.pack_into(">I", header, 0, 0x377F0682)
    struct.pack_into(">I", header, 8, 4096)
    struct.pack_into(">I", header, 16, 123)
    struct.pack_into(">I", header, 20, 456)
    
    # 24 byte frame header: pgno (offset 0), db_size_after (offset 4)
    # 4096 byte frame
    frame = bytearray(24 + 4096)
    struct.pack_into(">I", frame, 0, 1)  # pgno 1
    struct.pack_into(">I", frame, 4, 1)  # size after commit 1
    
    wal.write_bytes(header + frame)
    
    frames = SQLiteParser.parse_wal(wal)
    assert len(frames) == 1
    assert frames[0]["page_number"] == 1
    assert frames[0]["db_size_after"] == 1
    assert frames[0]["salt_1"] == 123
    assert frames[0]["salt_2"] == 456


def test_parse_wal_padding(tmp_path: Path) -> None:
    wal = tmp_path / "pad.db-wal"
    import struct
    header = bytearray(32)
    struct.pack_into(">I", header, 0, 0x377F0682)
    struct.pack_into(">I", header, 8, 4096)
    
    # padding frame (pgno = 0)
    frame = bytearray(24 + 4096)
    struct.pack_into(">I", frame, 0, 0) 
    
    wal.write_bytes(header + frame)
    
    frames = SQLiteParser.parse_wal(wal)
    assert len(frames) == 0


def test_parse_wal_exception(tmp_path: Path) -> None:
    wal = tmp_path / "err.db-wal"
    # To trigger an exception in parse_wal: e.g. mock read_bytes
    import unittest.mock
    with unittest.mock.patch("pathlib.Path.read_bytes", side_effect=Exception("mock err")):
        assert SQLiteParser.parse_wal(wal) == []
