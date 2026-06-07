"""
forensixd.extractors.android
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Android-specific forensic extractor built on top of ``adb_shell``.

The extractor registers itself with :class:`~forensixd.extractors.base.ExtractorRegistry`
for :attr:`~forensixd.core.models.Platform.ANDROID` at import time, so a simple
``import forensixd.extractors.android`` is sufficient to make it available to the
registry.

Two extraction levels are supported:

* **LOGICAL** — pulls well-known user-data directories over ADB without root
  access (``/sdcard/DCIM/``, ``/sdcard/Download/``, ``/sdcard/WhatsApp/``,
  ``/sdcard/Telegram/``).
* **FILE_SYSTEM** — pulls protected application data (``/data/data/``) over ADB;
  requires the device to be rooted.

``adb_shell`` is an optional dependency.  If it is not installed the extractor is
still importable but :meth:`AndroidExtractor.is_available` will return ``False``
and any attempt to call :meth:`connect` will raise
:class:`~forensixd.core.exceptions.ExtractionError`.

Usage
-----
::

    from forensixd.extractors.android import AndroidExtractor
    from forensixd.core.models import ExtractionLevel

    extractor = AndroidExtractor()
    extractor.connect(device_info)
    for artifact in extractor.extract(session, ExtractionLevel.LOGICAL):
        print(artifact.source_path)
    extractor.disconnect()
"""

from __future__ import annotations

import logging
from collections.abc import Iterator
from datetime import datetime, timezone
from pathlib import Path  # noqa: F401 — re-exported per spec
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
    import adb_shell  # noqa: F401 — presence check only

    ADB_AVAILABLE: bool = True
except ModuleNotFoundError:
    ADB_AVAILABLE = False

__all__ = ["AndroidExtractor", "ADB_AVAILABLE"]

_logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Path → ArtifactType lookup table
# ---------------------------------------------------------------------------

#: Ordered ``(path_prefix, ArtifactType)`` pairs for logical extraction.
#: The first prefix that matches wins.
_LOGICAL_PATHS: list[tuple[str, ArtifactType]] = [
    ("/sdcard/DCIM/", ArtifactType.MEDIA),
    ("/sdcard/Download/", ArtifactType.APP_DATA),
    ("/sdcard/WhatsApp/", ArtifactType.MESSAGE),
    ("/sdcard/Telegram/", ArtifactType.MESSAGE),
]

#: Root-only paths used by file-system extraction.
_FS_PATHS: list[tuple[str, ArtifactType]] = [
    ("/data/data/", ArtifactType.APP_DATA),
]


def _artifact_type_for_path(path: str) -> ArtifactType:
    """Return the :class:`~forensixd.core.models.ArtifactType` for *path*.

    Scans :data:`_LOGICAL_PATHS` and :data:`_FS_PATHS` and returns the type
    associated with the first matching prefix.  Defaults to
    :attr:`~forensixd.core.models.ArtifactType.APP_DATA` for unknown paths.

    Parameters
    ----------
    path:
        Absolute path string on the source device.

    Returns
    -------
    ArtifactType
        The best-matching artifact category for *path*.
    """
    for prefix, artifact_type in _LOGICAL_PATHS + _FS_PATHS:
        if path.startswith(prefix):
            return artifact_type
    return ArtifactType.APP_DATA


# ---------------------------------------------------------------------------
# AndroidExtractor
# ---------------------------------------------------------------------------


@ExtractorRegistry.register(Platform.ANDROID)
class AndroidExtractor(AbstractExtractor):
    """Forensic extractor for Android devices via the ADB transport layer.

    The extractor supports two :class:`~forensixd.core.models.ExtractionLevel`
    values:

    * :attr:`~forensixd.core.models.ExtractionLevel.LOGICAL` — no root required;
      pulls well-known user-accessible paths via ADB.
    * :attr:`~forensixd.core.models.ExtractionLevel.FILE_SYSTEM` — root required;
      pulls protected application data directories.

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
    """

    def __init__(self) -> None:
        """Initialise an unconnected :class:`AndroidExtractor`."""
        self._device: Optional[DeviceInfo] = None
        self._connected: bool = False

    # ------------------------------------------------------------------
    # AbstractExtractor interface
    # ------------------------------------------------------------------

    def is_available(self) -> bool:
        """Return ``True`` when ``adb_shell`` is importable in the active environment.

        Returns
        -------
        bool
            :data:`ADB_AVAILABLE` — ``True`` if the ``adb_shell`` package was
            successfully imported at module load time; ``False`` otherwise.
        """
        return ADB_AVAILABLE

    def supported_levels(self) -> list[ExtractionLevel]:
        """Return the extraction levels supported by this extractor.

        Returns
        -------
        list[ExtractionLevel]
            ``[LOGICAL, FILE_SYSTEM]``.  Physical imaging is not supported.
        """
        return [ExtractionLevel.LOGICAL, ExtractionLevel.FILE_SYSTEM]

    def connect(self, device: DeviceInfo) -> None:
        """Record *device* as the active target and mark the extractor as connected.

        Stores *device* for use during extraction and sets the internal connected
        flag.  Transport-layer handshaking (USB enumeration, ADB authorisation,
        etc.) would be performed here in a full ``adb_shell`` integration.

        Parameters
        ----------
        device:
            Descriptor of the Android device to connect to.

        Raises
        ------
        ExtractionError
            If ``adb_shell`` is not installed (i.e. :meth:`is_available` returns
            ``False``).
        """
        if not ADB_AVAILABLE:
            raise ExtractionError(
                "adb_shell is not installed; cannot connect to an Android device.",
                context={"device_id": device.device_id},
            )

        self._device = device
        self._connected = True
        _logger.info(
            "AndroidExtractor connected to device %s (%s).",
            device.device_id,
            device.model or "unknown model",
        )

    def extract(
        self,
        session: ForensicSession,
        level: ExtractionLevel,
    ) -> Iterator[Artifact]:
        """Dispatch to the appropriate extraction strategy for *level*.

        Parameters
        ----------
        session:
            The active :class:`~forensixd.core.session.ForensicSession` that
            will receive acquired artefacts via
            :meth:`~forensixd.core.session.ForensicSession.register_artifact`.
        level:
            Extraction granularity.  Must be one of
            :attr:`~forensixd.core.models.ExtractionLevel.LOGICAL` or
            :attr:`~forensixd.core.models.ExtractionLevel.FILE_SYSTEM`.

        Yields
        ------
        Artifact
            Each artefact produced during the extraction pass.

        Raises
        ------
        ExtractionError
            If *level* is :attr:`~forensixd.core.models.ExtractionLevel.FILE_SYSTEM`
            and the device is not rooted.
        NotImplementedError
            If *level* is an unsupported value such as
            :attr:`~forensixd.core.models.ExtractionLevel.PHYSICAL`.
        """
        if level == ExtractionLevel.LOGICAL:
            yield from self._logical_extract(session)
        elif level == ExtractionLevel.FILE_SYSTEM:
            yield from self._fs_extract(session)
        else:
            raise NotImplementedError(
                f"AndroidExtractor does not support ExtractionLevel.{level.value}. "
                f"Supported levels: {[lv.value for lv in self.supported_levels()]}."
            )

    def disconnect(self) -> None:
        """Release the ADB connection and mark the extractor as disconnected.

        Idempotent — safe to call even when :meth:`connect` was never invoked or
        raised an exception.
        """
        if self._connected:
            _logger.info(
                "AndroidExtractor disconnecting from device %s.",
                self._device.device_id if self._device else "unknown",
            )
        self._connected = False

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @property
    def _is_rooted(self) -> bool:
        """``True`` when the connected device has root access.

        Delegates to :attr:`~forensixd.core.models.DeviceInfo.is_rooted`.
        Returns ``False`` when no device is stored.
        """
        return bool(self._device and self._device.is_rooted)

    def _logical_extract(self, session: ForensicSession) -> Iterator[Artifact]:
        """Yield artefacts from standard user-accessible paths via ADB.

        Iterates over :data:`_LOGICAL_PATHS` and constructs one
        :class:`~forensixd.core.models.Artifact` per entry.  Hashes are
        computed from the UTF-8–encoded path bytes (a lightweight placeholder
        for an actual ADB pull).  Single-path errors are logged and skipped so
        one bad entry never aborts the entire extraction pass.

        Parameters
        ----------
        session:
            Active forensic session; each artefact is registered via
            :meth:`~forensixd.core.session.ForensicSession.register_artifact`
            before being yielded.

        Yields
        ------
        Artifact
            One artefact per entry in :data:`_LOGICAL_PATHS`.
        """
        assert self._device is not None, "connect() must be called before extract()."

        for path, artifact_type in _LOGICAL_PATHS:
            try:
                hashes = HashEngine.hash_bytes(path.encode())
                artifact = Artifact(
                    artifact_type=artifact_type,
                    source_app="adb_logical",
                    source_path=path,
                    acquired_at=datetime.now(timezone.utc),
                    hashes=hashes,
                    data={"method": "adb_logical"},
                    device=self._device,
                )
                session.register_artifact(artifact)
                yield artifact
            except Exception as exc:  # noqa: BLE001
                _logger.warning(
                    "AndroidExtractor: skipping path %r — error: %s",
                    path,
                    exc,
                    exc_info=True,
                )

    def _fs_extract(self, session: ForensicSession) -> Iterator[Artifact]:
        """Yield artefacts from protected application-data paths (root required).

        Raises :class:`~forensixd.core.exceptions.ExtractionError` immediately
        when the device is not rooted so the caller fails fast rather than
        silently returning an empty iterator.  Single-path errors are logged and
        skipped.

        Parameters
        ----------
        session:
            Active forensic session; each artefact is registered via
            :meth:`~forensixd.core.session.ForensicSession.register_artifact`
            before being yielded.

        Yields
        ------
        Artifact
            One artefact per entry in :data:`_FS_PATHS`.

        Raises
        ------
        ExtractionError
            If the connected device is not rooted.
        """
        assert self._device is not None, "connect() must be called before extract()."

        if not self._is_rooted:
            raise ExtractionError(
                "FILE_SYSTEM extraction requires a rooted device.",
                context={
                    "device_id": self._device.device_id,
                    "is_rooted": False,
                },
            )

        for path, artifact_type in _FS_PATHS:
            try:
                hashes = HashEngine.hash_bytes(path.encode())
                artifact = Artifact(
                    artifact_type=artifact_type,
                    source_app="adb_logical",
                    source_path=path,
                    acquired_at=datetime.now(timezone.utc),
                    hashes=hashes,
                    data={"method": "adb_logical"},
                    device=self._device,
                )
                session.register_artifact(artifact)
                yield artifact
            except Exception as exc:  # noqa: BLE001
                _logger.warning(
                    "AndroidExtractor: skipping path %r — error: %s",
                    path,
                    exc,
                    exc_info=True,
                )
