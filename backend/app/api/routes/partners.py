from datetime import date
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import DB, CurrentUser
from app.models import Area, PartnerPost, PartnerReply
from app.schemas.social import PartnerPostIn, PartnerPostOut, ReplyIn
from app.services import geo, social

router = APIRouter(prefix="/api/partners", tags=["partners"])

_LOAD = (
    selectinload(PartnerPost.user),
    selectinload(PartnerPost.area),
    selectinload(PartnerPost.replies).selectinload(PartnerReply.user),
)


@router.get("", response_model=list[PartnerPostOut])
def list_posts(
    db: DB,
    _: CurrentUser,
    setting: Literal["gym", "outdoor"] | None = None,
    area_id: int | None = None,
    discipline: str | None = None,
    lat: float | None = Query(default=None, ge=-90, le=90),
    lon: float | None = Query(default=None, ge=-180, le=180),
    radius_km: float = Query(default=100, gt=0, le=5000),
    include_past: bool = False,
):
    stmt = select(PartnerPost).where(PartnerPost.status == "open").options(*_LOAD)
    if not include_past:
        stmt = stmt.where(PartnerPost.climb_on >= date.today())
    if setting:
        stmt = stmt.where(PartnerPost.setting == setting)
    if area_id:
        stmt = stmt.where(PartnerPost.area_id == area_id)
    if discipline:
        stmt = stmt.where(PartnerPost.disciplines.contains(discipline))

    distances: dict[int, float] = {}
    if lat is not None and lon is not None:
        distances = dict(geo.nearby(db, PartnerPost, lat, lon, radius_km))
        stmt = stmt.where(PartnerPost.id.in_(distances.keys()))

    posts = db.scalars(stmt.order_by(PartnerPost.climb_on, PartnerPost.id.desc())).all()
    out = []
    for p in posts:
        item = PartnerPostOut.model_validate(p)
        item.distance_km = round(distances[p.id], 1) if p.id in distances else None
        out.append(item)
    return out


@router.post("", response_model=PartnerPostOut, status_code=201)
def create_post(body: PartnerPostIn, db: DB, me: CurrentUser):
    data = body.model_dump()
    data["disciplines"] = ",".join(body.disciplines)
    if body.area_id is not None:
        area = db.get(Area, body.area_id)
        if area is None:
            raise HTTPException(404, "Area not found")
        data["location_name"] = data["location_name"] or area.name
        if data["lat"] is None:
            data["lat"], data["lon"] = area.lat, area.lon
    if not data["location_name"]:
        raise HTTPException(422, "Pick an area or enter a gym/location name")
    post = PartnerPost(user_id=me.id, **data)
    db.add(post)
    db.flush()
    social.record(db, me.id, "partner_post", partner_post_id=post.id)
    db.commit()
    return db.scalar(select(PartnerPost).where(PartnerPost.id == post.id).options(*_LOAD))


@router.post("/{post_id}/replies", response_model=PartnerPostOut, status_code=201)
def reply(post_id: int, body: ReplyIn, db: DB, me: CurrentUser):
    post = db.get(PartnerPost, post_id)
    if post is None:
        raise HTTPException(404, "Post not found")
    db.add(PartnerReply(post_id=post_id, user_id=me.id, message=body.message))
    db.commit()
    db.expire_all()
    return db.scalar(select(PartnerPost).where(PartnerPost.id == post_id).options(*_LOAD))


@router.post("/{post_id}/close", response_model=PartnerPostOut)
def close_post(post_id: int, db: DB, me: CurrentUser):
    post = db.get(PartnerPost, post_id)
    if post is None or post.user_id != me.id:
        raise HTTPException(404, "Post not found")
    post.status = "closed"
    db.commit()
    return db.scalar(select(PartnerPost).where(PartnerPost.id == post_id).options(*_LOAD))
