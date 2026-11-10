"""The OpenBeta importer's grouping step: cutting a state's area tree into destinations."""

from app.pipeline.openbeta import UNKNOWN_ROCK, group


def _climb(n: int) -> dict:
    return {
        "name": f"Route {n}",
        "uuid": f"climb-{n}",
        "grades": {"yds": "5.10a", "vscale": None},
        "type": {"sport": True},
        "safety": "UNSPECIFIED",
    }


def _wall(name: str, lat: float, lon: float, n: int) -> dict:
    return {
        "area_name": name,
        "uuid": name,
        "totalClimbs": 1,
        "metadata": {"lat": lat, "lng": lon},
        "climbs": [_climb(n)],
    }


def _parent(name: str, children: list[dict]) -> dict:
    return {
        "area_name": name,
        "uuid": name,
        "totalClimbs": len(children),
        "metadata": None,
        "climbs": [],
        "children": children,
    }


def test_compact_area_stays_whole_and_sprawling_state_is_split():
    hueco = _parent("Hueco Tanks", [_wall("North Mountain", 31.92, -106.04, 1), _wall("East Spur", 31.93, -106.03, 2)])
    far = _parent("Enchanted Rock", [_wall("Main Dome", 30.50, -98.82, 3)])
    areas = group(_parent("Texas", [hueco, far]), "Texas", "Texas", ("Texas",))

    by_name = {a["name"]: a for a in areas}
    assert set(by_name) == {"Hueco Tanks", "Enchanted Rock"}  # 700 km apart: two destinations, not one "Texas"
    assert [c["name"] for c in by_name["Hueco Tanks"]["crags"]] == ["North Mountain", "East Spur"]
    assert by_name["Hueco Tanks"]["rock_type"] == "syenite"  # from ROCK_HINTS
    assert by_name["Enchanted Rock"]["rock_type"] == "granite"


def test_unlisted_area_gets_unknown_rock_and_climbs_without_grades_are_dropped():
    wall = _wall("Mystery Wall", 40.0, -100.0, 1)
    wall["climbs"].append({"name": "No grade", "uuid": "x", "grades": None, "type": {"sport": True}, "safety": None})
    (area,) = group(_parent("Somewhere", [wall]), "Nebraska", "Nebraska", ("Nebraska",))
    assert area["rock_type"] == UNKNOWN_ROCK
    assert [r["name"] for r in area["crags"][0]["routes"]] == ["Route 1"]
