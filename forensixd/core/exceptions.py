"""Custom exceptions for the forensixd forensic tool."""

from __future__ import annotations


class ForensixdError(Exception):
    """Base exception for all forensixd errors."""

    def __init__(self, message: str, context: dict | None = None) -> None:
        self.message: str = message
        self.context: dict | None = context
        super().__init__(message)

    def __str__(self) -> str:
        if self.context:
            return f"{self.message} | context={self.context}"
        return self.message


class DeviceNotFoundError(ForensixdError):
    """Raised when a target device cannot be located."""

    def __init__(self, message: str, context: dict | None = None) -> None:
        super().__init__(message, context)


class ExtractionError(ForensixdError):
    """Raised when a data extraction operation fails."""

    def __init__(self, message: str, context: dict | None = None) -> None:
        super().__init__(message, context)


class HashVerificationError(ForensixdError):
    """Raised when a hash integrity check fails."""

    def __init__(self, message: str, context: dict | None = None) -> None:
        super().__init__(message, context)


class SessionAlreadyClosedError(ForensixdError):
    """Raised when an operation is attempted on an already-closed session."""

    def __init__(self, message: str, context: dict | None = None) -> None:
        super().__init__(message, context)


class AuthorizationError(ForensixdError):
    """Raised when an action is not authorized or permitted."""

    def __init__(self, message: str, context: dict | None = None) -> None:
        super().__init__(message, context)


class ParseError(ForensixdError):
    """Raised when parsing of a file or data structure fails."""

    def __init__(self, message: str, context: dict | None = None) -> None:
        super().__init__(message, context)


class UnsupportedPlatformError(ForensixdError):
    """Raised when the current platform is not supported."""

    def __init__(self, message: str, context: dict | None = None) -> None:
        super().__init__(message, context)


class EncryptionError(ForensixdError):
    """Raised when an encryption or decryption operation fails."""

    def __init__(self, message: str, context: dict | None = None) -> None:
        super().__init__(message, context)


class CloudExtractionError(ForensixdError):
    """Raised when a cloud-based extraction operation fails."""

    def __init__(self, message: str, context: dict | None = None) -> None:
        super().__init__(message, context)


class WriteError(ForensixdError):
    """Raised when writing data to disk or output destination fails."""

    def __init__(self, message: str, context: dict | None = None) -> None:
        super().__init__(message, context)


__all__ = [
    "ForensixdError",
    "DeviceNotFoundError",
    "ExtractionError",
    "HashVerificationError",
    "SessionAlreadyClosedError",
    "AuthorizationError",
    "ParseError",
    "UnsupportedPlatformError",
    "EncryptionError",
    "CloudExtractionError",
    "WriteError",
]
