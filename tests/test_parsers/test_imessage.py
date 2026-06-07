"""
tests.test_parsers.test_imessage
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Unit tests for :class:`forensixd.parsers.apps.imessage.IMessageParser`.
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
from forensixd.parsers.apps.imessage import IMessageParser

@pytest.fixture
def device() -> DeviceInfo:
    return DeviceInfo(platform=Platform.IOS, device_id="ios-test")

@pytest.fixture
def sms_db(tmp_path: Path) -> Path:
    db = tmp_path / "sms.db"
    c = sqlite3.connect(str(db))
    c.execute("""CREATE TABLE message (rowid INTEGER PRIMARY KEY, text TEXT,
        date INTEGER, is_from_me INTEGER, service TEXT,
        handle_id INTEGER, cache_has_attachments INTEGER)""")
    c.execute("""CREATE TABLE handle (rowid INTEGER PRIMARY KEY, id TEXT)""")
    c.execute("INSERT INTO handle VALUES (1,'+1234567890')")
    c.execute("INSERT INTO message VALUES (1,'Hello',660000000000000000,0,'iMessage',1,0)")
    c.execute("INSERT INTO message VALUES (2,'Reply',660000001000000000,1,'iMessage',1,0)")
    c.commit()
    c.close()
    return db

@pytest.fixture
def artifact(sms_db: Path, device: DeviceInfo) -> Artifact:
    return Artifact(
        artifact_type=ArtifactType.MESSAGE,
        source_app="com.apple.MobileSMS",
        source_path=str(sms_db),
        acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        hashes=HashPair(md5="a" * 32, sha256="b" * 64),
        device=device,
    )

def test_app_name() -> None:
    assert IMessageParser().app_name == "iMessage"

def test_can_parse_sms_db(device: DeviceInfo) -> None:
    a = Artifact(
        artifact_type=ArtifactType.MESSAGE,
        source_app="com.apple.MobileSMS",
        source_path="/backup/3d0d7e5fb2ce/sms.db",
        acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        hashes=HashPair(md5="a" * 32, sha256="b" * 64),
        device=device,
    )
    assert IMessageParser().can_parse(a) is True

def test_parse_returns_records(artifact: Artifact) -> None:
    records = IMessageParser().parse(artifact)
    assert len(records) >= 2

def test_records_are_message_type(artifact: Artifact) -> None:
    for r in IMessageParser().parse(artifact):
        assert r.record_type == ArtifactType.MESSAGE

def test_is_from_me_field_present(artifact: Artifact) -> None:
    records = IMessageParser().parse(artifact)
    assert "is_from_me" in records[0].fields

def test_timestamp_is_valid_iso(artifact: Artifact) -> None:
    records = IMessageParser().parse(artifact)
    dt = datetime.fromisoformat(records[0].fields["timestamp"])
    assert dt.tzinfo is not None

def test_confidence_is_high(artifact: Artifact) -> None:
    for r in IMessageParser().parse(artifact):
        assert r.confidence >= 0.95

def test_service_field_present(artifact: Artifact) -> None:
    for r in IMessageParser().parse(artifact):
        assert "service" in r.fields


@pytest.fixture
def call_db(tmp_path: Path) -> Path:
    db = tmp_path / "CallHistory.storedata"
    c = sqlite3.connect(str(db))
    c.execute("""CREATE TABLE ZCALLRECORD (
        ZDURATION INTEGER, ZDATE INTEGER, ZADDRESS TEXT, ZORIGINATED INTEGER
    )""")
    # 660... is > 1e12, will hit the /= 1e9 logic
    c.execute("INSERT INTO ZCALLRECORD VALUES (60, 660000000000000000, '+1234', 1)")
    # Also add one that is smaller than 1e12
    c.execute("INSERT INTO ZCALLRECORD VALUES (30, 660000000, '+5678', 0)")
    # And one invalid
    c.execute("INSERT INTO ZCALLRECORD VALUES (0, 'bad_date', 'unknown', 0)")
    c.commit()
    c.close()
    return db


def test_parse_calls(sms_db: Path, call_db: Path, device: DeviceInfo) -> None:
    # sms_db and call_db are in the same tmp_path because tmp_path is a fixture per test
    a = Artifact(
        artifact_type=ArtifactType.MESSAGE,
        source_app="com.apple.MobileSMS",
        source_path=str(sms_db),
        acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        hashes=HashPair(md5="a" * 32, sha256="b" * 64),
        device=device,
    )
    records = IMessageParser().parse(a)
    # 2 from message, 3 from calls = 5
    assert len(records) == 5
    call_records = [r for r in records if r.record_type == ArtifactType.CALL_LOG]
    assert len(call_records) == 3


def test_missing_message_table(tmp_path: Path, device: DeviceInfo) -> None:
    bad_sms = tmp_path / "sms.db"
    c = sqlite3.connect(str(bad_sms))
    c.execute("CREATE TABLE foo (id int)")
    c.commit()
    c.close()

    a = Artifact(
        artifact_type=ArtifactType.MESSAGE,
        source_app="com.apple.MobileSMS",
        source_path=str(bad_sms),
        acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        hashes=HashPair(md5="a" * 32, sha256="b" * 64),
        device=device,
    )
    from forensixd.core.exceptions import ParseError
    with pytest.raises(ParseError, match="Required table 'message' not found"):
        IMessageParser().parse(a)


def test_missing_callrecord_table_ignored(sms_db: Path, tmp_path: Path, device: DeviceInfo) -> None:
    # Create CallHistory but without the table
    bad_call = tmp_path / "CallHistory.storedata"
    c = sqlite3.connect(str(bad_call))
    c.execute("CREATE TABLE foo (id int)")
    c.commit()
    c.close()

    a = Artifact(
        artifact_type=ArtifactType.MESSAGE,
        source_app="com.apple.MobileSMS",
        source_path=str(sms_db),
        acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        hashes=HashPair(md5="a" * 32, sha256="b" * 64),
        device=device,
    )
    # The ParseError from _parse_calls should be caught and ignored, leaving only message records
    records = IMessageParser().parse(a)
    assert len(records) == 2


def test_bad_message_timestamp(sms_db: Path, device: DeviceInfo) -> None:
    c = sqlite3.connect(str(sms_db))
    c.execute("INSERT INTO message VALUES (99,'Bad Date','not_a_date',0,'iMessage',1,0)")
    # one < 1e12
    c.execute("INSERT INTO message VALUES (100,'Small Date', 660000000, 0,'iMessage',1,0)")
    c.commit()
    c.close()

    a = Artifact(
        artifact_type=ArtifactType.MESSAGE,
        source_app="com.apple.MobileSMS",
        source_path=str(sms_db),
        acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        hashes=HashPair(md5="a" * 32, sha256="b" * 64),
        device=device,
    )
    records = IMessageParser().parse(a)
    assert len(records) == 4
