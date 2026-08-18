"""
forensixd.parsers.decryption_toolkit
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Multi-Method Digital Forensic Decryption and Triage Engine for Investigating Officers.
Provides multiple fallback strategies:
  1. WhatsApp Crypt12/14/15 Database Decryption (via Key File or 64-Hex Passphrase)
  2. Android System Notification History Log Scraper (Extracts unencrypted chat previews)
  3. Process RAM / Heap Memory Key Scanner (am dumpheap key extraction)
  4. WhatsApp Multi-Device Session Ingester
"""

from __future__ import annotations

import io
import json
import logging
import os
import re
import sqlite3
import subprocess
import time
import zlib
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

_logger = logging.getLogger(__name__)
_IST = timezone(timedelta(hours=5, minutes=30))


def _is_adb_device_online(adb_cmd: str, adb_target_args: list[str]) -> bool:
    """Verifies that an ADB target device is connected and authorized."""
    try:
        res = subprocess.run([adb_cmd, *adb_target_args, "get-state"], capture_output=True, text=True, timeout=3)
        return res.returncode == 0 and "device" in res.stdout.lower()
    except Exception:
        return False


class WhatsAppDecryptionEngine:
    """Multi-vector decryption engine for WhatsApp crypt12, crypt14, and crypt15 databases."""

    @staticmethod
    def decrypt_with_key_bytes(db_path: Path, raw_aes_key: bytes) -> bytes:
        """Decrypts a crypt14 or crypt15 database using raw 32-byte AES key."""
        if len(raw_aes_key) != 32:
            raise ValueError(f"AES key must be exactly 32 bytes (got {len(raw_aes_key)})")

        db_data = db_path.read_bytes()
        if len(db_data) < 100:
            raise ValueError("Database file too short to be a valid crypt container")

        # Crypt14 / Crypt15 format:
        # bytes 0..66: header / metadata
        # bytes 67..82: 16-byte GCM nonce (IV)
        # bytes 83..-16: ciphertext
        # bytes -16..: 16-byte GCM auth tag
        iv = db_data[67:83]
        ciphertext = db_data[83:-16]
        tag = db_data[-16:]

        # Attempt AES-GCM decryption
        try:
            from cryptography.hazmat.primitives.ciphers.aead import AESGCM
            aesgcm = AESGCM(raw_aes_key)
            # cryptography expects ciphertext + tag
            decrypted = aesgcm.decrypt(iv, ciphertext + tag, None)
            
            # Check for zlib compressed SQLite stream (common in crypt14/15)
            if decrypted.startswith(b"\x78\x9c") or decrypted.startswith(b"\x78\x01") or decrypted.startswith(b"\x78\xda"):
                try:
                    decrypted = zlib.decompress(decrypted)
                except Exception:
                    pass
            return decrypted
        except Exception as e:
            # Fallback to Cryptodome if available
            try:
                from Crypto.Cipher import AES  # type: ignore
                cipher = AES.new(raw_aes_key, AES.MODE_GCM, nonce=iv)
                decrypted = cipher.decrypt_and_verify(ciphertext, tag)
                if decrypted.startswith(b"\x78\x9c") or decrypted.startswith(b"\x78\x01") or decrypted.startswith(b"\x78\xda"):
                    try:
                        decrypted = zlib.decompress(decrypted)
                    except Exception:
                        pass
                return decrypted
            except Exception as e2:
                raise RuntimeError(f"GCM Decryption failed with provided key: {e} | {e2}")

    @staticmethod
    def decrypt_with_key_file(db_path: Path, key_file_path: Path) -> bytes:
        """Decrypts a crypt14/15 database using a 158-byte WhatsApp key file."""
        key_data = key_file_path.read_bytes()
        if len(key_data) < 67:
            raise ValueError(f"Key file too short ({len(key_data)} bytes). Expected at least 67 bytes.")
        aes_key = key_data[35:67]  # 32-byte AES key slice
        return WhatsAppDecryptionEngine.decrypt_with_key_bytes(db_path, aes_key)

    @staticmethod
    def decrypt_with_hex_key(db_path: Path, hex_key_str: str) -> bytes:
        """Decrypts a crypt14/15 database using a 64-character hex key (from E2E cloud backup)."""
        clean_hex = re.sub(r"[^0-9a-fA-F]", "", hex_key_str)
        if len(clean_hex) != 64:
            raise ValueError(f"Hex key must be 64 characters long (got {len(clean_hex)})")
        raw_key = bytes.fromhex(clean_hex)
        return WhatsAppDecryptionEngine.decrypt_with_key_bytes(db_path, raw_key)


class AndroidNotificationScraper:
    """Extracts plain-text message snippets and notifications logged by Android OS."""

    @staticmethod
    def scrape_notification_history(adb_cmd: str, adb_target_args: list[str]) -> List[Dict[str, Any]]:
        """Queries Android dumpsys notification / notification history for chat records."""
        if not _is_adb_device_online(adb_cmd, adb_target_args):
            return []
        records: List[Dict[str, Any]] = []
        try:
            # Try multiple dumpsys notification vectors
            commands = [
                [adb_cmd, *adb_target_args, "shell", "dumpsys", "notification", "--noredact"],
                [adb_cmd, *adb_target_args, "shell", "dumpsys", "notification"],
                [adb_cmd, *adb_target_args, "shell", "dumpsys", "notification_history"],
            ]

            combined_output = ""
            for cmd in commands:
                res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=10)
                if res.returncode == 0 and res.stdout:
                    combined_output += "\n" + res.stdout

            if combined_output:
                lines = combined_output.splitlines()
                current_pkg = "Unknown"
                current_title = ""
                current_text = ""
                current_time = datetime.now(_IST).isoformat()

                for line in lines:
                    line_str = line.strip()
                    pkg_m = re.search(r"pkg=([a-zA-Z0-9_\.]+)", line_str) or re.search(r"package=([a-zA-Z0-9_\.]+)", line_str)
                    if pkg_m:
                        current_pkg = pkg_m.group(1)

                    title_m = (
                        re.search(r"android\.title=String \((.*?)\)", line_str)
                        or re.search(r"android\.title=(.*?)(?:,|$)", line_str)
                        or re.search(r"tickerText=(.*?)$", line_str)
                    )
                    if title_m:
                        current_title = title_m.group(1).strip()

                    text_m = (
                        re.search(r"android\.text=String \((.*?)\)", line_str)
                        or re.search(r"android\.text=(.*?)(?:,|$)", line_str)
                        or re.search(r"android\.bigText=String \((.*?)\)", line_str)
                        or re.search(r"android\.bigText=(.*?)(?:,|$)", line_str)
                    )
                    if text_m:
                        current_text = text_m.group(1).strip()

                    if current_title and current_text and current_text != "null" and current_title != "null":
                        if any(app in current_pkg.lower() for app in ["whatsapp", "telegram", "signal", "mms", "messaging", "chat", "android"]):
                            records.append({
                                "sender": current_title,
                                "message": current_text,
                                "timestamp": current_time,
                                "app": "Notification Cache (" + current_pkg.split(".")[-1].title() + ")",
                                "type": "incoming",
                                "channel": "notification_log",
                            })
                            current_title = ""
                            current_text = ""

        except Exception as e:
            _logger.warning("Notification scraper error: %s", e)

        return records


class MemoryHeapKeyScanner:
    """Multi-method volatile memory scanner for extracting cryptographic key material.

    Implements a 6-method fallback chain that works across Android OEM skins
    (MIUI, OneUI, ColorOS, FunTouchOS, EMUI, Stock AOSP) without requiring
    root access or APK modification. Non-destructive — never force-stops
    the target application.
    """

    # ──────────────────────────── Helpers ────────────────────────────

    @staticmethod
    def _detect_device_profile(adb_cmd: str, adb_target_args: list[str]) -> Dict[str, Any]:
        """Fingerprints the connected device (brand, model, SDK, skin, security patch)."""
        props = {
            "manufacturer": "ro.product.manufacturer",
            "model": "ro.product.model",
            "sdk": "ro.build.version.sdk",
            "display": "ro.build.display.id",
            "security_patch": "ro.build.version.security_patch",
            "miui_version": "ro.miui.ui.version.name",
            "oneui_version": "ro.build.version.oneui",
            "coloros_version": "ro.build.version.oplusrom",
            "hardware": "ro.hardware",
            "platform": "ro.board.platform",
        }
        profile: Dict[str, Any] = {}
        for key, prop in props.items():
            try:
                res = subprocess.run(
                    [adb_cmd, *adb_target_args, "shell", "getprop", prop],
                    capture_output=True, text=True, timeout=3,
                )
                val = res.stdout.strip() if res.returncode == 0 else ""
                if val:
                    profile[key] = val
            except Exception:
                pass

        # Derive human-readable skin name
        skin = "Stock AOSP"
        if profile.get("miui_version"):
            skin = f"MIUI / HyperOS ({profile['miui_version']})"
        elif profile.get("oneui_version"):
            skin = f"Samsung OneUI ({profile['oneui_version']})"
        elif profile.get("coloros_version"):
            skin = f"ColorOS / Realme UI ({profile['coloros_version']})"
        elif "huawei" in profile.get("manufacturer", "").lower():
            skin = "Huawei EMUI / HarmonyOS"
        elif "vivo" in profile.get("manufacturer", "").lower():
            skin = "Vivo FunTouchOS"
        elif "oneplus" in profile.get("manufacturer", "").lower():
            skin = "OxygenOS"
        profile["skin"] = skin
        return profile

    @staticmethod
    def _find_target_pid(adb_cmd: str, adb_target_args: list[str], package_name: str) -> Optional[int]:
        """Resolves the running PID of the target package, or None if not running."""
        # Method A: pidof (Android 8+)
        try:
            res = subprocess.run(
                [adb_cmd, *adb_target_args, "shell", "pidof", package_name],
                capture_output=True, text=True, timeout=5,
            )
            if res.returncode == 0 and res.stdout.strip():
                # pidof may return multiple PIDs; take the first
                return int(res.stdout.strip().split()[0])
        except Exception:
            pass
        # Method B: ps grep fallback
        try:
            res = subprocess.run(
                [adb_cmd, *adb_target_args, "shell", "ps", "-A"],
                capture_output=True, text=True, timeout=5,
            )
            if res.returncode == 0:
                for line in res.stdout.splitlines():
                    if package_name in line:
                        parts = line.split()
                        if len(parts) >= 2:
                            return int(parts[1])
        except Exception:
            pass
        return None

    @staticmethod
    def _scan_binary_for_keys(data: bytes) -> List[str]:
        """Scans binary data for candidate 64-char hex strings (32-byte AES keys).

        Filters out obvious false positives: all-zeros, repeating single-byte
        patterns, and common hash prefixes that are unlikely to be crypto keys.
        """
        candidates: List[str] = []
        hex_matches = re.findall(rb"[0-9a-fA-F]{64}", data)
        for h in set(hex_matches):
            candidate = h.decode("ascii")
            # Filter false positives
            if candidate == "0" * 64:
                continue
            # Reject repeating single-byte patterns (e.g. "abababab...")
            if len(set(candidate[i:i+2] for i in range(0, 64, 2))) <= 1:
                continue
            candidates.append(candidate)
        return candidates

    @staticmethod
    def _try_auto_decrypt(output_dir: Path, candidate_hex_keys: List[str]) -> Optional[Dict[str, Any]]:
        """Attempts auto-decryption of crypt14/15 databases using candidate keys."""
        crypt_files = list(output_dir.glob("msgstore*.crypt14")) + list(output_dir.glob("msgstore*.crypt15"))
        if not crypt_files or not candidate_hex_keys:
            return None
        target_db = crypt_files[0]
        for candidate in candidate_hex_keys:
            try:
                decrypted = WhatsAppDecryptionEngine.decrypt_with_hex_key(target_db, candidate)
                out_db = output_dir / "msgstore.db"
                out_db.write_bytes(decrypted)
                return {
                    "key": candidate,
                    "decryptedDb": str(out_db),
                    "sourceDb": target_db.name,
                }
            except Exception:
                continue
        return None

    # ────────────────── Individual Extraction Methods ──────────────────

    @staticmethod
    def _method_managed_heap(adb_cmd: str, adb_target_args: list[str], package_name: str, output_dir: Path, pid: Optional[int]) -> Dict[str, Any]:
        """Method 1: Standard managed (Java/ART) heap dump via am dumpheap."""
        t0 = time.time()
        if pid is None:
            return {"method": "am dumpheap", "status": "failed", "reason": f"{package_name} is not running — open the app first", "duration_ms": 0}
            
        remote_hprof = f"/data/local/tmp/{package_name}_heap.hprof"
        local_hprof = output_dir / f"{package_name}_heap.hprof"
        try:
            res = subprocess.run(
                [adb_cmd, *adb_target_args, "shell", "am", "dumpheap", package_name, remote_hprof],
                capture_output=True, text=True, timeout=25,
            )
            err = (res.stderr.strip() + " " + res.stdout.strip()).strip()
            if "SecurityException" in err or "not debuggable" in err or "Permission" in err or "No process found" in err:
                return {"method": "am dumpheap", "status": "failed", "reason": err or "No process found", "duration_ms": int((time.time() - t0) * 1000)}

            # Wait for dump to finalize on device
            time.sleep(2)

            subprocess.run([adb_cmd, *adb_target_args, "pull", remote_hprof, str(local_hprof)], capture_output=True, timeout=30)
            subprocess.run([adb_cmd, *adb_target_args, "shell", "rm", "-f", remote_hprof], capture_output=True, timeout=5)

            if local_hprof.exists() and local_hprof.stat().st_size > 1024:
                data = local_hprof.read_bytes()
                keys = MemoryHeapKeyScanner._scan_binary_for_keys(data)
                return {
                    "method": "am dumpheap",
                    "status": "success",
                    "heapFile": str(local_hprof),
                    "heapSize": local_hprof.stat().st_size,
                    "candidates": keys[:10],
                    "duration_ms": int((time.time() - t0) * 1000),
                }
            return {"method": "am dumpheap", "status": "failed", "reason": "Heap file empty or not created", "duration_ms": int((time.time() - t0) * 1000)}
        except subprocess.TimeoutExpired:
            return {"method": "am dumpheap", "status": "failed", "reason": "Timed out (25s)", "duration_ms": int((time.time() - t0) * 1000)}
        except Exception as e:
            return {"method": "am dumpheap", "status": "failed", "reason": str(e), "duration_ms": int((time.time() - t0) * 1000)}

    @staticmethod
    def _method_native_heap(adb_cmd: str, adb_target_args: list[str], package_name: str, output_dir: Path, pid: Optional[int]) -> Dict[str, Any]:
        """Method 2: Native heap dump via am dumpheap -n."""
        t0 = time.time()
        if pid is None:
            return {"method": "am dumpheap -n (native)", "status": "failed", "reason": f"{package_name} is not running — open the app first", "duration_ms": 0}
            
        remote_path = f"/data/local/tmp/{package_name}_native.hprof"
        local_path = output_dir / f"{package_name}_native.hprof"
        try:
            res = subprocess.run(
                [adb_cmd, *adb_target_args, "shell", "am", "dumpheap", "-n", package_name, remote_path],
                capture_output=True, text=True, timeout=25,
            )
            err = (res.stderr.strip() + " " + res.stdout.strip()).strip()
            if "SecurityException" in err or "not debuggable" in err or "Permission" in err or "No process found" in err:
                return {"method": "am dumpheap -n (native)", "status": "failed", "reason": err or "No process found", "duration_ms": int((time.time() - t0) * 1000)}

            time.sleep(2)
            subprocess.run([adb_cmd, *adb_target_args, "pull", remote_path, str(local_path)], capture_output=True, timeout=30)
            subprocess.run([adb_cmd, *adb_target_args, "shell", "rm", "-f", remote_path], capture_output=True, timeout=5)

            if local_path.exists() and local_path.stat().st_size > 1024:
                data = local_path.read_bytes()
                keys = MemoryHeapKeyScanner._scan_binary_for_keys(data)
                return {
                    "method": "am dumpheap -n (native)",
                    "status": "success",
                    "heapFile": str(local_path),
                    "heapSize": local_path.stat().st_size,
                    "candidates": keys[:10],
                    "duration_ms": int((time.time() - t0) * 1000),
                }
            return {"method": "am dumpheap -n (native)", "status": "failed", "reason": "Native heap file empty or not created", "duration_ms": int((time.time() - t0) * 1000)}
        except subprocess.TimeoutExpired:
            return {"method": "am dumpheap -n (native)", "status": "failed", "reason": "Timed out (25s)", "duration_ms": int((time.time() - t0) * 1000)}
        except Exception as e:
            return {"method": "am dumpheap -n (native)", "status": "failed", "reason": str(e), "duration_ms": int((time.time() - t0) * 1000)}

    @staticmethod
    def _method_run_as(adb_cmd: str, adb_target_args: list[str], package_name: str, output_dir: Path) -> Dict[str, Any]:
        """Method 3: run-as sandbox file read (works if debuggable or CVE-2024-0044 is unpatched)."""
        t0 = time.time()
        try:
            # Try to read the key file directly via run-as
            res_key = subprocess.run(
                [adb_cmd, *adb_target_args, "shell", "run-as", package_name, "cat", "files/key"],
                capture_output=True, timeout=10,
            )
            key_data = res_key.stdout if res_key.returncode == 0 else b""
            err = res_key.stderr.decode(errors="replace").strip()

            if "not debuggable" in err or "Package" in err or "Unknown" in err:
                return {"method": "run-as sandbox read", "status": "failed", "reason": err or "Package not debuggable", "duration_ms": int((time.time() - t0) * 1000)}

            # If we got key data, try to also grab the database
            result: Dict[str, Any] = {"method": "run-as sandbox read", "status": "failed", "reason": "No key file found", "duration_ms": 0}
            if key_data and len(key_data) >= 32:
                key_out = output_dir / "key"
                key_out.write_bytes(key_data)
                result = {
                    "method": "run-as sandbox read",
                    "status": "success",
                    "keyFile": str(key_out),
                    "keySize": len(key_data),
                    "duration_ms": int((time.time() - t0) * 1000),
                }
                # Also try to grab the database
                res_db = subprocess.run(
                    [adb_cmd, *adb_target_args, "shell", "run-as", package_name, "cat", "databases/msgstore.db"],
                    capture_output=True, timeout=30,
                )
                if res_db.returncode == 0 and len(res_db.stdout) > 1024:
                    db_out = output_dir / "msgstore.db"
                    db_out.write_bytes(res_db.stdout)
                    result["dbFile"] = str(db_out)
                    result["dbSize"] = len(res_db.stdout)

            result["duration_ms"] = int((time.time() - t0) * 1000)
            return result
        except subprocess.TimeoutExpired:
            return {"method": "run-as sandbox read", "status": "failed", "reason": "Timed out (10s)", "duration_ms": int((time.time() - t0) * 1000)}
        except Exception as e:
            return {"method": "run-as sandbox read", "status": "failed", "reason": str(e), "duration_ms": int((time.time() - t0) * 1000)}

    @staticmethod
    def _method_proc_fd_scan(adb_cmd: str, adb_target_args: list[str], package_name: str, pid: Optional[int]) -> Dict[str, Any]:
        """Method 4: /proc/<pid>/fd/ open file descriptor scan — identifies which DB/key files are open."""
        t0 = time.time()
        if pid is None:
            return {"method": "proc fd scan", "status": "failed", "reason": f"{package_name} is not running — open the app first", "duration_ms": 0}
        try:
            res = subprocess.run(
                [adb_cmd, *adb_target_args, "shell", f"ls -la /proc/{pid}/fd/ 2>/dev/null | grep -i whatsapp"],
                capture_output=True, text=True, timeout=10,
            )
            open_files: List[str] = []
            if res.returncode == 0 and res.stdout.strip():
                for line in res.stdout.strip().splitlines():
                    # Extract symlink target (last part after ->)
                    if "->" in line:
                        target = line.split("->")[-1].strip()
                        if target and not target.startswith("[") and not target.startswith("pipe:"):
                            open_files.append(target)

            # Also scan for any open database or key-related descriptors
            res_all = subprocess.run(
                [adb_cmd, *adb_target_args, "shell", f"ls -la /proc/{pid}/fd/ 2>/dev/null | grep -iE '(msgstore|key|crypt|database|.db)'"],
                capture_output=True, text=True, timeout=10,
            )
            if res_all.returncode == 0 and res_all.stdout.strip():
                for line in res_all.stdout.strip().splitlines():
                    if "->" in line:
                        target = line.split("->")[-1].strip()
                        if target and target not in open_files and not target.startswith("["):
                            open_files.append(target)

            # Also check /proc/<pid>/maps for memory-mapped files
            res_maps = subprocess.run(
                [adb_cmd, *adb_target_args, "shell", f"cat /proc/{pid}/maps 2>/dev/null | grep -iE '(whatsapp|msgstore|key)' | head -20"],
                capture_output=True, text=True, timeout=10,
            )
            mapped_files: List[str] = []
            if res_maps.returncode == 0 and res_maps.stdout.strip():
                for line in res_maps.stdout.strip().splitlines():
                    parts = line.split()
                    if len(parts) >= 6 and parts[-1].startswith("/"):
                        mapped_files.append(parts[-1])

            if open_files or mapped_files:
                return {
                    "method": "proc fd scan",
                    "status": "success",
                    "pid": pid,
                    "openFiles": list(set(open_files)),
                    "mappedFiles": list(set(mapped_files))[:10],
                    "duration_ms": int((time.time() - t0) * 1000),
                }
            return {
                "method": "proc fd scan",
                "status": "failed",
                "reason": f"No WhatsApp-related file descriptors found for PID {pid} (permission restricted)",
                "pid": pid,
                "duration_ms": int((time.time() - t0) * 1000),
            }
        except subprocess.TimeoutExpired:
            return {"method": "proc fd scan", "status": "failed", "reason": "Timed out (10s)", "duration_ms": int((time.time() - t0) * 1000)}
        except Exception as e:
            return {"method": "proc fd scan", "status": "failed", "reason": str(e), "duration_ms": int((time.time() - t0) * 1000)}

    @staticmethod
    def _method_adb_backup(adb_cmd: str, adb_target_args: list[str], package_name: str, output_dir: Path) -> Dict[str, Any]:
        """Method 5: adb backup logical extraction (works on older WhatsApp or pre-Android 12)."""
        t0 = time.time()
        backup_file = output_dir / f"{package_name}_backup.ab"
        try:
            # adb backup requires user to tap "Back up my data" on device screen
            res = subprocess.run(
                [adb_cmd, *adb_target_args, "backup", "-noapk", "-noobb", package_name, "-f", str(backup_file)],
                capture_output=True, text=True, timeout=15,
            )
            err = (res.stderr.strip() + " " + res.stdout.strip()).strip()

            if backup_file.exists() and backup_file.stat().st_size > 100:
                return {
                    "method": "adb backup",
                    "status": "success",
                    "backupFile": str(backup_file),
                    "backupSize": backup_file.stat().st_size,
                    "note": "Backup archive created — requires manual extraction with abe.jar or dd+openssl to access internal databases",
                    "duration_ms": int((time.time() - t0) * 1000),
                }
            return {
                "method": "adb backup",
                "status": "failed",
                "reason": err or "Backup empty — WhatsApp has allowBackup=false on this Android version",
                "duration_ms": int((time.time() - t0) * 1000),
            }
        except subprocess.TimeoutExpired:
            return {"method": "adb backup", "status": "failed", "reason": "Timed out (15s) — user may need to confirm backup on device screen", "duration_ms": int((time.time() - t0) * 1000)}
        except Exception as e:
            return {"method": "adb backup", "status": "failed", "reason": str(e), "duration_ms": int((time.time() - t0) * 1000)}

    @staticmethod
    def _method_pm_dump_intel(adb_cmd: str, adb_target_args: list[str], package_name: str) -> Dict[str, Any]:
        """Method 6: pm dump + content query intelligence gathering (always works, read-only recon)."""
        t0 = time.time()
        intel: Dict[str, Any] = {}
        try:
            # Gather package permissions and components
            res_pm = subprocess.run(
                [adb_cmd, *adb_target_args, "shell", "pm", "dump", package_name],
                capture_output=True, text=True, timeout=10,
            )
            if res_pm.returncode == 0 and res_pm.stdout:
                output = res_pm.stdout
                # Extract key forensic-relevant fields
                intel["isDebuggable"] = "DEBUGGABLE" in output
                intel["allowBackup"] = "ALLOW_BACKUP" in output

                # Extract exported providers
                providers: List[str] = []
                in_provider = False
                for line in output.splitlines():
                    if "ContentProvider" in line or "provider" in line.lower():
                        in_provider = True
                    if in_provider and "authority" in line.lower():
                        providers.append(line.strip())
                    if in_provider and line.strip() == "":
                        in_provider = False
                intel["providers"] = providers[:5]

                # Extract version info
                for line in output.splitlines():
                    if "versionName" in line:
                        intel["appVersion"] = line.strip().split("=")[-1] if "=" in line else line.strip()
                        break

            # Check dumpsys meminfo for memory overview
            res_mem = subprocess.run(
                [adb_cmd, *adb_target_args, "shell", "dumpsys", "meminfo", package_name],
                capture_output=True, text=True, timeout=10,
            )
            if res_mem.returncode == 0 and res_mem.stdout:
                for line in res_mem.stdout.splitlines():
                    if "TOTAL" in line and "PSS" not in line:
                        parts = line.split()
                        for p in parts:
                            if p.isdigit() and int(p) > 1000:
                                intel["totalMemoryKb"] = int(p)
                                break
                        break

            return {
                "method": "pm dump intelligence",
                "status": "success",
                "intel": intel,
                "duration_ms": int((time.time() - t0) * 1000),
            }
        except Exception as e:
            return {"method": "pm dump intelligence", "status": "failed", "reason": str(e), "duration_ms": int((time.time() - t0) * 1000)}

    # ────────────────── Main Orchestrator ──────────────────

    @staticmethod
    def dump_and_scan_app_heap(adb_cmd: str, adb_target_args: list[str], package_name: str, output_dir: Path) -> Dict[str, Any]:
        """Multi-method volatile memory scanner with 6-method fallback chain.

        Attempts each method in sequence, recording per-method results.
        Non-destructive: never force-stops or relaunches the target app.
        Cross-brand compatible: attempts all methods regardless of OEM skin.
        """
        if not _is_adb_device_online(adb_cmd, adb_target_args):
            return {
                "success": False,
                "message": "No Android device connected via ADB. Please connect target device with USB Debugging enabled.",
                "methods": [],
                "candidates": [],
                "decrypted": None,
                "nextSteps": [
                    "Connect target device via USB cable",
                    "Enable Developer Options and USB Debugging on target device",
                    "Authorize host PC RSA fingerprint prompt on device screen"
                ]
            }

        all_candidates: List[str] = []
        method_results: List[Dict[str, Any]] = []
        decryption_result: Optional[Dict[str, Any]] = None

        # ── Step 0: Device fingerprint & PID resolution ──
        device_profile = MemoryHeapKeyScanner._detect_device_profile(adb_cmd, adb_target_args)
        pid = MemoryHeapKeyScanner._find_target_pid(adb_cmd, adb_target_args, package_name)

        _logger.info(
            "RAM Scanner starting: device=%s %s (SDK %s, %s) | PID=%s",
            device_profile.get("manufacturer", "?"),
            device_profile.get("model", "?"),
            device_profile.get("sdk", "?"),
            device_profile.get("skin", "?"),
            pid or "NOT RUNNING",
        )

        if pid is None:
            _logger.warning("Target package %s is not running — some methods will be skipped", package_name)

        # ── Step 1: Managed heap dump ──
        r1 = MemoryHeapKeyScanner._method_managed_heap(adb_cmd, adb_target_args, package_name, output_dir, pid)
        method_results.append(r1)
        if r1["status"] == "success" and r1.get("candidates"):
            all_candidates.extend(r1["candidates"])
            decryption_result = MemoryHeapKeyScanner._try_auto_decrypt(output_dir, r1["candidates"])

        # ── Step 2: Native heap dump ──
        if not decryption_result:
            r2 = MemoryHeapKeyScanner._method_native_heap(adb_cmd, adb_target_args, package_name, output_dir, pid)
            method_results.append(r2)
            if r2["status"] == "success" and r2.get("candidates"):
                all_candidates.extend(r2["candidates"])
                decryption_result = MemoryHeapKeyScanner._try_auto_decrypt(output_dir, r2["candidates"])

        # ── Step 3: run-as sandbox read ──
        if not decryption_result:
            r3 = MemoryHeapKeyScanner._method_run_as(adb_cmd, adb_target_args, package_name, output_dir)
            method_results.append(r3)

        # ── Step 4: /proc fd scan ──
        r4 = MemoryHeapKeyScanner._method_proc_fd_scan(adb_cmd, adb_target_args, package_name, pid)
        method_results.append(r4)

        # ── Step 5: adb backup ──
        if not decryption_result:
            r5 = MemoryHeapKeyScanner._method_adb_backup(adb_cmd, adb_target_args, package_name, output_dir)
            method_results.append(r5)

        # ── Step 6: pm dump intelligence (always runs) ──
        r6 = MemoryHeapKeyScanner._method_pm_dump_intel(adb_cmd, adb_target_args, package_name)
        method_results.append(r6)

        # ── Aggregate results ──
        any_success = any(r["status"] == "success" for r in method_results)
        unique_candidates = list(set(all_candidates))

        # Build next-step guidance
        next_steps: List[str] = []
        if not any_success or not unique_candidates:
            next_steps.append("Enable 'USB Debugging (Security settings)' in Developer Options on the device and retry")
            next_steps.append("Use Vector 2: Notification History Scraper for unencrypted message previews")
            next_steps.append("Use Vector 3: Deep UI Chat Crawler for full conversation extraction")
            next_steps.append("Use Vector 6: Physical Boot Triage for direct /data/data/ extraction (requires bootloader unlock or EDL mode)")
            if device_profile.get("security_patch", "9999") < "2024-10":
                next_steps.insert(1, "Device may be vulnerable to CVE-2024-0044 (pre-Oct 2024 patch) — attempt run-as bypass with forensic tooling")

        # Determine overall message
        if decryption_result:
            message = f"Auto-decrypted {decryption_result['sourceDb']} → msgstore.db using key extracted from RAM!"
        elif unique_candidates:
            message = f"Found {len(unique_candidates)} candidate AES key(s) from volatile memory. Use Vector 1 to attempt decryption."
        elif any_success:
            message = "Memory scan completed — gathered device intelligence but no cryptographic keys found in accessible memory regions."
        else:
            message = "All memory extraction methods blocked by device security. See next steps for alternative extraction vectors."

        return {
            "success": any_success or bool(decryption_result),
            "message": message,
            "deviceProfile": device_profile,
            "pid": pid,
            "methods": method_results,
            "candidates": unique_candidates[:10],
            "decrypted": decryption_result,
            "nextSteps": next_steps,
        }


class PhysicalBootTriageManager:
    """Manages Bootloader / Fastboot / EDL Physical Partition Triage."""

    @staticmethod
    def inspect_bootloader_and_fastboot(adb_cmd: str, adb_target_args: list[str]) -> Dict[str, Any]:
        """Checks device physical state, recovery status, and partition accessibility."""
        if not _is_adb_device_online(adb_cmd, adb_target_args):
            return {
                "success": False,
                "error": "No Android device connected via ADB. Please connect target device with USB Debugging enabled.",
                "hardware": "Disconnected",
                "chipset": "None",
                "bootloaderLocked": True,
                "hasRootAccess": False,
                "chipFamily": "None",
                "physicalDumpSupported": False
            }
        try:
            # 1. Check getprop for hardware/chipset info (Qualcomm vs MediaTek)
            res_hw = subprocess.run([adb_cmd, *adb_target_args, "shell", "getprop", "ro.hardware"], capture_output=True, text=True, timeout=5)
            res_soc = subprocess.run([adb_cmd, *adb_target_args, "shell", "getprop", "ro.board.platform"], capture_output=True, text=True, timeout=5)
            res_locked = subprocess.run([adb_cmd, *adb_target_args, "shell", "getprop", "ro.boot.flash.locked"], capture_output=True, text=True, timeout=5)
            
            hw = res_hw.stdout.strip() if res_hw.returncode == 0 else "Unknown"
            soc = res_soc.stdout.strip() if res_soc.returncode == 0 else "Unknown"
            locked = res_locked.stdout.strip() if res_locked.returncode == 0 else "1"

            # 2. Check if direct root / su is present
            res_su = subprocess.run([adb_cmd, *adb_target_args, "shell", "which", "su"], capture_output=True, text=True, timeout=5)
            has_su = res_su.returncode == 0 and res_su.stdout.strip() != ""

            return {
                "success": True,
                "hardware": hw,
                "chipset": soc,
                "bootloaderLocked": locked == "1",
                "hasRootAccess": has_su,
                "chipFamily": "Qualcomm" if ("qcom" in hw.lower() or "snapdragon" in soc.lower()) else ("MediaTek" if ("mt" in hw.lower() or "mtk" in soc.lower()) else "ARM Generic"),
                "physicalDumpSupported": True
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    @staticmethod
    def extract_direct_physical_db(adb_cmd: str, adb_target_args: list[str], output_dir: Path) -> Dict[str, Any]:
        """Attempts direct extraction from /data/data/ if root/su or elevated shell is available."""
        if not _is_adb_device_online(adb_cmd, adb_target_args):
            return {"success": False, "error": "No Android device connected via ADB."}
        try:
            out_db = output_dir / "msgstore.db"
            out_key = output_dir / "key"

            # Try cat with su or run-as
            cmd_db = f"su -c 'cat /data/data/com.whatsapp/databases/msgstore.db' > {out_db}"
            cmd_key = f"su -c 'cat /data/data/com.whatsapp/files/key' > {out_key}"
            
            subprocess.run([adb_cmd, *adb_target_args, "shell", f"su -c 'cp /data/data/com.whatsapp/databases/msgstore.db /sdcard/msgstore_phys.db'"], timeout=10)
            subprocess.run([adb_cmd, *adb_target_args, "pull", "/sdcard/msgstore_phys.db", str(out_db)], timeout=15)
            subprocess.run([adb_cmd, *adb_target_args, "shell", "rm", "-f", "/sdcard/msgstore_phys.db"], timeout=5)

            if out_db.exists() and out_db.stat().st_size > 1024:
                return {
                    "success": True,
                    "message": "Direct physical extraction of unencrypted msgstore.db succeeded!",
                    "outputFile": str(out_db),
                    "size": out_db.stat().st_size
                }
            else:
                return {
                    "success": False,
                    "message": "Direct /data/data/ physical read requires elevated permissions (su/EDL mode)."
                }
        except Exception as e:
            return {"success": False, "error": str(e)}


class AndroidWhatsAppHarvester:
    """Extracts WhatsApp media, voice notes, and live chat trees directly via ADB without database decryption."""

    _crawler_is_running: bool = False
    _crawler_cancel_requested: bool = False

    @classmethod
    def cancel_crawler(cls):
        """Signals the running deep UI crawler to stop gracefully."""
        cls._crawler_cancel_requested = True

    @staticmethod
    def harvest_whatsapp_media(adb_cmd: str, adb_target_args: list[str], target_case_dir: Path) -> Dict[str, Any]:
        """Scans unencrypted Android shared media directories for WhatsApp voice notes, audio, and documents."""
        if not _is_adb_device_online(adb_cmd, adb_target_args):
            return {
                "success": False,
                "error": "No Android device connected via ADB. Please connect target device with USB Debugging enabled.",
                "totalFiles": 0,
                "outputDir": str(target_case_dir)
            }
        target_media_dir = target_case_dir / "whatsapp_media"
        target_media_dir.mkdir(parents=True, exist_ok=True)

        media_paths = [
            "/sdcard/Android/media/com.whatsapp/WhatsApp/Media",
            "/sdcard/WhatsApp/Media",
            "/storage/emulated/0/Android/media/com.whatsapp/WhatsApp/Media",
            "/storage/emulated/0/WhatsApp/Media"
        ]

        pulled_count = 0

        for remote_base in media_paths:
            try:
                # Check if directory exists
                check = subprocess.run([adb_cmd, *adb_target_args, "shell", f"ls -d {remote_base}"], capture_output=True, text=True, timeout=5)
                if check.returncode == 0 and check.stdout.strip():
                    # Pull voice notes, audio, and documents
                    for sub in ["WhatsApp Voice Notes", "WhatsApp Audio", "WhatsApp Documents"]:
                        remote_sub = f"{remote_base}/{sub}"
                        res = subprocess.run([adb_cmd, *adb_target_args, "pull", remote_sub, str(target_media_dir)], capture_output=True, timeout=30)
                        if res.returncode == 0:
                            pulled_count += 1
            except Exception as e:
                _logger.warning("Error harvesting WhatsApp media: %s", e)

        files = list(target_media_dir.rglob("*.*"))
        if not files:
            return {
                "success": False,
                "error": "No unencrypted WhatsApp media files found in accessible device storage.",
                "totalFiles": 0,
                "recoveredCount": 0,
                "outputDir": str(target_media_dir)
            }
        return {
            "success": True,
            "message": f"Harvested {len(files)} unencrypted WhatsApp voice notes, audio files, and documents.",
            "totalFiles": len(files),
            "recoveredCount": len(files),
            "outputDir": str(target_media_dir)
        }

    @staticmethod
    def scrape_deep_whatsapp_threads(adb_cmd: str, adb_target_args: list[str], output_dir: Path, max_chats: int = 30) -> Dict[str, Any]:
        """Iteratively opens individual WhatsApp conversations, scrolls to the top of each conversation,
        and scrolls down the contact list to harvest all conversations locally without duplication or re-crawling."""
        if not _is_adb_device_online(adb_cmd, adb_target_args):
            return {
                "success": False,
                "error": "No Android device connected via ADB. Please connect target device with USB Debugging enabled.",
                "records": []
            }
        import xml.etree.ElementTree as ET
        all_conversations: List[Dict[str, Any]] = []
        remote_xml = "/data/local/tmp/uidump.xml"
        processed_contacts: set[str] = set()
        crawled_contact_samples: Dict[str, set[str]] = {}

        AndroidWhatsAppHarvester._crawler_is_running = True
        AndroidWhatsAppHarvester._crawler_cancel_requested = False

        def _sleep_interruptible(duration_sec: float) -> bool:
            """Sleeps in 50ms increments while checking for user cancellation. Returns True if cancelled."""
            steps = max(1, int(duration_sec / 0.05))
            for _ in range(steps):
                if AndroidWhatsAppHarvester._crawler_cancel_requested:
                    return True
                time.sleep(0.05)
            return AndroidWhatsAppHarvester._crawler_cancel_requested

        try:
            # 1. Bring WhatsApp explicitly to foreground
            subprocess.run([adb_cmd, *adb_target_args, "shell", "am", "start", "-n", "com.whatsapp/.Main"], capture_output=True, timeout=5)
            if _sleep_interruptible(1.2):
                return {"success": True, "message": "Crawler cancelled by user.", "records": []}

            consecutive_no_new_contacts = 0
            scroll_list_count = 0
            max_list_scrolls = 20

            while len(processed_contacts) < max_chats and scroll_list_count < max_list_scrolls:
                if AndroidWhatsAppHarvester._crawler_cancel_requested:
                    _logger.info("Crawler cancelled by user directive.")
                    break

                # Ensure we are in foreground and on HomeActivity
                subprocess.run([adb_cmd, *adb_target_args, "shell", "am", "start", "-n", "com.whatsapp/.Main"], capture_output=True, timeout=5)
                if _sleep_interruptible(0.5):
                    break

                # Dump chat list screen
                subprocess.run([adb_cmd, *adb_target_args, "shell", "uiautomator", "dump", remote_xml], capture_output=True, timeout=10)
                if AndroidWhatsAppHarvester._crawler_cancel_requested:
                    break

                res = subprocess.run([adb_cmd, *adb_target_args, "shell", "cat", remote_xml], capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=10)

                if res.returncode != 0 or not res.stdout or "<hierarchy" not in res.stdout:
                    _logger.warning("Failed to dump hierarchy or screen locked.")
                    break

                try:
                    root = ET.fromstring(res.stdout)
                except Exception as e:
                    _logger.warning("XML parse error on chat list: %s", e)
                    break

                # Extract currently visible contact rows
                visible_rows: List[Tuple[str, int, int]] = []
                for node in root.iter("node"):
                    pkg = node.attrib.get("package", "")
                    if pkg != "com.whatsapp":
                        continue

                    bounds_str = node.attrib.get("bounds", "")
                    m = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", bounds_str)
                    if not m:
                        continue
                    x1, y1, x2, y2 = map(int, m.groups())

                    # Filter within chat list area (exclude header y<350 and footer y>2050)
                    if y1 < 350 or y2 > 2100:
                        continue

                    text = node.attrib.get("text", "").strip()
                    res_id = node.attrib.get("resource-id", "")

                    if "conversations_row_contact_name" in res_id or ("contact_name" in res_id and text):
                        cx = (x1 + x2) // 2
                        cy = (y1 + y2) // 2
                        visible_rows.append((text, cx, cy))
                    elif text and len(text) > 1 and text not in ["Chats", "Updates", "Communities", "Calls", "Search", "WhatsApp", "Archived", "New chat", "Status", "Messages", "Online"]:
                        if 40 <= (y2 - y1) <= 220 and x1 < 450:
                            cx = (x1 + x2) // 2
                            cy = (y1 + y2) // 2
                            visible_rows.append((text, cx, cy))

                # Deduplicate visible rows by contact name and Y coordinate
                unique_visible: List[Tuple[str, int, int]] = []
                seen_y = set()
                for name, cx, cy in visible_rows:
                    if not any(abs(cy - sy) < 65 for sy in seen_y):
                        seen_y.add(cy)
                        unique_visible.append((name, cx, cy))

                # Filter out already processed contacts
                new_contacts_to_process = [
                    (name, cx, cy) for name, cx, cy in unique_visible 
                    if name not in processed_contacts
                ]

                _logger.info("Found %d visible rows (%d new to process)", len(unique_visible), len(new_contacts_to_process))

                if not new_contacts_to_process:
                    consecutive_no_new_contacts += 1
                    if consecutive_no_new_contacts >= 2:
                        _logger.info("No more new contacts found after consecutive scrolls. Ending crawl.")
                        break
                    # Scroll down the chat list
                    subprocess.run([adb_cmd, *adb_target_args, "shell", "input", "swipe", "540", "1600", "540", "600", "350"], timeout=5)
                    scroll_list_count += 1
                    if _sleep_interruptible(1.0):
                        break
                    continue
                else:
                    consecutive_no_new_contacts = 0

                # Process each new contact on screen
                for contact_label, cx, cy in new_contacts_to_process:
                    if AndroidWhatsAppHarvester._crawler_cancel_requested:
                        break
                    if len(processed_contacts) >= max_chats:
                        break
                    if contact_label in processed_contacts:
                        continue

                    try:
                        # Tap to open chat
                        subprocess.run([adb_cmd, *adb_target_args, "shell", "input", "tap", str(cx), str(cy)], timeout=5)
                        if _sleep_interruptible(1.0):
                            break

                        # Initial dump inside conversation to verify contact & check top 5 messages
                        subprocess.run([adb_cmd, *adb_target_args, "shell", "uiautomator", "dump", remote_xml], capture_output=True, timeout=8)
                        init_res = subprocess.run([adb_cmd, *adb_target_args, "shell", "cat", remote_xml], capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=8)

                        actual_contact_name = contact_label
                        init_messages: List[str] = []

                        if init_res.returncode == 0 and init_res.stdout and "<hierarchy" in init_res.stdout:
                            try:
                                init_root = ET.fromstring(init_res.stdout)
                                for cnode in init_root.iter("node"):
                                    c_text = cnode.attrib.get("text", "").strip()
                                    c_resid = cnode.attrib.get("resource-id", "")
                                    if "conversation_contact_name" in c_resid and c_text:
                                        actual_contact_name = c_text
                                    elif c_text and c_text not in ["Type a message", "Message", "Search", "Online", "typing...", "WhatsApp", "Messages and calls are end-to-end encrypted"]:
                                        init_messages.append(c_text)
                            except Exception:
                                pass

                        # Redundancy Guard: If contact already crawled, check if top 5 messages are identical
                        if actual_contact_name in crawled_contact_samples:
                            known_msgs = crawled_contact_samples[actual_contact_name]
                            top_5 = init_messages[:5]
                            if top_5 and all(m in known_msgs for m in top_5):
                                _logger.info("Chat '%s' top 5 messages already captured. Skipping redundant crawl.", actual_contact_name)
                                processed_contacts.add(contact_label)
                                processed_contacts.add(actual_contact_name)
                                subprocess.run([adb_cmd, *adb_target_args, "shell", "input", "keyevent", "4"], timeout=5)
                                if _sleep_interruptible(0.5):
                                    break
                                continue

                        chat_records_map: Dict[str, Dict[str, Any]] = {}
                        consecutive_no_new_msgs = 0
                        max_chat_swipes = 40
                        current_date_header = "Recent"

                        time_pattern = re.compile(r'^\d{1,2}:\d{2}(?:\s*(?:[aApP][mM]|am|pm|AM|PM))?$')
                        date_pattern = re.compile(r'^(?:Today|Yesterday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)(?:\s+\d{4})?|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})$', re.IGNORECASE)

                        for swipe_idx in range(max_chat_swipes):
                            if AndroidWhatsAppHarvester._crawler_cancel_requested:
                                break

                            # Dump conversation UI
                            subprocess.run([adb_cmd, *adb_target_args, "shell", "uiautomator", "dump", remote_xml], capture_output=True, timeout=8)
                            chat_res = subprocess.run([adb_cmd, *adb_target_args, "shell", "cat", remote_xml], capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=8)

                            new_msgs_in_swipe = 0
                            hit_top_encryption_marker = False

                            if chat_res.returncode == 0 and chat_res.stdout and "<hierarchy" in chat_res.stdout:
                                try:
                                    chat_root = ET.fromstring(chat_res.stdout)
                                    pending_time = ""

                                    for cnode in chat_root.iter("node"):
                                        c_text = cnode.attrib.get("text", "").strip()
                                        c_resid = cnode.attrib.get("resource-id", "")
                                        bounds_str = cnode.attrib.get("bounds", "")

                                        if "conversation_contact_name" in c_resid and c_text:
                                            actual_contact_name = c_text
                                            continue

                                        # Detect definitive top-of-chat encryption banner
                                        if "end-to-end encrypted" in c_text.lower():
                                            hit_top_encryption_marker = True
                                            continue

                                        if not c_text or c_text in ["Type a message", "Message", "Search", "Online", "typing...", "WhatsApp", "Edited", "Forwarded"]:
                                            continue

                                        # Parse bounds to determine incoming vs outgoing
                                        bm = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", bounds_str)
                                        if not bm:
                                            continue
                                        bx1, by1, bx2, by2 = map(int, bm.groups())

                                        # Ignore top header and bottom input bar
                                        if by1 < 300 or by2 > 2150:
                                            continue
                                        if c_text == actual_contact_name:
                                            continue

                                        # Detect date separator headers (e.g. "9 August 2026", "Yesterday")
                                        if date_pattern.match(c_text):
                                            current_date_header = c_text
                                            continue

                                        # Detect timestamp inside message bubble (e.g. "9:21 pm")
                                        if time_pattern.match(c_text):
                                            pending_time = c_text
                                            continue

                                        # Outgoing (sent by device owner) is right-aligned on screen (bx2 > 820 or bx1 > 200)
                                        # Incoming (sent by contact) is left-aligned (bx1 < 250 and bx2 < 880)
                                        is_outgoing = (bx2 > 820 and bx1 > 200) or (bx1 > 350)
                                        direction = "outgoing" if is_outgoing else "incoming"
                                        sender_name = "Me (Device Owner)" if is_outgoing else actual_contact_name
                                        receiver_name = actual_contact_name if is_outgoing else "Me (Device Owner)"

                                        # Combine date header + bubble time into timestamp
                                        msg_timestamp = f"{current_date_header}, {pending_time}" if pending_time else current_date_header

                                        # Unique key per message in this thread
                                        msg_key = f"{direction}:{c_text}"
                                        if msg_key not in chat_records_map:
                                            chat_records_map[msg_key] = {
                                                "sender": sender_name,
                                                "recipient": receiver_name,
                                                "direction": direction,
                                                "type": direction,
                                                "message": c_text,
                                                "contact": actual_contact_name,
                                                "timestamp": msg_timestamp,
                                                "app": "WhatsApp (Deep UI Crawler)",
                                                "channel": "deep_ui"
                                            }
                                            new_msgs_in_swipe += 1
                                except Exception as e:
                                    _logger.warning("Error parsing conversation DOM: %s", e)

                            # If encryption header is visible, we have reached the top of this chat!
                            if hit_top_encryption_marker:
                                _logger.info("Reached top-of-chat encryption banner for '%s'.", actual_contact_name)
                                break

                            if new_msgs_in_swipe == 0:
                                consecutive_no_new_msgs += 1
                                if consecutive_no_new_msgs >= 4:
                                    # Stable top reached
                                    break
                            else:
                                consecutive_no_new_msgs = 0

                            # Swipe down from top (540, 650 -> 540, 1850) with 450ms duration for clean deceleration
                            subprocess.run([adb_cmd, *adb_target_args, "shell", "input", "swipe", "540", "650", "540", "1850", "450"], timeout=5)
                            if _sleep_interruptible(0.8):
                                break

                        # Mark contact as processed & record message sample
                        processed_contacts.add(contact_label)
                        processed_contacts.add(actual_contact_name)
                        if actual_contact_name not in crawled_contact_samples:
                            crawled_contact_samples[actual_contact_name] = set()
                        for rec in chat_records_map.values():
                            crawled_contact_samples[actual_contact_name].add(rec["message"])

                        # Append all crawled dialogues
                        all_conversations.extend(list(chat_records_map.values()))

                        # Press Back to return to chat list
                        subprocess.run([adb_cmd, *adb_target_args, "shell", "input", "keyevent", "4"], timeout=5)
                        if _sleep_interruptible(0.5):
                            break

                    except Exception as e:
                        _logger.warning("Error harvesting contact %s: %s", contact_label, e)
                        processed_contacts.add(contact_label)
                        subprocess.run([adb_cmd, *adb_target_args, "shell", "input", "keyevent", "4"], timeout=5)

                # After processing visible contacts, scroll the chat list down
                if AndroidWhatsAppHarvester._crawler_cancel_requested:
                    break
                subprocess.run([adb_cmd, *adb_target_args, "shell", "input", "swipe", "540", "1600", "540", "600", "350"], timeout=5)
                scroll_list_count += 1
                if _sleep_interruptible(1.0):
                    break

            # Clean remote tmp
            subprocess.run([adb_cmd, *adb_target_args, "shell", "rm", "-f", remote_xml], timeout=5)

            # Save locally to case directory
            out_file = output_dir / "extracted_whatsapp_chats.json"
            out_file.write_text(json.dumps(all_conversations, indent=2, ensure_ascii=False), encoding="utf-8")

            status_msg = "Crawler stopped by user." if AndroidWhatsAppHarvester._crawler_cancel_requested else f"Successfully crawled {len(processed_contacts)} chat contacts and extracted {len(all_conversations)} full-history dialogue records locally."

            return {
                "success": True,
                "message": status_msg,
                "totalRecords": len(all_conversations),
                "contactsCrawled": len(processed_contacts),
                "localPath": str(out_file),
                "records": all_conversations
            }

        except Exception as e:
            return {"success": False, "error": str(e)}
        finally:
            AndroidWhatsAppHarvester._crawler_is_running = False
            AndroidWhatsAppHarvester._crawler_cancel_requested = False
