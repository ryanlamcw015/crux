"""Load the OpenBeta snapshot into the database and create a demo account with realistic history.

    python -m app.pipeline.seed            # places + demo data (safe to re-run)
    python -m app.pipeline.seed --reset-demo   # wipe and regenerate demo users' data

Demo climbers are fictional. Their logbooks reference real routes from the snapshot.
"""

import json
import random
import secrets
import sys
from bisect import bisect_left, bisect_right
from datetime import UTC, date, datetime, time, timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import (
    Activity,
    Area,
    Ascent,
    Crag,
    Friendship,
    Kudos,
    PartnerPost,
    PartnerReply,
    Route,
    User,
)
from app.pipeline.openbeta import SNAPSHOT
from app.services import grades

GYMS = [
    ("Basecamp Bouldering", 45.52, -122.68),
    ("The Overhang", 37.80, -122.27),
    ("Summit Collective", 39.74, -104.99),
    ("Crimp City Climbing", 40.76, -111.89),
]

DEMO_PEOPLE = [
    # username, display name, hue, bio, home area, route progression (start, end), boulder (start, end)
    (
        "demo",
        "Sam Rivera",
        160,
        "Weekend warrior chasing 5.12. Friction snob. Always down for a dawn patrol.",
        "Smith Rock",
        (100, 180),
        (1040, 1070),
    ),
    (
        "maya_k",
        "Maya Kim",
        320,
        "Boulderer first, sport climber when my skin needs a break.",
        "Joshua Tree National Park",
        (110, 150),
        (1050, 1090),
    ),
    (
        "jonah",
        "Jonah Weiss",
        30,
        "Crack addict. Will drive 8 hours for a splitter.",
        "Indian Creek",
        (120, 190),
        (1030, 1050),
    ),
    (
        "priya",
        "Priya Patel",
        260,
        "New to outdoor climbing, looking for mentors and partners!",
        "Red River Gorge",
        (80, 125),
        (1020, 1045),
    ),
    (
        "leo_b",
        "Leo Brandt",
        200,
        "Limestone enjoyer. Rifle every summer.",
        "Rifle Mountain Park",
        (150, 230),
        (1050, 1070),
    ),
]


def load_places(db: Session) -> None:
    data = json.loads(SNAPSHOT.read_text())
    known_areas = set(db.scalars(select(Area.openbeta_uuid)))
    for dest in data:
        if dest["uuid"] in known_areas:
            continue
        crags = dest["crags"]
        area = Area(
            openbeta_uuid=dest["uuid"],
            name=dest["name"],
            region=dest["region"],
            lat=dest["lat"],
            lon=dest["lon"],
            rock_type=dest["rock_type"],
            description=dest["description"],
            route_count=sum(len(c["routes"]) for c in crags),
        )
        for c in crags:
            crag = Crag(
                openbeta_uuid=c["uuid"], name=c["name"], lat=c["lat"], lon=c["lon"], route_count=len(c["routes"])
            )
            crag.routes = [
                Route(
                    openbeta_uuid=r["uuid"],
                    name=r["name"],
                    grade=r["grade"],
                    grade_system=r["grade_system"],
                    grade_index=r["grade_index"],
                    discipline=r["discipline"],
                    safety=r["safety"],
                )
                for r in c["routes"]
            ]
            area.crags.append(crag)
        db.add(area)
        db.commit()
        print(f"  loaded {dest['name']}: {len(crags)} crags, {area.route_count} routes")


def _pick_grade(rng: random.Random, top: int, step: int) -> int:
    """Pyramid-shaped: most climbs a few grades below your max, a few at it."""
    below = min(int(rng.expovariate(0.55)), 6)
    return top - below * step


def _ascents_for(
    rng: random.Random,
    user: User,
    routes_by_system: dict[str, tuple[list[Route], list[int]]],
    home: Area | None,
    prog_route: tuple[int, int],
    prog_boulder: tuple[int, int],
    today: date,
) -> list[Ascent]:
    out: list[Ascent] = []
    start = today - timedelta(days=420)
    day = start
    while day <= today:
        day += timedelta(days=rng.choice([2, 3, 3, 4, 5, 7]))
        if day > today:
            break
        progress = (day - start).days / 420
        gym = rng.random() < 0.4
        for _ in range(rng.randint(2, 5)):
            boulder = rng.random() < (0.6 if gym else 0.3)
            lo, hi = prog_boulder if boulder else prog_route
            top = int(lo + (hi - lo) * progress)
            target = _pick_grade(rng, top, 10)
            style = rng.choices(["onsight", "flash", "redpoint", "repeat", "attempt"], [3, 3, 4, 1, 3])[0]
            if boulder and style == "redpoint":
                style = "send"
            if gym:
                system = grades.V if boulder else grades.YDS
                label = grades.bucket(system, max(target, 1000 if boulder else 60))
                _, index, label = grades.parse_grade(label)
                gym_name = GYMS[user.id % len(GYMS)][0]
                out.append(
                    Ascent(
                        user_id=user.id,
                        name=rng.choice(
                            [
                                "Blue tag",
                                "Comp set",
                                "Purple circuit",
                                "The roof problem",
                                "Lane 7",
                                "Arete",
                                "Volume madness",
                            ]
                        ),
                        grade=label,
                        grade_system=system,
                        grade_index=index,
                        discipline="boulder" if boulder else "sport",
                        venue=gym_name,
                        is_gym=True,
                        climbed_on=day,
                        style=style,
                        attempts=rng.randint(1, 6),
                    )
                )
                continue
            pool, keys = routes_by_system[grades.V if boulder else grades.YDS]
            in_grade = pool[bisect_left(keys, target - 5) : bisect_right(keys, target + 5)]
            if not in_grade:
                continue
            local = [r for r in in_grade if home is not None and r.crag.area_id == home.id]
            near = local if local and rng.random() < 0.85 else in_grade
            r = rng.choice(near)
            out.append(
                Ascent(
                    user_id=user.id,
                    route_id=r.id,
                    name=r.name,
                    grade=r.grade,
                    grade_system=r.grade_system,
                    grade_index=r.grade_index,
                    discipline=r.discipline,
                    venue=f"{r.crag.name}, {r.crag.area.name}",
                    is_gym=False,
                    climbed_on=day,
                    style=style,
                    attempts=1 if style in ("onsight", "flash") else rng.randint(2, 8),
                    rating=rng.choice([None, 2, 3, 3, 4]),
                    notes=rng.choice(
                        [
                            "",
                            "",
                            "Crisp conditions, felt great.",
                            "Pumped out at the chains.",
                            "Finally! Third session on it.",
                            "Sandbagged for sure.",
                            "Beautiful line, go do it.",
                        ]
                    ),
                )
            )
    return out


def _at(d: date, hour: int = 18) -> datetime:
    """A timestamp on day d, never in the future (feed items must not say "just now" forever)."""
    when = datetime.combine(d, time(hour, 0), tzinfo=UTC)
    return min(when, datetime.now(UTC) - timedelta(minutes=30 + hour))


def seed_demo(db: Session, reset: bool) -> None:
    usernames = [p[0] for p in DEMO_PEOPLE]
    existing = db.scalars(select(User).where(User.username.in_(usernames))).all()
    if existing and not reset:
        print("  demo users already exist (use --reset-demo to regenerate)")
        return
    if existing:
        ids = [u.id for u in existing]
        for model, col in (
            (Kudos, Kudos.user_id),
            (Activity, Activity.user_id),
            (PartnerReply, PartnerReply.user_id),
            (PartnerPost, PartnerPost.user_id),
            (Ascent, Ascent.user_id),
        ):
            db.execute(delete(model).where(col.in_(ids)))
        db.execute(delete(Friendship).where(Friendship.requester_id.in_(ids) | Friendship.addressee_id.in_(ids)))
        db.execute(delete(User).where(User.id.in_(ids)))
        db.commit()

    rng = random.Random(42)
    today = date.today()
    areas = {a.name: a for a in db.scalars(select(Area))}
    routes = db.scalars(
        select(Route).options(selectinload(Route.crag).selectinload(Crag.area)).order_by(Route.grade_index)
    ).all()
    routes_by_system = {}
    for system in (grades.YDS, grades.V):
        pool = [r for r in routes if r.grade_system == system]
        routes_by_system[system] = (pool, [r.grade_index for r in pool])  # sorted, for bisect

    users: dict[str, User] = {}
    for username, name, hue, bio, home, prog_r, prog_b in DEMO_PEOPLE:
        u = User(
            username=username,
            email=f"{username}@demo.crux.app",
            display_name=name,
            bio=bio,
            avatar_hue=hue,
            password_hash=hash_password(secrets.token_urlsafe(24)),
            is_demo=True,
            home_area_id=areas[home].id if home in areas else None,
            created_at=_at(today - timedelta(days=430)),
        )
        db.add(u)
        db.flush()
        users[username] = u
        ascents = _ascents_for(rng, u, routes_by_system, areas.get(home), prog_r, prog_b, today)
        db.add_all(ascents)
        db.flush()
        for a in ascents[-25:]:  # only recent climbs appear in the feed
            db.add(
                Activity(user_id=u.id, kind="ascent", ascent_id=a.id, created_at=_at(a.climbed_on, rng.randint(15, 21)))
            )

    demo = users["demo"]
    for friend in ("maya_k", "jonah", "priya"):
        db.add(
            Friendship(
                requester_id=users[friend].id,
                addressee_id=demo.id,
                status="accepted",
                created_at=_at(today - timedelta(days=200)),
            )
        )
    db.add(Friendship(requester_id=users["maya_k"].id, addressee_id=users["jonah"].id, status="accepted"))
    db.add(Friendship(requester_id=users["leo_b"].id, addressee_id=demo.id, status="pending"))
    db.add(
        Activity(
            user_id=users["priya"].id,
            kind="friend",
            other_user_id=demo.id,
            created_at=_at(today - timedelta(days=9), 12),
        )
    )

    posts = [
        (
            "maya_k",
            "outdoor",
            "Joshua Tree National Park",
            3,
            "morning",
            "boulder,trad",
            "V4-V7",
            "Heading out early for the cool temps. Have 2 pads, would love a third!",
        ),
        (
            "jonah",
            "outdoor",
            "Indian Creek",
            6,
            "all-day",
            "trad",
            "5.10-5.12",
            "Full rack of cams. Looking for someone to swap leads on splitters.",
        ),
        (
            "priya",
            "gym",
            None,
            1,
            "evening",
            "boulder,sport",
            "V2-V4 / 5.10",
            "After-work session, happy to give and take beta!",
        ),
        (
            "leo_b",
            "outdoor",
            "Rifle Mountain Park",
            9,
            "afternoon",
            "sport",
            "5.12-5.13",
            "Projecting in the Arsenal. Need a patient belayer, will return the favor.",
        ),
        (
            "demo",
            "outdoor",
            "Smith Rock",
            4,
            "morning",
            "sport",
            "5.10-5.12",
            "Dawn patrol at the Dihedrals before it bakes. Car-pooling from Bend.",
        ),
    ]
    for i, (username, setting, area_name, days, tod, disc, grade_range, message) in enumerate(posts):
        area = areas.get(area_name) if area_name else None
        gym = GYMS[i % len(GYMS)]
        post = PartnerPost(
            user_id=users[username].id,
            setting=setting,
            area_id=area.id if area else None,
            location_name=area.name if area else gym[0],
            lat=area.lat if area else gym[1],
            lon=area.lon if area else gym[2],
            climb_on=today + timedelta(days=days),
            time_of_day=tod,
            disciplines=disc,
            grade_range=grade_range,
            message=message,
            created_at=_at(today - timedelta(days=1), 9 + i),
        )
        db.add(post)
        db.flush()
        db.add(Activity(user_id=post.user_id, kind="partner_post", partner_post_id=post.id, created_at=post.created_at))
        if username == "demo":
            db.add(
                PartnerReply(
                    post_id=post.id, user_id=users["priya"].id, message="I'm in! Can meet at the main lot at 7?"
                )
            )
        elif username in ("maya_k", "jonah"):
            db.add(
                PartnerReply(post_id=post.id, user_id=users["priya"].id, message="Would love to join if there's room.")
            )
    db.flush()

    for act in db.scalars(select(Activity).where(Activity.user_id.in_([u.id for u in users.values()]))):
        for u in users.values():
            if u.id != act.user_id and rng.random() < 0.3:
                db.add(Kudos(activity_id=act.id, user_id=u.id))
    db.commit()
    print(f"  demo users: {', '.join(users)}")


def main() -> None:
    reset = "--reset-demo" in sys.argv
    with SessionLocal() as db:
        print("Loading places...")
        load_places(db)
        print("Seeding demo climbers...")
        if get_settings().demo_username not in [p[0] for p in DEMO_PEOPLE]:
            print("  ! DEMO_USERNAME doesn't match a seeded user")
        seed_demo(db, reset)
    print("Done.")


if __name__ == "__main__":
    main()
