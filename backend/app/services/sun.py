"""Where the sun is in the sky, using NOAA's low-precision solar position equations (good to ~1°)."""

import math
from datetime import UTC, datetime


def solar_position(lat: float, lon: float, when: datetime) -> tuple[float, float]:
    """Return (elevation_deg, azimuth_deg) for a UTC time. Azimuth is clockwise from north."""
    when = when.astimezone(UTC)
    day_of_year = when.timetuple().tm_yday
    hour = when.hour + when.minute / 60 + when.second / 3600

    gamma = 2 * math.pi / 365 * (day_of_year - 1 + (hour - 12) / 24)  # fractional year, radians
    eq_time = 229.18 * (
        0.000075
        + 0.001868 * math.cos(gamma)
        - 0.032077 * math.sin(gamma)
        - 0.014615 * math.cos(2 * gamma)
        - 0.040849 * math.sin(2 * gamma)
    )
    decl = (
        0.006918
        - 0.399912 * math.cos(gamma)
        + 0.070257 * math.sin(gamma)
        - 0.006758 * math.cos(2 * gamma)
        + 0.000907 * math.sin(2 * gamma)
        - 0.002697 * math.cos(3 * gamma)
        + 0.00148 * math.sin(3 * gamma)
    )

    true_solar_minutes = hour * 60 + eq_time + 4 * lon
    hour_angle = math.radians(true_solar_minutes / 4 - 180)
    lat_r = math.radians(lat)

    cos_zenith = math.sin(lat_r) * math.sin(decl) + math.cos(lat_r) * math.cos(decl) * math.cos(hour_angle)
    zenith = math.acos(max(-1.0, min(1.0, cos_zenith)))
    elevation = 90 - math.degrees(zenith)

    azimuth = math.degrees(
        math.atan2(
            math.sin(hour_angle),
            math.cos(hour_angle) * math.sin(lat_r) - math.tan(decl) * math.cos(lat_r),
        )
    )
    return elevation, (azimuth + 180) % 360


def wall_in_sun(aspect_deg: float, sun_elevation: float, sun_azimuth: float) -> bool:
    """A wall is lit when the sun is up and within ~80° of the direction the wall faces."""
    diff = abs((sun_azimuth - aspect_deg + 180) % 360 - 180)
    return sun_elevation > 4 and diff < 80
