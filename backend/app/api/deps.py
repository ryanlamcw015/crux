"""Shared FastAPI dependencies (dependency injection): DB session and the logged-in user."""

from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models import User

bearer = HTTPBearer(auto_error=False)

DB = Annotated[Session, Depends(get_db)]


def get_optional_user(db: DB, creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]) -> User | None:
    if creds is None:
        return None
    user_id = decode_access_token(creds.credentials)
    return db.get(User, user_id) if user_id is not None else None


def get_current_user(user: Annotated[User | None, Depends(get_optional_user)]) -> User:
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not logged in")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
OptionalUser = Annotated[User | None, Depends(get_optional_user)]
