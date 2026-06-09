"""Tests for forensixd.core.exceptions"""

import pytest

from forensixd.core.exceptions import (
    AuthorizationError,
    CloudExtractionError,
    DeviceNotFoundError,
    EncryptionError,
    ExtractionError,
    ForensixdError,
    HashVerificationError,
    ParseError,
    SessionAlreadyClosedError,
    UnsupportedPlatformError,
    WriteError,
)


def test_base_error_message_only() -> None:
    e = ForensixdError("something broke")
    assert str(e) == "something broke"


def test_base_error_with_context() -> None:
    e = ForensixdError("broke", {"key": "val"})
    assert "broke" in str(e)
    assert "key" in str(e)


def test_base_error_context_none() -> None:
    e = ForensixdError("msg", None)
    assert str(e) == "msg"


def test_all_subclasses_are_catchable_as_base() -> None:
    subclasses = [
        DeviceNotFoundError,
        ExtractionError,
        HashVerificationError,
        SessionAlreadyClosedError,
        AuthorizationError,
        ParseError,
        UnsupportedPlatformError,
        EncryptionError,
        CloudExtractionError,
        WriteError,
    ]
    for cls in subclasses:
        with pytest.raises(ForensixdError):
            raise cls("test error")


def test_each_subclass_has_correct_type() -> None:
    e = ExtractionError("adb failed")
    assert isinstance(e, ExtractionError)
    assert isinstance(e, ForensixdError)
    assert isinstance(e, Exception)


def test_subclass_accepts_context() -> None:
    e = ParseError("bad db", {"path": "/data/test.db", "table": "messages"})
    assert "bad db" in str(e)


def test_encryption_error_raised_and_caught() -> None:
    with pytest.raises(EncryptionError) as exc_info:
        raise EncryptionError("crypt15 key missing", {"file": "key"})
    assert "crypt15" in str(exc_info.value)
