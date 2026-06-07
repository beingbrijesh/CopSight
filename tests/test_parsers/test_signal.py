"""
tests.test_parsers.test_signal
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Unit tests for :class:`forensixd.parsers.apps.signal.SignalParser`.
"""

import sqlite3
from datetime import timedelta, datetime, timezone
from pathlib import Path

import pytest

from forensixd.core.exceptions import EncryptionError
from forensixd.core.models import (
    Artifact,
    ArtifactType,
    DeviceInfo,
    HashPair,
    Platform,
)
from forensixd.parsers.apps.signal import SignalParser


@pytest.fixture
def device() -> DeviceInfo:
    return DeviceInfo(platform=Platform.ANDROID, device_id="signal-test")


@pytest.fixture
def decrypted_db(tmp_path: Path) -> Path:
    db = tmp_path / "signal.db"
    c = sqlite3.connect(str(db))
    c.execute(
        """CREATE TABLE sms (
            address TEXT,
            date INTEGER,
            body TEXT,
            type INTEGER
        )"""
    )
    c.execute(
        "INSERT INTO sms VALUES ('+1234567890',1700000000000,'Encrypted msg',1)"
    )
    c.execute(
        "INSERT INTO sms VALUES ('+1234567890',1700000001000,'My reply',2)"
    )
    c.commit()
    c.close()
    return db


@pytest.fixture
def artifact(decrypted_db: Path, device: DeviceInfo) -> Artifact:
    return Artifact(
        artifact_type=ArtifactType.APP_DATA,
        source_app="org.thoughtcrime.securesms",
        source_path=str(decrypted_db),
        acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        hashes=HashPair(md5="a" * 32, sha256="b" * 64),
        device=device,
    )


def test_app_name() -> None:
    assert SignalParser().app_name == "Signal"


def test_can_parse_signal_path(device: DeviceInfo) -> None:
    a = Artifact(
        artifact_type=ArtifactType.APP_DATA,
        source_app="org.thoughtcrime.securesms",
        source_path="/data/signal/signal.db",
        acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        hashes=HashPair(md5="a" * 32, sha256="b" * 64),
        device=device,
    )
    assert SignalParser().can_parse(a) is True


def test_parse_decrypted_db_returns_records(artifact: Artifact) -> None:
    records = SignalParser().parse(artifact)
    assert len(records) == 2


def test_records_are_message_type(artifact: Artifact) -> None:
    for r in SignalParser().parse(artifact):
        assert r.record_type == ArtifactType.MESSAGE


def test_is_from_me_correct(artifact: Artifact) -> None:
    records = SignalParser().parse(artifact)
    assert records[0].fields["is_from_me"] is False  # type=1
    assert records[1].fields["is_from_me"] is True   # type=2


def test_timestamp_is_iso(artifact: Artifact) -> None:
    records = SignalParser().parse(artifact)
    datetime.fromisoformat(records[0].fields["timestamp"])


def test_encrypted_db_raises_encryption_error(tmp_path: Path, device: DeviceInfo) -> None:
    f = tmp_path / "signal.db"
    # Create a corrupted/encrypted file header
    f.write_bytes(b"SQLite format 3\x00NOT REAL DB")
    
    a = Artifact(
        artifact_type=ArtifactType.APP_DATA,
        source_app="org.thoughtcrime.securesms",
        source_path=str(f),
        acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        hashes=HashPair(md5="a" * 32, sha256="b" * 64),
        device=device,
    )
    
    with pytest.raises((EncryptionError, Exception)):
        SignalParser().parse(a)


def test_confidence_gte_90(artifact: Artifact) -> None:
    for r in SignalParser().parse(artifact):
        assert r.confidence >= 0.90


def test_missing_sms_table(tmp_path: Path, device: DeviceInfo) -> None:
    db = tmp_path / "signal.db"
    c = sqlite3.connect(str(db))
    c.execute("CREATE TABLE foo (id INTEGER)")
    c.commit()
    c.close()

    a = Artifact(
        artifact_type=ArtifactType.APP_DATA,
        source_app="org.thoughtcrime.securesms",
        source_path=str(db),
        acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        hashes=HashPair(md5="a" * 32, sha256="b" * 64),
        device=device,
    )
    from forensixd.core.exceptions import ParseError
    with pytest.raises(ParseError, match="Required table 'sms' not found"):
        SignalParser().parse(a)


def test_invalid_timestamp(decrypted_db: Path, device: DeviceInfo) -> None:
    c = sqlite3.connect(str(decrypted_db))
    c.execute("INSERT INTO sms VALUES ('bad', 'invalid_date', 'Bad date', 1)")
    c.commit()
    c.close()

    a = Artifact(
        artifact_type=ArtifactType.APP_DATA,
        source_app="org.thoughtcrime.securesms",
        source_path=str(decrypted_db),
        acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        hashes=HashPair(md5="a" * 32, sha256="b" * 64),
        device=device,
    )
    records = SignalParser().parse(a)
    assert len(records) == 3
    bad_record = next(r for r in records if r.fields["address"] == "bad")
    assert "timestamp" in bad_record.fields


def test_parseerror_is_reraised(tmp_path: Path, device: DeviceInfo) -> None:
    db = tmp_path / "signal.db"
    
    a = Artifact(
        artifact_type=ArtifactType.APP_DATA,
        source_app="org.thoughtcrime.securesms",
        source_path=str(db),
        acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        hashes=HashPair(md5="a" * 32, sha256="b" * 64),
        device=device,
    )

    import unittest.mock
    from forensixd.core.exceptions import ParseError
    
    with unittest.mock.patch("forensixd.parsers.sqlite_parser.SQLiteParser.query") as mock_query:
        # Give it an error that does not contain "encrypted" or "not a database"
        mock_query.side_effect = ParseError("Some generic failure here")
        with pytest.raises(ParseError, match="Some generic failure here"):
            SignalParser().parse(a)


def test_parseerror_is_translated_to_encryptionerror(tmp_path: Path, device: DeviceInfo) -> None:
    db = tmp_path / "signal.db"
    
    a = Artifact(
        artifact_type=ArtifactType.APP_DATA,
        source_app="org.thoughtcrime.securesms",
        source_path=str(db),
        acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        hashes=HashPair(md5="a" * 32, sha256="b" * 64),
        device=device,
    )

    import unittest.mock
    from forensixd.core.exceptions import ParseError, EncryptionError
    
    with unittest.mock.patch("forensixd.parsers.sqlite_parser.SQLiteParser.query") as mock_query:
        mock_query.side_effect = ParseError("sqlite: file is encrypted or is not a database")
        with pytest.raises(EncryptionError, match="Signal database is SQLCipher-encrypted"):
            SignalParser().parse(a)
