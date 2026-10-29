"""App settings, read from environment variables (and a local .env file in development)."""

import os
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]
DEV_SECRET = "dev-only-secret-change-me-in-production-0000"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(BACKEND_DIR.parent / ".env", BACKEND_DIR / ".env"),
        extra="ignore",
    )

    # SQLite works out of the box for local dev; production uses PostgreSQL (+PostGIS).
    database_url: str = f"sqlite:///{BACKEND_DIR / 'crux.db'}"
    secret_key: str = DEV_SECRET
    access_token_minutes: int = 60 * 24 * 7

    # Comma-separated list of allowed frontend origins (CORS).
    frontend_origin: str = "http://localhost:5173"
    # Optional regex for extra origins, e.g. Vercel preview URLs.
    frontend_origin_regex: str | None = None

    weather_ttl_minutes: int = 60
    demo_username: str = "demo"

    @property
    def sqlalchemy_url(self) -> str:
        """Normalize provider URLs (postgres://...) to the psycopg3 driver SQLAlchemy expects."""
        url = self.database_url
        for prefix in ("postgres://", "postgresql://"):
            if url.startswith(prefix):
                return "postgresql+psycopg://" + url[len(prefix) :]
        return url

    @property
    def is_postgres(self) -> bool:
        return self.sqlalchemy_url.startswith("postgresql")

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip().rstrip("/") for o in self.frontend_origin.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    if os.getenv("VERCEL") and settings.secret_key == DEV_SECRET:
        raise RuntimeError("Set SECRET_KEY in the Vercel project's environment variables")
    return settings
