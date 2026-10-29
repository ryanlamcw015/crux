from datetime import date, timedelta

from tests.conftest import register


def test_register_login_me(client):
    headers = register(client, "alice")
    assert client.get("/api/auth/me", headers=headers).json()["username"] == "alice"
    assert client.post("/api/auth/login", json={"login": "ALICE", "password": "password123"}).status_code == 200
    assert client.post("/api/auth/login", json={"login": "alice", "password": "nope"}).status_code == 401
    assert client.get("/api/auth/me").status_code == 401


def test_duplicate_username_rejected(client):
    register(client, "alice")
    resp = client.post(
        "/api/auth/register",
        json={"username": "Alice", "email": "other@example.com", "password": "password123", "display_name": "A"},
    )
    assert resp.status_code == 409


def test_areas_have_scores_and_nearby_filter(client):
    areas = client.get("/api/areas").json()
    assert {a["name"] for a in areas} == {"Test Crag Area", "Far Away"}
    assert all(a["conditions"]["score"] >= 0 for a in areas)

    near = client.get("/api/areas", params={"lat": 44.4, "lon": -121.1, "radius_km": 50, "sort": "distance"}).json()
    assert [a["name"] for a in near] == ["Test Crag Area"]
    assert near[0]["distance_km"] < 10


def test_area_and_crag_detail(client):
    area_id = client.get("/api/areas", params={"q": "Test"}).json()[0]["id"]
    area = client.get(f"/api/areas/{area_id}").json()
    assert area["crags"][0]["name"] == "Sunny Wall"
    assert len(area["forecast"]["hourly"]) > 24
    crag = client.get(f"/api/crags/{area['crags'][0]['id']}").json()
    assert [r["name"] for r in crag["routes"]] == ["Easy Street", "Hard Thing"]


def test_route_search_by_grade(client):
    hits = client.get("/api/routes", params={"grade_min": "5.11a"}).json()
    assert [r["name"] for r in hits] == ["Hard Thing"]


def test_logbook_and_analytics(client):
    headers = register(client, "alice")
    route_id = client.get("/api/routes", params={"q": "Easy"}).json()[0]["id"]
    today = date.today()
    r1 = client.post(
        "/api/ascents",
        headers=headers,
        json={"route_id": route_id, "climbed_on": today.isoformat(), "style": "onsight"},
    )
    assert r1.status_code == 201
    assert r1.json()["venue"] == "Sunny Wall, Test Crag Area"
    r2 = client.post(
        "/api/ascents",
        headers=headers,
        json={
            "name": "Pink problem",
            "grade": "V5",
            "discipline": "boulder",
            "is_gym": True,
            "venue": "Gym",
            "climbed_on": (today - timedelta(days=40)).isoformat(),
            "style": "redpoint",
        },
    )
    assert r2.json()["style"] == "send"  # boulders are "sent", not "redpointed"

    stats = client.get("/api/analytics", headers=headers).json()
    assert stats["totals"]["sends"] == 2
    assert stats["hardest"]["boulder"]["grade"] == "V5"
    assert stats["pyramid"]["route"][0]["grade"] == "5.9"
    assert sum(m["sends"] for m in stats["trend"]) == 2

    ascent_id = r1.json()["id"]
    assert client.delete(f"/api/ascents/{ascent_id}", headers=register(client, "mallory")).status_code == 404
    assert client.delete(f"/api/ascents/{ascent_id}", headers=headers).status_code == 204


def test_friends_feed_and_kudos(client):
    alice, bob = register(client, "alice"), register(client, "bob")
    assert client.post("/api/friends/bob", headers=alice).json()["status"] == "outgoing"
    assert client.get("/api/friends", headers=bob).json()["incoming"][0]["user"]["username"] == "alice"
    assert client.post("/api/friends/alice", headers=bob).json()["status"] == "friends"

    client.post(
        "/api/ascents",
        headers=bob,
        json={
            "name": "Gym route",
            "grade": "5.11a",
            "discipline": "sport",
            "is_gym": True,
            "climbed_on": date.today().isoformat(),
            "style": "flash",
        },
    )
    feed = client.get("/api/feed", headers=alice).json()
    ascent_item = next(i for i in feed if i["kind"] == "ascent")
    assert ascent_item["user"]["username"] == "bob"

    assert client.post(f"/api/feed/{ascent_item['id']}/kudos", headers=alice).status_code == 204
    assert client.post(f"/api/feed/{ascent_item['id']}/kudos", headers=alice).status_code == 204  # idempotent
    item = next(i for i in client.get("/api/feed", headers=alice).json() if i["id"] == ascent_item["id"])
    assert item["kudos_count"] == 1 and item["kudoed_by_me"]

    # Strangers' activity stays out of your feed
    carol = register(client, "carol")
    assert all(i["user"]["username"] != "bob" for i in client.get("/api/feed", headers=carol).json())


def test_partner_finder(client):
    alice, bob = register(client, "alice"), register(client, "bob")
    area_id = client.get("/api/areas", params={"q": "Test"}).json()[0]["id"]
    resp = client.post(
        "/api/partners",
        headers=alice,
        json={
            "setting": "outdoor",
            "area_id": area_id,
            "climb_on": (date.today() + timedelta(days=2)).isoformat(),
            "time_of_day": "morning",
            "disciplines": ["sport", "trad"],
            "grade_range": "5.10-5.11",
        },
    )
    assert resp.status_code == 201
    post = resp.json()
    assert post["location_name"] == "Test Crag Area" and post["disciplines"] == ["sport", "trad"]

    near = client.get("/api/partners", headers=bob, params={"lat": 44.4, "lon": -121.1, "radius_km": 25}).json()
    assert [p["id"] for p in near] == [post["id"]]
    assert client.get("/api/partners", headers=bob, params={"lat": 37.7, "lon": -119.6, "radius_km": 25}).json() == []
    assert client.get("/api/partners", headers=bob, params={"discipline": "boulder"}).json() == []

    replied = client.post(f"/api/partners/{post['id']}/replies", headers=bob, json={"message": "I'm in!"}).json()
    assert replied["replies"][0]["user"]["username"] == "bob"
    assert client.post(f"/api/partners/{post['id']}/close", headers=bob).status_code == 404
    assert client.post(f"/api/partners/{post['id']}/close", headers=alice).json()["status"] == "closed"
