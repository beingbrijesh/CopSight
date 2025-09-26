from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://ufdr_user:ufdr_password@localhost:5432/ufdr_db"
    JWT_SECRET: str = "your-super-secret-jwt-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440
    
    PARSER_SERVICE_URL: str = "http://localhost:8001"
    INDEXER_SERVICE_URL: str = "http://localhost:8002"
    SEARCH_SERVICE_URL: str = "http://localhost:8003"
    GRAPH_SERVICE_URL: str = "http://localhost:8004"

    class Config:
        env_file = ".env"

settings = Settings()
