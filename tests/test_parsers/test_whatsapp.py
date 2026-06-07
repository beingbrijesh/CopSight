"""
tests.test_parsers.test_whatsapp
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Unit tests for :class:`forensixd.parsers.apps.whatsapp.WhatsAppParser`.

Coverage
--------
* ``app_name`` property
* ``can_parse`` positive / negative cases
* Plain Android ``msgstore.db`` – record count, types, field values,
  timestamp format, app_name label, confidence score
* Crypt15 path without a ``key`` sibling → :exc:`EncryptionError`
"""

import sqlite3
from datetime import timedelta, datetime, timezone
from pathlib import Path

import pytest

from forensixd.core.exceptions import EncryptionError, ParseError
from forensixd.core.models import (
    Artifact,
    ArtifactType,
    DeviceInfo,
    HashPair,
    Platform,
)
from forensixd.parsers.apps.whatsapp import WhatsAppParser

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def device() -> DeviceInfo:
    """Minimal Android :class:`DeviceInfo` shared across tests."""
    return DeviceInfo(platform=Platform.ANDROID, device_id="wa-test")


@pytest.fixture
def android_db(tmp_path: Path) -> Path:
    """Create a minimal ``msgstore.db`` with two messages."""
    db = tmp_path / "msgstore.db"
    conn = sqlite3.connect(str(db))
    conn.execute(
        """CREATE TABLE messages (
            key_remote_jid TEXT,
            data            TEXT,
            timestamp       INTEGER,
            key_from_me     INTEGER,
            media_url       TEXT
        )"""
    )
    conn.execute(
        "INSERT INTO messages VALUES (?,?,?,?,?)",
        ("123@s.whatsapp.net", "Hello!", 1_700_000_000_000, 0, None),
    )
    conn.execute(
        "INSERT INTO messages VALUES (?,?,?,?,?)",
        ("123@s.whatsapp.net", "Reply", 1_700_000_001_000, 1, None),
    )
    conn.commit()
    conn.close()
    return db


@pytest.fixture
def artifact(android_db: Path, device: DeviceInfo) -> Artifact:
    """Artifact pointing at the test ``msgstore.db``."""
    return Artifact(
        artifact_type=ArtifactType.APP_DATA,
        source_app="com.whatsapp",
        source_path=str(android_db),
        acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        hashes=HashPair(md5="a" * 32, sha256="b" * 64),
        device=device,
    )


# ---------------------------------------------------------------------------
# app_name
# ---------------------------------------------------------------------------


def test_app_name() -> None:
    """Parser must self-identify as 'WhatsApp'."""
    assert WhatsAppParser().app_name == "WhatsApp"


# ---------------------------------------------------------------------------
# can_parse
# ---------------------------------------------------------------------------


def test_can_parse_whatsapp_path(device: DeviceInfo) -> None:
    """Returns True when source_path contains 'whatsapp' or 'msgstore'."""
    artifact = Artifact(
        artifact_type=ArtifactType.APP_DATA,
        source_app="com.whatsapp",
        source_path="/data/whatsapp/msgstore.db",
        acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        hashes=HashPair(md5="a" * 32, sha256="b" * 64),
        device=device,
    )
    assert WhatsAppParser().can_parse(artifact) is True


def test_cannot_parse_signal_path(device: DeviceInfo) -> None:
    """Returns False when source_path contains no WhatsApp keywords."""
    artifact = Artifact(
        artifact_type=ArtifactType.APP_DATA,
        source_app="org.signal",
        source_path="/data/signal/signal.db",
        acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        hashes=HashPair(md5="a" * 32, sha256="b" * 64),
        device=device,
    )
    assert WhatsAppParser().can_parse(artifact) is False


# ---------------------------------------------------------------------------
# Android plain parsing
# ---------------------------------------------------------------------------


def test_parse_returns_two_records(artifact: Artifact) -> None:
    """Parser should return exactly one record per row in the messages table."""
    records = WhatsAppParser().parse(artifact)
    assert len(records) == 2


def test_records_are_message_type(artifact: Artifact) -> None:
    """Every record must have record_type == ArtifactType.MESSAGE."""
    for record in WhatsAppParser().parse(artifact):
        assert record.record_type == ArtifactType.MESSAGE


def test_is_from_me_correct(artifact: Artifact) -> None:
    """is_from_me must reflect the key_from_me column (0→False, 1→True)."""
    records = WhatsAppParser().parse(artifact)
    assert records[0].fields["is_from_me"] is False
    assert records[1].fields["is_from_me"] is True


def test_timestamp_is_iso_string(artifact: Artifact) -> None:
    """timestamp field must be a parseable ISO-8601 string."""
    records = WhatsAppParser().parse(artifact)
    # Raises ValueError if not a valid ISO string
    dt = datetime.fromisoformat(records[0].fields["timestamp"])
    assert dt.tzinfo is not None  # must be timezone-aware


def test_timestamp_value_correct(artifact: Artifact) -> None:
    """Timestamp must equal epoch ms ÷ 1000 converted to UTC ISO string."""
    records = WhatsAppParser().parse(artifact)
    expected = datetime.fromtimestamp(
        1_700_000_000_000 / 1000, tz=timezone(timedelta(hours=5, minutes=30))
    ).isoformat()
    assert records[0].fields["timestamp"] == expected


def test_body_field_correct(artifact: Artifact) -> None:
    """body field must contain the raw message text."""
    records = WhatsAppParser().parse(artifact)
    assert records[0].fields["body"] == "Hello!"
    assert records[1].fields["body"] == "Reply"


def test_from_field_correct(artifact: Artifact) -> None:
    """from field must contain the JID string from the database."""
    records = WhatsAppParser().parse(artifact)
    assert records[0].fields["from"] == "123@s.whatsapp.net"


def test_media_url_none_for_text_only(artifact: Artifact) -> None:
    """media_url must be None when the database column is NULL."""
    records = WhatsAppParser().parse(artifact)
    assert records[0].fields["media_url"] is None


def test_app_name_in_record(artifact: Artifact) -> None:
    """Every ParsedRecord.app_name must equal 'WhatsApp'."""
    for record in WhatsAppParser().parse(artifact):
        assert record.app_name == "WhatsApp"


def test_confidence_gte_90(artifact: Artifact) -> None:
    """Android plain confidence must be ≥ 0.90."""
    for record in WhatsAppParser().parse(artifact):
        assert record.confidence >= 0.90


def test_source_artifact_id_propagated(artifact: Artifact) -> None:
    """source_artifact_id in every record must match the artifact's ID."""
    records = WhatsAppParser().parse(artifact)
    for record in records:
        assert record.source_artifact_id == artifact.artifact_id


# ---------------------------------------------------------------------------
# Missing-table guard
# ---------------------------------------------------------------------------


def test_missing_messages_table_raises(tmp_path: Path, device: DeviceInfo) -> None:
    """ParseError must be raised when the messages table is absent."""
    db = tmp_path / "msgstore.db"
    conn = sqlite3.connect(str(db))
    conn.execute("CREATE TABLE unrelated (id INTEGER)")
    conn.commit()
    conn.close()

    artifact = Artifact(
        artifact_type=ArtifactType.APP_DATA,
        source_app="com.whatsapp",
        source_path=str(db),
        acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        hashes=HashPair(md5="a" * 32, sha256="b" * 64),
        device=device,
    )
    with pytest.raises(ParseError):
        WhatsAppParser().parse(artifact)


# ---------------------------------------------------------------------------
# Encrypted path – missing key file
# ---------------------------------------------------------------------------


def test_encrypted_without_key_raises(tmp_path: Path, device: DeviceInfo) -> None:
    """EncryptionError must be raised when the sibling key file is absent."""
    crypt_file = tmp_path / "msgstore.db.crypt15"
    crypt_file.write_bytes(b"fake encrypted content")

    artifact = Artifact(
        artifact_type=ArtifactType.APP_DATA,
        source_app="com.whatsapp",
        source_path=str(crypt_file),
        acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        hashes=HashPair(md5="a" * 32, sha256="b" * 64),
        device=device,
    )
    with pytest.raises(EncryptionError):
        WhatsAppParser().parse(artifact)
