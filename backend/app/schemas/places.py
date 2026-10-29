from typing import Any

from pydantic import BaseModel, Field

from app.schemas.users import Orm


class ConditionsBrief(BaseModel):
    score: int
    label: str
    temp_c: float
    precip_prob: float
    wet: bool


class AreaSummary(Orm):
    id: int
    name: str
    region: str
    lat: float
    lon: float
    rock_type: str
    route_count: int
    crag_count: int = 0
    conditions: ConditionsBrief | None = None
    distance_km: float | None = None


class CragSummary(Orm):
    id: int
    area_id: int
    name: str
    lat: float
    lon: float
    aspect_deg: int | None
    rock_type: str | None
    route_count: int
    conditions: ConditionsBrief | None = None


class RouteOut(Orm):
    id: int
    name: str
    grade: str
    grade_system: str
    discipline: str
    safety: str | None
    crag_id: int
    crag_name: str = ""
    area_id: int = 0
    area_name: str = ""


class AreaDetail(AreaSummary):
    description: str
    crags: list[CragSummary]
    forecast: dict[str, Any] | None = None


class CragDetail(CragSummary):
    area: AreaSummary
    routes: list[RouteOut]
    forecast: dict[str, Any] | None = None


class AspectIn(BaseModel):
    aspect_deg: int | None = Field(ge=0, lt=360)
