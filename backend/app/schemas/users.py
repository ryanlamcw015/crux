from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class Orm(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class AreaRef(Orm):
    id: int
    name: str
    region: str


class UserPublic(Orm):
    id: int
    username: str
    display_name: str
    bio: str
    avatar_hue: int
    home_area: AreaRef | None = None
    created_at: datetime


class UserMe(UserPublic):
    email: str
    is_demo: bool


class RegisterIn(BaseModel):
    username: str = Field(min_length=3, max_length=30, pattern=r"^[a-zA-Z0-9_]+$")
    email: str = Field(max_length=254, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=8, max_length=72)
    display_name: str = Field(min_length=1, max_length=60)


class LoginIn(BaseModel):
    login: str = Field(description="Username or email")
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserMe


class ProfileUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=60)
    bio: str | None = Field(default=None, max_length=500)
    home_area_id: int | None = None
    avatar_hue: int | None = Field(default=None, ge=0, le=360)


class FriendStatus(BaseModel):
    # none | friends | outgoing (you asked them) | incoming (they asked you) | self
    status: str
    friendship_id: int | None = None


class ProfileOut(BaseModel):
    user: UserPublic
    friend: FriendStatus
    stats: dict
    friend_count: int
