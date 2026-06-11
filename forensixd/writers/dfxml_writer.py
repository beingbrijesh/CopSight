from pathlib import Path
from typing import Union
from lxml import etree

from forensixd.core.models import SessionLog, Artifact
from forensixd.core.exceptions import WriteError

__all__ = ["DFXMLWriter"]

DFXML_NS = "http://www.forensicswiki.org/wiki/Category:Digital_Forensics_XML"


class DFXMLWriter:
    """
    Writes digital forensic artifacts to a Digital Forensics XML (DFXML) file.
    """

    def __init__(self, output_path: Union[str, Path], session: SessionLog) -> None:
        """
        Initialize the DFXMLWriter with an output path and session information.

        Args:
            output_path: The path where the DFXML file will be written.
            session: The forensic session log containing metadata.
        """
        self.output_path = Path(output_path)
        self.session = session

        # Build lxml root <dfxml version="1.2">
        self.root = etree.Element("dfxml", version="1.2", xmlns=DFXML_NS)

        # Add <metadata>
        metadata = etree.SubElement(self.root, "metadata")

        # Add <creator>
        creator = etree.SubElement(metadata, "creator")
        program = etree.SubElement(creator, "program")
        program.text = "forensixd"
        version = etree.SubElement(creator, "version")
        version.text = "0.1.0"

        if session.started_at:
            start_time = etree.SubElement(creator, "start_time")
            start_time.text = session.started_at.isoformat()

        # Add <case_info> with all case fields
        case_info = etree.SubElement(self.root, "case_info")
        try:
            case_data = session.case.model_dump(mode="json")
        except TypeError:
            case_data = session.case.model_dump()

        for key, value in case_data.items():
            if value is not None:
                if isinstance(value, dict):
                    child_elem = etree.SubElement(case_info, key)
                    for k, v in value.items():
                        if v is not None:
                            sub_elem = etree.SubElement(child_elem, k)
                            sub_elem.text = str(v)
                else:
                    child_elem = etree.SubElement(case_info, key)
                    child_elem.text = str(value)

    def append_artifact(self, artifact: Artifact) -> None:
        """
        Add a <fileobject> child for the given artifact.

        Args:
            artifact: The forensic artifact to add to the DFXML.
        """
        fileobject = etree.SubElement(self.root, "fileobject")

        filename = etree.SubElement(fileobject, "filename")
        filename.text = artifact.source_path

        if artifact.hashes:
            hash_md5 = etree.SubElement(fileobject, "hashdigest", alg="MD5")
            hash_md5.text = artifact.hashes.md5

            hash_sha256 = etree.SubElement(fileobject, "hashdigest", alg="SHA-256")
            hash_sha256.text = artifact.hashes.sha256

        mtime = etree.SubElement(fileobject, "mtime")
        if hasattr(artifact.acquired_at, "isoformat"):
            mtime.text = artifact.acquired_at.isoformat()
        else:
            mtime.text = str(artifact.acquired_at)

        source_app = etree.SubElement(fileobject, "source_app")
        source_app.text = artifact.source_app

        artifact_type = etree.SubElement(fileobject, "artifact_type")
        if hasattr(artifact.artifact_type, "value"):
            artifact_type.text = artifact.artifact_type.value
        else:
            artifact_type.text = str(artifact.artifact_type)

        artifact_id = etree.SubElement(fileobject, "artifact_id")
        artifact_id.text = artifact.artifact_id

    def finalize(self) -> Path:
        """
        Finalize and write the DFXML tree to the output path. Create parent dirs.

        Returns:
            The path where the DFXML file was written.

        Raises:
            WriteError: If writing to the file fails.
        """
        try:
            self.output_path.parent.mkdir(parents=True, exist_ok=True)
            tree_bytes = etree.tostring(
                self.root, pretty_print=True, xml_declaration=True, encoding="UTF-8"
            )
            self.output_path.write_bytes(tree_bytes)
            return self.output_path
        except Exception as e:
            raise WriteError(f"Failed to write DFXML to {self.output_path}: {e}") from e
