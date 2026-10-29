"""Friendships and the activity feed."""

from fastapi import HTTPException
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models import Activity, Friendship, Kudos, PartnerPost, User


def friendship_between(db: Session, a: int, b: int) -> Friendship | None:
    return db.scalar(
        select(Friendship).where(
            or_(
                and_(Friendship.requester_id == a, Friendship.addressee_id == b),
                and_(Friendship.requester_id == b, Friendship.addressee_id == a),
            )
        )
    )


def friend_status(db: Session, me: User | None, other: User) -> dict:
    if me is None:
        return {"status": "none", "friendship_id": None}
    if me.id == other.id:
        return {"status": "self", "friendship_id": None}
    f = friendship_between(db, me.id, other.id)
    if f is None:
        return {"status": "none", "friendship_id": None}
    if f.status == "accepted":
        status = "friends"
    else:
        status = "outgoing" if f.requester_id == me.id else "incoming"
    return {"status": status, "friendship_id": f.id}


def friend_ids(db: Session, user_id: int) -> list[int]:
    rows = db.execute(
        select(Friendship.requester_id, Friendship.addressee_id).where(
            Friendship.status == "accepted",
            or_(Friendship.requester_id == user_id, Friendship.addressee_id == user_id),
        )
    )
    return [b if a == user_id else a for a, b in rows]


def request_or_accept(db: Session, me: User, other: User) -> Friendship:
    """Send a friend request, or accept theirs if they already asked you."""
    if me.id == other.id:
        raise HTTPException(400, "You can't friend yourself")
    f = friendship_between(db, me.id, other.id)
    if f is None:
        f = Friendship(requester_id=me.id, addressee_id=other.id)
        db.add(f)
    elif f.status == "pending" and f.addressee_id == me.id:
        f.status = "accepted"
        db.add(Activity(user_id=me.id, kind="friend", other_user_id=other.id))
    db.commit()
    return f


def record(db: Session, user_id: int, kind: str, **refs) -> None:
    db.add(Activity(user_id=user_id, kind=kind, **refs))


def feed(db: Session, me: User, limit: int, before_id: int | None) -> list[dict]:
    ids = [me.id, *friend_ids(db, me.id)]
    stmt = (
        select(Activity)
        .where(Activity.user_id.in_(ids))
        .options(
            selectinload(Activity.user).selectinload(User.home_area),
            selectinload(Activity.other_user).selectinload(User.home_area),
            selectinload(Activity.ascent),
            selectinload(Activity.partner_post).selectinload(PartnerPost.user),
            selectinload(Activity.partner_post).selectinload(PartnerPost.area),
            selectinload(Activity.partner_post).selectinload(PartnerPost.replies),
        )
        .order_by(Activity.created_at.desc(), Activity.id.desc())
        .limit(limit)
    )
    if before_id:
        stmt = stmt.where(Activity.id < before_id)
    activities = list(db.scalars(stmt))
    act_ids = [a.id for a in activities]
    counts = dict(
        db.execute(
            select(Kudos.activity_id, func.count()).where(Kudos.activity_id.in_(act_ids)).group_by(Kudos.activity_id)
        ).all()
    )
    mine = set(db.scalars(select(Kudos.activity_id).where(Kudos.activity_id.in_(act_ids), Kudos.user_id == me.id)))
    return [
        {
            "id": a.id,
            "kind": a.kind,
            "created_at": a.created_at,
            "user": a.user,
            "other_user": a.other_user,
            "ascent": a.ascent,
            "partner_post": a.partner_post,
            "kudos_count": counts.get(a.id, 0),
            "kudoed_by_me": a.id in mine,
        }
        for a in activities
        # skip items whose target was deleted
        if not (a.kind == "ascent" and a.ascent is None) and not (a.kind == "partner_post" and a.partner_post is None)
    ]
