import zipfile
from pathlib import Path
from typing import Union, List

from lxml import etree

from forensixd.core.models import SessionLog, Artifact
from forensixd.core.exceptions import WriteError

__all__ = ["UFDRWriter"]


class UFDRWriter:
    """
    Writes digital forensic artifacts to a CopSight AI (Universal Forensic Device Report) archive.
    """

    def __init__(self, output_path: Union[str, Path], session: SessionLog) -> None:
        """
        Initialize the UFDRWriter.

        Args:
            output_path: The path where the CopSight AI archive will be created.
            session: The forensic session log containing case and device metadata.
        """
        self.output_path = Path(output_path)
        if self.output_path.suffix.lower() != ".ufdr":
            self.output_path = self.output_path.with_name(self.output_path.name + ".ufdr")
        self.session = session

    def build(self, artifacts: List[Artifact]) -> Path:
        """
        Build the CopSight AI archive containing the report, index, and artifact files.

        Args:
            artifacts: The list of artifacts to include in the CopSight AI archive.

        Returns:
            The path to the generated CopSight AI archive.

        Raises:
            WriteError: If the archive cannot be created.
        """
        try:
            self.output_path.parent.mkdir(parents=True, exist_ok=True)
            with zipfile.ZipFile(self.output_path, "w", zipfile.ZIP_DEFLATED) as zf:
                self._write_report_xml(zf, artifacts)
                self._write_index_xml(zf, artifacts)
                self._write_artifact_files(zf, artifacts)
            return self.output_path
        except Exception as e:
            raise WriteError(f"Failed to build CopSight AI archive at {self.output_path}: {e}") from e

    def _write_report_xml(self, zf: zipfile.ZipFile, artifacts: List[Artifact]) -> None:
        """
        Write the report.xml file to the CopSight AI archive.

        Args:
            zf: The open zipfile object.
            artifacts: The list of artifacts.
        """
        from forensixd.parsers.base import ParserRegistry

        root = etree.Element("CopSight AI")
        
        device = etree.SubElement(root, "device")

        # DeviceInfo
        device_info = etree.SubElement(device, "deviceInfo")
        if self.session.case and self.session.case.device:
            dev = self.session.case.device
            platform = etree.SubElement(device_info, "Platform")
            platform.text = dev.platform.value if dev.platform else ""
            device_id = etree.SubElement(device_info, "DeviceId")
            device_id.text = dev.device_id or ""
            model = etree.SubElement(device_info, "Model")
            model.text = dev.model or ""

        # CaseInfo
        case_info = etree.SubElement(device, "caseInfo")
        if self.session.case:
            case = self.session.case
            case_number = etree.SubElement(case_info, "CaseNumber")
            case_number.text = case.case_number or ""
            court_order_ref = etree.SubElement(case_info, "CourtOrderRef")
            court_order_ref.text = case.court_order_ref or ""
            examiner_id = etree.SubElement(case_info, "ExaminerId")
            examiner_id.text = case.examiner_id or ""
            
        acquisition_time = etree.SubElement(case_info, "AcquisitionTime")
        if self.session.started_at:
            acquisition_time.text = self.session.started_at.isoformat()

        # Statistics
        statistics = etree.SubElement(device, "statistics")
        session_hash = etree.SubElement(statistics, "SessionHash")
        session_hash.text = self.session.root_hash or ""

        # Communications
        communications = etree.SubElement(device, "communications")
        sms_messages = etree.SubElement(communications, "smsMessages")
        call_logs = etree.SubElement(communications, "callLogs")
        
        for artifact in artifacts:
            parsers = ParserRegistry.get_parsers_for(artifact)
            for parser in parsers:
                try:
                    records = parser.parse(artifact)
                    for rec in records:
                        if rec.record_type.value == "message":
                            msg_el = etree.SubElement(sms_messages, "message")
                            etree.SubElement(msg_el, "id").text = str(id(rec))
                            etree.SubElement(msg_el, "direction").text = "outgoing" if rec.fields.get("is_from_me") else "incoming"
                            etree.SubElement(msg_el, "phoneNumber").text = str(rec.fields.get("from") or "")
                            etree.SubElement(msg_el, "content").text = str(rec.fields.get("body") or "")
                            etree.SubElement(msg_el, "timestamp").text = str(rec.fields.get("timestamp") or "")
                            etree.SubElement(msg_el, "type").text = rec.app_name
                        elif rec.record_type.value == "call_log":
                            call_el = etree.SubElement(call_logs, "call")
                            etree.SubElement(call_el, "id").text = str(id(rec))
                            etree.SubElement(call_el, "direction").text = str(rec.fields.get("direction") or "")
                            etree.SubElement(call_el, "phoneNumber").text = str(rec.fields.get("number") or "")
                            etree.SubElement(call_el, "duration").text = str(rec.fields.get("duration") or "0")
                            etree.SubElement(call_el, "timestamp").text = str(rec.fields.get("timestamp") or "")
                except Exception:
                    # Silently ignore parsing errors during CopSight AI generation
                    pass

        tree_bytes = etree.tostring(root, pretty_print=True, xml_declaration=True, encoding="UTF-8")
        zf.writestr("report.xml", tree_bytes)

    def _write_index_xml(self, zf: zipfile.ZipFile, artifacts: List[Artifact]) -> None:
        """
        Write the index.xml file to the CopSight AI archive.

        Args:
            zf: The open zipfile object.
            artifacts: The list of artifacts.
        """
        root = etree.Element("ArtifactIndex", count=str(len(artifacts)))

        for artifact in artifacts:
            art_elem = etree.SubElement(
                root, 
                "Artifact", 
                id=artifact.artifact_id, 
                type=artifact.artifact_type.value if artifact.artifact_type else "", 
                app=artifact.source_app or ""
            )

            path = etree.SubElement(art_elem, "Path")
            path.text = artifact.source_path

            if artifact.hashes:
                md5 = etree.SubElement(art_elem, "MD5")
                md5.text = artifact.hashes.md5
                sha256 = etree.SubElement(art_elem, "SHA256")
                sha256.text = artifact.hashes.sha256

            acquired_at = etree.SubElement(art_elem, "AcquiredAt")
            if hasattr(artifact.acquired_at, "isoformat"):
                acquired_at.text = artifact.acquired_at.isoformat()
            else:
                acquired_at.text = str(artifact.acquired_at)

        tree_bytes = etree.tostring(root, pretty_print=True, xml_declaration=True, encoding="UTF-8")
        zf.writestr("index.xml", tree_bytes)

    def _write_artifact_files(self, zf: zipfile.ZipFile, artifacts: List[Artifact]) -> None:
        """
        Write the actual artifact files to the CopSight AI archive.

        Args:
            zf: The open zipfile object.
            artifacts: The list of artifacts.
        """
        for artifact in artifacts:
            source = Path(artifact.source_path)
            if source.exists() and source.is_file():
                filename = source.name
                archive_path = f"Files/{artifact.artifact_id}/{filename}"
                zf.write(source, archive_path)
