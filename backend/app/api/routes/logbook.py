from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.api.deps import DB, CurrentUser
from app.models import Ascent, Route, User
from app.schemas.logbook import AscentIn, AscentOut
from app.services import analytics, grades, social

router = APIRouter(prefix="/api", tags=["logbook"])


def _apply(ascent: Ascent, body: AscentIn, db: DB) -> None:
    """Fill an ascent from the request, copying climb details from the route when one is linked."""
    if body.route_id is not None:
        route = db.get(Route, body.route_id)
        if route is None:
            raise HTTPException(404, "Route not found")
        ascent.route_id = route.id
        ascent.name, ascent.grade = route.name, route.grade
        ascent.grade_system, ascent.grade_index = route.grade_system, route.grade_index
        ascent.discipline = route.discipline
        ascent.venue = f"{route.crag.name}, {route.crag.area.name}"
        ascent.is_gym = False
    else:
        if not (body.name and body.grade and body.discipline):
            raise HTTPException(422, "Name, grade and discipline are required when no route is selected")
        try:
            system, index, grade = grades.parse_grade(body.grade)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
        ascent.route_id = None
        ascent.name, ascent.grade, ascent.grade_system, ascent.grade_index = body.name, grade, system, index
        ascent.discipline = body.discipline
        ascent.venue = body.venue or ""
        ascent.is_gym = body.is_gym
    # Boulderers say "send", not "redpoint"
    ascent.style = "send" if ascent.grade_system == grades.V and body.style == "redpoint" else body.style
    ascent.climbed_on, ascent.attempts = body.climbed_on, body.attempts
    ascent.rating, ascent.notes = body.rating, body.notes


def _own(db: DB, ascent_id: int, user: User) -> Ascent:
    ascent = db.get(Ascent, ascent_id)
    if ascent is None or ascent.user_id != user.id:
        raise HTTPException(404, "Ascent not found")
    return ascent


def _user_by_name(db: DB, username: str) -> User:
    user = db.scalar(select(User).where(User.username == username))
    if user is None:
        raise HTTPException(404, "User not found")
    return user


@router.get("/ascents", response_model=list[AscentOut])
def list_ascents(db: DB, me: CurrentUser, username: str | None = None, limit: int = 500):
    user = _user_by_name(db, username) if username else me
    stmt = (
        select(Ascent)
        .where(Ascent.user_id == user.id)
        .order_by(Ascent.climbed_on.desc(), Ascent.id.desc())
        .limit(limit)
    )
    return db.scalars(stmt).all()


@router.post("/ascents", response_model=AscentOut, status_code=201)
def create_ascent(body: AscentIn, db: DB, me: CurrentUser):
    ascent = Ascent(user_id=me.id)
    _apply(ascent, body, db)
    db.add(ascent)
    db.flush()
    social.record(db, me.id, "ascent", ascent_id=ascent.id)
    db.commit()
    return ascent


@router.put("/ascents/{ascent_id}", response_model=AscentOut)
def update_ascent(ascent_id: int, body: AscentIn, db: DB, me: CurrentUser):
    ascent = _own(db, ascent_id, me)
    _apply(ascent, body, db)
    db.commit()
    return ascent


@router.delete("/ascents/{ascent_id}", status_code=204)
def delete_ascent(ascent_id: int, db: DB, me: CurrentUser):
    db.delete(_own(db, ascent_id, me))
    db.commit()


@router.get("/analytics")
def get_analytics(db: DB, me: CurrentUser, username: str | None = None):
    user = _user_by_name(db, username) if username else me
    return analytics.compute(db, user.id)
