"""
forensixd.extractors.disk_image
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Forensic extractor for raw disk images (DD, E01, AFF, etc.) via ``pytsk3``.

The extractor registers itself with :class:`~forensixd.extractors.base.ExtractorRegistry`
for :attr:`~forensixd.core.models.Platform.DISK_IMAGE` at import time, so a
simple ``import forensixd.extractors.disk_image`` is sufficient to make it
available to the registry.

All three :class:`~forensixd.core.models.ExtractionLevel` values are supported
because disk image traversal inherently operates at the raw file-system level
and can satisfy logical, file-system, and physical enquiries with the same
underlying ``pytsk3`` walk.

``pytsk3`` is an optional dependency.  If it is not installed the extractor is
still importable but :meth:`DiskImageExtractor.is_available` will return
``False`` and any attempt to call :meth:`~DiskImageExtractor.extract` will
raise :class:`~forensixd.core.exceptions.ExtractionError` with an install
hint.

Usage
-----
::

    from forensixd.extractors.disk_image import DiskImageExtractor
    from forensixd.core.models import ExtractionLevel

    extractor = DiskImageExtractor()
    extractor.connect(device_info)          # device_info.device_id = "/path/to/image.dd"
    for artifact in extractor.extract(session, ExtractionLevel.FILE_SYSTEM):
        print(artifact.source_path)
    extractor.disconnect()
"""

from __future__ import annotations

import logging
import tempfile
from collections.abc import Iterator
from datetime import timedelta, datetime, timezone
from pathlib import Path
from typing import Optional

from forensixd.core.exceptions import ExtractionError
from forensixd.core.hasher import HashEngine
from forensixd.core.models import (
    Artifact,
    ArtifactType,
    DeviceInfo,
    ExtractionLevel,
    Platform,
)
from forensixd.core.session import ForensicSession
from forensixd.extractors.base import AbstractExtractor, ExtractorRegistry

# ---------------------------------------------------------------------------
# Optional dependency guard
# ---------------------------------------------------------------------------

try:
    import pytsk3  # type: ignore[import-untyped]

    TSK_AVAILABLE: bool = True
except ModuleNotFoundError:
    TSK_AVAILABLE = False

__all__ = ["DiskImageExtractor", "TSK_AVAILABLE"]

_logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _artifact_type_for_tsk_path(path_str: str) -> ArtifactType:
    """Return the :class:`~forensixd.core.models.ArtifactType` for *path_str*.

    Maps common disk image path segments to forensic categories.  The first
    matching segment wins; unrecognised paths default to
    :attr:`~forensixd.core.models.ArtifactType.APP_DATA`.

    Parameters
    ----------
    path_str:
        String representation of the file's path inside the image.

    Returns
    -------
    ArtifactType
        The best-matching forensic category.
    """
    lower = path_str.lower()
    if any(seg in lower for seg in ("dcim", "pictures", "photo", "video", "movies")):
        return ArtifactType.MEDIA
    if any(seg in lower for seg in ("sms", "mms", "messages", "whatsapp", "signal")):
        return ArtifactType.MESSAGE
    if any(seg in lower for seg in ("calllog", "call_log", "calls", "callhistory")):
        return ArtifactType.CALL_LOG
    if any(seg in lower for seg in ("contacts", "phonebook")):
        return ArtifactType.CONTACT
    if any(
        seg in lower
        for seg in ("chrome", "firefox", "safari", "opera", "browser", "history")
    ):
        return ArtifactType.BROWSER_HISTORY
    if any(seg in lower for seg in ("mail", "email", "outlook", "gmail")):
        return ArtifactType.EMAIL
    if any(seg in lower for seg in ("gps", "location", "geo")):
        return ArtifactType.LOCATION
    if any(seg in lower for seg in ("log", "syslog", "event", "journal")):
        return ArtifactType.SYSTEM_LOG
    return ArtifactType.APP_DATA


# ---------------------------------------------------------------------------
# DiskImageExtractor
# ---------------------------------------------------------------------------


@ExtractorRegistry.register(Platform.DISK_IMAGE)
class DiskImageExtractor(AbstractExtractor):
    """Forensic extractor for raw disk images via ``pytsk3``.

    Supports all three :class:`~forensixd.core.models.ExtractionLevel` values.
    The extraction walk is identical regardless of the requested level — the
    entire file-system tree inside the image is traversed and every regular
    file is yielded as an :class:`~forensixd.core.models.Artifact`.

    ``pytsk3`` must be installed (``pip install pytsk3``) for extraction to
    succeed.  The extractor is still importable and registerable without it;
    :meth:`is_available` will return ``False`` and :meth:`extract` will raise
    :class:`~forensixd.core.exceptions.ExtractionError` with a clear install
    hint.

    Call :meth:`connect` before :meth:`extract`.  :meth:`disconnect` is a
    no-op but should be called for consistency and forward-compatibility.

    Attributes
    ----------
    _device:
        The :class:`~forensixd.core.models.DeviceInfo` supplied to the most
        recent successful :meth:`connect` call, or ``None`` when disconnected.
    _connected:
        ``True`` between a successful :meth:`connect` and the subsequent
        :meth:`disconnect`.
    _image_path:
        :class:`~pathlib.Path` to the disk image file, set during
        :meth:`connect`.
    """

    def __init__(self) -> None:
        """Initialise an unconnected :class:`DiskImageExtractor`."""
        self._device: Optional[DeviceInfo] = None
        self._connected: bool = False
        self._image_path: Optional[Path] = None

    # ------------------------------------------------------------------
    # AbstractExtractor interface
    # ------------------------------------------------------------------

    def is_available(self) -> bool:
        """Return ``True`` when ``pytsk3`` is importable.

        Returns
        -------
        bool
            :data:`TSK_AVAILABLE` — ``True`` if ``pytsk3`` was successfully
            imported at module load time; ``False`` otherwise.
        """
        return TSK_AVAILABLE

    def supported_levels(self) -> list[ExtractionLevel]:
        """Return all three extraction levels supported by this extractor.

        Disk image traversal via ``pytsk3`` naturally satisfies logical,
        file-system, and physical-level enquiries using the same walk, so all
        three :class:`~forensixd.core.models.ExtractionLevel` values are
        reported as supported.

        Returns
        -------
        list[ExtractionLevel]
            ``[LOGICAL, FILE_SYSTEM, PHYSICAL]``.
        """
        return [
            ExtractionLevel.LOGICAL,
            ExtractionLevel.FILE_SYSTEM,
            ExtractionLevel.PHYSICAL,
        ]

    def connect(self, device: DeviceInfo) -> None:
        """Validate and store the disk image path from *device*.

        :attr:`~forensixd.core.models.DeviceInfo.device_id` is interpreted as
        the filesystem path to the disk image file.  The method raises
        :class:`~forensixd.core.exceptions.ExtractionError` immediately if the
        path does not exist so that callers receive a clear error rather than a
        cryptic ``pytsk3`` failure deep inside the extraction stack.

        Parameters
        ----------
        device:
            Descriptor whose ``device_id`` field contains the path to a
            readable disk image (e.g. ``/cases/evidence.dd``).

        Raises
        ------
        ExtractionError
            If *device.device_id* does not refer to an existing file.
        """
        image_path = Path(device.device_id)

        if not image_path.exists():
            raise ExtractionError(
                f"Disk image not found: '{image_path}'. "
                "Ensure device.device_id is the absolute path to an existing image file.",
                context={
                    "device_id": device.device_id,
                    "platform": Platform.DISK_IMAGE.value,
                },
            )

        self._device = device
        self._image_path = image_path
        self._connected = True
        _logger.info(
            "DiskImageExtractor connected to image '%s'.",
            image_path,
        )

    def extract(
        self,
        session: ForensicSession,
        level: ExtractionLevel,
        profile: str = "all",
    ) -> Iterator[Artifact]:
        """Walk the disk image and yield one artefact per regular file.

        Raises :class:`~forensixd.core.exceptions.ExtractionError` when
        ``pytsk3`` is not installed or when :meth:`connect` has not been
        called.  Individual file errors are caught, logged, and skipped so
        that a single unreadable entry never aborts the entire extraction pass.

        Parameters
        ----------
        session:
            The active :class:`~forensixd.core.session.ForensicSession` that
            will receive acquired artefacts via
            :meth:`~forensixd.core.session.ForensicSession.register_artifact`.
        level:
            Extraction granularity.  All three levels are accepted; the
            underlying walk is identical regardless.

        Yields
        ------
        Artifact
            One artefact per regular file discovered inside the image.

        Raises
        ------
        ExtractionError
            If ``pytsk3`` is not installed or :meth:`connect` was not called.
        """
        if not TSK_AVAILABLE:
            raise ExtractionError(
                "pytsk3 is not installed; cannot extract from a disk image. "
                "Install it with: pip install pytsk3",
                context={"platform": Platform.DISK_IMAGE.value},
            )

        if not self._connected or self._device is None or self._image_path is None:
            raise ExtractionError(
                "connect() must be called before extract().",
                context={"platform": Platform.DISK_IMAGE.value},
            )

        yield from self._walk_image(session)

    def disconnect(self) -> None:
        """No-op disconnect — included for interface compliance.

        ``pytsk3`` image and file-system handles are opened and closed within
        :meth:`_walk_image` itself, so there are no persistent resources to
        release here.  The method is safe to call at any time and multiple
        times.
        """
        if self._connected:
            _logger.info(
                "DiskImageExtractor disconnecting from image '%s'.",
                self._image_path,
            )
        self._connected = False

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _walk_image(self, session: ForensicSession) -> Iterator[Artifact]:
        """Open the disk image with ``pytsk3`` and yield one artefact per file.

        Opens a :class:`pytsk3.Img_Info` handle for the image, then a
        :class:`pytsk3.FS_Info` handle for the primary file system.  Walks the
        root directory recursively.  For every regular file:

        1. Extracts its raw bytes via :meth:`pytsk3.File.read_random`.
        2. Writes them to a temporary file.
        3. Computes MD5 + SHA-256 via :class:`~forensixd.core.hasher.HashEngine`.
        4. Constructs an :class:`~forensixd.core.models.Artifact`.
        5. Registers it with *session*.
        6. Yields it to the caller.

        All ``pytsk3`` calls are wrapped in ``try/except``; errors on
        individual files are logged and skipped.  A top-level failure to open
        the image or file system propagates as an
        :class:`~forensixd.core.exceptions.ExtractionError`.

        Parameters
        ----------
        session:
            Active forensic session that receives each artefact.

        Yields
        ------
        Artifact
            One artefact per regular file inside the image.

        Raises
        ------
        ExtractionError
            If the image cannot be opened or no file system can be detected.
        """
        assert self._device is not None  # guaranteed by extract()
        assert self._image_path is not None  # guaranteed by extract()

        # Open the raw image.
        try:
            img: pytsk3.Img_Info = pytsk3.Img_Info(str(self._image_path))  # type: ignore[name-defined]
        except Exception as exc:
            raise ExtractionError(
                f"Failed to open disk image '{self._image_path}': {exc}",
                context={
                    "image_path": str(self._image_path),
                    "platform": Platform.DISK_IMAGE.value,
                },
            ) from exc

        # Detect and open the primary file system.
        try:
            fs: pytsk3.FS_Info = pytsk3.FS_Info(img)  # type: ignore[name-defined]
        except Exception as exc:
            raise ExtractionError(
                f"No supported file system found in '{self._image_path}': {exc}",
                context={
                    "image_path": str(self._image_path),
                    "platform": Platform.DISK_IMAGE.value,
                },
            ) from exc

        # Open the root directory.
        try:
            root_dir: pytsk3.Directory = fs.open_dir("/")  # type: ignore[name-defined]
        except Exception as exc:
            raise ExtractionError(
                f"Cannot open root directory in '{self._image_path}': {exc}",
                context={
                    "image_path": str(self._image_path),
                    "platform": Platform.DISK_IMAGE.value,
                },
            ) from exc

        yield from self._walk_dir(fs, root_dir, "/", session)

    def _walk_dir(
        self,
        fs: "pytsk3.FS_Info",  # type: ignore[name-defined]
        directory: "pytsk3.Directory",  # type: ignore[name-defined]
        path_prefix: str,
        session: ForensicSession,
    ) -> Iterator[Artifact]:
        """Recursively walk *directory* and yield artefacts for regular files.

        Skips the special ``.`` and ``..`` entries to prevent infinite
        recursion.  Sub-directories are descended into recursively.
        Individual entry errors are caught, logged, and skipped.

        Parameters
        ----------
        fs:
            Open :class:`pytsk3.FS_Info` handle for the image.
        directory:
            Current :class:`pytsk3.Directory` being iterated.
        path_prefix:
            Accumulated path string for the current directory (e.g.
            ``"/home/user"``).  Used to construct human-readable
            ``source_path`` values for each artefact.
        session:
            Active forensic session that receives each artefact.

        Yields
        ------
        Artifact
            One artefact per regular file discovered under *directory*.
        """
        try:
            for entry in directory:
                try:
                    # Skip entries with missing metadata.
                    if not entry.info or not entry.info.name or not entry.info.meta:
                        continue

                    name_bytes: bytes = entry.info.name.name
                    if not name_bytes:
                        continue

                    name: str = name_bytes.decode("utf-8", errors="replace")

                    # Skip navigation entries.
                    if name in (".", ".."):
                        continue

                    file_path_str = f"{path_prefix.rstrip('/')}/{name}"
                    meta_type = entry.info.meta.type

                    # Recurse into directories.
                    if meta_type == pytsk3.TSK_FS_META_TYPE_DIR:  # type: ignore[name-defined]
                        try:
                            sub_dir = fs.open_dir(file_path_str)
                            yield from self._walk_dir(
                                fs, sub_dir, file_path_str, session
                            )
                        except Exception as sub_exc:
                            _logger.debug(
                                "DiskImageExtractor: cannot open dir '%s' — %s",
                                file_path_str,
                                sub_exc,
                            )
                        continue

                    # Process regular files only.
                    if meta_type != pytsk3.TSK_FS_META_TYPE_REG:  # type: ignore[name-defined]
                        continue

                    artifact = self._extract_file_artifact(
                        entry, file_path_str, session
                    )
                    if artifact is not None:
                        yield artifact

                except Exception as entry_exc:  # noqa: BLE001
                    _logger.warning(
                        "DiskImageExtractor: skipping entry in '%s' — %s",
                        path_prefix,
                        entry_exc,
                        exc_info=True,
                    )

        except Exception as dir_exc:  # noqa: BLE001
            _logger.warning(
                "DiskImageExtractor: error iterating directory '%s' — %s",
                path_prefix,
                dir_exc,
                exc_info=True,
            )

    def _extract_file_artifact(
        self,
        entry: "pytsk3.File",  # type: ignore[name-defined]
        file_path_str: str,
        session: ForensicSession,
    ) -> Optional[Artifact]:
        """Extract *entry* to a temp file, hash it, and return an :class:`Artifact`.

        Returns ``None`` if any step fails; the error is logged at WARNING
        level so the overall walk continues uninterrupted.

        Parameters
        ----------
        entry:
            A :class:`pytsk3.File` handle for the regular file to extract.
        file_path_str:
            The file's path string inside the disk image (used as
            ``source_path`` on the resulting artefact).
        session:
            Active forensic session; the artefact is registered here if
            successfully created.

        Returns
        -------
        Artifact | None
            The constructed artefact, or ``None`` on any error.
        """
        assert self._device is not None  # guaranteed by _walk_image -> extract()

        try:
            file_size: int = entry.info.meta.size
        except Exception as exc:
            _logger.warning(
                "DiskImageExtractor: cannot read size for '%s' — %s",
                file_path_str,
                exc,
            )
            return None

        try:
            raw_data: bytes = entry.read_random(0, file_size) if file_size > 0 else b""
        except Exception as exc:
            _logger.warning(
                "DiskImageExtractor: cannot read data for '%s' — %s",
                file_path_str,
                exc,
                exc_info=True,
            )
            return None

        tmp_path: Optional[Path] = None
        try:
            with tempfile.NamedTemporaryFile(delete=False) as tmp:
                tmp.write(raw_data)
                tmp_path = Path(tmp.name)

            hashes = HashEngine.hash_file(tmp_path)
        except Exception as exc:
            _logger.warning(
                "DiskImageExtractor: hashing failed for '%s' — %s",
                file_path_str,
                exc,
                exc_info=True,
            )
            return None
        finally:
            if tmp_path is not None:
                try:
                    tmp_path.unlink(missing_ok=True)
                except Exception:  # noqa: BLE001
                    pass

        try:
            artifact_type: ArtifactType = _artifact_type_for_tsk_path(file_path_str)

            artifact = Artifact(
                artifact_type=artifact_type,
                source_app="disk_image",
                source_path=file_path_str,
                acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
                hashes=hashes,
                data={
                    "image_path": str(self._image_path),
                    "file_size_bytes": file_size,
                },
                device=self._device,
            )
            session.register_artifact(artifact)
            return artifact
        except Exception as exc:
            _logger.warning(
                "DiskImageExtractor: failed to build Artifact for '%s' — %s",
                file_path_str,
                exc,
                exc_info=True,
            )
            return None
