from __future__ import annotations

from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.db import close_engine, init_schema
from app.errors import ApiError, api_error_handler, validation_error_handler
from app.routers import allocations, auth, health, merchants, sim, transactions
from app.timeutil import format_timestamp, utc_now

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    await init_schema()
    yield
    await close_engine()


app = FastAPI(
    title="RIFT Core",
    version=settings.app_version,
    description="Offline-first simulated payment core for the RIFT hackathon rebuild.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(ApiError, api_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)

api_prefix = "/api/v1"
for router in (health.router, auth.router, allocations.router, transactions.router, merchants.router, sim.router):
    app.include_router(router, prefix=api_prefix)


@app.get("/")
async def root() -> JSONResponse:
    return JSONResponse(
        {
            "service": "rift-core",
            "version": settings.app_version,
            "docs": "/docs",
            "health": f"{api_prefix}/health",
            "timestamp": format_timestamp(utc_now()),
        }
    )
