"""
forensixd.extractors.ios
~~~~~~~~~~~~~~~~~~~~~~~~

iOS forensic extractor built on top of ``pymobiledevice3``.

The extractor registers itself with :class:`~forensixd.extractors.base.ExtractorRegistry`
for :attr:`~forensixd.core.models.Platform.IOS` at import time, so a simple
``import forensixd.extractors.ios`` is sufficient to make it available to the
registry.

Only :attr:`~forensixd.core.models.ExtractionLevel.LOGICAL` extraction is
supported.  In a full integration this would be powered by
``pymobiledevice3``'s ``MobileBackup2Service``; the current implementation
walks a backup directory already present on the host, mapping well-known path
components to their forensic categories:

* Paths containing ``DCIM``        → :attr:`~forensixd.core.models.ArtifactType.MEDIA`
* Paths containing ``SMS``         → :attr:`~forensixd.core.models.ArtifactType.MESSAGE`
* Paths containing ``CallHistory`` → :attr:`~forensixd.core.models.ArtifactType.CALL_LOG`
* Everything else                  → :attr:`~forensixd.core.models.ArtifactType.APP_DATA`

``pymobiledevice3`` is an optional dependency.  If it is not installed the
extractor is still importable but :meth:`IosExtractor.is_available` will
return ``False`` and any attempt to call :meth:`connect` will raise
:class:`~forensixd.core.exceptions.ExtractionError` with an install hint.

Usage
-----
::

    from forensixd.extractors.ios import IosExtractor
    from forensixd.core.models import ExtractionLevel
    from pathlib import Path

    extractor = IosExtractor()
    extractor.connect(device_info, backup_dir=Path("/path/to/backup"))
    for artifact in extractor.extract(session, ExtractionLevel.LOGICAL):
        print(artifact.source_path)
    extractor.disconnect()
"""

from __future__ import annotations

import logging
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
    import pymobiledevice3  # noqa: F401 — presence check only

    PYMOBILE_AVAILABLE: bool = True
except ModuleNotFoundError:
    PYMOBILE_AVAILABLE = False

__all__ = ["IosExtractor", "PYMOBILE_AVAILABLE"]

_logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Path-segment → ArtifactType mapping
# ---------------------------------------------------------------------------

#: Ordered ``(path_segment, ArtifactType)`` pairs used to categorise files
#: by inspecting the string representation of their path.
#: The first matching segment wins; unmatched files default to ``APP_DATA``.
_SEGMENT_TYPE_MAP: list[tuple[str, ArtifactType]] = [
    ("DCIM", ArtifactType.MEDIA),
    ("SMS", ArtifactType.MESSAGE),
    ("CallHistory", ArtifactType.CALL_LOG),
]


def _artifact_type_for_path(path: Path) -> ArtifactType:
    """Return the :class:`~forensixd.core.models.ArtifactType` for *path*.

    Checks the string representation of *path* against each segment in
    :data:`_SEGMENT_TYPE_MAP` in order and returns the category associated
    with the first match.  Defaults to
    :attr:`~forensixd.core.models.ArtifactType.APP_DATA` when no segment
    matches.

    Parameters
    ----------
    path:
        Filesystem path of the file being categorised.

    Returns
    -------
    ArtifactType
        The best-matching forensic category for *path*.
    """
    path_str = str(path)
    for segment, artifact_type in _SEGMENT_TYPE_MAP:
        if segment in path_str:
            return artifact_type
    return ArtifactType.APP_DATA


# ---------------------------------------------------------------------------
# IosExtractor
# ---------------------------------------------------------------------------


@ExtractorRegistry.register(Platform.IOS)
class IosExtractor(AbstractExtractor):
    """Forensic extractor for iOS devices via ``pymobiledevice3``.

    Only :attr:`~forensixd.core.models.ExtractionLevel.LOGICAL` extraction is
    supported.  In a production environment, :meth:`_backup_extract` would
    invoke ``pymobiledevice3``'s ``MobileBackup2Service`` to pull a fresh
    device backup; for now it walks an existing backup directory supplied via
    the ``backup_dir`` keyword argument to :meth:`connect`.

    Call :meth:`connect` before :meth:`extract`, and always call
    :meth:`disconnect` afterwards (ideally inside a ``finally`` block).

    Attributes
    ----------
    _device:
        The :class:`~forensixd.core.models.DeviceInfo` supplied to the most
        recent successful :meth:`connect` call, or ``None`` when disconnected.
    _connected:
        ``True`` between a successful :meth:`connect` and the subsequent
        :meth:`disconnect`.
    _backup_dir:
        Optional root directory of the iOS backup to walk during extraction.
        When ``None``, :meth:`_backup_extract` yields nothing and logs a
        warning.
    """

    def __init__(self) -> None:
        """Initialise an unconnected :class:`IosExtractor`."""
        self._device: Optional[DeviceInfo] = None
        self._connected: bool = False
        self._backup_dir: Optional[Path] = None

    # ------------------------------------------------------------------
    # AbstractExtractor interface
    # ------------------------------------------------------------------

    def is_available(self) -> bool:
        """Return ``True`` when ``pymobiledevice3`` is importable.

        Returns
        -------
        bool
            :data:`PYMOBILE_AVAILABLE` — ``True`` if ``pymobiledevice3`` was
            successfully imported at module load time; ``False`` otherwise.
        """
        return PYMOBILE_AVAILABLE

    def supported_levels(self) -> list[ExtractionLevel]:
        """Return the extraction levels supported by this extractor.

        Returns
        -------
        list[ExtractionLevel]
            ``[LOGICAL]``.  Physical imaging and raw file-system access are
            not supported by this extractor.
        """
        return [ExtractionLevel.LOGICAL]

    def connect(self, device: DeviceInfo, *, backup_dir: Optional[Path] = None) -> None:
        """Record *device* as the active target and mark the extractor as connected.

        Raises :class:`~forensixd.core.exceptions.ExtractionError` immediately
        when ``pymobiledevice3`` is not installed so that callers receive a
        clear, actionable error message rather than a ``ModuleNotFoundError``
        deep inside the extraction stack.

        In a full integration this method would also establish a USB/Wi-Fi
        connection to the device using ``pymobiledevice3``'s lockdown client
        before triggering a ``MobileBackup2Service`` backup.

        Parameters
        ----------
        device:
            Descriptor of the iOS device to connect to.
        backup_dir:
            Optional path to a local iOS backup directory to walk during
            :meth:`extract`.  When omitted, extraction yields nothing and a
            warning is emitted (pending live ``MobileBackup2Service``
            integration).

        Raises
        ------
        ExtractionError
            If ``pymobiledevice3`` is not installed.
        """
        if not PYMOBILE_AVAILABLE:
            raise ExtractionError(
                "pymobiledevice3 is not installed; cannot connect to an iOS device. "
                "Install it with: pip install pymobiledevice3",
                context={"device_id": device.device_id, "platform": Platform.IOS.value},
            )

        self._device = device
        self._backup_dir = backup_dir
        self._connected = True
        _logger.info(
            "IosExtractor connected to device %s (%s).",
            device.device_id,
            device.model or "unknown model",
        )

    def extract(
        self,
        session: ForensicSession,
        level: ExtractionLevel,
    ) -> Iterator[Artifact]:
        """Dispatch extraction for *level* and yield all collected artefacts.

        Only :attr:`~forensixd.core.models.ExtractionLevel.LOGICAL` is
        accepted.  Any other *level* raises
        :class:`~forensixd.core.exceptions.ExtractionError`.

        Parameters
        ----------
        session:
            The active :class:`~forensixd.core.session.ForensicSession` that
            will receive acquired artefacts via
            :meth:`~forensixd.core.session.ForensicSession.register_artifact`.
        level:
            Extraction granularity.  Must be
            :attr:`~forensixd.core.models.ExtractionLevel.LOGICAL`.

        Yields
        ------
        Artifact
            Media, message, call-log, and generic app-data files discovered
            inside the backup directory.

        Raises
        ------
        ExtractionError
            If :meth:`connect` was not called before :meth:`extract`, or if
            *level* is not :attr:`~forensixd.core.models.ExtractionLevel.LOGICAL`.
        """
        if not self._connected or self._device is None:
            raise ExtractionError(
                "connect() must be called before extract().",
                context={"platform": Platform.IOS.value},
            )

        if level != ExtractionLevel.LOGICAL:
            raise ExtractionError(
                f"IosExtractor does not support ExtractionLevel.{level.value}. "
                f"Supported levels: {[lv.value for lv in self.supported_levels()]}.",
                context={
                    "requested_level": level.value,
                    "supported_levels": [lv.value for lv in self.supported_levels()],
                },
            )

        yield from self._backup_extract(session)

    def disconnect(self) -> None:
        """Release the device reference and mark the extractor as disconnected.

        Idempotent — safe to call even when :meth:`connect` was never invoked
        or raised an exception.
        """
        if self._connected:
            _logger.info(
                "IosExtractor disconnecting from device %s.",
                self._device.device_id if self._device else "unknown",
            )
        self._connected = False

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _backup_extract(self, session: ForensicSession) -> Iterator[Artifact]:
        """Walk the backup directory and yield one artefact per regular file.

        Each file's path is inspected for well-known iOS path segments to
        determine the appropriate :class:`~forensixd.core.models.ArtifactType`
        (see :func:`_artifact_type_for_path`).  The file is then hashed with
        :class:`~forensixd.core.hasher.HashEngine`, wrapped in an
        :class:`~forensixd.core.models.Artifact`, registered with *session*,
        and yielded.  Single-file errors are logged and skipped so one corrupt
        or unreadable entry never aborts the entire extraction pass.

        .. todo::
            Replace the local directory walk with a live
            ``pymobiledevice3.services.mobilebackup2.MobileBackup2Service``
            call to stream a fresh backup from the connected device::

                from pymobiledevice3.lockdown import LockdownClient
                from pymobiledevice3.services.mobilebackup2 import MobileBackup2Service

                lockdown = LockdownClient(udid=self._device.device_id)
                with MobileBackup2Service(lockdown) as backup:
                    backup.backup(full=True, backup_directory=self._backup_dir)

        Parameters
        ----------
        session:
            Active forensic session; each artefact is registered via
            :meth:`~forensixd.core.session.ForensicSession.register_artifact`
            before being yielded.

        Yields
        ------
        Artifact
            One artefact per regular file found inside :attr:`_backup_dir`.
        """
        assert self._device is not None  # guaranteed by extract()

        if self._backup_dir is None:
            _logger.warning(
                "IosExtractor: no backup_dir supplied; skipping backup extraction. "
                "Pass backup_dir=<path> to connect() or integrate MobileBackup2Service.",
            )
            return

        if not self._backup_dir.is_dir():
            _logger.warning(
                "IosExtractor: backup_dir %s does not exist or is not a directory — skipping.",
                self._backup_dir,
            )
            return

        for file_path in self._backup_dir.rglob("*"):
            if not file_path.is_file():
                continue

            try:
                artifact_type: ArtifactType = _artifact_type_for_path(file_path)
                hashes = HashEngine.hash_file(file_path)

                artifact = Artifact(
                    artifact_type=artifact_type,
                    source_app="ios_backup",
                    source_path=str(file_path),
                    acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
                    hashes=hashes,
                    data={
                        "backup_dir": str(self._backup_dir),
                        "relative_path": str(file_path.relative_to(self._backup_dir)),
                    },
                    device=self._device,
                )
                session.register_artifact(artifact)
                yield artifact

            except Exception as exc:  # noqa: BLE001
                _logger.warning(
                    "IosExtractor: skipping file %s — error: %s",
                    file_path,
                    exc,
                    exc_info=True,
                )
