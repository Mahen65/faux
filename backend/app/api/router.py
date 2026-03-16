from fastapi import APIRouter

from app.api.endpoints import health, generate, usage, providers, submissions

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health.router, tags=["health"])
api_router.include_router(generate.router, tags=["generate"])
api_router.include_router(usage.router, tags=["usage"])
api_router.include_router(providers.router, tags=["providers"])
api_router.include_router(submissions.router, tags=["submissions"])
