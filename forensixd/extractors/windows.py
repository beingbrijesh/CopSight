"""
forensixd.extractors.windows
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Windows live-system forensic extractor.

The extractor registers itself with :class:`~forensixd.extractors.base.ExtractorRegistry`
for :attr:`~forensixd.core.models.Platform.WINDOWS` at import time, so a simple
``import forensixd.extractors.windows`` is sufficient to make it available to the
registry.

Only :attr:`~forensixd.core.models.ExtractionLevel.LOGICAL` extraction is
supported — the extractor operates against the *live* Windows file system (no
physical imaging or offline-hive mounting).  No device transport layer is
required; ``connect`` merely stores the :class:`~forensixd.core.models.DeviceInfo`
descriptor for later use in :class:`~forensixd.core.models.Artifact` construction.

Four forensic artefact categories are collected:

* **Registry hives** — ``SAM``, ``SYSTEM``, ``SOFTWARE``, and per-user
  ``NTUSER.DAT`` files.
* **Event logs** — all ``*.evtx`` files under
  ``C:/Windows/System32/winevt/Logs/``.
* **Prefetch files** — all ``*.pf`` files under ``C:/Windows/Prefetch/``.
* **Browser databases** — Chrome, Firefox, and Edge history / places databases
  for every user profile found under ``C:/Users/``.

``PermissionError`` and missing paths are silently skipped so that a partial
acquisition never aborts the entire session.

Usage
-----
::

    from forensixd.extractors.windows import WindowsExtractor
    from forensixd.core.models import ExtractionLevel

    extractor = WindowsExtractor()
    extractor.connect(device_info)
    for artifact in extractor.extract(session, ExtractionLevel.LOGICAL):
        print(artifact.source_path)
    extractor.disconnect()
"""

from __future__ import annotations

import logging
import platform as sys_platform
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

__all__ = ["WindowsExtractor"]

_logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Well-known paths
# ---------------------------------------------------------------------------

#: Registry hive files that exist at fixed, platform-wide locations.
_REGISTRY_HIVES: list[Path] = [
    Path("C:/Windows/System32/config/SAM"),
    Path("C:/Windows/System32/config/SYSTEM"),
    Path("C:/Windows/System32/config/SOFTWARE"),
]

#: Parent directory for per-user registry hives (``NTUSER.DAT``).
_USERS_ROOT: Path = Path("C:/Users")

#: Browser database glob patterns rooted at ``C:/Users``.
_BROWSER_GLOBS: list[tuple[str, str]] = [
    (
        "*/AppData/Local/Google/Chrome/User Data/Default/History",
        "chrome",
    ),
    (
        "*/AppData/Roaming/Mozilla/Firefox/Profiles/*/places.db",
        "firefox",
    ),
    (
        "*/AppData/Local/Microsoft/Edge/User Data/Default/History",
        "edge",
    ),
]


# ---------------------------------------------------------------------------
# WindowsExtractor
# ---------------------------------------------------------------------------


@ExtractorRegistry.register(Platform.WINDOWS)
class WindowsExtractor(AbstractExtractor):
    """Forensic extractor for live Windows systems.

    Operates directly against the local file system — no device transport
    layer is required.  The extractor is only :meth:`is_available` when
    executed on a Windows host.

    Only :attr:`~forensixd.core.models.ExtractionLevel.LOGICAL` extraction
    is supported.  Calling :meth:`extract` with any other level raises
    :class:`NotImplementedError`.

    Four artefact categories are collected during :meth:`extract`:

    1. Registry hives (``SAM``, ``SYSTEM``, ``SOFTWARE``, ``NTUSER.DAT``).
    2. Windows Event Log files (``*.evtx``).
    3. Prefetch files (``*.pf``).
    4. Browser history databases (Chrome, Firefox, Edge).

    ``PermissionError`` on any individual file is silently skipped so that
    restricted system hives do not abort the entire session.

    Attributes
    ----------
    _device:
        The :class:`~forensixd.core.models.DeviceInfo` supplied to the most
        recent successful :meth:`connect` call, or ``None`` when disconnected.
    """

    def __init__(self) -> None:
        """Initialise an unconnected :class:`WindowsExtractor`."""
        self._device: Optional[DeviceInfo] = None

    # ------------------------------------------------------------------
    # AbstractExtractor interface
    # ------------------------------------------------------------------

    def is_available(self) -> bool:
        """Return ``True`` when running on a live Windows host.

        Returns
        -------
        bool
            ``True`` if :func:`platform.system` reports ``'Windows'``;
            ``False`` on all other operating systems.
        """
        return sys_platform.system() == "Windows"

    def supported_levels(self) -> list[ExtractionLevel]:
        """Return the extraction levels supported by this extractor.

        Returns
        -------
        list[ExtractionLevel]
            ``[LOGICAL]``.  Physical imaging and raw file-system access are
            not supported by this extractor.
        """
        return [ExtractionLevel.LOGICAL]

    def connect(self, device: DeviceInfo) -> None:
        """Store *device* as the acquisition target.

        No transport-layer handshaking is required for a live Windows
        acquisition — the extractor reads directly from the local file
        system.  This method simply records the device descriptor for use
        when constructing :class:`~forensixd.core.models.Artifact` objects.

        Parameters
        ----------
        device:
            Descriptor of the Windows device being examined.
        """
        self._device = device
        _logger.info(
            "WindowsExtractor connected to device %s (%s).",
            device.device_id,
            device.model or "unknown model",
        )

    def extract(
        self,
        session: ForensicSession,
        level: ExtractionLevel,
    ) -> Iterator[Artifact]:
        """Dispatch extraction for *level* and yield all collected artefacts.

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
            Registry hives, event log files, prefetch files, and browser
            databases found on the local file system.

        Raises
        ------
        ExtractionError
            If :meth:`connect` was not called before :meth:`extract`.
        NotImplementedError
            If *level* is not
            :attr:`~forensixd.core.models.ExtractionLevel.LOGICAL`.
        """
        if self._device is None:
            raise ExtractionError(
                "connect() must be called before extract().",
                context={"platform": Platform.WINDOWS.value},
            )

        if level != ExtractionLevel.LOGICAL:
            raise NotImplementedError(
                f"WindowsExtractor does not support ExtractionLevel.{level.value}. "
                f"Supported levels: {[lv.value for lv in self.supported_levels()]}."
            )

        yield from self._extract_registry(session)
        yield from self._extract_event_logs(session)
        yield from self._extract_prefetch(session)
        yield from self._extract_browser_dbs(session)

    def disconnect(self) -> None:
        """Release the device reference.

        Idempotent — safe to call even when :meth:`connect` was never
        invoked or raised an exception.
        """
        if self._device is not None:
            _logger.info(
                "WindowsExtractor disconnecting from device %s.",
                self._device.device_id,
            )
        self._device = None

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _make_artifact(
        self,
        path: Path,
        artifact_type: ArtifactType,
        source_app: str,
        extra_data: Optional[dict] = None,
    ) -> Artifact:
        """Hash *path* and construct an :class:`~forensixd.core.models.Artifact`.

        Parameters
        ----------
        path:
            Absolute path to the file on the live file system.
        artifact_type:
            Forensic category for the constructed artefact.
        source_app:
            Label describing the subsystem or application that owns the file.
        extra_data:
            Optional additional key-value pairs to merge into the artefact's
            ``data`` payload.

        Returns
        -------
        Artifact
            A fully populated artefact with computed hashes.
        """
        assert self._device is not None  # guaranteed by callers

        hashes = HashEngine.hash_file(path)
        data: dict = {"source_path": str(path)}
        if extra_data:
            data.update(extra_data)

        return Artifact(
            artifact_type=artifact_type,
            source_app=source_app,
            source_path=str(path),
            acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
            hashes=hashes,
            data=data,
            device=self._device,
        )

    def _extract_registry(self, session: ForensicSession) -> Iterator[Artifact]:
        """Yield artefacts for Windows registry hive files.

        Collects ``SAM``, ``SYSTEM``, and ``SOFTWARE`` hives from
        ``C:/Windows/System32/config/`` plus any ``NTUSER.DAT`` files found
        under ``C:/Users/``.

        ``PermissionError`` on any individual hive is silently skipped.
        Non-existent paths are ignored.

        Parameters
        ----------
        session:
            Active forensic session; each artefact is registered before
            being yielded.

        Yields
        ------
        Artifact
            One artefact per accessible registry hive file.
        """
        # System-wide hives at fixed locations.
        candidates: list[Path] = list(_REGISTRY_HIVES)

        # Per-user hives — only enumerate if the Users directory exists.
        if _USERS_ROOT.exists():
            try:
                candidates.extend(_USERS_ROOT.glob("*/NTUSER.DAT"))
            except PermissionError:
                _logger.debug(
                    "WindowsExtractor: PermissionError while globbing NTUSER.DAT — skipping."
                )

        for hive_path in candidates:
            if not hive_path.exists():
                continue
            try:
                artifact = self._make_artifact(
                    path=hive_path,
                    artifact_type=ArtifactType.REGISTRY_KEY,
                    source_app="windows_registry",
                    extra_data={"hive": hive_path.name},
                )
                session.register_artifact(artifact)
                yield artifact
            except PermissionError:
                _logger.debug(
                    "WindowsExtractor: PermissionError reading registry hive %s — skipping.",
                    hive_path,
                )
            except Exception as exc:  # noqa: BLE001
                _logger.warning(
                    "WindowsExtractor: unexpected error reading %s — %s",
                    hive_path,
                    exc,
                    exc_info=True,
                )

    def _extract_event_logs(self, session: ForensicSession) -> Iterator[Artifact]:
        """Yield artefacts for Windows Event Log (``*.evtx``) files.

        Globs ``C:/Windows/System32/winevt/Logs/*.evtx``.  Missing
        directory or ``PermissionError`` on any file is silently skipped.

        Parameters
        ----------
        session:
            Active forensic session; each artefact is registered before
            being yielded.

        Yields
        ------
        Artifact
            One artefact per accessible ``*.evtx`` file.
        """
        evtx_dir = Path("C:/Windows/System32/winevt/Logs")
        if not evtx_dir.exists():
            return

        try:
            evtx_files = list(evtx_dir.glob("*.evtx"))
        except PermissionError:
            _logger.debug(
                "WindowsExtractor: PermissionError listing event log directory — skipping."
            )
            return

        for evtx_path in evtx_files:
            try:
                artifact = self._make_artifact(
                    path=evtx_path,
                    artifact_type=ArtifactType.SYSTEM_LOG,
                    source_app="windows_event_log",
                    extra_data={"log_name": evtx_path.stem},
                )
                session.register_artifact(artifact)
                yield artifact
            except PermissionError:
                _logger.debug(
                    "WindowsExtractor: PermissionError reading event log %s — skipping.",
                    evtx_path,
                )
            except Exception as exc:  # noqa: BLE001
                _logger.warning(
                    "WindowsExtractor: unexpected error reading %s — %s",
                    evtx_path,
                    exc,
                    exc_info=True,
                )

    def _extract_prefetch(self, session: ForensicSession) -> Iterator[Artifact]:
        """Yield artefacts for Windows Prefetch (``*.pf``) files.

        Globs ``C:/Windows/Prefetch/*.pf``.  Missing directory or
        ``PermissionError`` on any file is silently skipped.

        Parameters
        ----------
        session:
            Active forensic session; each artefact is registered before
            being yielded.

        Yields
        ------
        Artifact
            One artefact per accessible ``*.pf`` file.
        """
        prefetch_dir = Path("C:/Windows/Prefetch")
        if not prefetch_dir.exists():
            return

        try:
            pf_files = list(prefetch_dir.glob("*.pf"))
        except PermissionError:
            _logger.debug(
                "WindowsExtractor: PermissionError listing prefetch directory — skipping."
            )
            return

        for pf_path in pf_files:
            try:
                artifact = self._make_artifact(
                    path=pf_path,
                    artifact_type=ArtifactType.APP_DATA,
                    source_app="windows_prefetch",
                    extra_data={"executable": pf_path.stem},
                )
                session.register_artifact(artifact)
                yield artifact
            except PermissionError:
                _logger.debug(
                    "WindowsExtractor: PermissionError reading prefetch file %s — skipping.",
                    pf_path,
                )
            except Exception as exc:  # noqa: BLE001
                _logger.warning(
                    "WindowsExtractor: unexpected error reading %s — %s",
                    pf_path,
                    exc,
                    exc_info=True,
                )

    def _extract_browser_dbs(self, session: ForensicSession) -> Iterator[Artifact]:
        """Yield artefacts for browser history / places databases.

        Searches ``C:/Users/`` for Chrome, Firefox, and Edge databases using
        the following glob patterns:

        * ``*/AppData/Local/Google/Chrome/User Data/Default/History``
        * ``*/AppData/Roaming/Mozilla/Firefox/Profiles/*/places.db``
        * ``*/AppData/Local/Microsoft/Edge/User Data/Default/History``

        Missing paths and ``PermissionError`` on any individual file are
        silently skipped.

        Parameters
        ----------
        session:
            Active forensic session; each artefact is registered before
            being yielded.

        Yields
        ------
        Artifact
            One artefact per accessible browser database file.
        """
        if not _USERS_ROOT.exists():
            return

        for glob_pattern, browser_name in _BROWSER_GLOBS:
            try:
                matched_paths = list(_USERS_ROOT.glob(glob_pattern))
            except PermissionError:
                _logger.debug(
                    "WindowsExtractor: PermissionError while globbing %s paths — skipping.",
                    browser_name,
                )
                continue

            for db_path in matched_paths:
                try:
                    artifact = self._make_artifact(
                        path=db_path,
                        artifact_type=ArtifactType.BROWSER_HISTORY,
                        source_app=f"browser_{browser_name}",
                        extra_data={
                            "browser": browser_name,
                            "db_file": db_path.name,
                        },
                    )
                    session.register_artifact(artifact)
                    yield artifact
                except PermissionError:
                    _logger.debug(
                        "WindowsExtractor: PermissionError reading %s database %s — skipping.",
                        browser_name,
                        db_path,
                    )
                except Exception as exc:  # noqa: BLE001
                    _logger.warning(
                        "WindowsExtractor: unexpected error reading %s — %s",
                        db_path,
                        exc,
                        exc_info=True,
                    )
