"""
Configuration settings for AI Service
"""

from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings"""
    
    from pydantic import field_validator
    
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8005
    ENVIRONMENT: str = "development"
    CORS_ORIGINS: List[str] | str = ["http://localhost:5173", "http://localhost:8080"]
    
    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: str | List[str]) -> List[str]:
        if isinstance(v, str):
            if v.startswith("["):
                import json
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [i.strip() for i in v.split(",")]
        return v
    
    # PostgreSQL
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5433
    POSTGRES_DB: str = "copsight_db"
    POSTGRES_USER: str = "copsight_user"
    POSTGRES_PASSWORD: str = "copsight_password"
    
    # Elasticsearch
    ELASTICSEARCH_URL: str = "http://localhost:9201"
    ELASTICSEARCH_USER: str = "elastic"
    ELASTICSEARCH_PASSWORD: str = "changeme"
    
    # Neo4j
    NEO4J_URI: str = "bolt://localhost:7688"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = "copsight_password"
    
    # Qdrant (Vector DB)
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_API_KEY: str | None = None
    
    # Redis
    REDIS_URL: str | None = None
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6380
    REDIS_PASSWORD: str | None = None
    
    # Ollama
    OLLAMA_HOST: str = "http://localhost:11434"
    EMBEDDING_MODEL: str = "nomic-embed-text"
    EMBEDDING_DIM: int = 384
    # Using Llama 3.2 3B Instruct (4-bit quantized) - Best balance of speed, low memory (~2GB), and json-formatting capability
    LLM_MODEL: str = "llama3.2:3b"
    LLM_TEMPERATURE: float = 0.2  # Lowered temperature for more deterministic/faster JSON generation
    LLM_MAX_TOKENS: int = 1500
    
    # External APIs (Auto-Detected)
    OPENAI_API_KEY: str | None = None
    GEMINI_API_KEY: str | None = None
    USE_GEMINI_MODEL: int = 0
    
    # AWS S3 / Cloudflare R2 Storage
    AWS_ACCESS_KEY_ID: str | None = None
    AWS_SECRET_ACCESS_KEY: str | None = None
    AWS_S3_BUCKET: str | None = None
    AWS_REGION: str = "us-east-1"
    R2_ACCESS_KEY_ID: str | None = None
    R2_SECRET_ACCESS_KEY: str | None = None
    R2_ENDPOINT: str | None = None
    R2_BUCKET_NAME: str | None = None
    
    # Cross-Server Health
    BACKEND_URL: str = "http://localhost:8080"
    
    # Model Configuration
    MAX_TOKENS: int = 4096
    TEMPERATURE: float = 0.7
    TOP_K: int = 10
    SIMILARITY_THRESHOLD: float = 0.7
    
    @property
    def postgres_url(self) -> str:
        if self.POSTGRES_HOST.startswith("postgresql://") or self.POSTGRES_HOST.startswith("postgres://"):
            return self.POSTGRES_HOST
            
        import urllib.parse
        encoded_password = urllib.parse.quote_plus(self.POSTGRES_PASSWORD) if self.POSTGRES_PASSWORD else ""
        base = f"postgresql://{self.POSTGRES_USER}:{encoded_password}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        if "supabase" in self.POSTGRES_HOST.lower():
            return f"{base}?sslmode=require"
        return base
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
