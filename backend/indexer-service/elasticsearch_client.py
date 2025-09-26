from elasticsearch import Elasticsearch
from typing import Dict, Any, List, Optional
import json

class ElasticsearchClient:
    def __init__(self, elasticsearch_url: str):
        self.es = Elasticsearch([elasticsearch_url])
        self.message_index = "ufdr_messages"
        self.call_index = "ufdr_calls"
        self.contact_index = "ufdr_contacts"
        
        # Create indices if they don't exist
        self._create_indices()
    
    def _create_indices(self):
        """Create Elasticsearch indices with proper mappings"""
        
        # Messages index mapping
        message_mapping = {
            "mappings": {
                "properties": {
                    "job_id": {"type": "keyword"},
                    "source_device": {"type": "keyword"},
                    "app_name": {"type": "keyword"},
                    "sender_id": {"type": "keyword"},
                    "receiver_id": {"type": "keyword"},
                    "timestamp": {"type": "date"},
                    "content": {
                        "type": "text",
                        "analyzer": "standard",
                        "fields": {
                            "keyword": {"type": "keyword", "ignore_above": 256}
                        }
                    },
                    "message_type": {"type": "keyword"},
                    "metadata": {"type": "object"},
                    "indexed_at": {"type": "date"}
                }
            }
        }
        
        # Calls index mapping
        call_mapping = {
            "mappings": {
                "properties": {
                    "job_id": {"type": "keyword"},
                    "source_device": {"type": "keyword"},
                    "caller_id": {"type": "keyword"},
                    "receiver_id": {"type": "keyword"},
                    "timestamp": {"type": "date"},
                    "duration": {"type": "integer"},
                    "call_type": {"type": "keyword"},
                    "metadata": {"type": "object"},
                    "indexed_at": {"type": "date"}
                }
            }
        }
        
        # Contacts index mapping
        contact_mapping = {
            "mappings": {
                "properties": {
                    "job_id": {"type": "keyword"},
                    "source_device": {"type": "keyword"},
                    "contact_id": {"type": "keyword"},
                    "name": {
                        "type": "text",
                        "analyzer": "standard",
                        "fields": {
                            "keyword": {"type": "keyword", "ignore_above": 256}
                        }
                    },
                    "phone_numbers": {"type": "keyword"},
                    "email_addresses": {"type": "keyword"},
                    "metadata": {"type": "object"},
                    "indexed_at": {"type": "date"}
                }
            }
        }
        
        # Create indices
        if not self.es.indices.exists(index=self.message_index):
            self.es.indices.create(index=self.message_index, body=message_mapping)
        
        if not self.es.indices.exists(index=self.call_index):
            self.es.indices.create(index=self.call_index, body=call_mapping)
        
        if not self.es.indices.exists(index=self.contact_index):
            self.es.indices.create(index=self.contact_index, body=contact_mapping)
    
    async def index_message(self, doc: Dict[str, Any]) -> Dict[str, Any]:
        """Index a message document"""
        result = self.es.index(index=self.message_index, body=doc)
        return result
    
    async def index_call(self, doc: Dict[str, Any]) -> Dict[str, Any]:
        """Index a call document"""
        result = self.es.index(index=self.call_index, body=doc)
        return result
    
    async def index_contact(self, doc: Dict[str, Any]) -> Dict[str, Any]:
        """Index a contact document"""
        result = self.es.index(index=self.contact_index, body=doc)
        return result
    
    async def search_messages(
        self,
        query: str,
        size: int = 10,
        from_: int = 0,
        app_name: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None
    ) -> Dict[str, Any]:
        """Search messages with filters"""
        
        search_body = {
            "query": {
                "bool": {
                    "must": [
                        {
                            "multi_match": {
                                "query": query,
                                "fields": ["content", "sender_id", "receiver_id"],
                                "type": "best_fields"
                            }
                        }
                    ],
                    "filter": []
                }
            },
            "sort": [{"timestamp": {"order": "desc"}}],
            "size": size,
            "from": from_
        }
        
        # Add filters
        if app_name:
            search_body["query"]["bool"]["filter"].append({"term": {"app_name": app_name}})
        
        if date_from or date_to:
            date_range = {}
            if date_from:
                date_range["gte"] = date_from
            if date_to:
                date_range["lte"] = date_to
            search_body["query"]["bool"]["filter"].append({"range": {"timestamp": date_range}})
        
        result = self.es.search(index=self.message_index, body=search_body)
        return result
    
    async def search_calls(
        self,
        phone_number: Optional[str] = None,
        call_type: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        size: int = 10,
        from_: int = 0
    ) -> Dict[str, Any]:
        """Search calls with filters"""
        
        search_body = {
            "query": {
                "bool": {
                    "must": [],
                    "filter": []
                }
            },
            "sort": [{"timestamp": {"order": "desc"}}],
            "size": size,
            "from": from_
        }
        
        # Add phone number search
        if phone_number:
            search_body["query"]["bool"]["must"].append({
                "multi_match": {
                    "query": phone_number,
                    "fields": ["caller_id", "receiver_id"]
                }
            })
        else:
            search_body["query"]["bool"]["must"].append({"match_all": {}})
        
        # Add filters
        if call_type:
            search_body["query"]["bool"]["filter"].append({"term": {"call_type": call_type}})
        
        if date_from or date_to:
            date_range = {}
            if date_from:
                date_range["gte"] = date_from
            if date_to:
                date_range["lte"] = date_to
            search_body["query"]["bool"]["filter"].append({"range": {"timestamp": date_range}})
        
        result = self.es.search(index=self.call_index, body=search_body)
        return result
    
    async def search_contacts(
        self,
        query: str,
        size: int = 10,
        from_: int = 0
    ) -> Dict[str, Any]:
        """Search contacts"""
        
        search_body = {
            "query": {
                "multi_match": {
                    "query": query,
                    "fields": ["name", "phone_numbers", "email_addresses"],
                    "type": "best_fields"
                }
            },
            "size": size,
            "from": from_
        }
        
        result = self.es.search(index=self.contact_index, body=search_body)
        return result
    
    async def health_check(self) -> Dict[str, Any]:
        """Check Elasticsearch health"""
        try:
            health = self.es.cluster.health()
            return {
                "status": health["status"],
                "cluster_name": health["cluster_name"],
                "number_of_nodes": health["number_of_nodes"]
            }
        except Exception as e:
            return {"status": "error", "message": str(e)}
