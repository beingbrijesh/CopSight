import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer
from typing import List, Dict, Any, Optional
import numpy as np

class VectorStore:
    def __init__(self, chromadb_url: str):
        self.client = chromadb.HttpClient(host=chromadb_url.replace("http://", "").split(":")[0], 
                                        port=int(chromadb_url.split(":")[-1]))
        self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
        self.embedding_model_name = 'all-MiniLM-L6-v2'
        
        # Create collections
        self.message_collection = self._get_or_create_collection("ufdr_messages")
        self.call_collection = self._get_or_create_collection("ufdr_calls")
        self.contact_collection = self._get_or_create_collection("ufdr_contacts")
    
    def _get_or_create_collection(self, name: str):
        """Get or create a ChromaDB collection"""
        try:
            return self.client.get_collection(name)
        except:
            return self.client.create_collection(name)
    
    async def create_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Create embeddings for a list of texts"""
        embeddings = self.embedding_model.encode(texts)
        return embeddings.tolist()
    
    async def add_documents(self, texts: List[str], metadatas: List[Dict[str, Any]], ids: List[str], collection_name: str = "ufdr_messages"):
        """Add documents to the vector store"""
        
        # Create embeddings
        embeddings = await self.create_embeddings(texts)
        
        # Get the appropriate collection
        if collection_name == "ufdr_messages":
            collection = self.message_collection
        elif collection_name == "ufdr_calls":
            collection = self.call_collection
        elif collection_name == "ufdr_contacts":
            collection = self.contact_collection
        else:
            collection = self._get_or_create_collection(collection_name)
        
        # Add to collection
        collection.add(
            embeddings=embeddings,
            documents=texts,
            metadatas=metadatas,
            ids=ids
        )
    
    async def search_similar(self, query: str, collection_name: str = "ufdr_messages", top_k: int = 10, filters: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Search for similar documents"""
        
        # Create query embedding
        query_embedding = await self.create_embeddings([query])
        
        # Get the appropriate collection
        if collection_name == "ufdr_messages":
            collection = self.message_collection
        elif collection_name == "ufdr_calls":
            collection = self.call_collection
        elif collection_name == "ufdr_contacts":
            collection = self.contact_collection
        else:
            collection = self._get_or_create_collection(collection_name)
        
        # Perform search
        results = collection.query(
            query_embeddings=query_embedding,
            n_results=top_k,
            where=filters
        )
        
        return {
            "documents": results["documents"][0] if results["documents"] else [],
            "metadatas": results["metadatas"][0] if results["metadatas"] else [],
            "distances": results["distances"][0] if results["distances"] else [],
            "ids": results["ids"][0] if results["ids"] else []
        }
    
    async def find_similar(self, document_id: str, top_k: int = 5, collection_name: str = "ufdr_messages") -> List[Dict[str, Any]]:
        """Find similar documents to a given document ID"""
        
        # Get the appropriate collection
        if collection_name == "ufdr_messages":
            collection = self.message_collection
        elif collection_name == "ufdr_calls":
            collection = self.call_collection
        elif collection_name == "ufdr_contacts":
            collection = self.contact_collection
        else:
            collection = self._get_or_create_collection(collection_name)
        
        # Get the document
        doc_result = collection.get(ids=[document_id])
        if not doc_result["documents"]:
            return []
        
        # Search for similar documents
        doc_text = doc_result["documents"][0]
        similar_results = await self.search_similar(doc_text, collection_name, top_k + 1)
        
        # Filter out the original document
        similar_docs = []
        for i, doc_id in enumerate(similar_results["ids"]):
            if doc_id != document_id:
                similar_docs.append({
                    "id": doc_id,
                    "document": similar_results["documents"][i],
                    "metadata": similar_results["metadatas"][i],
                    "similarity_score": 1 - similar_results["distances"][i]  # Convert distance to similarity
                })
        
        return similar_docs[:top_k]
    
    async def get_collection_stats(self, collection_name: str = "ufdr_messages") -> Dict[str, Any]:
        """Get statistics about a collection"""
        
        if collection_name == "ufdr_messages":
            collection = self.message_collection
        elif collection_name == "ufdr_calls":
            collection = self.call_collection
        elif collection_name == "ufdr_contacts":
            collection = self.contact_collection
        else:
            collection = self._get_or_create_collection(collection_name)
        
        count = collection.count()
        return {
            "collection_name": collection_name,
            "document_count": count,
            "embedding_model": self.embedding_model_name
        }
    
    async def health_check(self) -> Dict[str, Any]:
        """Check vector store health"""
        try:
            # Test basic functionality
            test_embedding = await self.create_embeddings(["test"])
            
            # Get collection stats
            message_stats = await self.get_collection_stats("ufdr_messages")
            
            return {
                "status": "healthy",
                "embedding_model": self.embedding_model_name,
                "collections": {
                    "messages": message_stats["document_count"],
                    "calls": (await self.get_collection_stats("ufdr_calls"))["document_count"],
                    "contacts": (await self.get_collection_stats("ufdr_contacts"))["document_count"]
                }
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e)
            }
