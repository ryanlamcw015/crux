"""Import every model here so Base.metadata (and Alembic) sees all tables."""

from app.models.places import Area, Crag, Route, WeatherSnapshot
from app.models.social import Activity, Kudos, PartnerPost, PartnerReply
from app.models.users import Ascent, Friendship, User

__all__ = [
    "Activity",
    "Area",
    "Ascent",
    "Crag",
    "Friendship",
    "Kudos",
    "PartnerPost",
    "PartnerReply",
    "Route",
    "User",
    "WeatherSnapshot",
]
