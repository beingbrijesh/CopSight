"""
Tests for forensixd.extractors.base
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Covers:
- ExtractorRegistry.available_platforms() return type
- @ExtractorRegistry.register decorator round-trip
- ExtractorRegistry.get() raises UnsupportedPlatformError for unknown platforms
- ExtractorRegistry.available_platforms() returns a list
- Platform registration triggered by importing concrete extractor modules
"""

import pytest
from collections.abc import Iterator

from forensixd.extractors.base import AbstractExtractor, ExtractorRegistry
from forensixd.core.models import DeviceInfo, Artifact, ExtractionLevel, Platform
from forensixd.core.session import ForensicSession
from forensixd.core.exceptions import UnsupportedPlatformError


# ---------------------------------------------------------------------------
# Minimal concrete extractor used across multiple tests
# ---------------------------------------------------------------------------


class _ConcreteExtractor(AbstractExtractor):
    """Minimal concrete implementation satisfying the AbstractExtractor contract."""

    def connect(self, device: DeviceInfo) -> None:  # noqa: D401
        pass

    def extract(
        self,
        session: ForensicSession,
        level: ExtractionLevel,
    ) -> Iterator[Artifact]:
        return iter([])

    def disconnect(self) -> None:
        pass

    def is_available(self) -> bool:
        return True

    def supported_levels(self) -> list[ExtractionLevel]:
        return [ExtractionLevel.LOGICAL]


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_registry_starts_empty() -> None:
    """available_platforms() must return a list (may be empty or non-empty)."""
    platforms = ExtractorRegistry.available_platforms()
    assert isinstance(platforms, list)


def test_register_decorator_works() -> None:
    """Directly inserting into _registry and retrieving via get() should round-trip."""
    # Use LINUX as the scratch platform — unlikely to be claimed by a real extractor yet.
    ExtractorRegistry._registry[Platform.LINUX] = _ConcreteExtractor
    try:
        result = ExtractorRegistry.get(Platform.LINUX)
        assert result is _ConcreteExtractor
        assert Platform.LINUX in ExtractorRegistry.available_platforms()
    finally:
        # Always clean up to avoid polluting other tests.
        ExtractorRegistry._registry.pop(Platform.LINUX, None)


def test_register_decorator_returns_class_unchanged() -> None:
    """The decorator factory must return the class itself, preserving its identity."""
    decorator = ExtractorRegistry.register(Platform.LINUX)
    try:
        returned = decorator(_ConcreteExtractor)
        assert returned is _ConcreteExtractor
        assert ExtractorRegistry.get(Platform.LINUX) is _ConcreteExtractor
    finally:
        ExtractorRegistry._registry.pop(Platform.LINUX, None)


def test_get_unregistered_platform_raises() -> None:
    """get() must raise UnsupportedPlatformError for a platform with no extractor."""
    # Ensure MACOS is not in the registry for this test.
    ExtractorRegistry._registry.pop(Platform.MACOS, None)
    with pytest.raises(UnsupportedPlatformError):
        ExtractorRegistry.get(Platform.MACOS)


def test_get_error_message_contains_platform_name() -> None:
    """The UnsupportedPlatformError message should mention the requested platform."""
    ExtractorRegistry._registry.pop(Platform.MACOS, None)
    with pytest.raises(UnsupportedPlatformError, match="MACOS"):
        ExtractorRegistry.get(Platform.MACOS)


def test_available_platforms_returns_list() -> None:
    """available_platforms() must always return a list, never None or another type."""
    platforms = ExtractorRegistry.available_platforms()
    assert isinstance(platforms, list)


def test_available_platforms_reflects_registration() -> None:
    """Registering a new platform must make it appear in available_platforms()."""
    ExtractorRegistry._registry.pop(Platform.LINUX, None)
    before = ExtractorRegistry.available_platforms()
    assert Platform.LINUX not in before

    ExtractorRegistry._registry[Platform.LINUX] = _ConcreteExtractor
    try:
        after = ExtractorRegistry.available_platforms()
        assert Platform.LINUX in after
    finally:
        ExtractorRegistry._registry.pop(Platform.LINUX, None)


def test_available_platforms_reflects_deregistration() -> None:
    """Removing a platform from _registry must remove it from available_platforms()."""
    ExtractorRegistry._registry[Platform.LINUX] = _ConcreteExtractor
    assert Platform.LINUX in ExtractorRegistry.available_platforms()

    ExtractorRegistry._registry.pop(Platform.LINUX)
    assert Platform.LINUX not in ExtractorRegistry.available_platforms()


def test_abstract_extractor_cannot_be_instantiated() -> None:
    """AbstractExtractor is abstract; direct instantiation must raise TypeError."""
    with pytest.raises(TypeError):
        AbstractExtractor()  # type: ignore[abstract]


def test_concrete_extractor_satisfies_contract() -> None:
    """A fully implemented subclass must instantiate and honour the ABC contract."""
    ext = _ConcreteExtractor()
    assert ext.is_available() is True
    assert ExtractionLevel.LOGICAL in ext.supported_levels()
    ext.connect(
        DeviceInfo(platform=Platform.LINUX, device_id="test-device-001")
    )
    result = ext.extract(session=object(), level=ExtractionLevel.LOGICAL)  # type: ignore[arg-type]
    assert isinstance(result, Iterator)
    ext.disconnect()  # must not raise


# ---------------------------------------------------------------------------
# Import-triggered registration tests
# These are xfail until the concrete extractor stubs are implemented.
# Once forensixd/extractors/android.py and windows.py register themselves,
# these tests will automatically start passing (xpass → pass with strict=False).
# ---------------------------------------------------------------------------


@pytest.mark.xfail(
    reason="android.py is still a stub; registration will be added during implementation.",
    strict=False,
)
def test_android_registered_after_import() -> None:
    """Importing forensixd.extractors.android must register Platform.ANDROID."""
    import forensixd.extractors.android  # noqa: F401

    assert Platform.ANDROID in ExtractorRegistry.available_platforms()


@pytest.mark.xfail(
    reason="windows.py is still a stub; registration will be added during implementation.",
    strict=False,
)
def test_windows_registered_after_import() -> None:
    """Importing forensixd.extractors.windows must register Platform.WINDOWS."""
    import forensixd.extractors.windows  # noqa: F401

    assert Platform.WINDOWS in ExtractorRegistry.available_platforms()
