from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def _bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    environment: str
    app_version: str
    database_url: str
    issuer_private_key_hex: str
    issuer_key_version: str
    admin_secret: str
    relay_api_key: str
    mock_starting_balance_kobo: int
    cors_origins: list[str]
    auto_create_schema: bool

    @property
    def issuer_key_loaded(self) -> bool:
        raw = self.issuer_private_key_hex.strip()
        if len(raw) != 64:
            return False
        try:
            bytes.fromhex(raw)
        except ValueError:
            return False
        return True


def _load() -> Settings:
    origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]
    return Settings(
        environment=os.getenv("ENVIRONMENT", "development"),
        app_version=os.getenv("APP_VERSION", "1.0.0"),
        database_url=os.getenv("DATABASE_URL", f"sqlite:///{(BASE_DIR / 'rift_dev.db').as_posix()}"),
        issuer_private_key_hex=os.getenv("RIFT_ISSUER_PRIVATE_KEY_HEX", "").strip(),
        issuer_key_version=os.getenv("ISSUER_KEY_VERSION", "v1").strip() or "v1",
        admin_secret=os.getenv("ADMIN_SECRET", ""),
        relay_api_key=os.getenv("RELAY_API_KEY", ""),
        mock_starting_balance_kobo=_int("MOCK_STARTING_BALANCE_KOBO", 5_000_000),
        cors_origins=origins or ["*"],
        auto_create_schema=_bool("AUTO_CREATE_SCHEMA", True),
    )


settings = _load()
