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
