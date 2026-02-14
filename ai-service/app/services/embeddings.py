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
        logger.info(f"EmbeddingService initialized with model: {self.model}")
    
    async def generate_embedding(self, text: str) -> List[float]:
        """Generate embedding for a single text"""
        try:
            logger.info(f"Generating embedding using model: {self.model}")
            response = self.client.embeddings(
                model=self.model,
                prompt=text
            )
            embedding = response['embedding']
            logger.info(f"Generated embedding with length: {len(embedding)}")
            
            # Truncate to 384 dimensions if needed
            if len(embedding) > settings.EMBEDDING_DIM:
                embedding = embedding[:settings.EMBEDDING_DIM]
                logger.info(f"Truncated embedding to length: {len(embedding)}")
            
            return embedding
        except Exception as e:
            logger.error(f"Embedding generation failed: {e}")
            # Return zero vector as fallback (match configured embedding dimension)
            return [0.0] * settings.EMBEDDING_DIM
    
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
