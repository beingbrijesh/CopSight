"""
tests.test_parsers.test_email_parser
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Unit tests for :class:`forensixd.parsers.apps.email_parser.EmailParser`.
"""

import email
import mailbox
import tempfile
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
from forensixd.parsers.apps.email_parser import EmailParser


@pytest.fixture
def device() -> DeviceInfo:
    return DeviceInfo(platform=Platform.WINDOWS, device_id="mail-test")


@pytest.fixture
def mbox_file(tmp_path: Path) -> Path:
    f = tmp_path / "test.mbox"
    box = mailbox.mbox(str(f))
    
    msg = mailbox.mboxMessage()
    msg["From"] = "alice@example.com"
    msg["To"] = "bob@example.com"
    msg["Subject"] = "Evidence email"
    msg["Date"] = "Mon, 01 Jan 2024 12:00:00 +0000"
    msg.set_payload("This is the email body content.")
    box.add(msg)
    
    msg2 = mailbox.mboxMessage()
    msg2["From"] = "bob@example.com"
    msg2["To"] = "alice@example.com"
    msg2["Subject"] = "Re: Evidence email"
    msg2["Date"] = "Mon, 01 Jan 2024 13:00:00 +0000"
    msg2.set_payload("Got it.")
    box.add(msg2)
    
    box.flush()
    box.close()
    return f


@pytest.fixture
def mbox_artifact(mbox_file: Path, device: DeviceInfo) -> Artifact:
    return Artifact(
        artifact_type=ArtifactType.EMAIL,
        source_app="mail",
        source_path=str(mbox_file),
        acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        hashes=HashPair(md5="a" * 32, sha256="b" * 64),
        device=device,
    )


def test_app_name() -> None:
    assert EmailParser().app_name == "Email"


def test_can_parse_mbox(device: DeviceInfo) -> None:
    a = Artifact(
        artifact_type=ArtifactType.EMAIL,
        source_app="mail",
        source_path="/home/user/Mail/inbox.mbox",
        acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        hashes=HashPair(md5="a" * 32, sha256="b" * 64),
        device=device,
    )
    assert EmailParser().can_parse(a) is True


def test_can_parse_eml(device: DeviceInfo) -> None:
    a = Artifact(
        artifact_type=ArtifactType.EMAIL,
        source_app="mail",
        source_path="/evidence/email.eml",
        acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        hashes=HashPair(md5="a" * 32, sha256="b" * 64),
        device=device,
    )
    assert EmailParser().can_parse(a) is True


def test_parse_mbox_returns_two_records(mbox_artifact: Artifact) -> None:
    records = EmailParser().parse(mbox_artifact)
    assert len(records) == 2


def test_records_are_email_type(mbox_artifact: Artifact) -> None:
    for r in EmailParser().parse(mbox_artifact):
        assert r.record_type == ArtifactType.EMAIL


def test_from_field_present(mbox_artifact: Artifact) -> None:
    records = EmailParser().parse(mbox_artifact)
    assert "From" in records[0].fields
    assert "alice" in records[0].fields["From"].lower()


def test_subject_field_present(mbox_artifact: Artifact) -> None:
    records = EmailParser().parse(mbox_artifact)
    assert "Subject" in records[0].fields
    assert "Evidence" in records[0].fields["Subject"]


def test_body_not_empty(mbox_artifact: Artifact) -> None:
    records = EmailParser().parse(mbox_artifact)
    body = records[0].fields.get("body", "")
    assert isinstance(body, str) and len(body) > 0


def test_confidence_is_high(mbox_artifact: Artifact) -> None:
    for r in EmailParser().parse(mbox_artifact):
        assert r.confidence >= 0.95
