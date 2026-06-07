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


def test_invalid_charset_exception(device: DeviceInfo, tmp_path: Path) -> None:
    from email.message import Message
    eml_file = tmp_path / "invalid_charset.eml"
    msg = Message()
    msg.add_header('Content-Type', 'text/plain; charset="made-up-charset"')
    msg.set_payload(b'some bytes', charset='utf-8')
    # artificially replace the charset header so decode fails
    del msg["Content-Type"]
    msg["Content-Type"] = 'text/plain; charset="made-up-charset"'
    eml_file.write_bytes(msg.as_bytes())

    a = Artifact(
        artifact_type=ArtifactType.EMAIL,
        source_app="mail",
        source_path=str(eml_file),
        acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        hashes=HashPair(md5="a" * 32, sha256="b" * 64),
        device=device,
    )
    record = EmailParser().parse(a)[0]
    # Exception is caught, body is empty
    assert record.fields["body"] == ""


def test_string_payload(device: DeviceInfo, tmp_path: Path) -> None:
    import unittest.mock
    from email.message import Message
    
    eml_file = tmp_path / "str_payload.eml"
    msg = Message()
    msg.add_header('Content-Type', 'text/plain')
    eml_file.write_bytes(msg.as_bytes())

    a = Artifact(
        artifact_type=ArtifactType.EMAIL,
        source_app="mail",
        source_path=str(eml_file),
        acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        hashes=HashPair(md5="a" * 32, sha256="b" * 64),
        device=device,
    )

    parser = EmailParser()
    # Mock get_payload to return a str directly instead of bytes
    with unittest.mock.patch("email.message.Message.get_payload", return_value="string payload direct"):
        record = parser.parse(a)[0]
    
    assert record.fields["body"] == "string payload direct"


def test_parse_eml(device: DeviceInfo, tmp_path: Path) -> None:
    eml_file = tmp_path / "test.eml"
    msg = email.message.Message()
    msg["From"] = "test@example.com"
    msg["To"] = "test2@example.com"
    msg["Subject"] = "Test EML"
    msg["Date"] = "Mon, 01 Jan 2024 12:00:00 +0000"
    msg.set_payload("EML body")
    eml_file.write_bytes(msg.as_bytes())

    a = Artifact(
        artifact_type=ArtifactType.EMAIL,
        source_app="mail",
        source_path=str(eml_file),
        acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        hashes=HashPair(md5="a" * 32, sha256="b" * 64),
        device=device,
    )
    records = EmailParser().parse(a)
    assert len(records) == 1
    assert "EML body" in records[0].fields["body"]


def test_eml_exception(device: DeviceInfo, tmp_path: Path) -> None:
    eml_file = tmp_path / "dir.eml"
    eml_file.mkdir()  # IsADirectoryError when read_bytes is called

    a = Artifact(
        artifact_type=ArtifactType.EMAIL,
        source_app="mail",
        source_path=str(eml_file),
        acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        hashes=HashPair(md5="a" * 32, sha256="b" * 64),
        device=device,
    )
    from forensixd.core.exceptions import ParseError
    with pytest.raises(ParseError, match="Failed to parse .eml file"):
        EmailParser().parse(a)


def test_mbox_exception(device: DeviceInfo, tmp_path: Path) -> None:
    # mbox on a directory that doesn't exist or is invalid
    bad_mbox = tmp_path / "nonexistent" / "bad.mbox"
    a = Artifact(
        artifact_type=ArtifactType.EMAIL,
        source_app="mail",
        source_path=str(bad_mbox),
        acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        hashes=HashPair(md5="a" * 32, sha256="b" * 64),
        device=device,
    )
    from forensixd.core.exceptions import ParseError
    with pytest.raises(ParseError, match="Failed to open mbox file"):
        EmailParser().parse(a)


def test_naive_date_header(device: DeviceInfo, tmp_path: Path) -> None:
    eml_file = tmp_path / "naive.eml"
    msg = email.message.Message()
    # Missing timezone offset
    msg["Date"] = "Mon, 01 Jan 2024 12:00:00"
    msg.set_payload("Naive date body")
    eml_file.write_bytes(msg.as_bytes())

    a = Artifact(
        artifact_type=ArtifactType.EMAIL,
        source_app="mail",
        source_path=str(eml_file),
        acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        hashes=HashPair(md5="a" * 32, sha256="b" * 64),
        device=device,
    )
    record = EmailParser().parse(a)[0]
    assert record.fields["timestamp"].endswith("+05:30")


def test_invalid_date_header(device: DeviceInfo, tmp_path: Path) -> None:
    eml_file = tmp_path / "invalid_date.eml"
    msg = email.message.Message()
    msg["Date"] = "Not a real date format"
    msg.set_payload("Invalid date body")
    eml_file.write_bytes(msg.as_bytes())

    a = Artifact(
        artifact_type=ArtifactType.EMAIL,
        source_app="mail",
        source_path=str(eml_file),
        acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        hashes=HashPair(md5="a" * 32, sha256="b" * 64),
        device=device,
    )
    record = EmailParser().parse(a)[0]
    # Falls back to "now", so we just check it doesn't crash
    assert "timestamp" in record.fields


def test_multipart_with_attachment(device: DeviceInfo, tmp_path: Path) -> None:
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    from email.mime.application import MIMEApplication

    eml_file = tmp_path / "attach.eml"
    msg = MIMEMultipart()
    msg.attach(MIMEText("Text body"))
    
    attach = MIMEApplication(b"binary data")
    attach.add_header('Content-Disposition', 'attachment', filename='test.bin')
    msg.attach(attach)

    eml_file.write_bytes(msg.as_bytes())

    a = Artifact(
        artifact_type=ArtifactType.EMAIL,
        source_app="mail",
        source_path=str(eml_file),
        acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        hashes=HashPair(md5="a" * 32, sha256="b" * 64),
        device=device,
    )
    record = EmailParser().parse(a)[0]
    assert "test.bin" in record.fields["attachment_names"]
    assert "Text body" in record.fields["body"]


def test_decode_error_in_body(device: DeviceInfo, tmp_path: Path) -> None:
    from email.message import Message
    eml_file = tmp_path / "decode.eml"
    msg = Message()
    msg.add_header('Content-Type', 'text/plain; charset="utf-8"')
    # invalid utf-8
    msg.set_payload(b'\xff\xfe\xfd', charset='utf-8')
    eml_file.write_bytes(msg.as_bytes())

    a = Artifact(
        artifact_type=ArtifactType.EMAIL,
        source_app="mail",
        source_path=str(eml_file),
        acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        hashes=HashPair(md5="a" * 32, sha256="b" * 64),
        device=device,
    )
    record = EmailParser().parse(a)[0]
    # It decodes with errors='replace', so no crash, body has replacement chars
    assert len(record.fields["body"]) > 0


def test_truncated_body(device: DeviceInfo, tmp_path: Path) -> None:
    eml_file = tmp_path / "large.eml"
    msg = email.message.Message()
    msg.set_payload("A" * 6000)
    eml_file.write_bytes(msg.as_bytes())

    a = Artifact(
        artifact_type=ArtifactType.EMAIL,
        source_app="mail",
        source_path=str(eml_file),
        acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        hashes=HashPair(md5="a" * 32, sha256="b" * 64),
        device=device,
    )
    record = EmailParser().parse(a)[0]
    assert len(record.fields["body"]) < 6000
    assert "[truncated]" in record.fields["body"]


def test_extract_message_exception_skips(device: DeviceInfo, tmp_path: Path) -> None:
    import mailbox
    import unittest.mock
    
    mbox_file = tmp_path / "skip.mbox"
    box = mailbox.mbox(str(mbox_file))
    msg = mailbox.mboxMessage()
    msg.set_payload("OK")
    box.add(msg)
    box.flush()
    box.close()

    a = Artifact(
        artifact_type=ArtifactType.EMAIL,
        source_app="mail",
        source_path=str(mbox_file),
        acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
        hashes=HashPair(md5="a" * 32, sha256="b" * 64),
        device=device,
    )
    
    # Mock _extract_message to raise an exception, testing the silently skip malformed logic
    parser = EmailParser()
    with unittest.mock.patch.object(parser, '_extract_message', side_effect=Exception("mock bad message")):
        records = parser.parse(a)
    assert len(records) == 0
