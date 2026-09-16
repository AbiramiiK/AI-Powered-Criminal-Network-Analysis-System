from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services import auth as auth_service
from app.services import audit

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
def login(payload: LoginRequest):
    session = auth_service.login(payload.username, payload.password)
    if not session:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    audit.record(session["username"], session["role"], "LOGIN")
    return session


@router.post("/logout")
def logout(token: str):
    auth_service.logout(token)
    return {"ok": True}


@router.get("/demo-users")
def demo_users():
    return [
        {"username": "investigator", "password": "investigator123", "role": "INVESTIGATOR"},
        {"username": "analyst", "password": "analyst123", "role": "ANALYST"},
        {"username": "admin", "password": "admin123", "role": "ADMIN"},
    ]
