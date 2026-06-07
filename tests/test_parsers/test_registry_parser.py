"""Tests for forensixd.parsers.registry_parser."""

from pathlib import Path

import pytest

from forensixd.parsers.registry_parser import RegistryParser, RegistryRecord
from forensixd.core.exceptions import ParseError


# ---------------------------------------------------------------------------
# is_available
# ---------------------------------------------------------------------------


def test_is_available_returns_bool() -> None:
    assert isinstance(RegistryParser.is_available(), bool)


# ---------------------------------------------------------------------------
# open_hive
# ---------------------------------------------------------------------------


def test_open_hive_missing_file_raises() -> None:
    import pathlib

    with pytest.raises(ParseError):
        RegistryParser.open_hive(pathlib.Path("/no/such/hive"))


def test_open_hive_raises_if_not_available(tmp_path: Path) -> None:
    if RegistryParser.is_available():
        pytest.skip("python-registry installed; unavailability path not reachable")
    fake = tmp_path / "fake.hive"
    fake.write_bytes(b"not a hive")
    with pytest.raises(ParseError):
        RegistryParser.open_hive(fake)


# ---------------------------------------------------------------------------
# convert_filetime
# ---------------------------------------------------------------------------


def test_convert_filetime_returns_datetime() -> None:
    from datetime import timedelta, datetime, timezone

    # FILETIME value corresponding to 2023-01-01 00:00:00 UTC
    filetime = 133170048000000000
    dt = RegistryParser.convert_filetime(filetime)
    assert isinstance(dt, datetime)
    assert dt.tzinfo is not None
    assert dt.year == 2023


def test_convert_filetime_zero() -> None:
    dt = RegistryParser.convert_filetime(0)
    assert dt.year == 1601


def test_convert_filetime_is_utc() -> None:
    from datetime import timezone, timedelta

    filetime = 133168320000000000
    dt = RegistryParser.convert_filetime(filetime)
    assert dt.tzinfo == timezone(timedelta(hours=5, minutes=30))


def test_convert_filetime_month_day(  ) -> None:
    # 2023-01-01 00:00:00 UTC
    filetime = 133170048000000000
    dt = RegistryParser.convert_filetime(filetime)
    assert dt.month == 1
    assert dt.day == 1
    assert dt.hour == 5
    assert dt.minute == 30
    assert dt.second == 0


# ---------------------------------------------------------------------------
# RegistryRecord model
# ---------------------------------------------------------------------------


def test_registry_record_is_pydantic() -> None:
    from datetime import datetime, timezone, timedelta

    r = RegistryRecord(
        key_path="\\SOFTWARE\\Test",
        value_name="Version",
        value_type="REG_SZ",
        data="1.0",
        last_written=datetime.now(timezone(timedelta(hours=5, minutes=30))),
    )
    assert r.key_path == "\\SOFTWARE\\Test"
    assert r.value_name == "Version"
    assert r.value_type == "REG_SZ"
    assert r.data == "1.0"
    assert r.last_written is not None


def test_registry_record_is_frozen() -> None:
    r = RegistryRecord(
        key_path="\\TEST",
        value_name="k",
        value_type="REG_SZ",
        data="v",
    )
    with pytest.raises(Exception):
        r.key_path = "modified"  # type: ignore[misc]


def test_registry_record_last_written_optional() -> None:
    r = RegistryRecord(
        key_path="\\KEY",
        value_name="v",
        value_type="REG_DWORD",
        data=42,
    )
    assert r.last_written is None


def test_registry_record_data_accepts_any_type() -> None:
    r_int = RegistryRecord(key_path="\\K", value_name="n", value_type="REG_DWORD", data=99)
    r_list = RegistryRecord(key_path="\\K", value_name="m", value_type="REG_MULTI_SZ", data=["a", "b"])
    r_hex = RegistryRecord(key_path="\\K", value_name="b", value_type="REG_BINARY", data="deadbeef")
    assert r_int.data == 99
    assert r_list.data == ["a", "b"]
    assert r_hex.data == "deadbeef"


# ---------------------------------------------------------------------------
# walk_key
# ---------------------------------------------------------------------------


def test_walk_key_without_library_raises(tmp_path: Path) -> None:
    if RegistryParser.is_available():
        pytest.skip("python-registry installed; unavailability path not reachable")
    fake = tmp_path / "fake.hive"
    fake.write_bytes(b"fake")
    with pytest.raises(ParseError):
        RegistryParser.walk_key(fake)


def test_walk_key_invalid_hive_raises(tmp_path: Path) -> None:
    if not RegistryParser.is_available():
        pytest.skip("python-registry not installed")
    fake = tmp_path / "invalid.hive"
    fake.write_bytes(b"\x00" * 512)
    with pytest.raises(ParseError):
        RegistryParser.walk_key(fake)


# ---------------------------------------------------------------------------
# get_value
# ---------------------------------------------------------------------------


def test_get_value_returns_none_for_missing_hive(tmp_path: Path) -> None:
    if not RegistryParser.is_available():
        pytest.skip("python-registry not installed")
    fake = tmp_path / "invalid.hive"
    fake.write_bytes(b"\x00" * 512)
    # open_hive will raise ParseError which get_value propagates
    with pytest.raises(ParseError):
        RegistryParser.get_value(fake, "\\SOFTWARE", "Version")


# ---------------------------------------------------------------------------
# open_hive exceptions
# ---------------------------------------------------------------------------

def test_open_hive_mock_unavailable(tmp_path: Path) -> None:
    import unittest.mock
    import forensixd.parsers.registry_parser as rp
    with unittest.mock.patch.object(rp, "REGISTRY_AVAILABLE", False):
        with pytest.raises(ParseError, match="python-registry is not installed"):
            RegistryParser.open_hive(tmp_path / "fake")


# ---------------------------------------------------------------------------
# _convert_value
# ---------------------------------------------------------------------------

def test_convert_value_reg_binary() -> None:
    class MockVal:
        def value_type_str(self): return "REG_BINARY"
        def value(self): return b"abc"
    assert RegistryParser._convert_value(MockVal()) == "616263"
    
    class MockValNotBytes:
        def value_type_str(self): return "REG_BINARY"
        def value(self): return "already_string"
    assert RegistryParser._convert_value(MockValNotBytes()) == "already_string"


def test_convert_value_reg_multi_sz() -> None:
    class MockVal:
        def value_type_str(self): return "REG_MULTI_SZ"
        def value(self): return ["a", "b"]
    assert RegistryParser._convert_value(MockVal()) == ["a", "b"]
    
    class MockValNotList:
        def value_type_str(self): return "REG_MULTI_SZ"
        def value(self): return "string_instead"
    assert RegistryParser._convert_value(MockValNotList()) == "string_instead"


def test_convert_value_reg_dword() -> None:
    class MockVal:
        def value_type_str(self): return "REG_DWORD"
        def value(self): return 123
    assert RegistryParser._convert_value(MockVal()) == 123


def test_convert_value_reg_sz() -> None:
    class MockVal:
        def value_type_str(self): return "REG_SZ"
        def value(self): return "test"
    assert RegistryParser._convert_value(MockVal()) == "test"
    
    class MockValNone:
        def value_type_str(self): return "REG_SZ"
        def value(self): return None
    assert RegistryParser._convert_value(MockValNone()) == ""


def test_convert_value_unknown() -> None:
    class MockVal:
        def value_type_str(self): return "UNKNOWN"
        def value(self): return "raw"
    assert RegistryParser._convert_value(MockVal()) == "raw"


# ---------------------------------------------------------------------------
# _key_last_written
# ---------------------------------------------------------------------------

def test_key_last_written_naive() -> None:
    from datetime import datetime, timezone, timedelta
    class MockKey:
        def timestamp(self): return datetime(2020, 1, 1)
    
    ts = RegistryParser._key_last_written(MockKey())
    assert ts is not None
    assert ts.tzinfo == timezone(timedelta(hours=5, minutes=30))


def test_key_last_written_aware() -> None:
    from datetime import datetime, timezone, timedelta
    class MockKey:
        def timestamp(self): return datetime(2020, 1, 1, tzinfo=timezone.utc)
    
    ts = RegistryParser._key_last_written(MockKey())
    assert ts is not None
    assert ts.tzinfo == timezone(timedelta(hours=5, minutes=30))


def test_key_last_written_exception() -> None:
    class MockKey:
        def timestamp(self): raise ValueError("no ts")
    
    assert RegistryParser._key_last_written(MockKey()) is None


# ---------------------------------------------------------------------------
# walk_key
# ---------------------------------------------------------------------------

def test_walk_key_key_not_found(tmp_path: Path) -> None:
    import unittest.mock
    
    class MockReg:
        def root(self):
            class R:
                def subkey(self, n): raise Exception("not found")
            return R()
            
    with unittest.mock.patch("forensixd.parsers.registry_parser.RegistryParser.open_hive", return_value=MockReg()):
        with pytest.raises(ParseError, match="Registry key not found"):
            RegistryParser.walk_key(tmp_path / "hive", "\\MISSING")


# ---------------------------------------------------------------------------
# _recurse_key exceptions
# ---------------------------------------------------------------------------

def test_recurse_key_exceptions() -> None:
    # We want to cover the `except Exception: continue` branches
    class BadValue:
        def name(self): raise ValueError("bad name")
        
    class BadSubkey:
        def path(self): raise ValueError("bad path")
        
    class GoodValue:
        def name(self): return "ok"
        def value_type_str(self): return "REG_SZ"
        def value(self): return "data"
        
    class MockKey:
        def path(self): return "\\ROOT"
        def timestamp(self): return None
        def values(self): return [BadValue(), GoodValue()]
        def subkeys(self): return [BadSubkey()]
        
    records = []
    RegistryParser._recurse_key(MockKey(), records)
    assert len(records) == 1
    assert records[0].value_name == "ok"


def test_recurse_key_root_exception() -> None:
    class VeryBadKey:
        def path(self): raise Exception("crash")
    
    records = []
    RegistryParser._recurse_key(VeryBadKey(), records)
    assert len(records) == 0


# ---------------------------------------------------------------------------
# get_value missing/exceptions
# ---------------------------------------------------------------------------

def test_get_value_missing_value(tmp_path: Path) -> None:
    import unittest.mock
    class MockReg:
        def root(self):
            class R:
                def subkey(self, n): return self
                def value(self, n): raise Exception("not found")
            return R()
            
    with unittest.mock.patch("forensixd.parsers.registry_parser.RegistryParser.open_hive", return_value=MockReg()):
        assert RegistryParser.get_value(tmp_path / "hive", "\\PATH", "missing") is None


def test_get_value_success(tmp_path: Path) -> None:
    import unittest.mock
    class MockVal:
        def value_type_str(self): return "REG_SZ"
        def value(self): return "data"
        
    class MockReg:
        def root(self):
            class R:
                def subkey(self, n): return self
                def value(self, n): return MockVal()
            return R()
            
    with unittest.mock.patch("forensixd.parsers.registry_parser.RegistryParser.open_hive", return_value=MockReg()):
        assert RegistryParser.get_value(tmp_path / "hive", "\\PATH", "val") == "data"
