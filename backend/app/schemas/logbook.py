from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.users import Orm

Style = Literal["onsight", "flash", "redpoint", "send", "repeat", "attempt"]
Discipline = Literal["sport", "trad", "boulder", "tr"]


class AscentIn(BaseModel):
    route_id: int | None = None
    # Required when route_id is empty (gym climbs and routes not in the database):
    name: str | None = Field(default=None, max_length=200)
    grade: str | None = Field(default=None, max_length=20)
    discipline: Discipline | None = None
    venue: str | None = Field(default=None, max_length=200)
    is_gym: bool = False

    climbed_on: date
    style: Style
    attempts: int = Field(default=1, ge=1, le=500)
    rating: int | None = Field(default=None, ge=1, le=4)
    notes: str = Field(default="", max_length=2000)


class AscentOut(Orm):
    id: int
    user_id: int
    route_id: int | None
    name: str
    grade: str
    grade_system: str
    discipline: str
    venue: str
    is_gym: bool
    climbed_on: date
    style: str
    attempts: int
    rating: int | None
    notes: str
    created_at: datetime
