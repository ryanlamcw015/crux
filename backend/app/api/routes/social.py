from fastapi import APIRouter, HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.api.deps import DB, CurrentUser, OptionalUser
from app.models import Activity, Friendship, Kudos, User
from app.schemas.social import ActivityOut
from app.schemas.users import ProfileOut, UserPublic
from app.services import analytics, social

router = APIRouter(prefix="/api", tags=["social"])


def _user(db: DB, username: str) -> User:
    user = db.scalar(select(User).where(func.lower(User.username) == username.lower()))
    if user is None:
        raise HTTPException(404, "User not found")
    return user


@router.get("/users", response_model=list[UserPublic])
def search_users(db: DB, q: str = "", limit: int = 20):
    stmt = select(User).options(selectinload(User.home_area)).order_by(User.display_name).limit(limit)
    if q:
        stmt = stmt.where(or_(User.username.ilike(f"%{q}%"), User.display_name.ilike(f"%{q}%")))
    return db.scalars(stmt).all()


@router.get("/users/{username}", response_model=ProfileOut)
def get_profile(username: str, db: DB, me: OptionalUser):
    user = _user(db, username)
    stats = analytics.compute(db, user.id)
    return {
        "user": user,
        "friend": social.friend_status(db, me, user),
        "stats": {"totals": stats["totals"], "hardest": stats["hardest"]},
        "friend_count": len(social.friend_ids(db, user.id)),
    }


@router.get("/friends")
def list_friends(db: DB, me: CurrentUser):
    rows = db.scalars(
        select(Friendship)
        .where(or_(Friendship.requester_id == me.id, Friendship.addressee_id == me.id))
        .options(selectinload(Friendship.requester), selectinload(Friendship.addressee))
    ).all()
    out: dict[str, list] = {"friends": [], "incoming": [], "outgoing": []}
    for f in rows:
        other = f.addressee if f.requester_id == me.id else f.requester
        entry = {"friendship_id": f.id, "user": UserPublic.model_validate(other)}
        if f.status == "accepted":
            out["friends"].append(entry)
        elif f.addressee_id == me.id:
            out["incoming"].append(entry)
        else:
            out["outgoing"].append(entry)
    return out


@router.post("/friends/{username}")
def add_friend(username: str, db: DB, me: CurrentUser):
    other = _user(db, username)
    social.request_or_accept(db, me, other)
    return social.friend_status(db, me, other)


@router.delete("/friends/{friendship_id}", status_code=204)
def remove_friend(friendship_id: int, db: DB, me: CurrentUser):
    f = db.get(Friendship, friendship_id)
    if f is None or me.id not in (f.requester_id, f.addressee_id):
        raise HTTPException(404, "Friendship not found")
    db.delete(f)
    db.commit()


@router.get("/feed", response_model=list[ActivityOut])
def get_feed(db: DB, me: CurrentUser, limit: int = 30, before_id: int | None = None):
    return social.feed(db, me, min(limit, 100), before_id)


@router.post("/feed/{activity_id}/kudos", status_code=204)
def give_kudos(activity_id: int, db: DB, me: CurrentUser):
    if db.get(Activity, activity_id) is None:
        raise HTTPException(404, "Activity not found")
    db.add(Kudos(activity_id=activity_id, user_id=me.id))
    try:
        db.commit()
    except IntegrityError:  # already given
        db.rollback()


@router.delete("/feed/{activity_id}/kudos", status_code=204)
def remove_kudos(activity_id: int, db: DB, me: CurrentUser):
    k = db.scalar(select(Kudos).where(Kudos.activity_id == activity_id, Kudos.user_id == me.id))
    if k:
        db.delete(k)
        db.commit()
