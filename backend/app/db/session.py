"""Database engine and per-request sessions."""

import os
from collections.abc import Iterator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import get_settings

settings = get_settings()


def _make_engine():
    url = settings.sqlalchemy_url
    if url.startswith("sqlite"):
        engine = create_engine(url, connect_args={"check_same_thread": False})

        @event.listens_for(engine, "connect")
        def _sqlite_fk(dbapi_conn, _):  # SQLite ignores foreign keys unless asked
            dbapi_conn.execute("PRAGMA foreign_keys=ON")

        return engine

    # Serverless functions are short-lived, so let the provider's pooler (e.g. Neon) pool connections.
    # prepare_threshold=None disables server-side prepared statements, which poolers in transaction mode reject.
    kwargs: dict = {"pool_pre_ping": True, "connect_args": {"prepare_threshold": None}}
    if os.getenv("VERCEL"):
        kwargs["poolclass"] = NullPool
    return create_engine(url, **kwargs)


engine = _make_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """FastAPI dependency: one session per request, always closed afterwards."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
