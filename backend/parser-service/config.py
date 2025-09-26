from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    INDEXER_SERVICE_URL: str = "http://localhost:8002"
    
    class Config:
        env_file = ".env"

settings = Settings()
