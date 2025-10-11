"""
Embedding generation service using Ollama
"""

import ollama
from typing import List
from loguru import logger

from app.config import settings


class EmbeddingService:
    """Generate embeddings using Ollama"""
    
    def __init__(self):
        self.client = ollama.Client(host=settings.OLLAMA_HOST)
        self.model = settings.EMBEDDING_MODEL
    
    async def generate_embedding(self, text: str) -> List[float]:
        """Generate embedding for a single text"""
        try:
            response = self.client.embeddings(
                model=self.model,
                prompt=text
            )
            return response['embedding']
        except Exception as e:
            logger.error(f"Embedding generation failed: {e}")
            # Return zero vector as fallback
            return [0.0] * 384
    
    async def generate_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for multiple texts"""
        embeddings = []
        for text in texts:
            embedding = await self.generate_embedding(text)
            embeddings.append(embedding)
        return embeddings
    
    async def test_connection(self) -> bool:
        """Test if Ollama is available"""
        try:
            await self.generate_embedding("test")
            return True
        except:
            return False


# Global instance
embedding_service = EmbeddingService()
