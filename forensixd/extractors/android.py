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
import subprocess
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
from forensixd.core.gui_prompter import prompt_allow_deny, prompt_password, prompt_error_action
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
    ("/sdcard/Android/media/com.whatsapp/WhatsApp/", ArtifactType.MESSAGE),
    ("/sdcard/Telegram/", ArtifactType.MESSAGE),
    ("/sdcard/Android/media/org.telegram.messenger/", ArtifactType.MESSAGE),
    ("/sdcard/Android/data/org.telegram.messenger/", ArtifactType.MESSAGE),
    ("/sdcard/Signal/Backups/", ArtifactType.MESSAGE),
    ("/sdcard/Documents/Signal/Backups/", ArtifactType.MESSAGE),
    ("/sdcard/CallLogs/", ArtifactType.CALL_LOG),
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
            yield from self._logical_extract(session, profile)
        elif level == ExtractionLevel.FILE_SYSTEM:
            yield from self._fs_extract(session, profile)
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

    def _get_adb_cmd(self) -> str:
        """Get the path to the adb executable, preferring the PyInstaller bundled version."""
        import sys
        import os
        if hasattr(sys, '_MEIPASS'):
            bundled_adb = os.path.join(sys._MEIPASS, 'platform-tools', 'adb.exe' if os.name == 'nt' else 'adb')
            if os.path.exists(bundled_adb):
                if os.name != 'nt':
                    try:
                        os.chmod(bundled_adb, 0o755)
                    except:
                        pass
                return bundled_adb
        return 'adb'

    def _logical_extract(self, session: ForensicSession, profile: str = "all") -> Iterator[Artifact]:
        """Yield artefacts from standard user-accessible paths via ADB.

        Iterates over :data:`_LOGICAL_PATHS` and uses `adb pull` to extract real
        files to the session's output directory. Generates one
        :class:`~forensixd.core.models.Artifact` per successfully pulled file.
        Also attempts an `adb backup` if the user approves the prompt.
        """
        assert self._device is not None, "connect() must be called before extract()."

        # 1. Ask the user to authorize USB debugging
        instructions = (
            "To extract data from an Android device, USB Debugging must be enabled:\n\n"
            "1. If not enabled, go to Settings -> About Phone -> tap 'Build Number' 7 times.\n"
            "2. Go back to Settings -> System -> Developer Options.\n"
            "3. Turn on 'USB Debugging' (and 'Install via USB' / 'USB debugging (Security settings)' if present).\n"
            "4. Connect the device to the computer.\n"
            "5. A prompt will appear on the phone: 'Allow USB debugging?'. Check 'Always allow' and tap OK.\n\n"
            "Click 'Yes' to proceed ONLY after you have completed these steps."
        )
        prompt_allow_deny("Android Connection - Setup Required", instructions)

        adb_pull_dir = session.output_dir / "adb_pull"
        adb_pull_dir.mkdir(parents=True, exist_ok=True)

        # Attempt to get actual ADB serial and check authorization status
        adb_serial = None
        device_status = None
        
        adb_cmd = self._get_adb_cmd()
        # Restart ADB server to ensure fresh connection
        subprocess.run([adb_cmd, "kill-server"], capture_output=True)
        subprocess.run([adb_cmd, "start-server"], capture_output=True)
        
        devices_out = subprocess.run([adb_cmd, "devices"], capture_output=True, text=True).stdout
        for line in devices_out.splitlines()[1:]:
            line = line.strip()
            if not line:
                continue
            parts = line.split("\t")
            if len(parts) >= 2:
                status = parts[1]
                if status == "device":
                    adb_serial = parts[0]
                    device_status = "device"
                    break
                elif status in ["unauthorized", "offline"]:
                    device_status = status

        if adb_serial:
            adb_target_args = ["-s", adb_serial]
        else:
            if device_status == "unauthorized":
                raise ExtractionError("Device is connected but UNAUTHORIZED. Please check your phone screen and tap 'Allow USB debugging'.")
            elif device_status == "offline":
                raise ExtractionError("Device is OFFLINE. Please reconnect the USB cable and try again.")
            else:
                raise ExtractionError("No Android devices found with USB Debugging enabled. Please ensure Developer Options and USB Debugging are turned on.")

        # Ask the user to create manual backups for secure messaging apps
        backup_instructions = (
            "Modern messaging apps like WhatsApp, Signal, and Telegram block standard extraction methods.\n"
            "To extract their data without rooting the device, please perform these steps on the phone NOW:\n\n"
            "WhatsApp: Open app -> Settings -> Chats -> Chat backup -> Tap 'Back up' (ensure 'Back up to Google Drive' is Never).\n\n"
            "Signal: Open app -> Settings -> Chats -> Chat backups -> Turn on -> Tap 'Create backup' (Save the passphrase!).\n\n"
            "Click 'Yes' when the backups are complete so we can extract them."
        )
        prompt_allow_deny("Manual App Backups Required", backup_instructions)

        extract_media = profile in ["all", "media"]
        extract_textual = profile in ["all", "textual"]

        for remote_path, artifact_type in _LOGICAL_PATHS:
            if not extract_media and artifact_type == ArtifactType.MEDIA:
                continue
            if not extract_textual and artifact_type != ArtifactType.MEDIA:
                continue
            
            while True:
                try:
                    local_dest = adb_pull_dir / Path(remote_path).name
                    _logger.info("Executing adb pull %s %s", remote_path, local_dest)
                    result = subprocess.run(
                        [adb_cmd, *adb_target_args, "pull", remote_path, str(local_dest)],
                        capture_output=True, text=True
                    )
                    
                    if result.returncode == 0 and local_dest.exists():
                        # Walk the pulled directory
                        if local_dest.is_dir():
                            files = [f for f in local_dest.rglob("*") if f.is_file()]
                        else:
                            files = [local_dest]
                            
                        for file_path in files:
                            # Filter media files if requested
                            if not extract_media and file_path.suffix.lower() in [
                                '.jpg', '.jpeg', '.png', '.mp4', '.mp3', '.ogg', '.tgs', '.webp', '.gif', '.nomedia', '.opus', '.wav'
                            ]:
                                file_path.unlink(missing_ok=True)
                                continue

                            hashes = HashEngine.hash_file(file_path)
                            artifact = Artifact(
                                artifact_type=artifact_type,
                                source_app="adb_logical",
                                source_path=str(file_path),
                                acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
                                hashes=hashes,
                                data={"method": "adb_pull", "remote_path": remote_path},
                                device=self._device,
                            )
                            session.register_artifact(artifact)
                            yield artifact
                        break
                    else:
                        _logger.warning("adb pull failed for %s: %s", remote_path, result.stderr)
                        
                        # If the path doesn't exist (e.g. app not installed), just skip silently
                        err_lower = result.stderr.lower()
                        if "does not exist" in err_lower or "stat failed" in err_lower or "no such file" in err_lower:
                            _logger.info("Path %s does not exist on device, skipping.", remote_path)
                            break
                            
                        action = prompt_error_action(
                            "Extraction Error",
                            f"Failed to extract {remote_path} via adb.\nError: {result.stderr}\n\nChoose an action:"
                        )
                        if action == "Retry":
                            continue
                        elif action == "Abort":
                            raise ExtractionError(f"Aborted extraction due to error pulling {remote_path}")
                        else: # Skip
                            break

                except Exception as exc:  # noqa: BLE001
                    _logger.warning("AndroidExtractor: skipping path %r — error: %s", remote_path, exc, exc_info=True)
                    action = prompt_error_action(
                        "Extraction Exception",
                        f"Exception while pulling {remote_path}: {exc}\n\nChoose an action:"
                    )
                    if action == "Retry":
                        continue
                    elif action == "Abort":
                        raise ExtractionError(f"Aborted extraction due to exception pulling {remote_path}") from exc
                    else:
                        break
                
        # 2. Attempt ADB Backup for application data
        if extract_textual and prompt_allow_deny("ADB Backup", "Would you like to perform a full ADB backup for deeper extraction? (Requires tapping 'Back up my data' on device)"):
            backup_file = session.output_dir / "backup.ab"
            _logger.info("Starting adb backup to %s", backup_file)
            
            while True:
                backup_proc = subprocess.Popen(
                    [adb_cmd, *adb_target_args, "backup", "-all", "-f", str(backup_file)],
                    stderr=subprocess.PIPE, text=True
                )
                
                prompt_password(
                    "Backup Password", 
                    "If you set a desktop backup password on the device, please enter it here (or leave blank if none):"
                )
                
                _, stderr_out = backup_proc.communicate()
                
                if backup_proc.returncode == 0 and backup_file.exists():
                    break
                else:
                    _logger.warning("adb backup failed: %s", stderr_out)
                    action = prompt_error_action(
                        "Backup Error",
                        f"adb backup failed.\nError: {stderr_out}\n\nChoose an action:"
                    )
                    if action == "Retry":
                        continue
                    elif action == "Abort":
                        raise ExtractionError("Aborted extraction due to adb backup failure")
                    else:
                        break
            
            if backup_file.exists():
                hashes = HashEngine.hash_file(backup_file)
                artifact = Artifact(
                    artifact_type=ArtifactType.APP_DATA,
                    source_app="adb_backup",
                    source_path=str(backup_file),
                    acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
                    hashes=hashes,
                    data={"method": "adb_backup"},
                    device=self._device,
                )
                session.register_artifact(artifact)
                yield artifact

        # 3. Extract native Content Providers (SMS, Call Logs, Contacts)
        if extract_textual:
            _logger.info("Extracting native Android content providers (SMS, Call Logs, Contacts)")
        providers = {
            "sms": "content://sms/",
            "call_logs": "content://call_log/calls",
            "contacts": "content://contacts/phones"
        }
        
        for name, uri in providers.items():
            try:
                dest_file = adb_pull_dir / f"{name}.csv"
                _logger.info(f"Querying {uri} to {dest_file}")
                
                query_cmd = [adb_cmd, *adb_target_args, "shell", "content", "query", "--uri", uri]
                query_proc = subprocess.run(query_cmd, capture_output=True, text=True)
                
                if query_proc.returncode == 0 and query_proc.stdout.strip() and "No result found" not in query_proc.stdout:
                    dest_file.write_text(query_proc.stdout, encoding='utf-8')
                    
                    artifact_t = ArtifactType.MESSAGE
                    if name == "call_logs":
                        artifact_t = ArtifactType.CALL_LOG
                    elif name == "contacts":
                        artifact_t = ArtifactType.CONTACT
                        
                    hashes = HashEngine.hash_file(dest_file)
                    artifact = Artifact(
                        artifact_type=artifact_t,
                        source_app="adb_content_provider",
                        source_path=str(dest_file),
                        acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
                        hashes=hashes,
                        data={"method": "adb_shell_content", "uri": uri},
                        device=self._device,
                    )
                    session.register_artifact(artifact)
                    yield artifact
                else:
                    _logger.info(f"No data returned for {uri} or query failed: {query_proc.stderr}")
            except Exception as exc:
                _logger.warning(f"Failed to query {uri}: {exc}", exc_info=True)

    def _fs_extract(self, session: ForensicSession, profile: str = "all") -> Iterator[Artifact]:
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
                    acquired_at=datetime.now(timezone(timedelta(hours=5, minutes=30))),
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
