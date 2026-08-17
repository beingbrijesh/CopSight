import unittest
from pathlib import Path
from datetime import datetime
from forensixd.core.models import Artifact, ArtifactType, HashPair, DeviceInfo, Platform
from forensixd.parsers.auto_decoder import ForensicAutoDecoder

class TestForensicAutoDecoder(unittest.TestCase):
    def setUp(self):
        self.dev = DeviceInfo(platform=Platform.ANDROID, device_id="V47HTC6DPZVGSOIB", model="POCO M4 Pro")
        self.hashes = HashPair(md5="d41d8cd98f00b204e9800998ecf8427e", sha256="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")

    def test_sms_decoding(self):
        sms_path = Path("cases/Demo/adb_pull/sms.csv")
        if not sms_path.exists():
            self.skipTest("sms.csv not found")
        artifact = Artifact(
            artifact_id="art-sms-1",
            artifact_type=ArtifactType.MESSAGE,
            source_app="adb_content_provider",
            source_path=str(sms_path),
            acquired_at=datetime.utcnow(),
            hashes=self.hashes,
            device=self.dev
        )
        records = ForensicAutoDecoder.decode_and_extract_records(artifact)
        self.assertGreater(len(records), 1000)
        self.assertEqual(records[0]["app"], "SMS")
        self.assertIn("message", records[0])
        self.assertIn("sender", records[0])

    def test_call_logs_decoding(self):
        call_path = Path("cases/Demo/adb_pull/call_logs.csv")
        if not call_path.exists():
            self.skipTest("call_logs.csv not found")
        artifact = Artifact(
            artifact_id="art-call-1",
            artifact_type=ArtifactType.CALL_LOG,
            source_app="adb_content_provider",
            source_path=str(call_path),
            acquired_at=datetime.utcnow(),
            hashes=self.hashes,
            device=self.dev
        )
        records = ForensicAutoDecoder.decode_and_extract_records(artifact)
        self.assertGreater(len(records), 100)
        self.assertEqual(records[0]["app"], "Phone")
        self.assertIn("caller", records[0])

    def test_contacts_decoding(self):
        contact_path = Path("cases/Demo/adb_pull/contacts.csv")
        if not contact_path.exists():
            self.skipTest("contacts.csv not found")
        artifact = Artifact(
            artifact_id="art-contact-1",
            artifact_type=ArtifactType.CONTACT,
            source_app="adb_content_provider",
            source_path=str(contact_path),
            acquired_at=datetime.utcnow(),
            hashes=self.hashes,
            device=self.dev
        )
        records = ForensicAutoDecoder.decode_and_extract_records(artifact)
        self.assertGreater(len(records), 10)
        self.assertEqual(records[0]["app"], "Contacts")
        self.assertIn("name", records[0])

if __name__ == "__main__":
    unittest.main()
