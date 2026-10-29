"""Progression analytics computed from a climber's logbook: grade pyramid, send trends, stats."""

from collections import Counter, defaultdict
from datetime import date, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Ascent
from app.services import grades

SEND_STYLES = {"onsight", "flash", "redpoint", "send", "repeat"}


def _month_key(d: date) -> str:
    return f"{d.year:04d}-{d.month:02d}"


def _last_months(today: date, n: int) -> list[str]:
    keys, y, m = [], today.year, today.month
    for _ in range(n):
        keys.append(f"{y:04d}-{m:02d}")
        y, m = (y, m - 1) if m > 1 else (y - 1, 12)
    return keys[::-1]


def _pyramid(sends: list[Ascent], system: str) -> list[dict[str, Any]]:
    rows: dict[str, dict[str, Any]] = {}
    for a in sends:
        if a.grade_system != system or a.style == "repeat":
            continue
        label = grades.bucket(system, a.grade_index)
        row = rows.setdefault(
            label,
            {
                "grade": label,
                "index": grades.bucket_index(system, label),
                "total": 0,
                "onsight": 0,
                "flash": 0,
                "redpoint": 0,
            },
        )
        row["total"] += 1
        key = a.style if a.style in ("onsight", "flash") else "redpoint"
        row[key] += 1
    ordered = sorted(rows.values(), key=lambda r: -r["index"])
    return ordered[:10]


def _hardest(sends: list[Ascent], system: str) -> dict[str, Any] | None:
    best = max((a for a in sends if a.grade_system == system), key=lambda a: a.grade_index, default=None)
    if best is None:
        return None
    return {"name": best.name, "grade": best.grade, "date": best.climbed_on.isoformat(), "style": best.style}


def _weekly_streak(days: set[date], today: date) -> int:
    """Consecutive weeks (ending this week or last week) with at least one climbing day."""
    weeks = {d - timedelta(days=d.weekday()) for d in days}
    current = today - timedelta(days=today.weekday())
    if current not in weeks:
        current -= timedelta(weeks=1)
    streak = 0
    while current in weeks:
        streak += 1
        current -= timedelta(weeks=1)
    return streak


def compute(db: Session, user_id: int, today: date | None = None) -> dict[str, Any]:
    today = today or date.today()
    ascents = list(db.scalars(select(Ascent).where(Ascent.user_id == user_id).order_by(Ascent.climbed_on)))
    sends = [a for a in ascents if a.style in SEND_STYLES]
    days = {a.climbed_on for a in ascents}

    months = _last_months(today, 12)
    trend: dict[str, dict[str, Any]] = {
        m: {
            "month": m,
            "sends": 0,
            "attempts": 0,
            "days": 0,
            "max_route": None,
            "max_boulder": None,
            "_route_i": -1,
            "_boulder_i": -1,
        }
        for m in months
    }
    days_by_month: dict[str, set[date]] = defaultdict(set)
    for a in ascents:
        key = _month_key(a.climbed_on)
        if key not in trend:
            continue
        t = trend[key]
        days_by_month[key].add(a.climbed_on)
        if a.style in SEND_STYLES:
            t["sends"] += 1
            field = "route" if a.grade_system == grades.YDS else "boulder"
            if a.grade_index > t[f"_{field}_i"]:
                t[f"_{field}_i"] = a.grade_index
                t[f"max_{field}"] = grades.bucket(a.grade_system, a.grade_index)
        else:
            t["attempts"] += 1
    for key, t in trend.items():
        t["days"] = len(days_by_month[key])
        route_i, boulder_i = t.pop("_route_i"), t.pop("_boulder_i")
        t["max_route_index"] = route_i if route_i >= 0 else None
        t["max_boulder_index"] = boulder_i if boulder_i >= 0 else None

    cutoff = today - timedelta(days=90)
    recent = [a for a in sends if a.climbed_on >= cutoff]

    return {
        "totals": {
            "ascents": len(ascents),
            "sends": len(sends),
            "days": len(days),
            "outdoor": sum(1 for a in ascents if not a.is_gym),
            "gym": sum(1 for a in ascents if a.is_gym),
            "venues": len({a.venue for a in ascents if a.venue}),
            "weekly_streak": _weekly_streak(days, today),
        },
        "hardest": {"route": _hardest(sends, grades.YDS), "boulder": _hardest(sends, grades.V)},
        "hardest_recent": {"route": _hardest(recent, grades.YDS), "boulder": _hardest(recent, grades.V)},
        "pyramid": {"route": _pyramid(sends, grades.YDS), "boulder": _pyramid(sends, grades.V)},
        "trend": list(trend.values()),
        "styles": dict(Counter(a.style for a in ascents)),
        "disciplines": dict(Counter(a.discipline for a in ascents)),
    }
