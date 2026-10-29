from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.logbook import AscentOut
from app.schemas.users import AreaRef, Orm, UserPublic


class PartnerPostIn(BaseModel):
    setting: Literal["gym", "outdoor"]
    area_id: int | None = None
    location_name: str = Field(default="", max_length=200)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lon: float | None = Field(default=None, ge=-180, le=180)
    climb_on: date
    time_of_day: Literal["morning", "afternoon", "evening", "all-day"]
    disciplines: list[Literal["sport", "trad", "boulder", "tr"]] = Field(min_length=1)
    grade_range: str = Field(default="", max_length=40)
    message: str = Field(default="", max_length=1000)


class ReplyIn(BaseModel):
    message: str = Field(min_length=1, max_length=1000)


class ReplyOut(Orm):
    id: int
    user: UserPublic
    message: str
    created_at: datetime


class PartnerPostOut(Orm):
    id: int
    user: UserPublic
    setting: str
    area: AreaRef | None
    location_name: str
    lat: float | None
    lon: float | None
    climb_on: date
    time_of_day: str
    disciplines: list[str]
    grade_range: str
    message: str
    status: str
    created_at: datetime
    replies: list[ReplyOut] = []
    distance_km: float | None = None

    @field_validator("disciplines", mode="before")
    @classmethod
    def _split(cls, v: str | list[str]) -> list[str]:
        return v.split(",") if isinstance(v, str) else v


class ActivityOut(BaseModel):
    id: int
    kind: str
    created_at: datetime
    user: UserPublic
    other_user: UserPublic | None = None
    ascent: AscentOut | None = None
    partner_post: PartnerPostOut | None = None
    kudos_count: int
    kudoed_by_me: bool
