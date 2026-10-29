from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.places import Area, Route


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    password_hash: Mapped[str] = mapped_column(String(100))
    display_name: Mapped[str] = mapped_column(String(60))
    bio: Mapped[str] = mapped_column(Text, default="")
    home_area_id: Mapped[int | None] = mapped_column(ForeignKey("areas.id", ondelete="SET NULL"))
    avatar_hue: Mapped[int] = mapped_column(Integer, default=200)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)

    home_area: Mapped[Area | None] = relationship()


class Ascent(TimestampMixin, Base):
    """One logbook entry. Either links to a known outdoor route or describes a gym/custom climb."""

    __tablename__ = "ascents"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    route_id: Mapped[int | None] = mapped_column(ForeignKey("routes.id", ondelete="SET NULL"))
    name: Mapped[str] = mapped_column(String(200))
    grade: Mapped[str] = mapped_column(String(20))
    grade_system: Mapped[str] = mapped_column(String(10))
    grade_index: Mapped[int] = mapped_column(Integer)
    discipline: Mapped[str] = mapped_column(String(20))
    venue: Mapped[str] = mapped_column(String(200), default="")
    is_gym: Mapped[bool] = mapped_column(Boolean, default=False)
    climbed_on: Mapped[date] = mapped_column(Date, index=True)
    # onsight | flash | redpoint | send | repeat | attempt
    style: Mapped[str] = mapped_column(String(20))
    attempts: Mapped[int] = mapped_column(Integer, default=1)
    rating: Mapped[int | None] = mapped_column(Integer)  # 1-4 stars
    notes: Mapped[str] = mapped_column(Text, default="")

    user: Mapped[User] = relationship()
    route: Mapped[Route | None] = relationship()


class Friendship(TimestampMixin, Base):
    __tablename__ = "friendships"
    __table_args__ = (UniqueConstraint("requester_id", "addressee_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    requester_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    addressee_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(10), default="pending")  # pending | accepted

    requester: Mapped[User] = relationship(foreign_keys=[requester_id])
    addressee: Mapped[User] = relationship(foreign_keys=[addressee_id])
