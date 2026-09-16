"""Demo authentication + RBAC. Not production security -- issues opaque session tokens
mapped in-memory to a role. Good enough for an offline prototype demo."""
from __future__ import annotations

import secrets
import threading

DEMO_USERS = {
    "investigator": {"password": "investigator123", "role": "INVESTIGATOR", "name": "Asha Investigator"},
    "analyst": {"password": "analyst123", "role": "ANALYST", "name": "Ravi Analyst"},
    "admin": {"password": "admin123", "role": "ADMIN", "name": "Meera Admin"},
}

_lock = threading.Lock()
_sessions: dict[str, dict] = {}


def login(username: str, password: str) -> dict | None:
    user = DEMO_USERS.get(username)
    if not user or user["password"] != password:
        return None
    token = secrets.token_hex(16)
    session = {"token": token, "username": username, "role": user["role"], "name": user["name"]}
    with _lock:
        _sessions[token] = session
    return session


def get_session(token: str) -> dict | None:
    with _lock:
        return _sessions.get(token)


def logout(token: str):
    with _lock:
        _sessions.pop(token, None)
