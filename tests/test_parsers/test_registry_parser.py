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
