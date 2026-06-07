"""
forensixd.parsers.base
~~~~~~~~~~~~~~~~~~~~~~

Abstract base class and registry for all forensixd artifact parsers.

``AbstractParser`` defines the interface every parser must implement:

* ``app_name``   – a human-readable identifier for the application or
                   subsystem whose artifacts this parser handles.
* ``can_parse``  – a lightweight probe that decides whether *this* parser
                   is capable of handling a given :class:`~forensixd.core.models.Artifact`.
* ``parse``      – the heavy-lifting method that converts a raw
                   :class:`~forensixd.core.models.Artifact` into a list of
                   :class:`~forensixd.core.models.ParsedRecord` objects.

``ParserRegistry`` is a class-level dictionary that maps string *app IDs*
(e.g. ``"com.whatsapp"``, ``"msgstore.db"``) to parser classes.  Parsers
self-register via the :meth:`ParserRegistry.register` decorator factory::

    @ParserRegistry.register("com.whatsapp", "msgstore.db")
    class WhatsAppParser(AbstractParser):
        ...

At parse time, :meth:`ParserRegistry.get_parsers_for` performs a
**case-insensitive substring search** across both the artifact's
``source_path`` and ``source_app`` fields and returns one instantiated
parser per matched app ID (deduplicating on class identity).
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Callable

from forensixd.core.models import Artifact, ParsedRecord

__all__ = ["AbstractParser", "ParserRegistry"]


# ---------------------------------------------------------------------------
# Abstract base class
# ---------------------------------------------------------------------------


class AbstractParser(ABC):
    """Interface that every forensixd artifact parser must implement.

    Concrete subclasses should be registered via
    :meth:`ParserRegistry.register` so the framework can discover them
    automatically.

    Example
    -------
    ::

        @ParserRegistry.register("com.whatsapp", "msgstore.db")
        class WhatsAppParser(AbstractParser):

            @property
            def app_name(self) -> str:
                return "WhatsApp"

            def can_parse(self, artifact: Artifact) -> bool:
                return "msgstore.db" in artifact.source_path.lower()

            def parse(self, artifact: Artifact) -> list[ParsedRecord]:
                ...
    """

    # ------------------------------------------------------------------
    # Abstract interface
    # ------------------------------------------------------------------

    @property
    @abstractmethod
    def app_name(self) -> str:
        """Human-readable name of the application this parser handles.

        Returns
        -------
        str
            A short, descriptive label, e.g. ``"WhatsApp"`` or
            ``"Safari Browser History"``.
        """

    @abstractmethod
    def can_parse(self, artifact: Artifact) -> bool:
        """Return *True* if this parser can handle *artifact*.

        This method is intended to be a **cheap, fast probe** — it should
        inspect ``artifact.source_path`` and/or ``artifact.source_app``
        and return a boolean without performing any I/O or heavy computation.

        Parameters
        ----------
        artifact:
            The candidate artifact to evaluate.

        Returns
        -------
        bool
            ``True`` if :meth:`parse` can be safely called on *artifact*;
            ``False`` otherwise.
        """

    @abstractmethod
    def parse(self, artifact: Artifact) -> list[ParsedRecord]:
        """Parse *artifact* and return a list of structured records.

        Parameters
        ----------
        artifact:
            The forensic artifact to parse.  Implementors may assume that
            :meth:`can_parse` returned ``True`` for this artifact.

        Returns
        -------
        list[ParsedRecord]
            Zero or more parsed records extracted from the artifact.
            An empty list is valid (e.g. the artifact contained no
            actionable records).

        Raises
        ------
        ParseError
            If the artifact data is malformed or parsing fails
            unrecoverably.  Transient / recoverable errors should be
            handled internally and may be reflected in
            ``ParsedRecord.completeness_note``.
        """


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------


class ParserRegistry:
    """Class-level registry mapping app-ID strings to :class:`AbstractParser` subclasses.

    Usage
    -----
    Register a parser for one or more app IDs::

        @ParserRegistry.register("com.whatsapp", "msgstore.db")
        class WhatsAppParser(AbstractParser):
            ...

    Retrieve parsers for a given artifact::

        parsers = ParserRegistry.get_parsers_for(artifact)
        for parser in parsers:
            records = parser.parse(artifact)

    Notes
    -----
    * Each *app_id* is stored **lower-cased** to enable case-insensitive
      look-up.
    * :meth:`get_parsers_for` deduplicates on *class identity*, so a
      parser registered under multiple IDs that all match the same
      artifact is only instantiated once.
    """

    #: Internal mapping of ``lower(app_id)`` → parser class.
    _registry: dict[str, type[AbstractParser]] = {}

    # ------------------------------------------------------------------
    # Registration
    # ------------------------------------------------------------------

    @classmethod
    def register(
        cls,
        *app_ids: str,
    ) -> Callable[[type[AbstractParser]], type[AbstractParser]]:
        """Decorator factory that registers a parser class under each *app_id*.

        Parameters
        ----------
        *app_ids:
            One or more string identifiers for the application whose
            artifacts this parser handles.  IDs are normalised to
            lower-case before storage so look-ups are case-insensitive.
            Common choices include reverse-DNS bundle identifiers
            (``"com.whatsapp"``), database file names
            (``"msgstore.db"``), or plain app names (``"whatsapp"``).

        Returns
        -------
        Callable[[type[AbstractParser]], type[AbstractParser]]
            The class decorator, which registers the decorated class and
            returns it unchanged.

        Raises
        ------
        TypeError
            If no *app_ids* are supplied.
        ValueError
            If any *app_id* is an empty or whitespace-only string.

        Example
        -------
        ::

            @ParserRegistry.register("com.whatsapp", "msgstore.db")
            class WhatsAppParser(AbstractParser):
                ...
        """
        if not app_ids:
            raise TypeError(
                "register() requires at least one app_id argument."
            )

        normalised: list[str] = []
        for app_id in app_ids:
            stripped = app_id.strip()
            if not stripped:
                raise ValueError(
                    f"app_id must be a non-empty string, got {app_id!r}."
                )
            normalised.append(stripped.lower())

        def decorator(parser_cls: type[AbstractParser]) -> type[AbstractParser]:
            for nid in normalised:
                cls._registry[nid] = parser_cls
            return parser_cls

        return decorator

    # ------------------------------------------------------------------
    # Look-up
    # ------------------------------------------------------------------

    @classmethod
    def get_parsers_for(cls, artifact: Artifact) -> list[AbstractParser]:
        """Return instantiated parsers whose registered IDs match *artifact*.

        Matching is performed as a **case-insensitive substring search**
        against both ``artifact.source_path`` and ``artifact.source_app``.
        If multiple registered IDs resolve to the *same* parser class only
        one instance is returned (deduplication by class identity).

        Parameters
        ----------
        artifact:
            The artifact for which compatible parsers should be retrieved.

        Returns
        -------
        list[AbstractParser]
            A (possibly empty) list of instantiated parser objects whose
            registered IDs appear in the artifact's ``source_path`` or
            ``source_app``.  Order is non-deterministic beyond matching.
        """
        haystack_path = artifact.source_path.lower()
        haystack_app = artifact.source_app.lower()

        seen_classes: set[type[AbstractParser]] = set()
        matched: list[AbstractParser] = []

        for app_id, parser_cls in cls._registry.items():
            if app_id in haystack_path or app_id in haystack_app:
                if parser_cls not in seen_classes:
                    seen_classes.add(parser_cls)
                    matched.append(parser_cls())

        return matched

    # ------------------------------------------------------------------
    # Introspection
    # ------------------------------------------------------------------

    @classmethod
    def all_parsers(cls) -> list[str]:
        """Return a sorted list of every registered app-ID string.

        Returns
        -------
        list[str]
            Alphabetically sorted list of lower-cased app IDs currently
            held in the registry.

        Example
        -------
        ::

            >>> ParserRegistry.all_parsers()
            ['com.apple.mobilesafari', 'com.whatsapp', 'msgstore.db']
        """
        return sorted(cls._registry.keys())
