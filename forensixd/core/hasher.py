"""
forensixd.core.hasher
~~~~~~~~~~~~~~~~~~~~~

Cryptographic hashing utilities for the forensixd acquisition pipeline.

All operations produce a :class:`~forensixd.core.models.HashPair` containing
both an MD5 and a SHA-256 digest.  Both hashers are always updated in a single
pass over the data so the file (or stream) is read only once regardless of
which digests are requested.

Typical usage::

    from pathlib import Path
    from forensixd.core.hasher import HashEngine

    pair = HashEngine.hash_file(Path("/evidence/image.dd"))
    print(pair.md5, pair.sha256)

    is_intact = HashEngine.verify_file(Path("/evidence/image.dd"), expected=pair)
"""

from __future__ import annotations

import hashlib
from pathlib import Path
from typing import IO

from forensixd.core.models import HashPair
from forensixd.core.exceptions import HashVerificationError

__all__ = ["HashEngine"]

_CHUNK_SIZE: int = 65_536  # 64 KiB — balances memory pressure vs. syscall overhead


class HashEngine:
    """Static factory that produces :class:`~forensixd.core.models.HashPair` objects.

    Every method performs a *single-pass* read so large evidence files are
    never fully loaded into memory.  All methods are pure (no side effects
    beyond reading) and thread-safe (each call allocates its own hashers).
    """

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    @staticmethod
    def hash_bytes(data: bytes) -> HashPair:
        """Compute MD5 and SHA-256 of *data* in one pass.

        Parameters
        ----------
        data:
            Raw bytes to digest.  The full buffer is processed in a single
            ``update`` call because it is already resident in memory.

        Returns
        -------
        HashPair
            Frozen model carrying both hex digests.

        Examples
        --------
        >>> pair = HashEngine.hash_bytes(b"hello world")
        >>> len(pair.md5)
        32
        >>> len(pair.sha256)
        64
        """
        md5_h = hashlib.md5()
        sha256_h = hashlib.sha256()

        md5_h.update(data)
        sha256_h.update(data)

        return HashPair(md5=md5_h.hexdigest(), sha256=sha256_h.hexdigest())

    @staticmethod
    def hash_file(path: Path) -> HashPair:
        """Compute MD5 and SHA-256 of the file at *path* using chunked I/O.

        The file is opened in binary mode and read in ``65536``-byte chunks so
        the process memory footprint is bounded regardless of file size.

        Parameters
        ----------
        path:
            Absolute or relative :class:`~pathlib.Path` to the target file.

        Returns
        -------
        HashPair
            Frozen model carrying both hex digests.

        Raises
        ------
        HashVerificationError
            If *path* does not exist or is not a regular file.

        Examples
        --------
        >>> import tempfile, pathlib
        >>> with tempfile.NamedTemporaryFile(delete=False) as f:
        ...     _ = f.write(b"evidence")
        ...     tmp = pathlib.Path(f.name)
        >>> pair = HashEngine.hash_file(tmp)
        >>> len(pair.sha256)
        64
        """
        if not path.exists():
            raise HashVerificationError(
                f"File not found: {path}",
                context={"path": str(path)},
            )

        with path.open("rb") as fh:
            return HashEngine.hash_stream(fh)

    @staticmethod
    def hash_stream(stream: IO[bytes]) -> HashPair:
        """Compute MD5 and SHA-256 of all bytes readable from *stream*.

        Reads ``65536`` bytes at a time.  The stream is **not** closed or
        rewound after processing — callers retain full ownership.

        Parameters
        ----------
        stream:
            Any readable binary I/O object (e.g. an open file handle,
            :class:`io.BytesIO`, a network socket wrapped in
            :class:`io.RawIOBase`, etc.).

        Returns
        -------
        HashPair
            Frozen model carrying both hex digests computed over all bytes
            that were readable from *stream* at call time.

        Examples
        --------
        >>> import io
        >>> pair = HashEngine.hash_stream(io.BytesIO(b"stream data"))
        >>> len(pair.md5)
        32
        """
        md5_h = hashlib.md5()
        sha256_h = hashlib.sha256()

        while True:
            chunk: bytes = stream.read(_CHUNK_SIZE)
            if not chunk:
                break
            md5_h.update(chunk)
            sha256_h.update(chunk)

        return HashPair(md5=md5_h.hexdigest(), sha256=sha256_h.hexdigest())

    @staticmethod
    def verify_file(path: Path, expected: HashPair) -> bool:
        """Hash *path* and compare **both** digests against *expected*.

        Both ``md5`` and ``sha256`` must match exactly; a discrepancy in
        either digest returns ``False``.

        Parameters
        ----------
        path:
            Absolute or relative :class:`~pathlib.Path` to the file to verify.
        expected:
            A :class:`~forensixd.core.models.HashPair` holding the reference
            digests (e.g. recorded at acquisition time).

        Returns
        -------
        bool
            ``True`` if and only if both ``md5`` and ``sha256`` digests of the
            file match *expected* exactly; ``False`` otherwise.

        Raises
        ------
        HashVerificationError
            If *path* does not exist or is not a regular file.

        Examples
        --------
        >>> import tempfile, pathlib
        >>> with tempfile.NamedTemporaryFile(delete=False) as f:
        ...     _ = f.write(b"verify me")
        ...     tmp = pathlib.Path(f.name)
        >>> pair = HashEngine.hash_file(tmp)
        >>> HashEngine.verify_file(tmp, pair)
        True
        """
        actual: HashPair = HashEngine.hash_file(path)  # raises HashVerificationError if missing
        return actual.md5 == expected.md5 and actual.sha256 == expected.sha256
