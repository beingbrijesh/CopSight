"""
Base Plugin Interface for External Intelligence Providers
"""
from abc import ABC, abstractmethod
from typing import Dict, Any, List

class ExternalIntelligenceProvider(ABC):
    """
    Abstract Base Class for integrating external systems like Aadhaar, Banks, or CCTV.
    Any new plugin must inherit from this and implement the methods.
    """

    @abstractmethod
    async def authenticate(self) -> bool:
        """Authenticate with the external system."""
        pass

    @abstractmethod
    async def query_entity(self, identifier_type: str, identifier_value: str) -> Dict[str, Any]:
        """
        Query the external system for details about an entity.
        Returns a structured dictionary of findings.
        """
        pass

    @abstractmethod
    async def sync_events(self, since_timestamp: str) -> List[Dict[str, Any]]:
        """
        Poll or sync new events (like new transactions or CCTV sightings) 
        from the external system.
        """
        pass

    def format_for_graph(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Utility to map the provider's raw API response into the Graph Mapper's format.
        """
        # Default implementation, should be overridden by subclasses
        return {
            "entities": [],
            "relationships": []
        }
