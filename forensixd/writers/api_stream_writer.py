import sqlite3
import json
import time
import requests  # type: ignore
from threading import Lock
from pathlib import Path
from rich.console import Console

console = Console()

class ApiStreamWriter:
    def __init__(self, stream_url: str, token: str, session_encryption_key: str, case_id: int, device_id: int, batch_size: int = 50):
        self.stream_url = stream_url.rstrip('/')
        if self.stream_url.endswith('/api'):
            self.stream_url = self.stream_url[:-4]
            
        self.token = token
        self.session_encryption_key = bytes.fromhex(session_encryption_key) if session_encryption_key else None
        self.case_id = case_id
        self.device_id = device_id
        self.batch_size = batch_size
        self.buffer = []
        self._seen_hashes = set()
        self.lock = Lock()
        
        # Setup offline queue DB with safe directory fallbacks
        try:
            self.db_path = Path.home() / ".forensixd" / "offline_queue.db"
            self.db_path.parent.mkdir(parents=True, exist_ok=True)
            self._init_db()
        except Exception:
            try:
                self.db_path = Path("./.forensixd") / "offline_queue.db"
                self.db_path.parent.mkdir(parents=True, exist_ok=True)
                self._init_db()
            except Exception:
                self.db_path = ":memory:"
                self._init_db()

        try:
            self._attempt_sync()
        except Exception:
            pass

    def _init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute('''
                CREATE TABLE IF NOT EXISTS offline_chunks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    case_id INTEGER,
                    device_id INTEGER,
                    payload TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')

    def append_artifact(self, artifact):
        sha256 = None
        if hasattr(artifact, 'hashes') and artifact.hashes:
            if hasattr(artifact.hashes, 'sha256'):
                sha256 = artifact.hashes.sha256
            elif isinstance(artifact.hashes, dict):
                sha256 = artifact.hashes.get("sha256") or artifact.hashes.get("SHA-256")
        
        if sha256:
            if sha256 in self._seen_hashes:
                return
            self._seen_hashes.add(sha256)

        # 1. First attempt structured decoding (SMS, Calls, Contacts, WhatsApp chats, Backups)
        try:
            from forensixd.parsers.auto_decoder import ForensicAutoDecoder
            decoded_records = ForensicAutoDecoder.decode_and_extract_records(artifact)
            if decoded_records:
                with self.lock:
                    for rec in decoded_records:
                        app_name = str(rec.get("app") or rec.get("channel") or "sms").lower()
                        if "whatsapp" in app_name:
                            st = "whatsapp"
                        elif "telegram" in app_name:
                            st = "telegram"
                        elif "call" in app_name or "phone" in app_name:
                            st = "call_log"
                        elif "contact" in app_name:
                            st = "contacts"
                        else:
                            st = "sms"
                        self.buffer.append({
                            "sourceType": st,
                            "data": rec
                        })
                        if len(self.buffer) >= self.batch_size:
                            batch = self.buffer.copy()
                            self.buffer.clear()
                            self._send_batch(batch)
                return
        except Exception as e:
            console.print(f"[yellow]Auto-decoder notice: {e}[/yellow]")

        # 2. General Artifact Fallback
        if hasattr(artifact, 'model_dump'):
            art_dict = artifact.model_dump(mode="json")
        elif hasattr(artifact, 'json'):
            art_dict = json.loads(artifact.json())
        elif hasattr(artifact, 'dict'):
            art_dict = artifact.dict()
        elif hasattr(artifact, '__dict__'):
            art_dict = artifact.__dict__
        else:
            art_dict = str(artifact)

        is_uploaded = False
        if hasattr(artifact, 'source_path') and artifact.source_path:
            p = Path(artifact.source_path)
            if p.exists() and p.is_file():
                is_textual = p.suffix.lower() in ['.csv', '.txt', '.json', '.log']
                is_small = p.stat().st_size < 10 * 1024 * 1024
                
                if is_textual and is_small:
                    try:
                        art_dict['content'] = p.read_text(encoding='utf-8', errors='replace')
                    except Exception as e:
                        console.print(f"[yellow]Failed to read content for {p}: {e}[/yellow]")
                else:
                    self._upload_file(p, art_dict)
                    is_uploaded = True
                    
        if is_uploaded:
            return

        source_type = 'unknown'
        if hasattr(artifact, 'app_name'):
            source_type = artifact.app_name.lower()
        elif hasattr(artifact, '__class__'):
            source_type = artifact.__class__.__name__.replace('Record', '').lower()
            
        with self.lock:
            self.buffer.append({
                "sourceType": source_type,
                "data": art_dict
            })
            if len(self.buffer) >= self.batch_size:
                batch = self.buffer.copy()
                self.buffer.clear()
                self._send_batch(batch)

    def _encrypt_bytes(self, plaintext_bytes: bytes) -> tuple[bytes, bytes, bytes]:
        """Encrypts bytes using AES-256-GCM with cryptography (or PyCryptodome fallback)."""
        import os
        iv = os.urandom(12)
        try:
            from cryptography.hazmat.primitives.ciphers.aead import AESGCM
            aesgcm = AESGCM(self.session_encryption_key)
            ct_with_tag = aesgcm.encrypt(iv, plaintext_bytes, None)
            return iv, ct_with_tag[:-16], ct_with_tag[-16:]
        except ImportError:
            from Crypto.Cipher import AES
            cipher = AES.new(self.session_encryption_key, AES.MODE_GCM, nonce=iv)
            ciphertext, tag = cipher.encrypt_and_digest(plaintext_bytes)
            return iv, ciphertext, tag

    def _encrypt_payload(self, payload_dict: dict) -> dict:
        if not self.session_encryption_key:
            return payload_dict

        plaintext = json.dumps(payload_dict).encode('utf-8')
        iv, ciphertext, tag = self._encrypt_bytes(plaintext)

        return {
            "iv": iv.hex(),
            "ciphertext": ciphertext.hex(),
            "tag": tag.hex()
        }

    def _upload_file(self, file_path: Path, art_dict: dict):
        url = f"{self.stream_url}/api/ingest/upload/case/{self.case_id}"
        headers = {"Authorization": f"Bearer {self.token}"}
        
        source_type = art_dict.get('app_name', '').lower()
        if not source_type:
            source_type = art_dict.get('artifact_type', 'upload').lower()
            
        data = {
            "deviceId": str(self.device_id),
            "sourceType": source_type
        }
        
        upload_path = file_path
        
        try:
            if self.session_encryption_key:
                enc_path = file_path.with_suffix(file_path.suffix + '.enc')
                raw_bytes = file_path.read_bytes()
                iv, ciphertext, tag = self._encrypt_bytes(raw_bytes)
                enc_path.write_bytes(ciphertext)
                
                data["iv"] = iv.hex()
                data["tag"] = tag.hex()
                data["encrypted"] = "true"
                upload_path = enc_path

            with open(upload_path, 'rb') as f:
                files = {'file': (file_path.name, f)}
                response = requests.post(url, headers=headers, data=data, files=files, timeout=300)
                response.raise_for_status()
                console.print(f"[dim]Uploaded file: {file_path.name}[/dim]")
                
        except requests.RequestException as e:
            status_code = getattr(e.response, "status_code", "Unknown") if hasattr(e, "response") else "Network Error"
            console.print(f"[yellow]Network error uploading file {file_path.name} (Status Code: {status_code}).[/yellow]")
        finally:
            if self.session_encryption_key and upload_path != file_path and upload_path.exists():
                upload_path.unlink()

    def _send_batch(self, batch):
        payload = {
            "deviceId": self.device_id,
            "artifacts": batch
        }
        
        encrypted_payload = self._encrypt_payload(payload)
        
        headers = {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}
        # Assumes stream_url is the base URL like http://localhost:8080
        url = f"{self.stream_url}/api/ingest/stream/case/{self.case_id}"
        
        try:
            response = requests.post(url, json=encrypted_payload, headers=headers, timeout=10)
            response.raise_for_status()
        except requests.RequestException as e:
            status_code = getattr(e.response, "status_code", "Unknown") if hasattr(e, "response") else "Network Error"
            error_details = ""
            if hasattr(e, "response") and e.response is not None:
                try:
                    error_details = f" - {e.response.text}"
                except Exception:
                    pass
            console.print(f"[yellow]Network error sending batch to backend (Status Code: {status_code}{error_details}). Queueing offline.[/yellow]")
            self._queue_offline(self.case_id, self.device_id, batch)

    def _queue_offline(self, case_id, device_id, batch):
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute('INSERT INTO offline_chunks (case_id, device_id, payload) VALUES (?, ?, ?)',
                             (case_id, device_id, json.dumps(batch)))
        except Exception as e:
            console.print(f"[red]Failed to queue offline: {e}[/red]")

    def _attempt_sync(self):
        """Attempts to sync any queued offline chunks to the backend"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('SELECT id, case_id, device_id, payload FROM offline_chunks ORDER BY id ASC LIMIT 10')
                rows = cursor.fetchall()
                
                if not rows:
                    return
                    
                console.print(f"[cyan]Found {len(rows)} offline chunks. Attempting to sync...[/cyan]")
                
                headers = {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}
                
                for row_id, case_id, device_id, payload_str in rows:
                    url = f"{self.stream_url}/api/ingest/stream/case/{case_id}"
                    payload = {
                        "deviceId": device_id,
                        "artifacts": json.loads(payload_str)
                    }
                    encrypted_payload = self._encrypt_payload(payload)
                    response = requests.post(url, json=encrypted_payload, headers=headers, timeout=10)
                    response.raise_for_status()
                    
                    # Delete successful row
                    conn.execute('DELETE FROM offline_chunks WHERE id = ?', (row_id,))
                    
                console.print("[green]Offline chunks synced successfully.[/green]")
        except Exception as e:
            status_code = getattr(getattr(e, "response", None), "status_code", "Unknown")
            error_details = ""
            if hasattr(e, "response") and e.response is not None:
                try:
                    error_details = f" - {e.response.text}"
                except Exception:
                    pass
            console.print(f"[yellow]Offline sync failed (Status Code: {status_code}{error_details}), will try again later.[/yellow]")

    def finalize(self):
        with self.lock:
            if self.buffer:
                self._send_batch(self.buffer)
                self.buffer.clear()
        self._attempt_sync()
