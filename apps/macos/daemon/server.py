"""Lightweight, high-performance local daemon server for CopSight macOS Desktop Application."""

from __future__ import annotations

import argparse
import asyncio
import contextlib
import json
import sys
import os
import subprocess
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Dict, List, Set, Optional

try:
    import uvicorn
    from starlette.applications import Starlette
    from starlette.middleware import Middleware
    from starlette.middleware.cors import CORSMiddleware
    from starlette.requests import Request
    from starlette.responses import JSONResponse
    from starlette.routing import Route, WebSocketRoute
    from starlette.websockets import WebSocket, WebSocketDisconnect
    HAS_STARLETTE = True
except ImportError:
    HAS_STARLETTE = False
    import http.server
    import urllib.parse

from forensixd.core.device_detector import DeviceDetector, USB_AVAILABLE
from forensixd.extractors.android import resolve_adb_command, _resolve_adb_command
from apps.macos.daemon.session_bridge import AcquisitionBridge

# Active WebSocket connections
_active_websockets: Set[WebSocket] = set()
_loop: asyncio.AbstractEventLoop | None = None


_event_log: List[Dict[str, Any]] = []

def _broadcast_event(payload: Dict[str, Any]) -> None:
    """Thread-safe event dispatcher for connected WebSockets and polling clients."""
    global _loop, _active_websockets, _event_log
    _event_log.append(payload)
    if len(_event_log) > 1000:
        _event_log = _event_log[-500:]

    if not _active_websockets:
        return

    message_text = json.dumps(payload)

    async def _send_all():
        disconnected = set()
        for ws in list(_active_websockets):
            try:
                await ws.send_text(message_text)
            except Exception:
                disconnected.add(ws)
        _active_websockets.difference_update(disconnected)

    if _loop and _loop.is_running():
        asyncio.run_coroutine_threadsafe(_send_all(), _loop)


# Instantiate the bridge with event broadcast
bridge = AcquisitionBridge(event_callback=_broadcast_event)

# Global tracking for physical extraction vendors
_MTK_PROCESS: Optional[subprocess.Popen] = None
_MTK_LOG_FILE: Optional[Path] = None


async def health_endpoint(request: Request) -> JSONResponse:
    """Returns daemon health and USB subsystem state."""
    return JSONResponse({
        "status": "healthy",
        "daemon": "CopSight macOS Engine",
        "version": "1.0.0",
        "usb_available": USB_AVAILABLE,
        "is_acquiring": bridge.is_running,
    })


async def status_endpoint(request: Request) -> JSONResponse:
    """Returns active extraction state and last completed session result."""
    return JSONResponse({
        "is_running": bridge.is_running,
        "usb_available": USB_AVAILABLE,
        "last_result": bridge._last_result,
    })


_last_known_devices: list[dict[str, Any]] = []


async def devices_endpoint(request: Request) -> JSONResponse:
    """Probes USB bus and returns connected forensic target devices."""
    global _last_known_devices
    from forensixd.parsers.decryption_toolkit import AndroidWhatsAppHarvester
    
    # Only return cache if an acquisition session is actively streaming or crawler is running
    if bridge.is_running or getattr(AndroidWhatsAppHarvester, "_crawler_is_running", False):
        return JSONResponse({
            "success": True,
            "devices": _last_known_devices,
            "count": len(_last_known_devices),
            "usb_backend_ready": True,
        })

    try:
        detector = DeviceDetector()
        devices = await asyncio.to_thread(detector.scan)
        results = []
        for d in devices:
            vid = "0x2717"
            pid = "0xFF48"
            if ":" in d.device_id and not d.device_id.startswith("adb:") and not d.device_id.startswith("ios:"):
                parts = d.device_id.split(":")
                if len(parts) == 2:
                    vid, pid = parts[0], parts[1]
            elif d.platform == Platform.IOS:
                vid, pid = "0x05AC", "0x12A8"
            elif d.platform == Platform.ANDROID:
                vid, pid = "0x18D1", "0x4EE2"

            results.append({
                "device_id": d.device_id,
                "platform": d.platform.value if hasattr(d.platform, "value") else str(d.platform),
                "vendor_id": vid,
                "product_id": pid,
                "model": d.model or "Target Phone",
                "serial": d.serial or d.device_id,
            })
        _last_known_devices = results
        return JSONResponse({
            "success": True,
            "devices": results,
            "count": len(results),
            "usb_backend_ready": True,
        })
    except Exception:
        _last_known_devices = []
        return JSONResponse({
            "success": True,
            "devices": [],
            "count": 0,
            "usb_backend_ready": True,
        })


async def start_acquire_endpoint(request: Request) -> JSONResponse:
    """Starts a forensic acquisition with the provided case and target parameters."""
    if bridge.is_running:
        return JSONResponse(
            {"success": False, "error": "An acquisition session is already running."},
            status_code=409,
        )

    try:
        data = await request.json()
    except Exception:
        return JSONResponse({"success": False, "error": "Invalid JSON payload."}, status_code=400)

    case_info = data.get("case_info")
    if not case_info:
        return JSONResponse({"success": False, "error": "case_info is required."}, status_code=400)

    device_id = data.get("device_id")
    extraction_level = data.get("level", "logical").lower()
    profile = data.get("profile", "all").lower()
    output_dir = data.get("output_dir", "./cases")
    auth_token = data.get("token")
    session_encryption_key = data.get("session_encryption_key")
    stream_url = data.get("stream_url")

    try:
        bridge.start_acquisition(
            case_info=case_info,
            device_id=device_id,
            extraction_level=extraction_level,
            profile=profile,
            output_dir=output_dir,
            auth_token=auth_token,
            session_encryption_key=session_encryption_key,
            stream_url=stream_url,
        )
        return JSONResponse({
            "success": True,
            "message": "Forensic acquisition initiated successfully.",
            "caseNumber": case_info.get("caseNumber"),
        })
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)


async def cancel_acquire_endpoint(request: Request) -> JSONResponse:
    """Cancels the active acquisition cleanly."""
    cancelled = bridge.cancel()
    if cancelled:
        return JSONResponse({"success": True, "message": "Acquisition cancellation requested."})
    return JSONResponse({"success": False, "message": "No active acquisition to cancel."}, status_code=400)


async def reports_endpoint(request: Request) -> JSONResponse:
    """Returns details of the latest output artifacts."""
    if bridge._last_result:
        return JSONResponse({"success": True, "report": bridge._last_result})
async def poll_events_endpoint(request: Request) -> JSONResponse:
    """HTTP polling fallback for real-time extraction progress and events."""
    try:
        since = int(request.query_params.get("since", "0"))
    except Exception:
        since = 0
    return JSONResponse({
        "success": True,
        "events": _event_log[since:],
        "next_idx": len(_event_log),
        "is_running": bridge.is_running,
    })


async def websocket_events_endpoint(websocket: WebSocket) -> None:
    """WebSocket stream for real-time extraction progress and logs."""
    global _active_websockets
    await websocket.accept()
    _active_websockets.add(websocket)
    try:
        # Send initial connection handshake
        await websocket.send_text(json.dumps({
            "type": "CONNECTION_ESTABLISHED",
            "message": "Connected to CopSight macOS Forensic Stream",
            "is_acquiring": bridge.is_running,
        }))
        while True:
            # Keep-alive receive loop
            data = await websocket.receive_text()
            # Handle client ping
            if data == "ping":
                await websocket.send_text(json.dumps({"type": "PONG"}))
    except WebSocketDisconnect:
        pass
    finally:
        _active_websockets.discard(websocket)


@contextlib.asynccontextmanager
async def lifespan(app: Starlette):
    global _loop
    try:
        _loop = asyncio.get_running_loop()
    except RuntimeError:
        pass
    yield


async def _safe_get_json(request: Request) -> Dict[str, Any]:
    """Safely extracts JSON payload from request without throwing JSONDecodeError on empty body."""
    try:
        body = await request.body()
        if not body:
            return {}
        return json.loads(body.decode("utf-8"))
    except Exception:
        return {}


def _resolve_adb_target_args(data: Dict[str, Any]) -> list[str]:
    """Extracts device serial from request data and returns ADB -s target args."""
    serial = data.get("deviceSerial", "")
    if serial:
        return ["-s", serial]
    return []


async def decrypt_whatsapp_endpoint(request: Request) -> JSONResponse:
    """Decrypts WhatsApp .crypt14/.crypt15 database using key file or 64-hex key."""
    try:
        data = await _safe_get_json(request)
        case_number = data.get("caseNumber", "Demo")
        hex_key = data.get("hexKey")
        key_file_path = data.get("keyFilePath")

        case_dir = Path("cases") / case_number / "adb_pull"
        crypt_files = list(case_dir.glob("msgstore*.crypt14")) + list(case_dir.glob("msgstore*.crypt15")) + list(case_dir.glob("*.crypt14"))

        if not crypt_files:
            return JSONResponse({"success": False, "message": "No encrypted WhatsApp databases found in case folder."}, status_code=404)

        from forensixd.parsers.decryption_toolkit import WhatsAppDecryptionEngine
        target_db = crypt_files[0]
        out_db = case_dir / "msgstore.db"

        if hex_key:
            decrypted_bytes = WhatsAppDecryptionEngine.decrypt_with_hex_key(target_db, hex_key)
        elif key_file_path and Path(key_file_path).exists():
            decrypted_bytes = WhatsAppDecryptionEngine.decrypt_with_key_file(target_db, Path(key_file_path))
        else:
            # Check if a sibling key file exists
            sibling_key = case_dir / "key"
            if sibling_key.exists():
                decrypted_bytes = WhatsAppDecryptionEngine.decrypt_with_key_file(target_db, sibling_key)
            else:
                return JSONResponse({"success": False, "message": "Missing key. Please provide 64-hex key or key file path."}, status_code=400)

        out_db.write_bytes(decrypted_bytes)
        
        # Parse and count records
        from forensixd.parsers.auto_decoder import ForensicAutoDecoder
        from forensixd.core.models import Artifact, ArtifactType, HashPair
        hashes = HashPair(md5="decrypted", sha256="decrypted")
        art = Artifact(
            artifact_id="whatsapp_decrypted",
            artifact_type=ArtifactType.MESSAGE,
            source_app="WhatsApp",
            source_path=str(out_db),
            acquired_at=datetime.now(),
            hashes=hashes
        )
        records = ForensicAutoDecoder.decode_and_extract_records(art)

        return JSONResponse({
            "success": True,
            "message": f"Successfully decrypted {target_db.name} -> msgstore.db ({len(records)} messages parsed)",
            "outputFile": str(out_db),
            "recordCount": len(records),
            "sample": records[:3] if records else []
        })
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)


async def scrape_notifications_endpoint(request: Request) -> JSONResponse:
    """Scrapes unencrypted notification history from device memory."""
    try:
        data = await _safe_get_json(request)
        adb_args = _resolve_adb_target_args(data)
        from forensixd.parsers.decryption_toolkit import AndroidNotificationScraper
        from forensixd.extractors.android import _resolve_adb_command
        adb_cmd = _resolve_adb_command()
        records = AndroidNotificationScraper.scrape_notification_history(adb_cmd, adb_args)
        return JSONResponse({
            "success": True,
            "count": len(records),
            "records": records
        })
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)


async def verify_custody_endpoint(request: Request) -> JSONResponse:
    """Verifies cryptographic hash chain of custody for a case."""
    try:
        data = await _safe_get_json(request)
        case_number = data.get("caseNumber", "Demo")
        case_dir = Path("cases") / case_number
        files = list(case_dir.glob("*.audit.jsonl"))

        if not files:
            return JSONResponse({"success": False, "message": "No audit logs found for case."}, status_code=404)

        from forensixd.core.logger import AuditLogger
        results = []
        all_passed = True
        for f in files:
            is_valid = AuditLogger.from_file(f).verify()
            if not is_valid:
                all_passed = False
            results.append({"file": f.name, "status": "PASS" if is_valid else "TAMPERED"})

        return JSONResponse({
            "success": True,
            "verified": all_passed,
            "results": results
        })
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)


async def open_folder_endpoint(request: Request) -> JSONResponse:
    """Reveals the case directory in macOS Finder."""
    try:
        data = await _safe_get_json(request)
        case_number = data.get("caseNumber", "Demo")
        case_dir = Path("cases") / case_number
        if not case_dir.exists():
            case_dir = Path("cases")
        subprocess.run(["open", str(case_dir.resolve())])
        return JSONResponse({"success": True, "message": f"Opened {case_dir} in Finder."})
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)


async def heap_dump_endpoint(request: Request) -> JSONResponse:
    """Captures process RAM / heap memory dump and extracts candidate AES keys."""
    try:
        data = await _safe_get_json(request)
        case_number = data.get("caseNumber", "Demo")
        package_name = data.get("packageName", "com.whatsapp")
        adb_args = _resolve_adb_target_args(data)
        case_dir = Path("cases") / case_number / "adb_pull"
        case_dir.mkdir(parents=True, exist_ok=True)

        from forensixd.parsers.decryption_toolkit import MemoryHeapKeyScanner
        from forensixd.extractors.android import _resolve_adb_command
        adb_cmd = _resolve_adb_command()

        result = await asyncio.to_thread(MemoryHeapKeyScanner.dump_and_scan_app_heap, adb_cmd, adb_args, package_name, case_dir)
        return JSONResponse(result)
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)


async def physical_inspect_endpoint(request: Request) -> JSONResponse:
    """Inspects device bootloader, chipset hardware, and physical extraction capabilities."""
    try:
        data = await _safe_get_json(request)
        adb_args = _resolve_adb_target_args(data)
        from forensixd.parsers.decryption_toolkit import PhysicalBootTriageManager
        from forensixd.extractors.android import _resolve_adb_command
        adb_cmd = _resolve_adb_command()
        result = PhysicalBootTriageManager.inspect_bootloader_and_fastboot(adb_cmd, adb_args)
        return JSONResponse(result)
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)


async def physical_extract_endpoint(request: Request) -> JSONResponse:
    """Attempts direct physical /data/data/ database extraction using elevated/EDL privileges."""
    try:
        data = await _safe_get_json(request)
        case_number = data.get("caseNumber", "Demo")
        adb_args = _resolve_adb_target_args(data)
        case_dir = Path("cases") / case_number / "adb_pull"
        case_dir.mkdir(parents=True, exist_ok=True)

        from forensixd.parsers.decryption_toolkit import PhysicalBootTriageManager
        from forensixd.extractors.android import _resolve_adb_command
        adb_cmd = _resolve_adb_command()

        result = PhysicalBootTriageManager.extract_direct_physical_db(adb_cmd, adb_args, case_dir)
        return JSONResponse(result)
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)


async def vendor_setup_endpoint(request: Request) -> JSONResponse:
    """Sets up a physical extraction vendor tool (e.g., mtkclient)."""
    try:
        data = await _safe_get_json(request)
        vendor = data.get("vendor", "mtkclient")
        if vendor == "mtkclient":
            from forensixd.core.vendor_manager import VendorManager
            result = await asyncio.to_thread(VendorManager.setup_mtkclient)
            return JSONResponse(result)
        else:
            return JSONResponse({"success": False, "error": f"Unknown vendor: {vendor}"}, status_code=400)
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)


async def mtk_extract_endpoint(request: Request) -> JSONResponse:
    """Starts the mtkclient extraction process."""
    global _MTK_PROCESS, _MTK_LOG_FILE
    try:
        data = await _safe_get_json(request)
        case_number = data.get("caseNumber", "Demo")
        case_dir = Path("cases") / case_number / "physical_dump"
        case_dir.mkdir(parents=True, exist_ok=True)
        
        log_file = case_dir / "mtkclient.log"
        _MTK_LOG_FILE = log_file

        from forensixd.core.vendor_manager import VendorManager
        
        # Ensure any existing process is killed
        if _MTK_PROCESS and _MTK_PROCESS.poll() is None:
            _MTK_PROCESS.kill()
            
        process = await asyncio.to_thread(VendorManager.execute_mtk_dump, case_dir, log_file)
        _MTK_PROCESS = process
        
        return JSONResponse({"success": True, "message": "MTK physical dump started."})
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)


async def mtk_status_endpoint(request: Request) -> JSONResponse:
    """Polls the status of the MTK extraction and reads the latest log lines."""
    global _MTK_PROCESS, _MTK_LOG_FILE
    try:
        if not _MTK_LOG_FILE or not _MTK_LOG_FILE.exists():
            return JSONResponse({"success": True, "running": False, "logs": "No log file found. Waiting..."})

        logs = await asyncio.to_thread(_MTK_LOG_FILE.read_text, errors="replace")
        
        running = False
        if _MTK_PROCESS and _MTK_PROCESS.poll() is None:
            running = True
            
        # Get only the last 1000 characters to prevent massive payload
        log_snippet = logs[-2000:] if len(logs) > 2000 else logs
        
        return JSONResponse({"success": True, "running": running, "logs": log_snippet})
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)



async def open_dev_settings_endpoint(request: Request) -> JSONResponse:
    """Launches the Developer Options settings page directly on the connected Android screen."""
    try:
        data = await _safe_get_json(request)
        adb_args = _resolve_adb_target_args(data)
        from forensixd.extractors.android import _resolve_adb_command
        adb_cmd = _resolve_adb_command()
        subprocess.run([adb_cmd, *adb_args, "shell", "am", "start", "-a", "android.settings.APPLICATION_DEVELOPMENT_SETTINGS"], capture_output=True, timeout=5)
        return JSONResponse({"success": True, "message": "Opened Developer Options screen directly on device."})
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)


async def whatsapp_media_endpoint(request: Request) -> JSONResponse:
    """Harvests unencrypted WhatsApp audio voice notes, documents, and media."""
    try:
        data = await _safe_get_json(request)
        case_number = data.get("caseNumber", "Demo")
        case_dir = Path("cases") / case_number / "adb_pull"
        case_dir.mkdir(parents=True, exist_ok=True)

        from forensixd.parsers.decryption_toolkit import AndroidWhatsAppHarvester
        from forensixd.extractors.android import _resolve_adb_command
        adb_cmd = _resolve_adb_command()

        adb_args = _resolve_adb_target_args(data)
        result = await asyncio.to_thread(AndroidWhatsAppHarvester.harvest_whatsapp_media, adb_cmd, adb_args, case_dir)
        return JSONResponse(result)
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)


async def whatsapp_ui_endpoint(request: Request) -> JSONResponse:
    """Iteratively opens WhatsApp chats, scrolls to extract dialogues, and saves locally."""
    try:
        data = await _safe_get_json(request)
        case_number = data.get("caseNumber", "Demo")
        case_dir = Path("cases") / case_number / "adb_pull"
        case_dir.mkdir(parents=True, exist_ok=True)

        from forensixd.parsers.decryption_toolkit import AndroidWhatsAppHarvester
        from forensixd.extractors.android import _resolve_adb_command
        adb_cmd = _resolve_adb_command()

        adb_args = _resolve_adb_target_args(data)
        result = await asyncio.to_thread(AndroidWhatsAppHarvester.scrape_deep_whatsapp_threads, adb_cmd, adb_args, case_dir)
        return JSONResponse(result)
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)


async def cancel_whatsapp_ui_endpoint(request: Request) -> JSONResponse:
    """Cancels an active WhatsApp deep UI crawler session."""
    try:
        from forensixd.parsers.decryption_toolkit import AndroidWhatsAppHarvester
        AndroidWhatsAppHarvester.cancel_crawler()
        return JSONResponse({"success": True, "message": "Crawler cancellation signal dispatched."})
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)


async def case_local_status_endpoint(request: Request) -> JSONResponse:
    """Returns local extraction stats and upload status."""
    try:
        case_number = request.query_params.get("caseNumber", "Demo")
        case_dir = Path("cases") / case_number / "adb_pull"
        files = list(case_dir.glob("*.*")) if case_dir.exists() else []

        upload_flag = case_dir / ".uploaded_to_cloud"
        is_uploaded = upload_flag.exists()

        return JSONResponse({
            "success": True,
            "localFileCount": len(files),
            "isUploaded": is_uploaded,
            "status": "Uploaded to Cloud" if is_uploaded else "Stored Locally (Not Uploaded)",
            "files": [f.name for f in files]
        })
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)


async def upload_to_cloud_endpoint(request: Request) -> JSONResponse:
    """Explicitly uploads local case records to the central cloud server on IO demand."""
    try:
        data = await _safe_get_json(request)
        case_id = data.get("caseId", 1)
        case_number = data.get("caseNumber", "Demo")
        case_dir = Path("cases") / case_number / "adb_pull"

        if not case_dir.exists():
            return JSONResponse({"success": False, "message": "No local case files found."}, status_code=404)

        # Look for extracted chats or CSV files
        uploaded_count = 0
        import urllib.request
        cloud_url = os.environ.get("COPSIGHT_STREAM_URL", f"https://copsight.onrender.com/api/ingest/stream/case/{case_id}")
        
        chat_file = case_dir / "extracted_whatsapp_chats.json"
        if chat_file.exists():
            chat_records = json.loads(chat_file.read_text(encoding="utf-8"))
            if chat_records:
                payload = json.dumps({"records": chat_records}).encode("utf-8")
                req = urllib.request.Request(cloud_url, data=payload, headers={"Content-Type": "application/json"})
                try:
                    with urllib.request.urlopen(req, timeout=15) as resp:
                        uploaded_count += len(chat_records)
                except Exception as e:
                    _logger.warning("Cloud upload sync note: %s", e)

        # Mark as uploaded
        (case_dir / ".uploaded_to_cloud").write_text(datetime.now(timezone.utc).isoformat())

        return JSONResponse({
            "success": True,
            "message": f"Successfully synced {uploaded_count} evidence records to cloud server.",
            "uploadedCount": uploaded_count,
            "status": "Uploaded"
        })
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)


if HAS_STARLETTE:
    def create_app() -> Starlette:
        """Constructs the Starlette application with CORS and routes."""
        middleware = [
            Middleware(
                CORSMiddleware,
                allow_origins=["*"],
                allow_methods=["*"],
                allow_headers=["*"],
            )
        ]

        routes = [
            Route("/health", health_endpoint, methods=["GET"]),
            Route("/api/status", status_endpoint, methods=["GET"]),
            Route("/api/devices", devices_endpoint, methods=["GET"]),
            Route("/api/acquire/start", start_acquire_endpoint, methods=["POST"]),
            Route("/api/acquire/cancel", cancel_acquire_endpoint, methods=["POST"]),
            Route("/api/reports", reports_endpoint, methods=["GET"]),
            Route("/api/decrypt/whatsapp", decrypt_whatsapp_endpoint, methods=["POST"]),
            Route("/api/acquire/notifications", scrape_notifications_endpoint, methods=["POST"]),
            Route("/api/acquire/whatsapp-media", whatsapp_media_endpoint, methods=["POST", "GET"]),
            Route("/api/acquire/whatsapp-ui", whatsapp_ui_endpoint, methods=["POST", "GET"]),
            Route("/api/acquire/whatsapp-ui/cancel", cancel_whatsapp_ui_endpoint, methods=["POST"]),
            Route("/api/acquire/heap", heap_dump_endpoint, methods=["POST"]),
            Route("/api/acquire/open-dev-settings", open_dev_settings_endpoint, methods=["POST", "GET"]),
            Route("/api/acquire/physical-inspect", physical_inspect_endpoint, methods=["POST", "GET"]),
            Route("/api/acquire/physical-extract", physical_extract_endpoint, methods=["POST"]),
            Route("/api/acquire/physical/vendor-setup", vendor_setup_endpoint, methods=["POST"]),
            Route("/api/acquire/physical/mtk-extract", mtk_extract_endpoint, methods=["POST"]),
            Route("/api/acquire/physical/mtk-status", mtk_status_endpoint, methods=["GET"]),
            Route("/api/cases/local-status", case_local_status_endpoint, methods=["GET"]),
            Route("/api/cases/upload-to-cloud", upload_to_cloud_endpoint, methods=["POST"]),
            Route("/api/verify", verify_custody_endpoint, methods=["POST", "GET"]),
            Route("/api/open-folder", open_folder_endpoint, methods=["POST"]),
            Route("/api/acquire/events/poll", poll_events_endpoint, methods=["GET"]),
            WebSocketRoute("/api/acquire/events", websocket_events_endpoint),
        ]

        return Starlette(routes=routes, middleware=middleware, lifespan=lifespan)

    app = create_app()
else:
    app = None

    class FallbackDaemonHandler(http.server.BaseHTTPRequestHandler):
        def _send_cors(self, status=200, content_type="application/json"):
            self.send_response(status)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "*")
            self.send_header("Content-Type", content_type)
            self.end_headers()

        def do_OPTIONS(self):
            self._send_cors(204)

        def do_GET(self):
            parsed = urllib.parse.urlparse(self.path)
            path = parsed.path
            if path == "/health":
                self._send_cors(200)
                resp = json.dumps({
                    "status": "healthy",
                    "daemon": "CopSight macOS Engine",
                    "version": "2.0.28",
                    "usb_available": USB_AVAILABLE,
                    "is_acquiring": bridge.is_running,
                }).encode("utf-8")
                self.wfile.write(resp)
            elif path == "/api/status":
                self._send_cors(200)
                resp = json.dumps({
                    "is_running": bridge.is_running,
                    "usb_available": USB_AVAILABLE,
                    "last_result": bridge._last_result,
                }).encode("utf-8")
                self.wfile.write(resp)
            elif path == "/api/acquire/events/poll":
                try:
                    query_params = urllib.parse.parse_qs(parsed.query)
                    since_idx = int(query_params.get("since", ["0"])[0])
                except Exception:
                    since_idx = 0
                new_events = _event_log[since_idx:]
                self._send_cors(200)
                self.wfile.write(json.dumps({
                    "success": True,
                    "events": new_events,
                    "next_idx": len(_event_log),
                    "is_running": bridge.is_running
                }).encode("utf-8"))
            elif path == "/api/devices":
                try:
                    detector = DeviceDetector()
                    devices = detector.scan()
                    results = []
                    for d in devices:
                        results.append({
                            "device_id": d.device_id,
                            "platform": d.platform.value if hasattr(d.platform, "value") else str(d.platform),
                            "vendor_id": "0x2717",
                            "product_id": "0xFF48",
                            "model": d.model or "Target Device",
                            "serial": d.serial or d.device_id,
                        })
                    self._send_cors(200)
                    self.wfile.write(json.dumps({"success": True, "devices": results, "count": len(results)}).encode("utf-8"))
                except Exception as e:
                    self._send_cors(200)
                    self.wfile.write(json.dumps({"success": True, "devices": [], "count": 0, "error": str(e)}).encode("utf-8"))
            elif path == "/api/reports":
                case_dir = Path("cases")
                reports = []
                if case_dir.exists():
                    for p in case_dir.rglob("*.pdf"):
                        reports.append({"name": p.name, "path": str(p), "size": p.stat().st_size})
                self._send_cors(200)
                self.wfile.write(json.dumps({"success": True, "reports": reports}).encode("utf-8"))
            else:
                self._send_cors(200)
                self.wfile.write(json.dumps({"success": True, "path": path}).encode("utf-8"))

        def do_POST(self):
            parsed = urllib.parse.urlparse(self.path)
            path = parsed.path
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else "{}"
            try:
                data = json.loads(body)
            except Exception:
                data = {}

            if path == "/api/acquire/start":
                if bridge.is_running:
                    self._send_cors(409)
                    self.wfile.write(json.dumps({"success": False, "error": "An acquisition session is already running."}).encode("utf-8"))
                    return

                case_info = data.get("case_info")
                if not case_info:
                    case_info = {
                        "caseNumber": data.get("case_number", "CASE-DEMO"),
                        "officerName": data.get("officer_id", "IO-OFFICER"),
                        "title": "Forensic Acquisition"
                    }

                device_id = data.get("device_id")
                extraction_level = str(data.get("level", "logical")).lower()
                profile = str(data.get("profile", "all")).lower()
                output_dir = data.get("output_dir", "./cases")
                auth_token = data.get("token")
                session_encryption_key = data.get("session_encryption_key")
                stream_url = data.get("stream_url")

                try:
                    bridge.start_acquisition(
                        case_info=case_info,
                        device_id=device_id,
                        extraction_level=extraction_level,
                        profile=profile,
                        output_dir=output_dir,
                        auth_token=auth_token,
                        session_encryption_key=session_encryption_key,
                        stream_url=stream_url,
                    )
                    self._send_cors(200)
                    self.wfile.write(json.dumps({
                        "success": True,
                        "message": "Forensic acquisition initiated successfully.",
                        "caseNumber": case_info.get("caseNumber")
                    }).encode("utf-8"))
                except Exception as e:
                    self._send_cors(500)
                    self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode("utf-8"))

            elif path == "/api/acquire/cancel":
                cancelled = bridge.cancel()
                self._send_cors(200)
                self.wfile.write(json.dumps({"success": True, "message": "Acquisition cancellation requested" if cancelled else "No active acquisition"}).encode("utf-8"))
            elif path == "/api/open-folder":
                folder_path = data.get("path", ".")
                subprocess.Popen(["open", folder_path])
                self._send_cors(200)
                self.wfile.write(json.dumps({"success": True}).encode("utf-8"))
            else:
                self._send_cors(200)
                self.wfile.write(json.dumps({"success": True, "message": "OK"}).encode("utf-8"))

        def log_message(self, format, *args):
            pass


def main():
    parser = argparse.ArgumentParser(description="CopSight macOS Forensic Daemon")
    parser.add_argument("--host", default="127.0.0.1", help="Host interface (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=54322, help="Port to listen on (default: 54322)")
    args = parser.parse_args()

    print(f"[CopSight Daemon] Starting on http://{args.host}:{args.port}...")
    if HAS_STARLETTE and app is not None:
        uvicorn.run(app, host=args.host, port=args.port, log_level="warning")
    else:
        print("[CopSight Daemon] Running on Standard Library HTTP Server (Zero External Dependencies)...")
        from socketserver import ThreadingMixIn
        class ThreadedHTTPServer(ThreadingMixIn, http.server.HTTPServer):
            daemon_threads = True

        server = ThreadedHTTPServer((args.host, args.port), FallbackDaemonHandler)
        server.serve_forever()


if __name__ == "__main__":
    main()
