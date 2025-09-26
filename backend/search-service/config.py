from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    ELASTICSEARCH_URL: str = "http://localhost:9200"
    CHROMADB_URL: str = "http://localhost:8000"
    OPENAI_API_KEY: str = "your-openai-api-key-here"
    
    class Config:
        env_file = ".env"

settings = Settings()
