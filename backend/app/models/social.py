from datetime import date

from sqlalchemy import Date, Float, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.places import Area
from app.models.users import Ascent, User


class PartnerPost(TimestampMixin, Base):
    """A "looking for a partner" post, at a gym or an outdoor area."""

    __tablename__ = "partner_posts"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    setting: Mapped[str] = mapped_column(String(10))  # gym | outdoor
    area_id: Mapped[int | None] = mapped_column(ForeignKey("areas.id", ondelete="SET NULL"))
    location_name: Mapped[str] = mapped_column(String(200))
    lat: Mapped[float | None] = mapped_column(Float)
    lon: Mapped[float | None] = mapped_column(Float)
    climb_on: Mapped[date] = mapped_column(Date, index=True)
    time_of_day: Mapped[str] = mapped_column(String(20))  # morning | afternoon | evening | all-day
    disciplines: Mapped[str] = mapped_column(String(80))  # comma-separated
    grade_range: Mapped[str] = mapped_column(String(40), default="")
    message: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(10), default="open")  # open | closed

    user: Mapped[User] = relationship()
    area: Mapped[Area | None] = relationship()
    replies: Mapped[list["PartnerReply"]] = relationship(
        back_populates="post", cascade="all, delete-orphan", order_by="PartnerReply.created_at"
    )


class PartnerReply(TimestampMixin, Base):
    __tablename__ = "partner_replies"

    id: Mapped[int] = mapped_column(primary_key=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("partner_posts.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    message: Mapped[str] = mapped_column(Text)

    post: Mapped[PartnerPost] = relationship(back_populates="replies")
    user: Mapped[User] = relationship()


class Activity(TimestampMixin, Base):
    """A feed item, written when something worth sharing happens."""

    __tablename__ = "activities"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(20))  # ascent | partner_post | friend
    ascent_id: Mapped[int | None] = mapped_column(ForeignKey("ascents.id", ondelete="CASCADE"))
    partner_post_id: Mapped[int | None] = mapped_column(ForeignKey("partner_posts.id", ondelete="CASCADE"))
    other_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))

    user: Mapped[User] = relationship(foreign_keys=[user_id])
    other_user: Mapped[User | None] = relationship(foreign_keys=[other_user_id])
    ascent: Mapped[Ascent | None] = relationship()
    partner_post: Mapped[PartnerPost | None] = relationship()
    kudos: Mapped[list["Kudos"]] = relationship(cascade="all, delete-orphan")


class Kudos(TimestampMixin, Base):
    __tablename__ = "kudos"
    __table_args__ = (UniqueConstraint("activity_id", "user_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    activity_id: Mapped[int] = mapped_column(ForeignKey("activities.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
