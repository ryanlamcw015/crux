import random

from fastapi import APIRouter, HTTPException
from sqlalchemy import func, or_, select

from app.api.deps import DB, CurrentUser
from app.core.config import get_settings
from app.core.security import create_access_token, hash_password, verify_password
from app.models import Area, User
from app.schemas.users import LoginIn, ProfileUpdate, RegisterIn, TokenOut, UserMe

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _token(user: User) -> TokenOut:
    return TokenOut(access_token=create_access_token(user.id), user=UserMe.model_validate(user))


@router.post("/register", response_model=TokenOut, status_code=201)
def register(body: RegisterIn, db: DB):
    taken = db.scalar(
        select(User).where(
            or_(func.lower(User.username) == body.username.lower(), func.lower(User.email) == body.email.lower())
        )
    )
    if taken:
        raise HTTPException(409, "That username or email is already registered")
    user = User(
        username=body.username,
        email=body.email.lower(),
        password_hash=hash_password(body.password),
        display_name=body.display_name,
        avatar_hue=random.randint(0, 359),
    )
    db.add(user)
    db.commit()
    return _token(user)


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: DB):
    login = body.login.strip().lower()
    user = db.scalar(select(User).where(or_(func.lower(User.username) == login, User.email == login)))
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Wrong username or password")
    return _token(user)


@router.post("/demo", response_model=TokenOut)
def demo_login(db: DB):
    """One-click login to the seeded demo account, so visitors can try every feature."""
    user = db.scalar(select(User).where(User.username == get_settings().demo_username))
    if user is None:
        raise HTTPException(404, "Demo account isn't set up. Run the seed script")
    return _token(user)


@router.get("/me", response_model=UserMe)
def me(user: CurrentUser):
    return user


@router.patch("/me", response_model=UserMe)
def update_me(body: ProfileUpdate, user: CurrentUser, db: DB):
    data = body.model_dump(exclude_unset=True)
    if data.get("home_area_id") is not None and db.get(Area, data["home_area_id"]) is None:
        raise HTTPException(404, "Area not found")
    for key, value in data.items():
        setattr(user, key, value)
    db.commit()
    db.refresh(user)
    return user
