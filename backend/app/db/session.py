"""Database session management."""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings

engine_kwargs: dict = {"echo": False}
# PostgreSQL supports connection pooling; SQLite does not
if "postgresql" in settings.database_url:
    engine_kwargs.update(pool_size=5, max_overflow=10)
    # Cloud-hosted PostgreSQL (Supabase, Neon) requires SSL
    if any(host in settings.database_url for host in ("supabase", "neon")):
        import ssl
        ssl_ctx = ssl.create_default_context()
        ssl_ctx.check_hostname = False
        ssl_ctx.verify_mode = ssl.CERT_NONE
        engine_kwargs["connect_args"] = {"ssl": ssl_ctx}

engine = create_async_engine(settings.database_url, **engine_kwargs)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        yield session
