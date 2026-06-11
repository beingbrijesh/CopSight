"""
forensixd.extractors.base
~~~~~~~~~~~~~~~~~~~~~~~~~

Abstract base class and registry for platform-specific forensic extractors.

:class:`AbstractExtractor` defines the contract every extractor must fulfil:
connect to a device, yield :class:`~forensixd.core.models.Artifact` objects
during an extraction pass, and disconnect cleanly.

:class:`ExtractorRegistry` is a class-level mapping from
:class:`~forensixd.core.models.Platform` values to concrete
:class:`AbstractExtractor` subclasses.  Extractors register themselves via the
:meth:`ExtractorRegistry.register` decorator factory, keeping the registry
decoupled from any individual extractor module.

Usage
-----
Register a concrete extractor::

    from forensixd.core.models import Platform
    from forensixd.extractors.base import ExtractorRegistry, AbstractExtractor

    @ExtractorRegistry.register(Platform.ANDROID)
    class AndroidExtractor(AbstractExtractor):
        ...

Retrieve and instantiate it::

    extractor_cls = ExtractorRegistry.get(Platform.ANDROID)
    extractor = extractor_cls()
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Iterator
from typing import Callable

from forensixd.core.models import DeviceInfo, Artifact, ExtractionLevel, Platform
from forensixd.core.session import ForensicSession
from forensixd.core.exceptions import UnsupportedPlatformError

__all__ = ["AbstractExtractor", "ExtractorRegistry"]


# ---------------------------------------------------------------------------
# Abstract base extractor
# ---------------------------------------------------------------------------


class AbstractExtractor(ABC):
    """Contract that every platform-specific extractor must satisfy.

    Sub-classes are responsible for implementing a complete acquisition
    workflow: establishing a transport-layer connection to the target device,
    iterating over the requested artefacts, and cleanly terminating the
    connection regardless of any errors encountered during extraction.

    All concrete implementations should be registered with
    :class:`ExtractorRegistry` via its :meth:`~ExtractorRegistry.register`
    decorator so that higher-level orchestration code can obtain them by
    :class:`~forensixd.core.models.Platform` without importing individual
    extractor modules directly.
    """

    @abstractmethod
    def connect(self, device: DeviceInfo) -> None:
        """Establish a connection to *device*.

        This method must be called before :meth:`extract`.  Implementations
        are responsible for acquiring any transport-layer resources (USB
        handles, ADB sockets, TCP sessions, …) needed by the extractor.

        Parameters
        ----------
        device:
            Descriptor of the physical device to connect to.

        Raises
        ------
        forensixd.core.exceptions.DeviceNotFoundError
            If the device cannot be located or a connection cannot be
            established.
        """
        ...

    @abstractmethod
    def extract(
        self,
        session: ForensicSession,
        level: ExtractionLevel,
    ) -> Iterator[Artifact]:
        """Yield artefacts from the connected device at the requested *level*.

        Implementations must call :meth:`session.register_artifact` for every
        artefact they yield so that the session's audit log is kept consistent.
        The caller is responsible for exhausting the iterator; failing to do so
        may leave device resources open.

        Parameters
        ----------
        session:
            The active :class:`~forensixd.core.session.ForensicSession` that
            will receive the acquired artefacts.
        level:
            Granularity of the extraction (``LOGICAL``, ``FILE_SYSTEM``, or
            ``PHYSICAL``).

        Yields
        ------
        Artifact
            Each artefact produced during the extraction pass.

        Raises
        ------
        forensixd.core.exceptions.ExtractionError
            If a non-recoverable error occurs during extraction.
        NotImplementedError
            If *level* is not supported by this extractor; check
            :meth:`supported_levels` first.
        """
        ...

    @abstractmethod
    def disconnect(self) -> None:
        """Release all transport-layer resources acquired during :meth:`connect`.

        This method must be safe to call even if :meth:`connect` was never
        called or if it raised an exception.  It is typically invoked inside a
        ``finally`` block to guarantee clean-up.
        """
        ...

    @abstractmethod
    def is_available(self) -> bool:
        """Return ``True`` if this extractor can run in the current environment.

        Implementations should verify that all required system-level
        dependencies (native libraries, daemons, drivers, …) are present and
        operational before returning ``True``.

        Returns
        -------
        bool
            ``True`` when the extractor is fully operational, ``False``
            otherwise.
        """
        ...

    @abstractmethod
    def supported_levels(self) -> list[ExtractionLevel]:
        """Return the extraction levels supported by this extractor.

        The caller should check the returned list before passing a
        :class:`~forensixd.core.models.ExtractionLevel` to :meth:`extract`
        to avoid a ``NotImplementedError``.

        Returns
        -------
        list[ExtractionLevel]
            An ordered list of the :class:`~forensixd.core.models.ExtractionLevel`
            values this extractor can satisfy.  The list must never be empty
            for a fully functional extractor.
        """
        ...


# ---------------------------------------------------------------------------
# Extractor registry
# ---------------------------------------------------------------------------


class ExtractorRegistry:
    """Class-level mapping from :class:`~forensixd.core.models.Platform` to
    a concrete :class:`AbstractExtractor` sub-class.

    Concrete extractor classes self-register by decorating their class
    definition with :meth:`register`::

        @ExtractorRegistry.register(Platform.IOS)
        class IOSExtractor(AbstractExtractor):
            ...

    The registry is intentionally a *class*-level singleton — there is no
    need to instantiate :class:`ExtractorRegistry` directly.
    """

    _registry: dict[Platform, type[AbstractExtractor]] = {}

    @classmethod
    def register(
        cls,
        platform: Platform,
    ) -> Callable[[type[AbstractExtractor]], type[AbstractExtractor]]:
        """Decorator factory that registers a concrete extractor class.

        Apply this decorator to a :class:`AbstractExtractor` sub-class to
        associate it with *platform*.  If a class is already registered for
        *platform*, it is silently replaced by the new one, allowing
        hot-swapping of extractor implementations in tests.

        Parameters
        ----------
        platform:
            The :class:`~forensixd.core.models.Platform` value the decorated
            class handles.

        Returns
        -------
        Callable[[type[AbstractExtractor]], type[AbstractExtractor]]
            A decorator that stores the class in the registry and returns it
            unchanged, so the class name remains available in its defining
            module.

        Examples
        --------
        >>> from forensixd.core.models import Platform
        >>> from forensixd.extractors.base import ExtractorRegistry, AbstractExtractor
        >>> @ExtractorRegistry.register(Platform.ANDROID)
        ... class MyAndroidExtractor(AbstractExtractor): ...
        >>> ExtractorRegistry.get(Platform.ANDROID) is MyAndroidExtractor
        True
        """

        def decorator(
            extractor_cls: type[AbstractExtractor],
        ) -> type[AbstractExtractor]:
            cls._registry[platform] = extractor_cls
            return extractor_cls

        return decorator

    @classmethod
    def get(cls, platform: Platform) -> type[AbstractExtractor]:
        """Return the registered extractor class for *platform*.

        Parameters
        ----------
        platform:
            The :class:`~forensixd.core.models.Platform` whose extractor is
            requested.

        Returns
        -------
        type[AbstractExtractor]
            The concrete extractor class registered for *platform*.

        Raises
        ------
        forensixd.core.exceptions.UnsupportedPlatformError
            If no extractor has been registered for *platform*.
        """
        try:
            return cls._registry[platform]
        except KeyError:
            raise UnsupportedPlatformError(
                f"No extractor registered for platform '{platform.value}'.",
                context={"platform": platform.value, "registered": [p.value for p in cls._registry]},
            ) from None

    @classmethod
    def available_platforms(cls) -> list[Platform]:
        """Return the list of platforms that have a registered extractor.

        Returns
        -------
        list[Platform]
            A snapshot of the currently registered
            :class:`~forensixd.core.models.Platform` keys.  The order
            reflects the registration order (insertion-ordered ``dict``
            semantics, Python ≥ 3.7).
        """
        return list(cls._registry.keys())
