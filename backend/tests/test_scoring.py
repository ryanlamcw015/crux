from datetime import UTC, datetime

import pytest

from app.services import conditions, grades
from app.services.sun import solar_position, wall_in_sun
from tests.conftest import make_forecast


@pytest.mark.parametrize(
    ("text", "system", "bucket"),
    [
        ("5.9", "yds", "5.9"),
        ("5.9+", "yds", "5.9"),
        ("5.10a", "yds", "5.10a"),
        ("5.10-", "yds", "5.10a"),
        ("5.11+", "yds", "5.11c"),
        ("5.12d", "yds", "5.12d"),
        ("V4", "v", "V4"),
        ("V-easy", "v", "VB"),
        ("V3-4", "v", "V3"),
    ],
)
def test_grade_parsing(text, system, bucket):
    parsed_system, index, _ = grades.parse_grade(text)
    assert parsed_system == system
    assert grades.bucket(system, index) == bucket


def test_grades_sort_by_difficulty():
    order = ["5.9", "5.10a", "5.10d", "5.11a", "5.12c"]
    indexes = [grades.parse_grade(g)[1] for g in order]
    assert indexes == sorted(indexes)


def test_unknown_grade_rejected():
    with pytest.raises(ValueError):
        grades.parse_grade("hard")


def test_noon_sun_is_south_in_northern_hemisphere():
    elevation, azimuth = solar_position(44.37, -121.14, datetime(2026, 6, 21, 20, 0, tzinfo=UTC))  # ~1pm PDT
    assert elevation > 60
    assert 150 < azimuth < 230
    assert wall_in_sun(180, elevation, azimuth)
    assert not wall_in_sun(0, elevation, azimuth)


def test_perfect_day_scores_high():
    s = conditions.summarize(make_forecast(temp=10, rh=35), 44.37, -121.14, "granite", None)
    assert s["score"] >= 80
    assert s["label"] == "Prime"


def test_rain_tanks_score_and_soft_sandstone_stays_closed():
    # Heavy rain over the last few hours
    rain = set(range(40, 48))
    granite = conditions.summarize(make_forecast(rain_hours=rain), 0, 0, "granite", None)
    sandstone = conditions.summarize(make_forecast(rain_hours=rain), 0, 0, "sandstone", None)
    assert sandstone["score"] <= 5
    assert any("break holds" in r["text"] for r in sandstone["reasons"])
    assert granite["score"] < 60


def test_heat_lowers_score():
    cool = conditions.summarize(make_forecast(temp=10), 0, 0, "granite", None)
    hot = conditions.summarize(make_forecast(temp=33), 0, 0, "granite", None)
    assert hot["score"] < cool["score"] - 30
