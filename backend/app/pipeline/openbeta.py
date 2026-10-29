"""Import routes from OpenBeta's open GraphQL API into a JSON snapshot.

    python -m app.pipeline.openbeta              # all destinations -> data/openbeta_snapshot.json
    python -m app.pipeline.openbeta "Smith Rock" # just one

Each destination's area tree is walked breadth-first. Every sub-area that directly holds climbs
becomes a crag. The snapshot is committed to the repo so seeding doesn't depend on the API being up.
"""

import json
import sys
import time
from pathlib import Path
from typing import Any

import httpx

from app.pipeline.destinations import DESTINATIONS
from app.services import grades
from app.services.geo import haversine_km

API = "https://api.openbeta.io/"
SNAPSHOT = Path(__file__).resolve().parents[2] / "data" / "openbeta_snapshot.json"

MAX_CRAGS_PER_DESTINATION = 40
MAX_ROUTES_PER_CRAG = 80
MAX_REQUESTS_PER_DESTINATION = 250

FIND_QUERY = """
query Find($name: String!) {
  areas(filter: {area_name: {match: $name}}) { area_name uuid totalClimbs metadata { lat lng } }
}"""

AREA_QUERY = """
query Area($uuid: ID) {
  area(uuid: $uuid) {
    children {
      area_name uuid totalClimbs metadata { lat lng }
      climbs { name uuid grades { yds vscale } type { sport trad bouldering tr } safety }
    }
  }
}"""


def _gql(client: httpx.Client, query: str, variables: dict[str, Any]) -> dict[str, Any]:
    for attempt in range(3):
        try:
            resp = client.post(API, json={"query": query, "variables": variables}, timeout=30)
            resp.raise_for_status()
            body = resp.json()
            if "errors" in body:
                raise RuntimeError(body["errors"])
            return body["data"]
        except (httpx.HTTPError, RuntimeError):
            if attempt == 2:
                raise
            time.sleep(2 * (attempt + 1))
    raise AssertionError("unreachable")


def find_root(client: httpx.Client, dest: dict[str, Any]) -> dict[str, Any] | None:
    """The area with this name that's near the expected spot and has the most climbs."""
    candidates = _gql(client, FIND_QUERY, {"name": dest["name"]})["areas"]
    lat, lon = dest["near"]
    close = [
        a
        for a in candidates
        if a["metadata"] and haversine_km(lat, lon, a["metadata"]["lat"], a["metadata"]["lng"]) < 60
    ]
    return max(close, key=lambda a: a["totalClimbs"], default=None)


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


def import_destination(client: httpx.Client, dest: dict[str, Any]) -> dict[str, Any] | None:
    root = find_root(client, dest)
    if root is None:
        print(f"  ! no OpenBeta area found for {dest['name']}")
        return None
    crags: list[dict[str, Any]] = []
    queue, requests = [root["uuid"]], 0
    while queue and requests < MAX_REQUESTS_PER_DESTINATION:
        uuid = queue.pop(0)
        requests += 1
        children = (_gql(client, AREA_QUERY, {"uuid": uuid})["area"] or {}).get("children") or []
        for child in children:
            routes = [r for r in map(_route, child["climbs"] or []) if r]
            meta = child["metadata"] or {}
            if routes and meta.get("lat"):
                crags.append(
                    {
                        "uuid": child["uuid"],
                        "name": child["area_name"][:200],
                        "lat": meta["lat"],
                        "lon": meta["lng"],
                        "routes": routes[:MAX_ROUTES_PER_CRAG],
                    }
                )
            elif child["totalClimbs"] > 0:
                queue.append(child["uuid"])
    crags.sort(key=lambda c: -len(c["routes"]))
    crags = crags[:MAX_CRAGS_PER_DESTINATION]
    total = sum(len(c["routes"]) for c in crags)
    print(f"  {dest['name']}: {len(crags)} crags, {total} routes ({requests} requests)")
    return {
        **{k: v for k, v in dest.items() if k != "near"},
        "uuid": root["uuid"],
        "lat": root["metadata"]["lat"],
        "lon": root["metadata"]["lng"],
        "crags": crags,
    }


def main(names: list[str]) -> None:
    selected = [d for d in DESTINATIONS if not names or d["name"] in names]
    existing = json.loads(SNAPSHOT.read_text()) if SNAPSHOT.exists() else []
    by_name = {d["name"]: d for d in existing}
    with httpx.Client(headers={"User-Agent": "crux-climbing-app"}) as client:
        for dest in selected:
            print(f"Importing {dest['name']}...")
            result = import_destination(client, dest)
            if result:
                by_name[dest["name"]] = result
    SNAPSHOT.parent.mkdir(exist_ok=True)
    ordered = [by_name[d["name"]] for d in DESTINATIONS if d["name"] in by_name]
    SNAPSHOT.write_text(json.dumps(ordered, separators=(",", ":")))
    print(f"Wrote {SNAPSHOT} ({len(ordered)} destinations)")


if __name__ == "__main__":
    main(sys.argv[1:])
