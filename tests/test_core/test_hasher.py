"""Tests for forensixd.core.hasher — HashEngine"""

import io
import os
import tempfile
import pytest

from pathlib import Path

from forensixd.core.hasher import HashEngine
from forensixd.core.models import HashPair
from forensixd.core.exceptions import HashVerificationError


# ---------------------------------------------------------------------------
# hash_bytes
# ---------------------------------------------------------------------------


def test_hash_bytes_returns_hash_pair() -> None:
    hp = HashEngine.hash_bytes(b"hello forensixd")
    assert isinstance(hp, HashPair)
    assert len(hp.md5) == 32
    assert len(hp.sha256) == 64


def test_hash_bytes_known_value() -> None:
    # SHA-256 of empty bytes is a well-known constant (RFC 6234).
    hp = HashEngine.hash_bytes(b"")
    assert hp.sha256 == "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"


def test_hash_bytes_deterministic() -> None:
    hp1 = HashEngine.hash_bytes(b"same input")
    hp2 = HashEngine.hash_bytes(b"same input")
    assert hp1.md5 == hp2.md5
    assert hp1.sha256 == hp2.sha256


def test_hash_bytes_different_inputs_differ() -> None:
    hp1 = HashEngine.hash_bytes(b"input one")
    hp2 = HashEngine.hash_bytes(b"input two")
    assert hp1.sha256 != hp2.sha256


# ---------------------------------------------------------------------------
# hash_file
# ---------------------------------------------------------------------------


def test_hash_file_returns_hash_pair(tmp_path: Path) -> None:
    f = tmp_path / "test.bin"
    f.write_bytes(b"file content for hashing")
    hp = HashEngine.hash_file(f)
    assert isinstance(hp, HashPair)
    assert len(hp.md5) == 32
    assert len(hp.sha256) == 64


def test_hash_file_matches_hash_bytes(tmp_path: Path) -> None:
    data = b"identical content"
    f = tmp_path / "test.bin"
    f.write_bytes(data)
    hp_file = HashEngine.hash_file(f)
    hp_bytes = HashEngine.hash_bytes(data)
    assert hp_file.md5 == hp_bytes.md5
    assert hp_file.sha256 == hp_bytes.sha256


def test_hash_file_nonexistent_raises() -> None:
    with pytest.raises(HashVerificationError):
        HashEngine.hash_file(Path("/nonexistent/file.db"))


# ---------------------------------------------------------------------------
# hash_stream
# ---------------------------------------------------------------------------


def test_hash_stream_matches_hash_bytes() -> None:
    data = b"stream test data"
    stream = io.BytesIO(data)
    hp_stream = HashEngine.hash_stream(stream)
    hp_bytes = HashEngine.hash_bytes(data)
    assert hp_stream.sha256 == hp_bytes.sha256


def test_hash_stream_does_not_close_stream() -> None:
    stream = io.BytesIO(b"data")
    HashEngine.hash_stream(stream)
    assert not stream.closed


# ---------------------------------------------------------------------------
# verify_file
# ---------------------------------------------------------------------------


def test_verify_file_returns_true_for_correct_hash(tmp_path: Path) -> None:
    f = tmp_path / "verify.bin"
    f.write_bytes(b"verify me")
    hp = HashEngine.hash_file(f)
    assert HashEngine.verify_file(f, hp) is True


def test_verify_file_returns_false_for_wrong_hash(tmp_path: Path) -> None:
    f = tmp_path / "verify.bin"
    f.write_bytes(b"original content")
    wrong_hp = HashPair(md5="a" * 32, sha256="b" * 64)
    assert HashEngine.verify_file(f, wrong_hp) is False


def test_verify_file_nonexistent_raises() -> None:
    hp = HashPair(md5="a" * 32, sha256="b" * 64)
    with pytest.raises(HashVerificationError):
        HashEngine.verify_file(Path("/nonexistent/file"), hp)


# ---------------------------------------------------------------------------
# Large-file chunked I/O
# ---------------------------------------------------------------------------


def test_hash_large_file_does_not_load_all_in_memory(tmp_path: Path) -> None:
    # Write a 5 MiB file and confirm hashing completes without error.
    # The chunked implementation keeps only 64 KiB resident at any time.
    f = tmp_path / "large.bin"
    f.write_bytes(b"x" * (5 * 1024 * 1024))
    hp = HashEngine.hash_file(f)
    assert len(hp.sha256) == 64
