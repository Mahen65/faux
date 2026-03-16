from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    app_name: str = "Faux Backend"
    host: str = "127.0.0.1"
    port: int = 8321
    database_url: str = "postgresql+asyncpg://faux:faux@localhost:5432/faux"

    # LLM integration
    llm_api_key: str | None = None
    llm_provider: str = "anthropic"

    # RAG settings
    rag_enabled: bool = True
    rag_top_k: int = 3
    rag_similarity_threshold: float = 0.65
    embedding_model: str = "all-MiniLM-L6-v2"

    # CORS - extension origin
    extension_origin: str = "chrome-extension://*"

    model_config = {"env_prefix": "FAUX_"}


settings = Settings()
