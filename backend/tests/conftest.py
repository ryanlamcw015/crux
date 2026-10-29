import os
import tempfile
from datetime import UTC, datetime, timedelta

# Point the app at a throwaway SQLite file before anything imports the engine.
_db_file = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ["DATABASE_URL"] = f"sqlite:///{_db_file.name}"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db.base import Base  # noqa: E402
from app.db.session import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Area, Crag, Route  # noqa: E402
from app.services import weather  # noqa: E402


def make_forecast(
    hours: int = 144, temp: float = 12, rh: float = 40, precip: float = 0.0, rain_hours: set[int] | None = None
) -> dict:
    """A fake Open-Meteo response: 2 past days + 4 forecast days, hourly."""
    start = datetime.now(UTC).replace(minute=0, second=0, microsecond=0) - timedelta(hours=48)
    rain_hours = rain_hours or set()
    times = [int((start + timedelta(hours=i)).timestamp()) for i in range(hours)]
    is_day = [1 if 7 <= (start + timedelta(hours=i)).hour <= 18 else 0 for i in range(hours)]
    return {
        "utc_offset_seconds": 0,
        "hourly": {
            "time": times,
            "temperature_2m": [temp] * hours,
            "relative_humidity_2m": [rh] * hours,
            "precipitation": [5.0 if i in rain_hours else precip for i in range(hours)],
            "precipitation_probability": [0] * hours,
            "cloud_cover": [10] * hours,
            "wind_speed_10m": [10] * hours,
            "direct_radiation": [400 if d else 0 for d in is_day],
            "is_day": is_day,
        },
    }


@pytest.fixture(autouse=True)
def fresh_db(monkeypatch):
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    monkeypatch.setattr(weather, "fetch_open_meteo", lambda coords: [make_forecast() for _ in coords])
    with SessionLocal() as db:
        area = Area(name="Test Crag Area", region="Nowhere", lat=44.37, lon=-121.14, rock_type="granite", route_count=2)
        crag = Crag(name="Sunny Wall", lat=44.37, lon=-121.14, aspect_deg=180, route_count=2)
        crag.routes = [
            Route(name="Easy Street", grade="5.9", grade_system="yds", grade_index=90, discipline="sport"),
            Route(name="Hard Thing", grade="5.12a", grade_system="yds", grade_index=180, discipline="sport"),
        ]
        area.crags.append(crag)
        far = Area(name="Far Away", region="Elsewhere", lat=37.7, lon=-119.6, rock_type="sandstone")
        db.add_all([area, far])
        db.commit()
    yield


@pytest.fixture
def client():
    return TestClient(app)


def register(client, username: str) -> dict:
    resp = client.post(
        "/api/auth/register",
        json={
            "username": username,
            "email": f"{username}@example.com",
            "password": "password123",
            "display_name": username.title(),
        },
    )
    assert resp.status_code == 201, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}
