"""FastAPI entrypoint. Vercel and uvicorn both load `app` from this module."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import auth, logbook, partners, places, social
from app.core.config import get_settings
from app.services.conditions import ROCK_RULES
from app.services.grades import grade_options

settings = get_settings()

app = FastAPI(
    title="Crux API",
    description="Climbing conditions, route finder, logbook and partner finder.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.frontend_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for module in (auth, places, logbook, social, partners):
    app.include_router(module.router)


@app.get("/", include_in_schema=False)
def root():
    return {"name": "Crux API", "docs": "/docs", "health": "/api/health"}


@app.get("/api/health", tags=["meta"])
def health():
    return {"ok": True}


@app.get("/api/meta", tags=["meta"])
def meta():
    """Static options the frontend needs for pickers and legends."""
    return {
        "grades": grade_options(),
        "rock_types": {k: {"label": v["label"], "note": v["note"]} for k, v in ROCK_RULES.items()},
        "styles": ["onsight", "flash", "redpoint", "send", "repeat", "attempt"],
        "disciplines": ["sport", "trad", "boulder", "tr"],
    }
