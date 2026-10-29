"""Where you climb: areas (destinations) contain crags (walls/sectors), which contain routes."""

from datetime import datetime
from typing import Any

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Area(Base):
    __tablename__ = "areas"

    id: Mapped[int] = mapped_column(primary_key=True)
    openbeta_uuid: Mapped[str | None] = mapped_column(String(64), unique=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    region: Mapped[str] = mapped_column(String(120), default="")
    lat: Mapped[float] = mapped_column(Float)
    lon: Mapped[float] = mapped_column(Float)
    rock_type: Mapped[str] = mapped_column(String(40))
    description: Mapped[str] = mapped_column(Text, default="")
    route_count: Mapped[int] = mapped_column(Integer, default=0)

    crags: Mapped[list["Crag"]] = relationship(back_populates="area", cascade="all, delete-orphan")
    weather: Mapped["WeatherSnapshot | None"] = relationship(back_populates="area", cascade="all, delete-orphan")


class Crag(Base):
    __tablename__ = "crags"

    id: Mapped[int] = mapped_column(primary_key=True)
    area_id: Mapped[int] = mapped_column(ForeignKey("areas.id", ondelete="CASCADE"), index=True)
    openbeta_uuid: Mapped[str | None] = mapped_column(String(64), unique=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    lat: Mapped[float] = mapped_column(Float)
    lon: Mapped[float] = mapped_column(Float)
    # Compass direction the wall faces (0 = N, 90 = E). Unknown until a climber adds it.
    aspect_deg: Mapped[int | None] = mapped_column(Integer)
    rock_type: Mapped[str | None] = mapped_column(String(40))  # overrides the area's rock type
    route_count: Mapped[int] = mapped_column(Integer, default=0)

    area: Mapped[Area] = relationship(back_populates="crags")
    routes: Mapped[list["Route"]] = relationship(back_populates="crag", cascade="all, delete-orphan")


class Route(Base):
    __tablename__ = "routes"

    id: Mapped[int] = mapped_column(primary_key=True)
    crag_id: Mapped[int] = mapped_column(ForeignKey("crags.id", ondelete="CASCADE"), index=True)
    openbeta_uuid: Mapped[str | None] = mapped_column(String(64), unique=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    grade: Mapped[str] = mapped_column(String(20))
    grade_system: Mapped[str] = mapped_column(String(10))  # "yds" or "v"
    grade_index: Mapped[int] = mapped_column(Integer, index=True)  # sortable difficulty
    discipline: Mapped[str] = mapped_column(String(20), index=True)  # sport | trad | boulder | tr
    safety: Mapped[str | None] = mapped_column(String(20))

    crag: Mapped[Crag] = relationship(back_populates="routes")


class WeatherSnapshot(Base):
    """Cached Open-Meteo forecast for an area, refreshed when older than the TTL."""

    __tablename__ = "weather_snapshots"

    id: Mapped[int] = mapped_column(primary_key=True)
    area_id: Mapped[int] = mapped_column(ForeignKey("areas.id", ondelete="CASCADE"), unique=True)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    payload: Mapped[dict[str, Any]] = mapped_column(JSON)

    area: Mapped[Area] = relationship(back_populates="weather")
