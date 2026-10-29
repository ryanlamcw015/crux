"""Fetch Open-Meteo forecasts and cache them per area in the weather_snapshots table."""

import logging
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import Area, WeatherSnapshot

log = logging.getLogger(__name__)

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
HOURLY_FIELDS = (
    "temperature_2m,relative_humidity_2m,precipitation,precipitation_probability,"
    "cloud_cover,wind_speed_10m,direct_radiation,is_day"
)


def fetch_open_meteo(coords: list[tuple[float, float]]) -> list[dict[str, Any]]:
    """One request for many locations. Includes 2 past days so the drying model knows about recent rain."""
    params = {
        "latitude": ",".join(f"{lat:.4f}" for lat, _ in coords),
        "longitude": ",".join(f"{lon:.4f}" for _, lon in coords),
        "hourly": HOURLY_FIELDS,
        "past_days": 2,
        "forecast_days": 4,
        "timezone": "auto",
        "timeformat": "unixtime",
    }
    resp = httpx.get(OPEN_METEO_URL, params=params, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    return data if isinstance(data, list) else [data]


def _is_fresh(snapshot: WeatherSnapshot | None, now: datetime) -> bool:
    if snapshot is None:
        return False
    fetched = snapshot.fetched_at
    if fetched.tzinfo is None:  # SQLite drops timezone info
        fetched = fetched.replace(tzinfo=UTC)
    return now - fetched < timedelta(minutes=get_settings().weather_ttl_minutes)


def get_forecasts(db: Session, areas: list[Area]) -> dict[int, dict[str, Any]]:
    """Return {area_id: forecast}, refreshing stale entries in a single batched API call."""
    if not areas:
        return {}
    now = datetime.now(UTC)
    snapshots = {
        s.area_id: s
        for s in db.scalars(select(WeatherSnapshot).where(WeatherSnapshot.area_id.in_([a.id for a in areas])))
    }
    stale = [a for a in areas if not _is_fresh(snapshots.get(a.id), now)]

    for start in range(0, len(stale), 50):  # Open-Meteo accepts many coordinates per request
        chunk = stale[start : start + 50]
        try:
            results = fetch_open_meteo([(a.lat, a.lon) for a in chunk])
        except httpx.HTTPError as exc:
            log.warning("Open-Meteo fetch failed, serving cached data: %s", exc)
            continue
        for area, payload in zip(chunk, results, strict=False):
            snap = snapshots.get(area.id)
            if snap is None:
                snap = WeatherSnapshot(area_id=area.id, fetched_at=now, payload=payload)
                db.add(snap)
                snapshots[area.id] = snap
            else:
                snap.fetched_at, snap.payload = now, payload
        db.commit()

    return {area_id: s.payload for area_id, s in snapshots.items()}
