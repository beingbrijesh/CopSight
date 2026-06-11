import sqlite3
import json
import time
import requests  # type: ignore
from threading import Lock
from pathlib import Path
from rich.console import Console

console = Console()

class ApiStreamWriter:
    def __init__(self, stream_url: str, token: str, case_id: int, device_id: int, batch_size: int = 50):
        self.stream_url = stream_url.rstrip('/')
        if not self.stream_url.endswith('/api'):
            # It's better to expect base_url
            pass
            
        self.token = token
        self.case_id = case_id
        self.device_id = device_id
        self.batch_size = batch_size
        self.buffer = []
        self.lock = Lock()
        
        # Setup offline queue DB
        self.db_path = Path.home() / ".forensixd" / "offline_queue.db"
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()
        self._attempt_sync()

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
        # Convert artifact to dict safely
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
            
        # Attach content if it's a small text file
        if hasattr(artifact, 'source_path') and artifact.source_path:
            p = Path(artifact.source_path)
            if p.exists() and p.is_file():
                if p.suffix.lower() in ['.csv', '.txt', '.json', '.log']:
                    try:
                        # Limit to 10MB to avoid blowing up memory
                        if p.stat().st_size < 10 * 1024 * 1024:
                            art_dict['content'] = p.read_text(encoding='utf-8', errors='replace')
                    except Exception as e:
                        console.print(f"[yellow]Failed to read content for {p}: {e}[/yellow]")

        # Add source_type mapping
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

    def _send_batch(self, batch):
        payload = {
            "deviceId": self.device_id,
            "artifacts": batch
        }
        
        headers = {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}
        # Assumes stream_url is the base URL like http://localhost:8080
        url = f"{self.stream_url}/api/ingest/stream/case/{self.case_id}"
        
        try:
            response = requests.post(url, json=payload, headers=headers, timeout=10)
            response.raise_for_status()
        except requests.RequestException as e:
            console.print(f"[yellow]Network error sending batch to backend. Queueing offline. ({e})[/yellow]")
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
                    response = requests.post(url, json=payload, headers=headers, timeout=10)
                    response.raise_for_status()
                    
                    # Delete successful row
                    conn.execute('DELETE FROM offline_chunks WHERE id = ?', (row_id,))
                    
                console.print("[green]Offline chunks synced successfully.[/green]")
        except Exception as e:
            console.print(f"[yellow]Offline sync failed, will try again later. ({e})[/yellow]")

    def finalize(self):
        with self.lock:
            if self.buffer:
                self._send_batch(self.buffer)
                self.buffer.clear()
        self._attempt_sync()
