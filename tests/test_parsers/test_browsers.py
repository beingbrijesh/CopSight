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
