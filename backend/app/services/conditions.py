"""The Conditions Score: a 0-100 rating of how good climbing is, hour by hour.

Inputs: an Open-Meteo hourly forecast (temperature, humidity, rain, wind, cloud, sunshine),
the wall's aspect (for sun vs. shade), and rules for how each rock type handles water.

1. Rock wetness: rain adds water; sun, wind, warmth and dry air remove it at a rock-specific rate.
2. Rock temperature: air temperature, plus a bonus when the wall is in direct sun.
3. Each factor is scored 0-100 and blended; wet rock and active rain cap the result.
"""

from dataclasses import asdict, dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from app.services.sun import solar_position, wall_in_sun

ROCK_RULES: dict[str, dict[str, Any]] = {
    "granite": {
        "label": "Granite",
        "dry_hours": 4,
        "soft_when_wet": False,
        "note": "Sheds water quickly. Friction peaks in cool, dry air.",
    },
    "sandstone": {
        "label": "Sandstone",
        "dry_hours": 36,
        "soft_when_wet": True,
        "note": "Weak when wet: holds can snap. Wait 24-48h after soaking rain.",
    },
    "limestone": {
        "label": "Limestone",
        "dry_hours": 8,
        "soft_when_wet": False,
        "seeps": True,
        "note": "Dries fast on the surface, but seeps for days after heavy rain.",
    },
    "volcanic": {
        "label": "Volcanic tuff",
        "dry_hours": 12,
        "soft_when_wet": False,
        "note": "Porous rock that holds moisture; give it half a day after rain.",
    },
    "quartzite": {
        "label": "Quartzite",
        "dry_hours": 5,
        "soft_when_wet": False,
        "note": "Hard and slick when damp. Best on crisp, breezy days.",
    },
    "conglomerate": {
        "label": "Conglomerate",
        "dry_hours": 10,
        "soft_when_wet": False,
        "seeps": True,
        "note": "Cobbles can loosen when saturated. Let it dry fully.",
    },
    "gneiss": {
        "label": "Gneiss",
        "dry_hours": 5,
        "soft_when_wet": False,
        "note": "Dries quickly; lichen-covered slabs stay slick longer.",
    },
}
DEFAULT_ROCK = "granite"

IDEAL_TEMP = (7.0, 13.0)  # °C, best friction range for rock temperature


@dataclass
class HourScore:
    time: str
    score: int
    is_day: bool
    temp_c: float
    rock_temp_c: float
    humidity: float
    precip_mm: float
    precip_prob: float
    wind_kmh: float
    cloud: float
    in_sun: bool | None
    wet: bool


def _ramp(value: float, lo_zero: float, lo_full: float, hi_full: float, hi_zero: float) -> float:
    """100 inside [lo_full, hi_full], falling linearly to 0 at lo_zero and hi_zero."""
    if lo_full <= value <= hi_full:
        return 100.0
    if value < lo_full:
        return max(0.0, 100 * (value - lo_zero) / (lo_full - lo_zero))
    return max(0.0, 100 * (hi_zero - value) / (hi_zero - hi_full))


def label_for(score: int) -> str:
    if score >= 80:
        return "Prime"
    if score >= 65:
        return "Good"
    if score >= 45:
        return "Fair"
    if score >= 25:
        return "Poor"
    return "No-go"


def score_hours(
    weather: dict[str, Any], lat: float, lon: float, rock_type: str, aspect_deg: int | None
) -> list[HourScore]:
    rules = ROCK_RULES.get(rock_type, ROCK_RULES[DEFAULT_ROCK])
    hourly = weather["hourly"]
    offset = timedelta(seconds=weather.get("utc_offset_seconds", 0))
    dry_rate = 10.0 / rules["dry_hours"]  # mm of water removed per hour in average conditions

    wetness = 0.0
    rain_72h: list[float] = []
    out: list[HourScore] = []
    for i, ts in enumerate(hourly["time"]):
        when = datetime.fromtimestamp(ts, UTC)
        temp = hourly["temperature_2m"][i] or 0.0
        rh = hourly["relative_humidity_2m"][i] or 0.0
        precip = hourly["precipitation"][i] or 0.0
        prob = hourly["precipitation_probability"][i] or 0.0
        wind = hourly["wind_speed_10m"][i] or 0.0
        cloud = hourly["cloud_cover"][i] or 0.0
        radiation = hourly["direct_radiation"][i] or 0.0
        is_day = bool(hourly["is_day"][i])

        elevation, azimuth = solar_position(lat, lon, when)
        if aspect_deg is None:
            in_sun = None
            sun_share = 0.5  # unknown aspect: assume partly exposed
        else:
            in_sun = wall_in_sun(aspect_deg, elevation, azimuth) and radiation > 50
            sun_share = 1.0 if in_sun else 0.0

        # Wetness model
        drying = dry_rate * (
            0.4
            + 0.8 * sun_share * min(1.0, radiation / 600)
            + 0.3 * min(1.0, wind / 20)
            + 0.02 * max(0.0, temp)
            + 0.4 * max(0.0, (80 - rh) / 80)
        )
        wetness = max(0.0, wetness + precip - drying)
        rain_72h = (rain_72h + [precip])[-72:]
        seeping = rules.get("seeps", False) and sum(rain_72h) > 20
        wet = wetness > 0.5 or seeping

        rock_temp = temp + sun_share * min(10.0, radiation / 80)
        temp_score = _ramp(rock_temp, -8, IDEAL_TEMP[0], IDEAL_TEMP[1], 30)
        humidity_score = 100.0 if rh <= 35 else 25 + 75 * (100 - rh) / 65
        wind_score = _ramp(wind, -15, 6, 20, 55)
        sky_score = 100 - prob * 0.8

        score = 0.45 * temp_score + 0.2 * humidity_score + 0.15 * wind_score + 0.2 * sky_score
        score *= 1 - min(1.0, wetness / 5) * 0.85
        if seeping:
            score = min(score, 55)
        if precip > 0.3:
            score = min(score, 10)
        if wet and rules["soft_when_wet"]:
            score = min(score, 5)

        out.append(
            HourScore(
                time=(when + offset).replace(tzinfo=None).isoformat(timespec="minutes"),
                score=round(score),
                is_day=is_day,
                temp_c=round(temp, 1),
                rock_temp_c=round(rock_temp, 1),
                humidity=round(rh),
                precip_mm=round(precip, 1),
                precip_prob=round(prob),
                wind_kmh=round(wind, 1),
                cloud=round(cloud),
                in_sun=in_sun,
                wet=wet,
            )
        )
    return out


def _reasons(hour: HourScore, rules: dict[str, Any], aspect_deg: int | None) -> list[dict[str, str]]:
    """Plain-language factors behind a score, tagged good / bad / info."""
    r: list[dict[str, str]] = []
    if hour.precip_mm > 0.3:
        r.append({"tone": "bad", "text": f"Raining now ({hour.precip_mm} mm/h)"})
    if hour.wet:
        if rules["soft_when_wet"]:
            r.append({"tone": "bad", "text": f"{rules['label']} is still wet. Climbing it now can break holds"})
        else:
            r.append({"tone": "bad", "text": "Rock is still drying from recent rain"})
    if hour.rock_temp_c > 24:
        r.append({"tone": "bad", "text": f"Hot rock ({hour.rock_temp_c}°C). Friction will suffer"})
    elif hour.rock_temp_c < 0:
        r.append({"tone": "bad", "text": f"Freezing rock ({hour.rock_temp_c}°C)"})
    elif IDEAL_TEMP[0] <= hour.rock_temp_c <= IDEAL_TEMP[1]:
        r.append({"tone": "good", "text": f"Prime friction temps ({hour.rock_temp_c}°C on the rock)"})
    if hour.humidity > 75:
        r.append({"tone": "bad", "text": f"Humid ({hour.humidity}%)"})
    elif hour.humidity < 45:
        r.append({"tone": "good", "text": f"Dry air ({hour.humidity}% humidity)"})
    if hour.wind_kmh > 35:
        r.append({"tone": "bad", "text": f"Strong wind ({hour.wind_kmh} km/h)"})
    elif 6 <= hour.wind_kmh <= 25:
        r.append({"tone": "good", "text": "Light breeze keeps things crisp"})
    if hour.precip_prob >= 50:
        r.append({"tone": "bad", "text": f"{hour.precip_prob}% chance of rain"})
    if aspect_deg is None:
        r.append({"tone": "info", "text": "Wall aspect unknown. Sun/shade estimated"})
    elif hour.in_sun:
        r.append({"tone": "info", "text": "Wall is in the sun"})
    elif hour.is_day:
        r.append({"tone": "info", "text": "Wall is in the shade"})
    return r


def _best_windows(hours: list[HourScore], now_index: int) -> list[dict[str, Any]]:
    """Daylight stretches (2h+) in the coming days where the score stays at 65+."""
    windows, run = [], []
    for h in hours[now_index:] + [None]:
        if h is not None and h.is_day and h.score >= 65:
            run.append(h)
            continue
        if len(run) >= 2:
            windows.append(
                {
                    "start": run[0].time,
                    "end": run[-1].time,
                    "avg_score": round(sum(x.score for x in run) / len(run)),
                    "peak_score": max(x.score for x in run),
                }
            )
        run = []
    return sorted(windows, key=lambda w: (-w["avg_score"], w["start"]))[:3]


def summarize(
    weather: dict[str, Any],
    lat: float,
    lon: float,
    rock_type: str,
    aspect_deg: int | None,
    now: datetime | None = None,
) -> dict[str, Any]:
    rules = ROCK_RULES.get(rock_type, ROCK_RULES[DEFAULT_ROCK])
    hours = score_hours(weather, lat, lon, rock_type, aspect_deg)
    now_ts = (now or datetime.now(UTC)).timestamp()
    times = weather["hourly"]["time"]
    now_index = max((i for i, t in enumerate(times) if t <= now_ts), default=0)
    current = hours[now_index]

    days: dict[str, dict[str, Any]] = {}
    for h in hours[now_index:]:
        if not h.is_day:
            continue
        day = days.setdefault(
            h.time[:10],
            {
                "date": h.time[:10],
                "best_score": 0,
                "best_time": h.time,
                "high_c": h.temp_c,
                "low_c": h.temp_c,
                "rain_mm": 0.0,
            },
        )
        if h.score > day["best_score"]:
            day["best_score"], day["best_time"] = h.score, h.time
        day["high_c"] = max(day["high_c"], h.temp_c)
        day["low_c"] = min(day["low_c"], h.temp_c)
        day["rain_mm"] = round(day["rain_mm"] + h.precip_mm, 1)

    return {
        "score": current.score,
        "label": label_for(current.score),
        "now": asdict(current),
        "reasons": _reasons(current, rules, aspect_deg),
        "rock": {"type": rock_type, **rules},
        "best_windows": _best_windows(hours, now_index),
        "days": list(days.values())[:4],
        "hourly": [asdict(h) for h in hours[now_index : now_index + 72]],
    }
