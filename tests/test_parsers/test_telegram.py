"""
tests.test_parsers.test_telegram
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Unit tests for :class:`forensixd.parsers.apps.telegram.TelegramParser`.
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
from forensixd.parsers.apps.telegram import TelegramParser


@pytest.fixture
def device() -> DeviceInfo:
    return DeviceInfo(platform=Platform.ANDROID, device_id="tg-test")


@pytest.fixture
def cache_db(tmp_path: Path) -> Path:
    db = tmp_path / "cache4.db"
    c = sqlite3.connect(str(db))
    c.execute(
        """CREATE TABLE messages (
            uid INTEGER,
            date INTEGER,
            message TEXT,
            from_id INTEGER,
            out INTEGER
        )"""
    )
    c.execute("INSERT INTO messages VALUES (1,1700000000,'Secret plan',999,0)")
    c.execute("INSERT INTO messages VALUES (2,1700000001,'Confirmed',999,1)")
    c.commit()
    c.close()
    return db


@pytest.fixture
def artifact(cache_db: Path, device: DeviceInfo) -> Artifact:
    return Artifact(
        artifact_type=ArtifactType.APP_DATA,
        source_app="org.telegram.messenger",
        source_path=str(cache_db),
        acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        hashes=HashPair(md5="a" * 32, sha256="b" * 64),
        device=device,
    )


def test_app_name() -> None:
    assert TelegramParser().app_name == "Telegram"


def test_can_parse_telegram_path(device: DeviceInfo) -> None:
    a = Artifact(
        artifact_type=ArtifactType.APP_DATA,
        source_app="org.telegram.messenger",
        source_path="/data/telegram/cache4.db",
        acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        hashes=HashPair(md5="a" * 32, sha256="b" * 64),
        device=device,
    )
    assert TelegramParser().can_parse(a) is True


def test_parse_returns_records(artifact: Artifact) -> None:
    records = TelegramParser().parse(artifact)
    assert len(records) == 2


def test_records_are_message_type(artifact: Artifact) -> None:
    for r in TelegramParser().parse(artifact):
        assert r.record_type == ArtifactType.MESSAGE


def test_completeness_note_present(artifact: Artifact) -> None:
    for r in TelegramParser().parse(artifact):
        assert r.completeness_note is not None
        assert len(r.completeness_note) > 0


def test_is_outgoing_field_present(artifact: Artifact) -> None:
    records = TelegramParser().parse(artifact)
    assert "is_outgoing" in records[0].fields
    assert records[0].fields["is_outgoing"] is False
    assert records[1].fields["is_outgoing"] is True


def test_confidence_is_reasonable(artifact: Artifact) -> None:
    for r in TelegramParser().parse(artifact):
        assert 0.5 <= r.confidence <= 1.0
