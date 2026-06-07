"""
forensixd.legal.authorization
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Interactive and file-based authorization management for forensic acquisitions.
"""

from datetime import datetime, timezone
from pathlib import Path

from rich.console import Console
from rich.prompt import Prompt, Confirm
from rich.table import Table
from rich.panel import Panel

from forensixd.core.models import CaseMetadata, DeviceInfo, ConsentType
from forensixd.core.exceptions import AuthorizationError

console = Console()

class AuthorizationManager:
    """Manages legal authorization workflows for forensic acquisitions."""

    @staticmethod
    def capture_interactively(device: DeviceInfo) -> CaseMetadata:
        """
        Capture authorization details interactively from the examiner.
        
        Args:
            device (DeviceInfo): The target device being authorized.
            
        Returns:
            CaseMetadata: The populated legal metadata.
            
        Raises:
            AuthorizationError: If any required field is empty or authorization is declined.
        """
        console.print(Panel("FORENSIXD — LEGAL AUTHORIZATION REQUIRED"))
        
        case_number = Prompt.ask("Case Number").strip()
        court_order_ref = Prompt.ask("Court Order Reference").strip()
        examiner_id = Prompt.ask("Examiner ID").strip()
        jurisdiction = Prompt.ask("Jurisdiction").strip()
        
        if not all([case_number, court_order_ref, examiner_id, jurisdiction]):
            raise AuthorizationError("All fields must be provided and cannot be empty.")
            
        console.print("\nConsent Types:")
        console.print("1 = COURT_ORDER")
        console.print("2 = VOLUNTARY")
        console.print("3 = EMERGENCY")
        
        consent_choice = Prompt.ask("Select Consent Type", choices=["1", "2", "3"])
        
        consent_map = {
            "1": ConsentType.COURT_ORDER,
            "2": ConsentType.VOLUNTARY,
            "3": ConsentType.EMERGENCY,
        }
        consent_type = consent_map[consent_choice]
        
        table = Table(title="Authorization Summary")
        table.add_column("Field")
        table.add_column("Value")
        
        table.add_row("Case Number", case_number)
        table.add_row("Court Order Ref", court_order_ref)
        table.add_row("Examiner ID", examiner_id)
        table.add_row("Jurisdiction", jurisdiction)
        table.add_row("Consent Type", consent_type.value)
        table.add_row("Device Platform", device.platform.value)
        table.add_row("Device ID", device.device_id)
        
        console.print(table)
        
        if not Confirm.ask("Confirm and proceed?"):
            raise AuthorizationError("Declined by examiner.")
            
        return CaseMetadata(
            case_number=case_number,
            court_order_ref=court_order_ref,
            examiner_id=examiner_id,
            jurisdiction=jurisdiction,
            consent_type=consent_type,
            authorized_at=datetime.now(timezone.utc),
            device=device,
        )

    @staticmethod
    def from_yaml(auth_file: Path) -> CaseMetadata:
        """
        Load authorization details from a YAML file.
        
        Args:
            auth_file (Path): Path to the YAML file.
            
        Returns:
            CaseMetadata: The populated legal metadata.
            
        Raises:
            AuthorizationError: If the file is missing, empty, or fields are invalid.
        """
        import yaml  # type: ignore
        
        if not auth_file.exists():
            raise AuthorizationError(f"Authorization file not found: {auth_file}")
            
        try:
            with open(auth_file, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)
        except Exception as e:
            raise AuthorizationError(f"Failed to load YAML file: {e}")
            
        if not data or not isinstance(data, dict):
            raise AuthorizationError("Authorization file is empty or invalid format.")
            
        required_fields = ["case_number", "court_order_ref", "examiner_id", "jurisdiction", "consent_type", "device"]
        
        for field in required_fields:
            val = data.get(field)
            if not val:
                raise AuthorizationError(f"Missing or empty required field: {field}")
            if isinstance(val, str) and not val.strip():
                raise AuthorizationError(f"Required field cannot be empty whitespace: {field}")
                
        device_data = data["device"]
        if not isinstance(device_data, dict):
            raise AuthorizationError("Device field must be a dictionary.")
            
        try:
            device = DeviceInfo(**device_data)
        except Exception as e:
            raise AuthorizationError(f"Invalid device information: {e}")
            
        try:
            consent_type = ConsentType(data["consent_type"])
        except ValueError:
            raise AuthorizationError(f"Invalid consent type: {data['consent_type']}")
            
        try:
            return CaseMetadata(
                case_number=str(data["case_number"]).strip(),
                court_order_ref=str(data["court_order_ref"]).strip(),
                examiner_id=str(data["examiner_id"]).strip(),
                jurisdiction=str(data["jurisdiction"]).strip(),
                consent_type=consent_type,
                authorized_at=data.get("authorized_at", datetime.now(timezone.utc)),
                device=device,
                notes=data.get("notes")
            )
        except Exception as e:
            raise AuthorizationError(f"Failed to build CaseMetadata: {e}")

__all__ = ["AuthorizationManager"]
