from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://ufdr_user:ufdr_password@localhost:5432/ufdr_db"
    ELASTICSEARCH_URL: str = "http://localhost:9200"
    GRAPH_SERVICE_URL: str = "http://localhost:8004"
    
    class Config:
        env_file = ".env"

settings = Settings()
