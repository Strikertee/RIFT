from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import create_schema
from .errors import install_error_handlers
from .routers import allocations, auth, health, merchants, sim, transactions

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("rift")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if settings.auto_create_schema:
        create_schema()
        logger.info("Database schema ready.")
    if not settings.issuer_key_loaded:
        logger.warning("Issuer key is not configured; /health will report degraded.")
    yield


app = FastAPI(
    title="RIFT Devions Bank Simulated Core",
    version=settings.app_version,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

install_error_handlers(app)

api = APIRouter(prefix="/api/v1")
api.include_router(health.router)
api.include_router(auth.router)
api.include_router(allocations.router)
api.include_router(transactions.router)
api.include_router(merchants.router)
api.include_router(sim.router)
app.include_router(api)


@app.get("/")
def root() -> dict:
    return {
        "name": "RIFT Devions Bank Simulated Core",
        "version": settings.app_version,
        "docs": "/docs",
        "health": "/api/v1/health",
        "settlement": "SIMULATED ONLY",
    }
