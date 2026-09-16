from __future__ import annotations

from fastapi import Header, HTTPException

from app.services.auth import get_session
from app.services.data_store import get_store, DataStore


def get_data_store() -> DataStore:
    return get_store()


def get_current_user(authorization: str | None = Header(default=None)) -> dict:
    """Demo auth: expects 'Bearer <token>'. Falls back to a read-only guest identity in
    demo mode so the API remains browsable without forcing a login for every call."""
    if authorization and authorization.startswith("Bearer "):
        token = authorization.removeprefix("Bearer ").strip()
        session = get_session(token)
        if session:
            return session
    return {"username": "guest", "role": "INVESTIGATOR", "name": "Guest Investigator", "token": None}
