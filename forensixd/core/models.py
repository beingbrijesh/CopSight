"""
forensixd.core.models
~~~~~~~~~~~~~~~~~~~~~

Pydantic v2 data models for the forensixd acquisition and parsing pipeline.

All datetime fields are timezone-aware IST (Asia/Kolkata, UTC+05:30).  Naive
datetimes supplied to any field are automatically localised to IST; aware
datetimes from other zones are converted to IST.  Frozen models are immutable
after construction and are therefore safe to use as dict keys or in sets.

Model hierarchy
---------------
HashPair          – cryptographic digest pair (MD5 + SHA-256)
DeviceInfo        – physical device descriptor
CaseMetadata      – legal / jurisdictional wrapper around a DeviceInfo
Artifact          – a single acquired forensic artefact
AcquisitionEvent  – a single event in the chain-of-custody log
SessionLog        – top-level container for a full acquisition session
ParsedRecord      – a parsed, structured record extracted from an Artifact
"""

from datetime import datetime
from enum import Enum
from typing import Optional, Any
from uuid import uuid4
from zoneinfo import ZoneInfo

from pydantic import BaseModel, Field, field_validator, ConfigDict

# IST timezone singleton — reused by every validator.
_IST = ZoneInfo("Asia/Kolkata")


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------


class Platform(str, Enum):
    """Supported device / image platforms."""

    ANDROID = "ANDROID"
    IOS = "IOS"
    WINDOWS = "WINDOWS"
    MACOS = "MACOS"
    LINUX = "LINUX"
    DISK_IMAGE = "DISK_IMAGE"


class ExtractionLevel(str, Enum):
    """Granularity level of the forensic extraction."""

    LOGICAL = "LOGICAL"
    FILE_SYSTEM = "FILE_SYSTEM"
    PHYSICAL = "PHYSICAL"


class ArtifactType(str, Enum):
    """Category of a forensic artefact or parsed record."""

    MESSAGE = "MESSAGE"
    CALL_LOG = "CALL_LOG"
    CONTACT = "CONTACT"
    BROWSER_HISTORY = "BROWSER_HISTORY"
    EMAIL = "EMAIL"
    LOCATION = "LOCATION"
    MEDIA = "MEDIA"
    APP_DATA = "APP_DATA"
    SYSTEM_LOG = "SYSTEM_LOG"
    REGISTRY_KEY = "REGISTRY_KEY"


class ConsentType(str, Enum):
    """Legal basis under which the acquisition was authorised."""

    COURT_ORDER = "COURT_ORDER"
    VOLUNTARY = "VOLUNTARY"
    EMERGENCY = "EMERGENCY"


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------


class HashPair(BaseModel):
    """Cryptographic digest pair used to verify artefact integrity."""

    model_config = ConfigDict(frozen=True)

    md5: str = Field(description="MD5 hex digest of the artefact (32 hex characters).")
    sha256: str = Field(
        description="SHA-256 hex digest of the artefact (64 hex characters)."
    )

    @field_validator("md5")
    @classmethod
    def validate_md5_length(cls, v: str) -> str:
        """Reject digests that are not exactly 32 hex characters."""
        if len(v) != 32:
            raise ValueError(
                f"MD5 digest must be exactly 32 hex characters, got {len(v)}."
            )
        return v

    @field_validator("sha256")
    @classmethod
    def validate_sha256_length(cls, v: str) -> str:
        """Reject digests that are not exactly 64 hex characters."""
        if len(v) != 64:
            raise ValueError(
                f"SHA-256 digest must be exactly 64 hex characters, got {len(v)}."
            )
        return v


class DeviceInfo(BaseModel):
    """Physical device descriptor captured at acquisition time."""

    model_config = ConfigDict(frozen=True)

    platform: Platform = Field(description="Operating system / platform of the device.")
    device_id: str = Field(
        description="Unique identifier assigned to the device (e.g. IMEI, UUID, serial)."
    )
    model: Optional[str] = Field(
        default=None,
        description="Human-readable device model name (e.g. 'iPhone 14 Pro').",
    )
    os_version: Optional[str] = Field(
        default=None,
        description="Operating system version string reported by the device.",
    )
    serial: Optional[str] = Field(
        default=None,
        description="Manufacturer serial number of the device.",
    )
    is_rooted: bool = Field(
        default=False,
        description=(
            "True if the device was rooted / jailbroken at the time of acquisition."
        ),
    )


class CaseMetadata(BaseModel):
    """Legal and jurisdictional metadata that wraps a DeviceInfo."""

    model_config = ConfigDict(frozen=True)

    case_number: str = Field(
        description=(
            "Official case or docket number (whitespace is stripped; minimum 3 characters)."
        )
    )
    court_order_ref: str = Field(
        description="Reference identifier for the court order or legal authorisation."
    )
    examiner_id: str = Field(
        description="Unique identifier of the forensic examiner conducting the acquisition."
    )
    jurisdiction: str = Field(
        description="Jurisdiction (court, agency, or legal authority) governing this case."
    )
    consent_type: ConsentType = Field(
        description="Legal basis under which the device owner's consent was obtained."
    )
    authorized_at: datetime = Field(
        description="UTC timestamp at which the acquisition was formally authorised."
    )
    device: DeviceInfo = Field(
        description="Descriptor of the physical device being examined."
    )
    notes: Optional[str] = Field(
        default=None,
        description="Free-form notes recorded by the examiner about this case.",
    )

    @field_validator("case_number", mode="before")
    @classmethod
    def strip_and_validate_case_number(cls, v: Any) -> str:
        """Strip surrounding whitespace and enforce a minimum length of 3."""
        if not isinstance(v, str):
            raise ValueError("case_number must be a string.")
        stripped = v.strip()
        if len(stripped) < 3:
            raise ValueError(
                f"case_number must be at least 3 characters after stripping, got {len(stripped)!r}."
            )
        return stripped

    @field_validator("court_order_ref", "examiner_id", "jurisdiction", mode="before")
    @classmethod
    def strip_and_reject_empty(cls, v: Any, info: Any) -> str:
        """Strip whitespace and reject blank strings."""
        if not isinstance(v, str):
            raise ValueError(f"{info.field_name} must be a string.")
        stripped = v.strip()
        if not stripped:
            raise ValueError(f"{info.field_name} cannot be empty after stripping.")
        return stripped

    @field_validator("authorized_at", mode="before")
    @classmethod
    def ensure_authorized_at_ist(cls, v: Any) -> datetime:
        """Coerce naive datetimes to IST; convert aware datetimes to IST."""
        if isinstance(v, str):
            v = datetime.fromisoformat(v)
        if isinstance(v, datetime):
            if v.tzinfo is None:
                return v.replace(tzinfo=_IST)
            return v.astimezone(_IST)
        raise ValueError("authorized_at must be a datetime or ISO-8601 string.")


class Artifact(BaseModel):
    """A single forensic artefact acquired from the target device."""

    # NOT frozen — artefacts may be enriched after initial creation.

    artifact_id: str = Field(
        default_factory=lambda: str(uuid4()),
        description="Globally unique identifier for this artefact (UUID v4).",
    )
    artifact_type: ArtifactType = Field(
        description="Category that best describes the content of this artefact."
    )
    source_app: str = Field(
        description="Name of the application or subsystem that produced this artefact."
    )
    source_path: str = Field(
        description="Absolute path on the source device where the artefact was located."
    )
    acquired_at: datetime = Field(
        description="IST timestamp at which this artefact was extracted from the device."
    )
    hashes: HashPair = Field(
        description="MD5 and SHA-256 digests of the raw artefact bytes."
    )
    data: dict[str, Any] = Field(
        default_factory=dict,
        description="Arbitrary key-value payload attached to this artefact.",
    )
    device: DeviceInfo = Field(
        description="Descriptor of the device from which this artefact was acquired."
    )

    @field_validator("acquired_at", mode="before")
    @classmethod
    def ensure_acquired_at_ist(cls, v: Any) -> datetime:
        """Coerce naive datetimes to IST; convert aware datetimes to IST."""
        if isinstance(v, str):
            v = datetime.fromisoformat(v)
        if isinstance(v, datetime):
            if v.tzinfo is None:
                return v.replace(tzinfo=_IST)
            return v.astimezone(_IST)
        raise ValueError("acquired_at must be a datetime or ISO-8601 string.")


class AcquisitionEvent(BaseModel):
    """A single chain-of-custody event recorded during an acquisition session."""

    model_config = ConfigDict(frozen=True)

    event_id: str = Field(
        default_factory=lambda: str(uuid4()),
        description="Globally unique identifier for this event (UUID v4).",
    )
    event_type: str = Field(
        description="Short label describing the class of event (e.g. 'DEVICE_CONNECTED')."
    )
    occurred_at: datetime = Field(
        description="IST timestamp at which this event occurred."
    )
    actor: str = Field(
        description="Identifier of the examiner or automated system that triggered the event."
    )
    description: str = Field(
        description="Human-readable description of what occurred during this event."
    )
    metadata: dict[str, Any] = Field(
        default_factory=dict,
        description="Optional structured metadata providing additional context for the event.",
    )

    @field_validator("occurred_at", mode="before")
    @classmethod
    def ensure_occurred_at_ist(cls, v: Any) -> datetime:
        """Coerce naive datetimes to IST; convert aware datetimes to IST."""
        if isinstance(v, str):
            v = datetime.fromisoformat(v)
        if isinstance(v, datetime):
            if v.tzinfo is None:
                return v.replace(tzinfo=_IST)
            return v.astimezone(_IST)
        raise ValueError("occurred_at must be a datetime or ISO-8601 string.")


class SessionLog(BaseModel):
    """Top-level container for a complete forensic acquisition session."""

    # NOT frozen — sessions are populated incrementally during acquisition.

    session_id: str = Field(
        description="Unique identifier for this acquisition session."
    )
    case: CaseMetadata = Field(
        description="Legal and jurisdictional metadata associated with this session."
    )
    started_at: datetime = Field(
        description="IST timestamp at which the acquisition session began."
    )
    ended_at: Optional[datetime] = Field(
        default=None,
        description="IST timestamp at which the session was concluded, or None if ongoing.",
    )
    artifacts: list[Artifact] = Field(
        default_factory=list,
        description="Ordered list of artefacts acquired during this session.",
    )
    events: list[AcquisitionEvent] = Field(
        default_factory=list,
        description="Ordered chain-of-custody events recorded during this session.",
    )
    root_hash: Optional[str] = Field(
        default=None,
        description=(
            "Merkle root or combined hash of all artefact digests, set when the session "
            "is sealed."
        ),
    )
    is_sealed: bool = Field(
        default=False,
        description="True once the session has been finalised and no further changes are permitted.",
    )

    @field_validator("started_at", "ended_at", mode="before")
    @classmethod
    def ensure_session_timestamps_ist(cls, v: Any) -> Optional[datetime]:
        """Coerce naive datetimes to IST; convert aware datetimes to IST. Pass None through."""
        if v is None:
            return None
        if isinstance(v, str):
            v = datetime.fromisoformat(v)
        if isinstance(v, datetime):
            if v.tzinfo is None:
                return v.replace(tzinfo=_IST)
            return v.astimezone(_IST)
        raise ValueError("Timestamp fields must be datetime or ISO-8601 strings.")


class ParsedRecord(BaseModel):
    """A structured record parsed from a raw Artifact."""

    model_config = ConfigDict(frozen=True)

    record_id: str = Field(
        default_factory=lambda: str(uuid4()),
        description="Globally unique identifier for this parsed record (UUID v4).",
    )
    record_type: ArtifactType = Field(
        description="Category of the parsed record, matching the source artefact's type."
    )
    source_artifact_id: str = Field(
        description="artifact_id of the Artifact from which this record was parsed."
    )
    parsed_at: datetime = Field(
        description="IST timestamp at which the parsing operation produced this record."
    )
    confidence: float = Field(
        description=(
            "Parser confidence score in the range [0.0, 1.0].  "
            "1.0 indicates a fully deterministic parse; 0.0 indicates no confidence."
        )
    )
    fields: dict[str, Any] = Field(
        description="Structured key-value pairs extracted from the raw artefact."
    )
    app_name: str = Field(
        description="Name of the application or parser module that produced this record."
    )
    completeness_note: Optional[str] = Field(
        default=None,
        description=(
            "Optional note describing any fields that could not be recovered or were "
            "partially parsed."
        ),
    )

    @field_validator("parsed_at", mode="before")
    @classmethod
    def ensure_parsed_at_ist(cls, v: Any) -> datetime:
        """Coerce naive datetimes to IST; convert aware datetimes to IST."""
        if isinstance(v, str):
            v = datetime.fromisoformat(v)
        if isinstance(v, datetime):
            if v.tzinfo is None:
                return v.replace(tzinfo=_IST)
            return v.astimezone(_IST)
        raise ValueError("parsed_at must be a datetime or ISO-8601 string.")

    @field_validator("confidence")
    @classmethod
    def validate_confidence_range(cls, v: float) -> float:
        """Reject confidence values outside [0.0, 1.0]."""
        if not (0.0 <= v <= 1.0):
            raise ValueError(
                f"confidence must be in the range [0.0, 1.0], got {v}."
            )
        return v


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

__all__ = [
    # Enumerations
    "Platform",
    "ExtractionLevel",
    "ArtifactType",
    "ConsentType",
    # Models
    "HashPair",
    "DeviceInfo",
    "CaseMetadata",
    "Artifact",
    "AcquisitionEvent",
    "SessionLog",
    "ParsedRecord",
]
