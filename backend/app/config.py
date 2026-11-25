from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    environment: str = "development"
    app_version: str = "1.0.0"
    database_url: str = "sqlite+aiosqlite:///./rift_dev.db"
    rift_issuer_private_key_hex: str | None = None
    issuer_key_version: str = "v1"
    admin_secret: str | None = None
    relay_api_key: str | None = None
    mock_starting_balance_kobo: int = 5_000_000
    cors_origins: str = "*"
    auto_create_schema: bool = True
    run_migrations: bool = False
    port: int = 8000

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def cors_origins_list(self) -> list[str]:
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
