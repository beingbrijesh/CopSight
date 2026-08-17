import unittest
import os
import json
from pathlib import Path
from unittest.mock import patch, MagicMock
from forensixd.writers.api_stream_writer import ApiStreamWriter
from forensixd.core.models import Artifact, ArtifactType, HashPair, DeviceInfo, Platform
from datetime import datetime

class TestApiStreamWriter(unittest.TestCase):
    def test_encryption_and_buffering(self):
        key_hex = os.urandom(32).hex()
        writer = ApiStreamWriter(
            stream_url="https://copsight.onrender.com",
            token="test-jwt-token",
            session_encryption_key=key_hex,
            case_id=101,
            device_id=202,
            batch_size=5
        )

        dev = DeviceInfo(platform=Platform.ANDROID, device_id="V47HTC6DPZVGSOIB", model="POCO M4 Pro")
        artifact = Artifact(
            artifact_id="art-test-stream-1",
            artifact_type=ArtifactType.MESSAGE,
            source_app="WhatsApp",
            source_path="/tmp/msgstore.db",
            acquired_at=datetime.utcnow(),
            hashes=HashPair(md5="d41d8cd98f00b204e9800998ecf8427e", sha256="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
            data={"test": "data"},
            device=dev
        )

        with patch.object(writer, "_send_batch") as mock_send:
            for i in range(6):
                # Unique sha256 for each
                art_copy = Artifact(
                    artifact_id=f"art-{i}",
                    artifact_type=ArtifactType.MESSAGE,
                    source_app="SMS",
                    source_path=f"/tmp/msg_{i}.db",
                    acquired_at=datetime.utcnow(),
                    hashes=HashPair(md5=f"{i:032x}", sha256=f"{i:064x}"),
                    device=dev
                )
                writer.append_artifact(art_copy)

            self.assertTrue(mock_send.called)

        # Test encrypt payload
        payload = {"sample": "evidence", "count": 42}
        encrypted = writer._encrypt_payload(payload)
        self.assertIn("iv", encrypted)
        self.assertIn("ciphertext", encrypted)
        self.assertIn("tag", encrypted)

if __name__ == "__main__":
    unittest.main()
