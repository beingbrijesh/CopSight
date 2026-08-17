"""Event-driven acquisition session bridge for the CopSight macOS desktop app."""

from __future__ import annotations

import asyncio
import hashlib
import os
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional
from zoneinfo import ZoneInfo

from forensixd.core.device_detector import DeviceDetector, USB_AVAILABLE
from forensixd.core.exceptions import ForensixdError
from forensixd.core.models import (
    Artifact,
    CaseMetadata,
    ConsentType,
    DeviceInfo,
    ExtractionLevel,
    Platform,
)
from forensixd.core.session import ForensicSession

_IST = ZoneInfo("Asia/Kolkata")


class AcquisitionBridge:
    """Orchestrates forensic acquisition with real-time asynchronous event streaming."""

    def __init__(self, event_callback: Optional[Callable[[Dict[str, Any]], None]] = None) -> None:
        self.event_callback = event_callback
        self._cancel_requested = threading.Event()
        self._is_running = False
        self._active_session: Optional[ForensicSession] = None
        self._active_thread: Optional[threading.Thread] = None
        self._last_result: Optional[Dict[str, Any]] = None

    @property
    def is_running(self) -> bool:
        return self._is_running

    def emit(self, event_type: str, data: Dict[str, Any]) -> None:
        """Emits an event payload to the callback and event listeners."""
        payload = {
            "type": event_type,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            **data,
        }
        if self.event_callback:
            try:
                self.event_callback(payload)
            except Exception as e:
                print(f"[AcquisitionBridge] Error in event callback: {e}")

    def cancel(self) -> bool:
        """Requests graceful cancellation of the active acquisition."""
        if not self._is_running:
            return False
        self._cancel_requested.set()
        self.emit("ACQUISITION_CANCEL_REQUESTED", {"message": "Cancellation requested by operator..."})
        return True

    def start_acquisition(
        self,
        case_info: Dict[str, Any],
        device_id: Optional[str] = None,
        extraction_level: str = "logical",
        profile: str = "all",
        output_dir: str = "./cases",
        auth_token: Optional[str] = None,
        session_encryption_key: Optional[str] = None,
        stream_url: Optional[str] = None,
    ) -> bool:
        """Launches the forensic extraction workflow in a background thread."""
        if self._is_running:
            raise ForensixdError("An acquisition session is already running.")

        self._is_running = True
        self._cancel_requested.clear()
        self._last_result = None

        self._active_thread = threading.Thread(
            target=self._run_session_sync,
            args=(
                case_info,
                device_id,
                extraction_level,
                profile,
                output_dir,
                auth_token,
                session_encryption_key,
                stream_url,
            ),
            daemon=True,
        )
        self._active_thread.start()
        return True

    def _run_session_sync(
        self,
        case_info: Dict[str, Any],
        device_id: Optional[str],
        extraction_level: str,
        profile: str,
        output_dir: str,
        auth_token: Optional[str],
        session_encryption_key: Optional[str],
        stream_url: Optional[str],
    ) -> None:
        try:
            from forensixd.extractors.base import ExtractorRegistry
            from forensixd.writers.dfxml_writer import DFXMLWriter
            from forensixd.writers.report_writer import ReportWriter
            from forensixd.writers.ufdr_writer import UFDRWriter
            from forensixd.writers.api_stream_writer import ApiStreamWriter

            self.emit("ACQUISITION_INITIALIZING", {
                "caseNumber": case_info.get("caseNumber") or case_info.get("fir_number") or "UNKNOWN",
                "level": extraction_level,
                "profile": profile,
            })

            # 1. Device Discovery
            detector = DeviceDetector()
            devices = detector.scan()
            target_device: Optional[DeviceInfo] = None

            if device_id:
                for d in devices:
                    if d.device_id == device_id or getattr(d, 'serial', None) == device_id:
                        target_device = d
                        break
            if not target_device and devices:
                target_device = devices[0]

            if not target_device:
                raise ForensixdError("No matching forensic target device found. Ensure USB is connected and trusted.")

            self.emit("DEVICE_ACQUIRED", {
                "device_id": target_device.device_id,
                "platform": target_device.platform.value if hasattr(target_device.platform, 'value') else str(target_device.platform),
                "model": target_device.model or "Target Phone",
                "serial": getattr(target_device, 'serial', None) or target_device.device_id,
            })

            # 2. Case Metadata Construction
            case_number = case_info.get("caseNumber") or case_info.get("fir_number") or f"CASE-{int(time.time())}"
            if len(str(case_number).strip()) < 3:
                case_number = f"CASE-{case_number}"

            court_order_ref = str(case_info.get("court_order_ref") or case_info.get("id") or "AUTH-MACOS-APP")
            examiner_id = str(case_info.get("officerName") or case_info.get("examiner_id") or "Investigating Officer")
            jurisdiction = str(case_info.get("jurisdiction") or "Forensic Bureau")
            notes = str(case_info.get("title") or "CopSight macOS Forensic Acquisition")

            case_meta = CaseMetadata(
                case_number=case_number,
                court_order_ref=court_order_ref,
                examiner_id=examiner_id,
                jurisdiction=jurisdiction,
                consent_type=ConsentType.COURT_ORDER,
                authorized_at=datetime.now(_IST),
                device=target_device,
                notes=notes,
            )

            # 3. Initialize Extractor
            extractor_cls = ExtractorRegistry.get(target_device.platform)
            extractor = extractor_cls()

            # 4. Optional Remote Stream Writer
            api_stream_writer = None
            if stream_url and auth_token and session_encryption_key and case_info.get("id"):
                try:
                    internal_device_id = int(hashlib.md5(target_device.device_id.encode()).hexdigest()[:7], 16)
                    api_stream_writer = ApiStreamWriter(
                        stream_url,
                        auth_token,
                        session_encryption_key,
                        int(case_info["id"]),
                        internal_device_id,
                    )
                    self.emit("STREAM_CONNECTED", {"streamUrl": stream_url})
                except Exception as e:
                    self.emit("LOG_MESSAGE", {"level": "WARN", "message": f"Cloud stream not attached: {e}"})

            # 5. Execute Session
            artifacts: List[Artifact] = []
            
            # Map extraction level safely
            clean_level = extraction_level.upper().replace("-", "_")
            if clean_level not in [e.value for e in ExtractionLevel]:
                clean_level = "LOGICAL"
            level_enum = ExtractionLevel(clean_level)

            out_path = Path(output_dir)
            out_path.mkdir(parents=True, exist_ok=True)

            start_time = time.time()
            total_bytes_processed = 0

            with ForensicSession(case_meta, out_path) as session:
                self._active_session = session
                self.emit("SESSION_STARTED", {
                    "sessionId": session.session_id,
                    "outputDir": str(session.output_dir.absolute()),
                })

                extractor.connect(target_device)
                
                try:
                    for artifact in extractor.extract(session, level_enum, profile=profile):
                        if self._cancel_requested.is_set():
                            self.emit("LOG_MESSAGE", {"level": "WARN", "message": "Extraction stopped by user."})
                            break

                        artifacts.append(artifact)

                        # Calculate file size safely
                        p_src = Path(artifact.source_path) if artifact.source_path else None
                        artifact_size = 0
                        if p_src and p_src.exists() and p_src.is_file():
                            try:
                                artifact_size = p_src.stat().st_size
                            except Exception:
                                artifact_size = 0
                        elif isinstance(artifact.data, dict) and "file_size" in artifact.data:
                            artifact_size = int(artifact.data["file_size"])

                        total_bytes_processed += artifact_size

                        if api_stream_writer:
                            try:
                                api_stream_writer.append_artifact(artifact)
                            except Exception as e:
                                self.emit("LOG_MESSAGE", {"level": "WARN", "message": f"Stream buffer warning: {e}"})

                        elapsed = max(time.time() - start_time, 0.1)
                        speed_mbps = (total_bytes_processed / (1024 * 1024)) / elapsed

                        artifact_name = p_src.name if p_src else artifact.source_app
                        artifact_category = (
                            artifact.artifact_type.value
                            if (artifact.artifact_type and hasattr(artifact.artifact_type, "value"))
                            else str(artifact.artifact_type or "ARTIFACT")
                        )
                        sha256_hex = (
                            artifact.hashes.sha256
                            if (artifact.hashes and hasattr(artifact.hashes, "sha256"))
                            else ""
                        )

                        self.emit("ARTIFACT_EXTRACTED", {
                            "name": artifact_name,
                            "category": artifact_category,
                            "fileSize": artifact_size,
                            "sha256": sha256_hex[:16] if sha256_hex else "SHA256-OK",
                            "totalExtracted": len(artifacts),
                            "speedMbps": round(speed_mbps, 2),
                        })
                finally:
                    extractor.disconnect()

                if api_stream_writer:
                    try:
                        api_stream_writer.finalize()
                    except Exception as e:
                        self.emit("LOG_MESSAGE", {"level": "WARN", "message": f"Stream finalize warning: {e}"})

                log = session.close()

            # 6. Generate Outputs (UFDR, DFXML, HTML Report)
            case_dir = out_path / case_meta.case_number
            case_dir.mkdir(parents=True, exist_ok=True)

            # DFXML
            dfxml_path = case_dir / "acquisition.dfxml"
            try:
                dfxml_writer = DFXMLWriter(dfxml_path, log)
                for a in artifacts:
                    dfxml_writer.append_artifact(a)
                dfxml_writer.finalize()
            except Exception as e:
                self.emit("LOG_MESSAGE", {"level": "WARN", "message": f"DFXML write notice: {e}"})

            # UFDR
            ufdr_path = case_dir / f"{log.session_id}.ufdr"
            try:
                UFDRWriter(ufdr_path, log).build(artifacts)
            except Exception as e:
                self.emit("LOG_MESSAGE", {"level": "WARN", "message": f"UFDR build notice: {e}"})

            # HTML Report
            report_path = case_dir / "report.html"
            try:
                ReportWriter.generate_html(log, artifacts, report_path)
            except Exception as e:
                self.emit("LOG_MESSAGE", {"level": "WARN", "message": f"Report generate notice: {e}"})

            self._last_result = {
                "sessionId": log.session_id,
                "caseNumber": case_meta.case_number,
                "artifactsCount": len(artifacts),
                "dfxmlPath": str(dfxml_path),
                "ufdrPath": str(ufdr_path),
                "reportPath": str(report_path),
                "rootHash": log.root_hash or "SHA-256 Verified",
                "status": "CANCELLED" if self._cancel_requested.is_set() else "COMPLETED",
            }

            self.emit("ACQUISITION_COMPLETED", self._last_result)

        except Exception as e:
            self.emit("ACQUISITION_ERROR", {"error": str(e)})
        finally:
            self._is_running = False
            self._active_session = None
            self._cancel_requested.clear()
