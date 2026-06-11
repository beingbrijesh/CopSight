"""Tests for forensixd.parsers.plist_parser.PlistParser."""

import io
import plistlib
from datetime import timedelta, datetime, timezone
from pathlib import Path

import pytest

from forensixd.core.exceptions import ParseError
from forensixd.parsers.plist_parser import PlistParser


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _write_plist(path: Path, data: dict) -> Path:
    """Dump *data* as an XML plist to *path* and return the path."""
    with open(str(path), "wb") as fh:
        plistlib.dump(data, fh)
    return path


def _write_binary_plist(path: Path, data: dict) -> Path:
    """Dump *data* as a binary plist to *path* and return the path."""
    with open(str(path), "wb") as fh:
        plistlib.dump(data, fh, fmt=plistlib.FMT_BINARY)
    return path


# ---------------------------------------------------------------------------
# parse() — file-based tests
# ---------------------------------------------------------------------------


def test_parse_xml_plist(tmp_path: Path) -> None:
    """parse() correctly reads an XML plist and returns a dict."""
    data = {"name": "forensixd", "version": 1, "active": True}
    f = _write_plist(tmp_path / "t.plist", data)

    r = PlistParser.parse(f)

    assert r["name"] == "forensixd"
    assert r["version"] == 1


def test_parse_returns_dict_type(tmp_path: Path) -> None:
    """parse() always returns a dict, not a list or scalar."""
    f = _write_plist(tmp_path / "t.plist", {"x": 1})
    assert isinstance(PlistParser.parse(f), dict)


def test_bytes_converted_to_hex_string(tmp_path: Path) -> None:
    """parse() converts bytes values to lowercase hex strings."""
    data = {"raw": b"\xde\xad\xbe\xef"}
    f = _write_plist(tmp_path / "t.plist", data)

    r = PlistParser.parse(f)

    assert isinstance(r["raw"], str)
    assert r["raw"].lower() == "deadbeef"


def test_datetime_gets_utc_timezone(tmp_path: Path) -> None:
    """parse() attaches UTC tzinfo to naive datetime values. (IST)"""
    data = {"ts": datetime(2023, 1, 1, 12, 0, 0)}
    f = _write_plist(tmp_path / "t.plist", data)

    r = PlistParser.parse(f)

    assert r["ts"].tzinfo is not None
    assert r["ts"].tzinfo == timezone(timedelta(hours=5, minutes=30))


def test_aware_datetime_preserved(tmp_path: Path) -> None:
    """parse() leaves already-IST-aware datetime values unchanged."""
    aware = datetime(2023, 6, 15, 8, 30, 0, tzinfo=timezone(timedelta(hours=5, minutes=30)))
    data = {"ts": aware}
    f = _write_plist(tmp_path / "t.plist", data)

    r = PlistParser.parse(f)

    assert r["ts"].tzinfo is not None
    assert r["ts"] == aware


def test_nested_dict_parsed(tmp_path: Path) -> None:
    """parse() recursively converts nested dicts."""
    data = {"outer": {"inner": "value"}}
    f = _write_plist(tmp_path / "t.plist", data)

    r = PlistParser.parse(f)

    assert r["outer"]["inner"] == "value"


def test_list_value_parsed(tmp_path: Path) -> None:
    """parse() recursively converts list values."""
    data = {"items": [1, 2, 3]}
    f = _write_plist(tmp_path / "t.plist", data)

    r = PlistParser.parse(f)

    assert r["items"] == [1, 2, 3]


def test_bytes_inside_list_converted(tmp_path: Path) -> None:
    """parse() converts bytes elements nested inside a list to hex strings."""
    data = {"blobs": [b"\xca\xfe", b"\xba\xbe"]}
    f = _write_plist(tmp_path / "t.plist", data)

    r = PlistParser.parse(f)

    assert r["blobs"] == ["cafe", "babe"]


def test_bytes_inside_nested_dict_converted(tmp_path: Path) -> None:
    """parse() converts bytes values nested inside a child dict."""
    data = {"outer": {"blob": b"\x00\xff"}}
    f = _write_plist(tmp_path / "t.plist", data)

    r = PlistParser.parse(f)

    assert r["outer"]["blob"] == "00ff"


def test_parse_binary_plist(tmp_path: Path) -> None:
    """parse() correctly reads a bplist00 binary plist."""
    data = {"hello": "world", "count": 7}
    f = _write_binary_plist(tmp_path / "b.plist", data)

    r = PlistParser.parse(f)

    assert r["hello"] == "world"
    assert r["count"] == 7


def test_invalid_file_raises_parse_error(tmp_path: Path) -> None:
    """parse() raises ParseError for a file that is not a valid plist."""
    f = tmp_path / "bad.plist"
    f.write_bytes(b"not a plist at all XXXXXXX")

    with pytest.raises(ParseError):
        PlistParser.parse(f)


def test_missing_file_raises_parse_error() -> None:
    """parse() raises ParseError when the target file does not exist."""
    with pytest.raises(ParseError):
        PlistParser.parse(Path("/no/such/file.plist"))


# ---------------------------------------------------------------------------
# parse_bytes() — in-memory tests
# ---------------------------------------------------------------------------


def test_parse_bytes_returns_dict() -> None:
    """parse_bytes() deserialises a bytes buffer into a dict."""
    data = {"key": "value", "num": 42}
    b = plistlib.dumps(data)

    r = PlistParser.parse_bytes(b)

    assert r["key"] == "value"
    assert r["num"] == 42


def test_parse_bytes_converts_bytes_to_hex() -> None:
    """parse_bytes() converts embedded bytes to hex strings."""
    data = {"sig": b"\xab\xcd\xef"}
    b = plistlib.dumps(data)

    r = PlistParser.parse_bytes(b)

    assert r["sig"] == "abcdef"


def test_parse_bytes_datetime_utc() -> None:
    """parse_bytes() attaches UTC tzinfo to naive datetimes."""
    data = {"created": datetime(2024, 3, 10, 0, 0, 0)}
    b = plistlib.dumps(data)

    r = PlistParser.parse_bytes(b)

    assert r["created"].tzinfo == timezone(timedelta(hours=5, minutes=30))


def test_parse_bytes_nested_structure() -> None:
    """parse_bytes() handles nested dicts and lists."""
    data = {"a": {"b": [1, 2, 3]}}
    b = plistlib.dumps(data)

    r = PlistParser.parse_bytes(b)

    assert r["a"]["b"] == [1, 2, 3]


def test_parse_bytes_invalid_raises_parse_error() -> None:
    """parse_bytes() raises ParseError for corrupt/non-plist bytes."""
    with pytest.raises(ParseError):
        PlistParser.parse_bytes(b"totally invalid bytes XYZZY")


def test_parse_bytes_empty_raises_parse_error() -> None:
    """parse_bytes() raises ParseError for an empty byte string."""
    with pytest.raises(ParseError):
        PlistParser.parse_bytes(b"")


# ---------------------------------------------------------------------------
# _convert_types() — unit tests for the recursive normaliser
# ---------------------------------------------------------------------------


def test_convert_types_passthrough_int() -> None:
    """_convert_types() leaves integers unchanged."""
    assert PlistParser._convert_types(99) == 99


def test_convert_types_passthrough_str() -> None:
    """_convert_types() leaves strings unchanged."""
    assert PlistParser._convert_types("hello") == "hello"


def test_convert_types_passthrough_bool() -> None:
    """_convert_types() leaves booleans unchanged."""
    assert PlistParser._convert_types(True) is True


def test_convert_types_passthrough_none() -> None:
    """_convert_types() leaves None unchanged."""
    assert PlistParser._convert_types(None) is None


def test_convert_types_bytes_to_hex() -> None:
    """_convert_types() converts bytes to a lowercase hex string."""
    assert PlistParser._convert_types(b"\x01\x02\x03") == "010203"


def test_convert_types_empty_bytes() -> None:
    """_convert_types() converts empty bytes to an empty string."""
    assert PlistParser._convert_types(b"") == ""


def test_convert_types_naive_datetime_becomes_utc() -> None:
    """_convert_types() attaches UTC to a naive datetime."""
    naive = datetime(2020, 6, 1, 0, 0, 0)
    result = PlistParser._convert_types(naive)
    assert result.tzinfo == timezone(timedelta(hours=5, minutes=30))
    assert result.year == 2020


def test_convert_types_aware_datetime_unchanged() -> None:
    """_convert_types() does not modify an already-IST-aware datetime."""
    aware = datetime(2020, 6, 1, 0, 0, 0, tzinfo=timezone(timedelta(hours=5, minutes=30)))
    result = PlistParser._convert_types(aware)
    assert result is aware


def test_convert_types_dict_recurses() -> None:
    """_convert_types() recurses into dict values."""
    obj = {"data": b"\xff", "num": 1}
    result = PlistParser._convert_types(obj)
    assert result == {"data": "ff", "num": 1}


def test_convert_types_list_recurses() -> None:
    """_convert_types() recurses into list items."""
    obj = [b"\xaa", b"\xbb"]
    result = PlistParser._convert_types(obj)
    assert result == ["aa", "bb"]


def test_convert_types_deeply_nested() -> None:
    """_convert_types() handles multi-level nesting of dicts and lists."""
    obj = {"level1": {"level2": [b"\x01", datetime(2021, 1, 1)]}}
    result = PlistParser._convert_types(obj)
    assert result["level1"]["level2"][0] == "01"
    assert result["level1"]["level2"][1].tzinfo == timezone(timedelta(hours=5, minutes=30))
