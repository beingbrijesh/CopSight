"""
tests.test_parsers.test_browsers
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Unit tests for :class:`forensixd.parsers.apps.browsers.BrowserParser`.
"""

import sqlite3
from datetime import timedelta, datetime, timezone
from pathlib import Path

import pytest

from forensixd.core.models import (
    Artifact,
    ArtifactType,
    DeviceInfo,
    HashPair,
    Platform,
)
from forensixd.parsers.apps.browsers import BrowserParser


@pytest.fixture
def device() -> DeviceInfo:
    return DeviceInfo(platform=Platform.WINDOWS, device_id="win-test")


@pytest.fixture
def chrome_db(tmp_path: Path) -> Path:
    db = tmp_path / "History"
    c = sqlite3.connect(str(db))
    c.execute(
        """CREATE TABLE urls (
            id INTEGER PRIMARY KEY,
            url TEXT,
            title TEXT,
            visit_count INTEGER
        )"""
    )
    c.execute(
        """CREATE TABLE visits (
            id INTEGER PRIMARY KEY,
            url INTEGER,
            visit_time INTEGER
        )"""
    )
    c.execute("INSERT INTO urls VALUES (1,'https://example.com','Example',5)")
    c.execute("INSERT INTO urls VALUES (2,'https://google.com','Google',10)")
    # Chrome timestamps: microseconds since 1601-01-01
    c.execute("INSERT INTO visits VALUES (1,1,13305907200000000)")
    c.execute("INSERT INTO visits VALUES (2,2,13305907300000000)")
    c.commit()
    c.close()
    return db


@pytest.fixture
def chrome_artifact(chrome_db: Path, device: DeviceInfo) -> Artifact:
    return Artifact(
        artifact_type=ArtifactType.BROWSER_HISTORY,
        source_app="com.android.chrome",
        source_path=str(chrome_db),
        acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        hashes=HashPair(md5="a" * 32, sha256="b" * 64),
        device=device,
    )


def test_app_name_not_empty() -> None:
    assert len(BrowserParser().app_name) > 0


def test_can_parse_chrome_history(device: DeviceInfo) -> None:
    a = Artifact(
        artifact_type=ArtifactType.BROWSER_HISTORY,
        source_app="chrome",
        source_path="/AppData/Chrome/History",
        acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        hashes=HashPair(md5="a" * 32, sha256="b" * 64),
        device=device,
    )
    assert BrowserParser().can_parse(a) is True


def test_can_parse_firefox_places(device: DeviceInfo) -> None:
    a = Artifact(
        artifact_type=ArtifactType.BROWSER_HISTORY,
        source_app="firefox",
        source_path="/profiles/abc/places.db",
        acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        hashes=HashPair(md5="a" * 32, sha256="b" * 64),
        device=device,
    )
    assert BrowserParser().can_parse(a) is True


def test_parse_chrome_returns_records(chrome_artifact: Artifact) -> None:
    records = BrowserParser().parse(chrome_artifact)
    assert len(records) >= 2


def test_records_are_browser_history_type(chrome_artifact: Artifact) -> None:
    for r in BrowserParser().parse(chrome_artifact):
        assert r.record_type == ArtifactType.BROWSER_HISTORY


def test_url_field_present(chrome_artifact: Artifact) -> None:
    records = BrowserParser().parse(chrome_artifact)
    assert "url" in records[0].fields
    assert records[0].fields["url"].startswith("http")


def test_timestamp_is_valid_iso(chrome_artifact: Artifact) -> None:
    records = BrowserParser().parse(chrome_artifact)
    datetime.fromisoformat(records[0].fields["timestamp"])


def test_confidence_is_high(chrome_artifact: Artifact) -> None:
    for r in BrowserParser().parse(chrome_artifact):
        assert r.confidence >= 0.95


@pytest.fixture
def firefox_db(tmp_path: Path) -> Path:
    db = tmp_path / "places.db"
    c = sqlite3.connect(str(db))
    c.execute(
        """CREATE TABLE moz_places (
            id INTEGER PRIMARY KEY,
            url TEXT,
            title TEXT,
            visit_count INTEGER
        )"""
    )
    c.execute(
        """CREATE TABLE moz_historyvisits (
            id INTEGER PRIMARY KEY,
            place_id INTEGER,
            visit_date INTEGER
        )"""
    )
    c.execute("INSERT INTO moz_places VALUES (1,'https://mozilla.org','Mozilla',2)")
    # Firefox timestamps: microseconds since 1970-01-01
    c.execute("INSERT INTO moz_historyvisits VALUES (1,1,1609459200000000)")
    c.commit()
    c.close()
    return db


def test_parse_firefox(firefox_db: Path, device: DeviceInfo) -> None:
    a = Artifact(
        artifact_type=ArtifactType.BROWSER_HISTORY,
        source_app="firefox",
        source_path=str(firefox_db),
        acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        hashes=HashPair(md5="a" * 32, sha256="b" * 64),
        device=device,
    )
    records = BrowserParser().parse(a)
    assert len(records) == 1
    assert records[0].fields["browser_name"] == "Firefox"
    assert records[0].fields["url"] == "https://mozilla.org"


def test_safari_branch(chrome_db: Path, device: DeviceInfo) -> None:
    # We pass a chrome_db so it successfully parses, but name it safari to hit the branch
    safari_db = chrome_db.parent / "safari_History"
    import shutil
    shutil.copy(chrome_db, safari_db)
    
    a = Artifact(
        artifact_type=ArtifactType.BROWSER_HISTORY,
        source_app="safari",
        source_path=str(safari_db),
        acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        hashes=HashPair(md5="a" * 32, sha256="b" * 64),
        device=device,
    )
    records = BrowserParser().parse(a)
    assert len(records) > 0
    assert records[0].fields["browser_name"] == "Safari"


def test_unknown_browser_branch(chrome_db: Path, device: DeviceInfo) -> None:
    # Rename to something that is not chrome, firefox, or safari
    unknown_db = chrome_db.parent / "unknown_places.db"
    import shutil
    shutil.copy(chrome_db, unknown_db)

    a = Artifact(
        artifact_type=ArtifactType.BROWSER_HISTORY,
        source_app="unknown",
        source_path=str(unknown_db),
        acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        hashes=HashPair(md5="a" * 32, sha256="b" * 64),
        device=device,
    )
    records = BrowserParser().parse(a)
    assert len(records) > 0
    assert records[0].fields["browser_name"] == "Browser"


def test_unrecognized_schema(tmp_path: Path, device: DeviceInfo) -> None:
    bad_db = tmp_path / "bad_History"
    c = sqlite3.connect(str(bad_db))
    c.execute("CREATE TABLE foo (id INTEGER)")
    c.commit()
    c.close()

    a = Artifact(
        artifact_type=ArtifactType.BROWSER_HISTORY,
        source_app="chrome",
        source_path=str(bad_db),
        acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        hashes=HashPair(md5="a" * 32, sha256="b" * 64),
        device=device,
    )
    from forensixd.core.exceptions import ParseError
    with pytest.raises(ParseError, match="Unrecognized browser database schema"):
        BrowserParser().parse(a)


def test_chrome_invalid_timestamp(chrome_db: Path, device: DeviceInfo) -> None:
    c = sqlite3.connect(str(chrome_db))
    c.execute("INSERT INTO urls VALUES (99,'https://bad.com','Bad',1)")
    c.execute("INSERT INTO visits VALUES (99,99,'invalid_time')")
    c.commit()
    c.close()

    a = Artifact(
        artifact_type=ArtifactType.BROWSER_HISTORY,
        source_app="chrome",
        source_path=str(chrome_db),
        acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        hashes=HashPair(md5="a" * 32, sha256="b" * 64),
        device=device,
    )
    records = BrowserParser().parse(a)
    assert len(records) == 3
    # Look for the bad one
    bad_record = next(r for r in records if r.fields["url"] == "https://bad.com")
    assert "timestamp" in bad_record.fields


def test_firefox_invalid_timestamp(firefox_db: Path, device: DeviceInfo) -> None:
    c = sqlite3.connect(str(firefox_db))
    c.execute("INSERT INTO moz_places VALUES (99,'https://bad.com','Bad',1)")
    c.execute("INSERT INTO moz_historyvisits VALUES (99,99,'invalid_time')")
    c.commit()
    c.close()

    a = Artifact(
        artifact_type=ArtifactType.BROWSER_HISTORY,
        source_app="firefox",
        source_path=str(firefox_db),
        acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        hashes=HashPair(md5="a" * 32, sha256="b" * 64),
        device=device,
    )
    records = BrowserParser().parse(a)
    assert len(records) == 2
    bad_record = next(r for r in records if r.fields["url"] == "https://bad.com")
    assert "timestamp" in bad_record.fields
