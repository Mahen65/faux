"""Faux Backend - FastAPI application entry point."""

import logging
from contextlib import asynccontextmanager

logging.basicConfig(level=logging.INFO)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api.router import api_router
from app.db import Base, engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create database tables and initialize services on startup."""
    import asyncio
    from sqlalchemy import text

    try:
        async with engine.begin() as conn:
            # Enable pgvector extension (no-op if already enabled)
            if "postgresql" in settings.database_url:
                await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            await conn.run_sync(Base.metadata.create_all)
    except Exception as e:
        logging.error("Database init failed (will retry on first request): %s", e)

    # Pre-load embedding model in background to avoid cold-start delay
    if settings.rag_enabled:
        from app.services.embedding import load_model
        asyncio.get_event_loop().run_in_executor(None, load_model)

    yield


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Smart field classification and dummy data generation for Faux",
    lifespan=lifespan,
)

# CORS - allow the browser extension to call us
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Extension origins vary; tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=True,
    )
