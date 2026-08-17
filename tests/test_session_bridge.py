import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch, MagicMock
from forensixd.core.models import DeviceInfo, Platform, Artifact, ArtifactType, HashPair
from apps.macos.daemon.session_bridge import AcquisitionBridge

class TestAcquisitionBridge(unittest.TestCase):
    def test_bridge_session_execution(self):
        events = []
        def event_cb(evt):
            events.append(evt)

        bridge = AcquisitionBridge(event_callback=event_cb)

        dev = DeviceInfo(platform=Platform.ANDROID, device_id="V47HTC6DPZVGSOIB", model="POCO M4 Pro")
        
        with patch("forensixd.core.device_detector.DeviceDetector.scan", return_value=[dev]):
            with patch("forensixd.extractors.android.AndroidExtractor.is_available", return_value=True):
                with patch("forensixd.extractors.android.AndroidExtractor.connect"):
                    sample_artifact = Artifact(
                        artifact_id="art-test-1",
                        artifact_type=ArtifactType.MESSAGE,
                        source_app="SMS",
                        source_path="/tmp/test_msg.db",
                        acquired_at=datetime.utcnow(),
                        hashes=HashPair(md5="d41d8cd98f00b204e9800998ecf8427e", sha256="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
                        device=dev
                    )
                    with patch("forensixd.extractors.android.AndroidExtractor.extract", return_value=[sample_artifact]):
                        with patch("forensixd.extractors.android.AndroidExtractor.disconnect"):
                            case_info = {
                                "id": 1,
                                "caseNumber": "Demo-Case-001",
                                "title": "Suspect Extraction",
                                "officerName": "Inspector Sharma",
                            }
                            
                            out_dir = "dist/test_cases"
                            bridge._run_session_sync(
                                case_info=case_info,
                                device_id="V47HTC6DPZVGSOIB",
                                extraction_level="logical",
                                profile="textual",
                                output_dir=out_dir,
                                auth_token=None,
                                session_encryption_key=None,
                                stream_url=None
                            )

        event_types = [e["type"] for e in events]
        for e in events:
            if e["type"] == "ACQUISITION_ERROR":
                print("Captured Acquisition Error:", e)
        self.assertIn("SESSION_STARTED", event_types)
        self.assertIn("ARTIFACT_EXTRACTED", event_types)
        self.assertIn("ACQUISITION_COMPLETED", event_types)
        self.assertNotIn("ACQUISITION_ERROR", event_types)

if __name__ == "__main__":
    unittest.main()
