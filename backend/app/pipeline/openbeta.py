"""Import every US and Canadian climb from OpenBeta's open GraphQL API into a JSON snapshot.

    python -m app.pipeline.openbeta                  # every state and province
    python -m app.pipeline.openbeta Texas "Alberta"  # just these (merged into the existing snapshot)
    python -m app.pipeline.openbeta --refresh        # ignore the download cache and re-fetch

OpenBeta stores areas as a tree: country > state > region > ... > wall. Crux needs two levels:
an Area (a destination small enough to share one weather forecast) and its Crags (walls or
boulders that hold routes). `group` walks each state's tree and cuts it into areas.

The snapshot is committed (gzipped) so seeding doesn't depend on the API being up. Raw downloads are
cached in data/.cache (not committed), so changing how areas are cut doesn't mean fetching again.
"""

import gzip
import json
import math
import statistics
import sys
import time
from pathlib import Path
from typing import Any

import httpx

from app.pipeline.destinations import DESTINATIONS, ROCK_HINTS
from app.services import grades
from app.services.geo import haversine_km

API = "https://api.openbeta.io/"
SNAPSHOT = Path(__file__).resolve().parents[2] / "data" / "openbeta_snapshot.json.gz"
CACHE = SNAPSHOT.parent / ".cache"

COUNTRIES = {
    "USA": "1db1e8ba-a40e-587c-88a4-64f5ea814b8e",
    "Canada": "2996145f-e1ba-5b56-9da8-30c64ccc3776",
}
# An area is kept whole when most of its crags sit within this distance of its centre,
# so one forecast and one sun position are a fair fit for all of them.
MAX_AREA_SPREAD_KM = 15
NESTED_LEVELS = 6
UNKNOWN_ROCK = "unknown"

_NODE = "area_name uuid totalClimbs metadata { lat lng }"
_CLIMBS = "climbs { name uuid grades { yds vscale } type { sport trad bouldering tr } safety }"


def _tree_query(levels: int) -> str:
    """One query that returns an area and `levels` generations of descendants, with their climbs."""
    body = f"{_NODE} {_CLIMBS}"
    for _ in range(levels):
        body = f"{_NODE} {_CLIMBS} children {{ {body} }}"
    return f"query Tree($uuid: ID) {{ area(uuid: $uuid) {{ {body} }} }}"


TREE_QUERY = _tree_query(NESTED_LEVELS)
CHILDREN_QUERY = "query Children($uuid: ID) { area(uuid: $uuid) { children { area_name uuid totalClimbs } } }"


def _gql(
    client: httpx.Client, query: str, variables: dict[str, Any], attempts: int = 3, timeout: float = 60
) -> dict[str, Any]:
    for attempt in range(attempts):
        try:
            resp = client.post(API, json={"query": query, "variables": variables}, timeout=timeout)
            resp.raise_for_status()
            body = resp.json()
            if "errors" in body:
                raise RuntimeError(body["errors"])
            return body["data"]
        except (httpx.HTTPError, RuntimeError, ValueError):
            if attempt == attempts - 1:
                raise
            time.sleep(3 * (attempt + 1))
    raise AssertionError("unreachable")


def fetch_tree(client: httpx.Client, uuid: str) -> dict[str, Any] | None:
    """Download a whole subtree. Falls back to one request per child when the response is too big."""
    try:
        # One try only: a subtree that's too big to return in time is quicker to split than to retry.
        node = _gql(client, TREE_QUERY, {"uuid": uuid}, attempts=1, timeout=100)["area"]
    except (httpx.HTTPError, RuntimeError, ValueError):
        children = (_gql(client, CHILDREN_QUERY, {"uuid": uuid})["area"] or {}).get("children") or []
        kids = [fetch_tree(client, c["uuid"]) for c in children if c["totalClimbs"] > 0]
        return {"area_name": "", "uuid": uuid, "totalClimbs": 0, "metadata": None, "climbs": [], "children": kids}
    if node:
        _fill_cut_off(client, node)
    return node


def _fill_cut_off(client: httpx.Client, node: dict[str, Any]) -> None:
    """The nested query stops at a fixed depth. Re-fetch any node there that still has climbs below it."""
    if "children" not in node:
        if node["totalClimbs"] > len(node.get("climbs") or []):
            deeper = fetch_tree(client, node["uuid"])
            node["children"] = (deeper or {}).get("children") or []
        return
    for child in node["children"] or []:
        if child:
            _fill_cut_off(client, child)


def _route(climb: dict[str, Any]) -> dict[str, Any] | None:
    t = climb["type"] or {}
    g = climb["grades"] or {}
    if t.get("bouldering"):
        discipline, grade = "boulder", g.get("vscale")
    else:
        discipline = "sport" if t.get("sport") else "trad" if t.get("trad") else "tr" if t.get("tr") else None
        grade = g.get("yds")
    name = (climb["name"] or "").strip()
    if not (discipline and grade and name) or name.startswith("["):
        return None
    try:
        system, index, grade = grades.parse_grade(grade)
    except ValueError:
        return None
    return {
        "uuid": climb["uuid"],
        "name": name[:200],
        "grade": grade,
        "grade_system": system,
        "grade_index": index,
        "discipline": discipline,
        "safety": None if climb.get("safety") in (None, "UNSPECIFIED") else climb["safety"],
    }


def _crags_under(node: dict[str, Any], path: tuple[str, ...]) -> list[dict[str, Any]]:
    """Every descendant (or the node itself) that directly holds usable routes."""
    out: list[dict[str, Any]] = []
    routes = [r for r in map(_route, node.get("climbs") or []) if r]
    meta = node.get("metadata") or {}
    if routes and meta.get("lat") and meta.get("lng"):
        out.append(
            {
                "uuid": node["uuid"],
                "name": node["area_name"][:200],
                "lat": meta["lat"],
                "lon": meta["lng"],
                "routes": routes,
                "path": path,
            }
        )
    for child in node.get("children") or []:
        if child:
            out.extend(_crags_under(child, (*path, child["area_name"])))
    return out


def _spread_km(crags: list[dict[str, Any]]) -> tuple[float, float, float]:
    """Centre of a set of crags and how far out most of them reach (90th percentile, to ignore bad pins)."""
    lat = statistics.median(c["lat"] for c in crags)
    lon = statistics.median(c["lon"] for c in crags)
    dists = sorted(haversine_km(lat, lon, c["lat"], c["lon"]) for c in crags)
    return lat, lon, dists[math.ceil(0.9 * (len(dists) - 1))]  # small groups: this is simply the farthest


def _plain(name: str) -> str:
    """Normalise an area name for matching: OpenBeta has "Red Rocks" and "New River Gorge, The"."""
    words = "".join(ch if ch.isalnum() else " " for ch in name.lower()).split()
    return " ".join(w.rstrip("s") for w in words if w != "the")


def _curated(name: str, lat: float, lon: float) -> dict[str, Any] | None:
    for dest in DESTINATIONS:
        if _plain(dest["name"]) == _plain(name) and haversine_km(lat, lon, *dest["near"]) < 60:
            return dest
    return None


def _curated_below(node: dict[str, Any]) -> bool:
    """True if a curated destination sits somewhere under this node (so the node must be split to reach it)."""
    for child in node.get("children") or []:
        if not child:
            continue
        meta = child.get("metadata") or {}
        if meta.get("lat") and _curated(child["area_name"], meta["lat"], meta["lng"]):
            return True
        if _curated_below(child):
            return True
    return False


def _rock_type(state: str, path: tuple[str, ...]) -> str:
    names = [p.lower() for p in path]
    for hint_state, fragment, rock in ROCK_HINTS:
        if hint_state == state and any(fragment in n for n in names):
            return rock
    return UNKNOWN_ROCK


def group(node: dict[str, Any], state: str, region: str, path: tuple[str, ...]) -> list[dict[str, Any]]:
    """Cut a subtree into areas: keep a node whole if it's compact (or curated), otherwise recurse."""
    crags = _crags_under(node, path)
    if not crags:
        return []
    lat, lon, spread = _spread_km(crags)
    curated = _curated(node["area_name"], lat, lon)
    children = [c for c in node.get("children") or [] if c]
    compact = spread <= MAX_AREA_SPREAD_KM and not _curated_below(node)
    if curated or compact or not children:
        rock = curated["rock_type"] if curated else _rock_type(state, path)
        out_crags = []
        for c in crags:
            crag = {k: v for k, v in c.items() if k != "path"}
            # A crag deeper in the tree can match a more specific hint than its area did
            # (the area "Boulder" has no single rock type, but "Boulder Canyon" inside it does).
            own = rock if curated else _rock_type(state, c["path"])
            if own not in (rock, UNKNOWN_ROCK):
                crag["rock_type"] = own
            out_crags.append(crag)
        return [
            {
                "uuid": node["uuid"],
                "name": node["area_name"][:200],
                "region": region,
                "lat": round(lat, 5),
                "lon": round(lon, 5),
                "rock_type": rock,
                "description": curated["description"] if curated else "",
                "crags": out_crags,
            }
        ]
    areas: list[dict[str, Any]] = []
    own = [c for c in crags if c["uuid"] == node["uuid"]]
    if own:  # routes attached straight to a sprawling parent: its own one-crag area
        solo = {**node, "children": []}
        areas.extend(group(solo, state, region, path))
    for child in children:
        areas.extend(group(child, state, region, (*path, child["area_name"])))
    return areas


def load_snapshot() -> list[dict[str, Any]]:
    if not SNAPSHOT.exists():
        return []
    with gzip.open(SNAPSHOT, "rt", encoding="utf-8") as f:
        return json.load(f)


def save_snapshot(areas_by_region: dict[str, list[dict[str, Any]]]) -> list[dict[str, Any]]:
    ordered = [a for region in sorted(areas_by_region) for a in areas_by_region[region]]
    SNAPSHOT.parent.mkdir(exist_ok=True)
    with gzip.open(SNAPSHOT, "wt", encoding="utf-8") as f:
        json.dump(ordered, f, separators=(",", ":"))
    return ordered


def main(args: list[str]) -> None:
    refresh = "--refresh" in args
    CACHE.mkdir(parents=True, exist_ok=True)
    names = [a for a in args if not a.startswith("--")]
    areas_by_region: dict[str, list[dict[str, Any]]] = {}
    for area in load_snapshot():
        areas_by_region.setdefault(area["region"], []).append(area)

    with httpx.Client(headers={"User-Agent": "crux-climbing-app"}) as client:
        for country, country_uuid in COUNTRIES.items():
            states = _gql(client, CHILDREN_QUERY, {"uuid": country_uuid})["area"]["children"]
            for state in sorted(states, key=lambda s: s["area_name"]):
                name = state["area_name"]
                region = name if country == "USA" else f"{name}, {country}"
                junk = name.lower().startswith("test")  # OpenBeta has a few sandbox "states"
                if (names and name not in names) or state["totalClimbs"] == 0 or junk:
                    continue
                started = time.time()
                cached = CACHE / f"{region}.json.gz"
                if cached.exists() and not refresh:
                    with gzip.open(cached, "rt", encoding="utf-8") as f:
                        tree = json.load(f)
                else:
                    try:
                        tree = fetch_tree(client, state["uuid"])
                    except (httpx.HTTPError, RuntimeError, ValueError) as exc:
                        print(f"  ! {region}: failed ({exc!r}); keeping what the snapshot already has", flush=True)
                        continue
                    if not tree:
                        continue
                    with gzip.open(cached, "wt", encoding="utf-8") as f:
                        json.dump(tree, f, separators=(",", ":"))
                tree["area_name"] = tree["area_name"] or name
                areas = group(tree, name, region, (name,))
                areas_by_region[region] = areas
                save_snapshot(areas_by_region)  # checkpoint, so a dropped connection doesn't lose the run
                crags = sum(len(a["crags"]) for a in areas)
                routes = sum(len(c["routes"]) for a in areas for c in a["crags"])
                secs = time.time() - started
                print(f"  {region}: {len(areas)} areas, {crags} crags, {routes} routes ({secs:.0f}s)", flush=True)

    ordered = save_snapshot(areas_by_region)
    total = sum(len(c["routes"]) for a in ordered for c in a["crags"])
    print(f"Wrote {SNAPSHOT.name}: {len(ordered)} areas, {total} routes")


if __name__ == "__main__":
    main(sys.argv[1:])
