"""Local embedding service using sentence-transformers."""

import asyncio
import logging

from app.config import settings

logger = logging.getLogger(__name__)

_model = None


def load_model():
    """Load the sentence-transformers model (call once at startup)."""
    global _model
    if _model is not None:
        return _model

    from sentence_transformers import SentenceTransformer

    logger.info("Loading embedding model: %s", settings.embedding_model)
    _model = SentenceTransformer(settings.embedding_model)
    logger.info("Embedding model loaded (dim=%d)", _model.get_sentence_embedding_dimension())
    return _model


def _embed_sync(texts: list[str]) -> list[list[float]]:
    """Synchronous embedding (CPU-bound)."""
    model = load_model()
    embeddings = model.encode(texts, normalize_embeddings=True)
    return [e.tolist() for e in embeddings]


async def embed_text(text: str) -> list[float]:
    """Embed a single text string. Returns 384-dim vector."""
    results = await asyncio.to_thread(_embed_sync, [text])
    return results[0]


async def embed_texts(texts: list[str]) -> list[list[float]]:
    """Batch embed multiple text strings."""
    if not texts:
        return []
    return await asyncio.to_thread(_embed_sync, texts)
