from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import PostgresDsn, AnyHttpUrl
from typing import List, Union

class Settings(BaseSettings):
    PROJECT_NAME: str = "OptiWaste"
    API_V1_STR: str = "/api/v1"
    
    # CORS
    BACKEND_CORS_ORIGINS: List[AnyHttpUrl] = []

    # MongoDB Database
    MONGO_SERVER: str = "localhost"
    MONGO_USER: str = ""
    MONGO_PASSWORD: str = ""
    MONGO_DB: str = "optiwaste"
    MONGO_PORT: str = "27017"

    @property
    def MONGO_DATABASE_URI(self) -> str:
        if self.MONGO_USER and self.MONGO_PASSWORD:
            return f"mongodb://{self.MONGO_USER}:{self.MONGO_PASSWORD}@{self.MONGO_SERVER}:{self.MONGO_PORT}/{self.MONGO_DB}?authSource=admin"
        return f"mongodb://{self.MONGO_SERVER}:{self.MONGO_PORT}/{self.MONGO_DB}"

    # JWT
    SECRET_KEY: str = "CHANGE_THIS_IN_PRODUCTION"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 days

    model_config = SettingsConfigDict(case_sensitive=True, env_file=".env")

settings = Settings()
