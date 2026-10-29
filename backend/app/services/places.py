"""Areas, crags and routes, decorated with live Conditions Scores."""

from typing import Any

from fastapi import HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models import Area, Crag, Route
from app.services import conditions, geo, grades, weather


def _brief(summary: dict[str, Any]) -> dict[str, Any]:
    now = summary["now"]
    return {
        "score": summary["score"],
        "label": summary["label"],
        "temp_c": now["temp_c"],
        "precip_prob": now["precip_prob"],
        "wet": now["wet"],
    }


def _crag_summary(crag: Crag, area: Area, forecast: dict | None) -> dict[str, Any]:
    out = {
        c: getattr(crag, c) for c in ("id", "area_id", "name", "lat", "lon", "aspect_deg", "rock_type", "route_count")
    }
    if forecast:
        s = conditions.summarize(forecast, crag.lat, crag.lon, crag.rock_type or area.rock_type, crag.aspect_deg)
        out["conditions"] = _brief(s)
    return out


def _area_summary(area: Area, forecast: dict | None, crag_count: int, distance_km: float | None = None) -> dict:
    out = {c: getattr(area, c) for c in ("id", "name", "region", "lat", "lon", "rock_type", "route_count")}
    out["crag_count"] = crag_count
    out["distance_km"] = round(distance_km, 1) if distance_km is not None else None
    if forecast:
        out["conditions"] = _brief(conditions.summarize(forecast, area.lat, area.lon, area.rock_type, None))
    return out


def list_areas(
    db: Session,
    q: str | None,
    rock_type: str | None,
    lat: float | None,
    lon: float | None,
    radius_km: float,
    sort: str,
) -> list[dict[str, Any]]:
    stmt = select(Area)
    if q:
        stmt = stmt.where(or_(Area.name.ilike(f"%{q}%"), Area.region.ilike(f"%{q}%")))
    if rock_type:
        stmt = stmt.where(Area.rock_type == rock_type)

    distances: dict[int, float] = {}
    if lat is not None and lon is not None:
        distances = dict(geo.nearby(db, Area, lat, lon, radius_km))
        stmt = stmt.where(Area.id.in_(distances.keys()))

    areas = list(db.scalars(stmt))
    counts = dict(db.execute(select(Crag.area_id, func.count()).group_by(Crag.area_id)).all())
    forecasts = weather.get_forecasts(db, areas)
    out = [_area_summary(a, forecasts.get(a.id), counts.get(a.id, 0), distances.get(a.id)) for a in areas]

    if sort == "distance" and distances:
        out.sort(key=lambda a: a["distance_km"])
    elif sort == "name":
        out.sort(key=lambda a: a["name"])
    else:  # best conditions first
        out.sort(key=lambda a: -a["conditions"]["score"] if a.get("conditions") else 1)
    return out


def area_detail(db: Session, area_id: int) -> dict[str, Any]:
    area = db.get(Area, area_id)
    if area is None:
        raise HTTPException(404, "Area not found")
    forecast = weather.get_forecasts(db, [area]).get(area.id)
    crags = sorted(area.crags, key=lambda c: -c.route_count)
    out = _area_summary(area, forecast, len(crags))
    out["description"] = area.description
    out["crags"] = [_crag_summary(c, area, forecast) for c in crags]
    out["forecast"] = conditions.summarize(forecast, area.lat, area.lon, area.rock_type, None) if forecast else None
    return out


def crag_detail(db: Session, crag_id: int) -> dict[str, Any]:
    crag = db.scalar(select(Crag).where(Crag.id == crag_id).options(selectinload(Crag.routes)))
    if crag is None:
        raise HTTPException(404, "Crag not found")
    area = crag.area
    forecast = weather.get_forecasts(db, [area]).get(area.id)
    out = _crag_summary(crag, area, forecast)
    out["area"] = _area_summary(area, forecast, len(area.crags))
    out["routes"] = [route_out(r) for r in sorted(crag.routes, key=lambda r: (r.grade_system, r.grade_index))]
    rock = crag.rock_type or area.rock_type
    out["forecast"] = conditions.summarize(forecast, crag.lat, crag.lon, rock, crag.aspect_deg) if forecast else None
    return out


def route_out(route: Route) -> dict[str, Any]:
    crag = route.crag
    return {
        "id": route.id,
        "name": route.name,
        "grade": route.grade,
        "grade_system": route.grade_system,
        "discipline": route.discipline,
        "safety": route.safety,
        "crag_id": crag.id,
        "crag_name": crag.name,
        "area_id": crag.area_id,
        "area_name": crag.area.name,
    }


def search_routes(
    db: Session,
    q: str | None,
    area_id: int | None,
    crag_id: int | None,
    discipline: str | None,
    grade_min: str | None,
    grade_max: str | None,
    limit: int,
    offset: int,
) -> list[dict[str, Any]]:
    stmt = select(Route).join(Crag).options(selectinload(Route.crag).selectinload(Crag.area))
    if q:
        stmt = stmt.where(Route.name.ilike(f"%{q}%"))
    if area_id:
        stmt = stmt.where(Crag.area_id == area_id)
    if crag_id:
        stmt = stmt.where(Route.crag_id == crag_id)
    if discipline:
        stmt = stmt.where(Route.discipline == discipline)
    for value, op in ((grade_min, "ge"), (grade_max, "le")):
        if value:
            try:
                system, index, _ = grades.parse_grade(value)
            except ValueError as exc:
                raise HTTPException(422, str(exc)) from exc
            col = Route.grade_index
            stmt = stmt.where(Route.grade_system == system, col >= index if op == "ge" else col <= index)
    stmt = stmt.order_by(Route.grade_system, Route.grade_index, Route.name).limit(limit).offset(offset)
    return [route_out(r) for r in db.scalars(stmt)]
