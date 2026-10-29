from typing import Literal

from fastapi import APIRouter, HTTPException, Query

from app.api.deps import DB, CurrentUser
from app.models import Crag, Route
from app.schemas.places import AreaDetail, AreaSummary, AspectIn, CragDetail, RouteOut
from app.services import places

router = APIRouter(prefix="/api", tags=["places"])


@router.get("/areas", response_model=list[AreaSummary])
def list_areas(
    db: DB,
    q: str | None = None,
    rock_type: str | None = None,
    lat: float | None = Query(default=None, ge=-90, le=90),
    lon: float | None = Query(default=None, ge=-180, le=180),
    radius_km: float = Query(default=500, gt=0, le=5000),
    sort: Literal["score", "distance", "name"] = "score",
):
    return places.list_areas(db, q, rock_type, lat, lon, radius_km, sort)


@router.get("/areas/{area_id}", response_model=AreaDetail)
def get_area(area_id: int, db: DB):
    return places.area_detail(db, area_id)


@router.get("/crags/{crag_id}", response_model=CragDetail)
def get_crag(crag_id: int, db: DB):
    return places.crag_detail(db, crag_id)


@router.put("/crags/{crag_id}/aspect", response_model=CragDetail)
def set_aspect(crag_id: int, body: AspectIn, db: DB, _: CurrentUser):
    """Crowdsourced: any logged-in climber can record which way a wall faces."""
    crag = db.get(Crag, crag_id)
    if crag is None:
        raise HTTPException(404, "Crag not found")
    crag.aspect_deg = body.aspect_deg
    db.commit()
    return places.crag_detail(db, crag_id)


@router.get("/routes", response_model=list[RouteOut])
def search_routes(
    db: DB,
    q: str | None = None,
    area_id: int | None = None,
    crag_id: int | None = None,
    discipline: str | None = None,
    grade_min: str | None = None,
    grade_max: str | None = None,
    limit: int = Query(default=50, le=200),
    offset: int = 0,
):
    return places.search_routes(db, q, area_id, crag_id, discipline, grade_min, grade_max, limit, offset)


@router.get("/routes/{route_id}", response_model=RouteOut)
def get_route(route_id: int, db: DB):
    route = db.get(Route, route_id)
    if route is None:
        raise HTTPException(404, "Route not found")
    return places.route_out(route)
