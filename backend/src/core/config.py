# rag-a-toni/backend/src/core/config.py

from functools import cached_property

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    openai_api_key: str = ""
    openai_embedding_model: str = "text-embedding-3-small"
    openai_chat_model: str = "gpt-5.4-mini"

    api_host: str = "127.0.0.1"
    api_port: int = 8015
    cors_origins: str = "http://127.0.0.1:5188,http://localhost:5188"

    database_url: str = "postgresql+psycopg://rag:rag@127.0.0.1:5439/rag_a_toni"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @cached_property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
