"""Distance queries. PostGIS does the work in production; SQLite (local dev/tests) falls back to Python."""

import math

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _geog(lat_col, lon_col):
    return func.geography(func.ST_MakePoint(lon_col, lat_col))


def nearby(db: Session, model, lat: float, lon: float, radius_km: float) -> list[tuple[int, float]]:
    """[(id, distance_km)] for rows of `model` (which has lat/lon columns) within radius, nearest first."""
    if get_settings().is_postgres:
        here = _geog(lat, lon)
        point = _geog(model.lat, model.lon)
        rows = db.execute(
            select(model.id, (func.ST_Distance(point, here) / 1000).label("km"))
            .where(model.lat.is_not(None))
            .where(func.ST_DWithin(point, here, radius_km * 1000))  # uses the GiST index
            .order_by("km")
        )
        return [(row.id, float(row.km)) for row in rows]

    rows = db.execute(select(model.id, model.lat, model.lon).where(model.lat.is_not(None)))
    hits = [(row.id, haversine_km(lat, lon, row.lat, row.lon)) for row in rows]
    return sorted((h for h in hits if h[1] <= radius_km), key=lambda h: h[1])
