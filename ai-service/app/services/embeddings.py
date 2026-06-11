# pyrefly: ignore-errors
"""
Embedding generation service using Ollama
"""

import ollama
from typing import List
from loguru import logger

from app.config import settings
import re
import nltk
import ssl

try:
    _create_unverified_https_context = ssl._create_unverified_context
except AttributeError:
    pass
else:
    ssl._create_default_https_context = _create_unverified_https_context  # type: ignore

try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt', quiet=True)
except Exception:
    pass

class SemanticChunker:
    """Splits text into meaningful semantic chunks (paragraphs/sentences)"""
    def __init__(self, max_chunk_size: int = 1000):
        self.max_chunk_size = max_chunk_size

    def chunk_text(self, text: str) -> List[str]:
        if not text or not text.strip():
            return []
            
        # Split by paragraphs first
        paragraphs = re.split(r'\n\s*\n', text.strip())
        chunks = []
        
        for p in paragraphs:
            if len(p) <= self.max_chunk_size:
                chunks.append(p.strip())
            else:
                # If paragraph is too big, split by sentences
                try:
                    sentences = nltk.tokenize.sent_tokenize(p)
                except LookupError:
                    # Fallback to crude regex split if nltk punkt missing
                    sentences = re.split(r'(?<=[.!?])\s+', p)
                    
                current_chunk = ""
                for sentence in sentences:
                    if len(current_chunk) + len(sentence) <= self.max_chunk_size:
                        current_chunk += " " + sentence if current_chunk else sentence
                    else:
                        if current_chunk:
                            chunks.append(current_chunk.strip())
                        current_chunk = sentence
                if current_chunk:
                    chunks.append(current_chunk.strip())
                    
        return [c for c in chunks if c]

class EmbeddingService:
    """Generate embeddings using Ollama"""
    
    def __init__(self):
        self.client = ollama.AsyncClient(host=settings.OLLAMA_HOST)
        self.model = settings.EMBEDDING_MODEL
        logger.info(f"EmbeddingService initialized with model: {self.model}")
    
    async def generate_embedding(self, text: str) -> List[float]:
        """Generate embedding for a single text"""
        try:
            if settings.USE_GEMINI_MODEL == 1 and settings.GEMINI_API_KEY:
                logger.info("Generating embedding using Gemini API")
                import google.generativeai as genai
                genai.configure(api_key=settings.GEMINI_API_KEY)
                try:
                    result = genai.embed_content(
                        model="models/gemini-embedding-001",
                        content=text,
                        task_type="retrieval_document",
                        output_dimensionality=settings.EMBEDDING_DIM
                    )
                except Exception:
                    # Fallback if output_dimensionality is not supported by SDK version
                    result = genai.embed_content(
                        model="models/gemini-embedding-001",
                        content=text,
                        task_type="retrieval_document"
                    )
                embedding = result['embedding']
            else:
                logger.info(f"Generating embedding using Ollama model: {self.model}")
                response: dict = await self.client.embeddings(  # type: ignore[assignment]
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
