# CLAUDE.md

Guidance for Claude when working in this repository.

## Project

**Crux** is a data-driven climbing app: a 0–100 Conditions Score per crag (weather + sun/shade + rock-type
drying rules), a route finder over ~17k OpenBeta routes, a logbook, progression analytics (grade pyramid,
send trends), friends + activity feed, and a partner finder.

Status: v1 feature-complete; deploys to Vercel (two projects: `backend/` and `frontend/`) with Neon Postgres.

## Working with me

- I'm a CS senior learning as I build. Explain the *why* behind decisions, not just the *what*.
- Go step by step. Before large changes, outline the plan and let me confirm.
- Prefer simple, conventional solutions over clever ones. Name the concept being used
  (e.g. "this is dependency injection") so I can look it up.
- Don't commit or push unless I ask.

## Stack

- **Backend:** FastAPI, Python 3.12+, SQLAlchemy 2 (ORM), Alembic, Pydantic v2, httpx, pytest, ruff
- **Database:** PostgreSQL + PostGIS in production; SQLite locally and in tests (no install needed)
- **Frontend:** React 19 + TypeScript (strict), Vite, Tailwind v4, Motion, Recharts, React Leaflet, React Router

## Layout

```
backend/
  app/
    main.py       FastAPI app (Vercel's entrypoint), CORS, router registration
    api/deps.py   Shared dependencies: DB session, current user
    api/routes/   HTTP endpoints, one file per area: auth, places, logbook, social, partners
    core/         Settings from env vars (config.py), bcrypt + JWT (security.py)
    db/           Engine/session setup (serverless-aware), declarative Base
    models/       SQLAlchemy tables: places (Area > Crag > Route, WeatherSnapshot), users (User, Ascent, Friendship), social
    schemas/      Pydantic request/response models
    services/     Business logic: conditions (score model), sun, weather (Open-Meteo cache), grades, analytics, geo, places, social
    pipeline/     openbeta.py (import → data/openbeta_snapshot.json), destinations.py (curated rock types), seed.py
  alembic/        Migrations (0001 adds PostGIS GiST indexes on Postgres only)
  tests/          pytest; conftest stubs Open-Meteo and uses a temp SQLite DB
frontend/
  src/
    api/          client.ts (fetch + token + errors), endpoints.ts (typed API calls)
    components/   ui.tsx (Button, Card, Modal, Chip…), AnimatedBackground, ScoreRing, ConditionsPanel, charts, AreaMap, LogAscentModal, Layout
    hooks/        useAuth (context), useApi (data loading), useGeolocation, useUnits (°F/°C), useMeta
    lib/format.ts Score colors, grade labels, date helpers
    pages/        One file per route (see App.tsx; pages are lazy-loaded)
    types/        TypeScript mirrors of backend schemas
docs/             Design notes and decisions
```

## Conventions

- Keep layers separate: **routes** handle HTTP, **services** hold logic, **models** talk to the DB.
  Put non-trivial queries and logic in `services/`; simple lookups in routes are fine.
- `models/` (DB tables) and `schemas/` (API JSON) are deliberately separate, even when they look alike.
- Every schema change goes through an Alembic migration; never edit the DB by hand.
- Geospatial code must work on both PostGIS and SQLite (see `services/geo.py`).
- Secrets live in `.env` (gitignored). Document every new variable in `.env.example`.
- Frontend types in `frontend/src/types/` should match backend Pydantic schemas.
- Python: type hints everywhere; ruff for lint + format (line length 120).
- TypeScript: `strict` mode on; avoid `any`. Respect `prefers-reduced-motion` in animations.

## Commands

```bash
# Backend (from backend/, with .venv activated)
pip install -r requirements-dev.txt
alembic upgrade head                 # create/upgrade tables
python -m app.pipeline.seed          # load routes + demo users (--reset-demo to regenerate)
python -m app.pipeline.openbeta      # re-import routes from OpenBeta into the snapshot
uvicorn app.main:app --reload        # http://localhost:8000, docs at /docs
pytest                               # tests
ruff check . && ruff format .        # lint + format

# Frontend (from frontend/)
npm install
npm run dev                          # http://localhost:5173 (expects API at VITE_API_URL, default :8000)
npm run build                        # type-check + production build
npm run lint                         # oxlint
```
