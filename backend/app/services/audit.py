"""In-memory audit log. Every sensitive read/write action is recorded here."""
from __future__ import annotations

import itertools
import threading
from datetime import datetime, timezone

_lock = threading.Lock()
_log: list[dict] = []
_counter = itertools.count(1)


def record(user: str, role: str, action: str, case_id: str | None = None,
           entity: str | None = None, result: str = "SUCCESS"):
    with _lock:
        entry = {
            "id": next(_counter),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "user": user,
            "role": role,
            "action": action,
            "case_id": case_id,
            "entity": entity,
            "result": result,
        }
        _log.append(entry)
        return entry


def get_logs(limit: int = 500) -> list[dict]:
    with _lock:
        return list(reversed(_log))[:limit]


def clear():
    with _lock:
        _log.clear()
