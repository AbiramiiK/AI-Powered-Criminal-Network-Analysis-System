"""Central in-memory data store. Loads all CSVs once at startup and caches them.
Also caches the built graph and analytics so repeated API calls don't recompute."""
from __future__ import annotations

import threading
import time
from datetime import datetime, timezone

import pandas as pd

from app.utils.config import DATA_DIR, DATASET_FILES


class DataStore:
    _instance: "DataStore | None" = None
    _lock = threading.Lock()

    def __init__(self):
        self.frames: dict[str, pd.DataFrame] = {}
        self.load_status: dict[str, dict] = {}
        self.last_loaded: datetime | None = None
        self.graph = None
        self.analytics_cache: dict = {}
        self._graph_lock = threading.Lock()

    @classmethod
    def instance(cls) -> "DataStore":
        with cls._lock:
            if cls._instance is None:
                cls._instance = DataStore()
                cls._instance.load_all()
        return cls._instance

    def load_all(self):
        for name, filename in DATASET_FILES.items():
            path = DATA_DIR / filename
            started = time.time()
            try:
                if not path.exists():
                    self.load_status[name] = {
                        "connected": False,
                        "record_count": 0,
                        "source_file": filename,
                        "last_processed": None,
                        "error": "File not found",
                    }
                    continue
                df = pd.read_csv(path, dtype=str, keep_default_na=True)
                df.columns = [c.strip() for c in df.columns]
                df = df.astype(object).where(df.notna(), None)
                self.frames[name] = df
                self.load_status[name] = {
                    "connected": True,
                    "record_count": len(df),
                    "source_file": filename,
                    "last_processed": datetime.now(timezone.utc).isoformat(),
                    "load_time_ms": round((time.time() - started) * 1000, 2),
                    "error": None,
                }
            except Exception as exc:  # noqa: BLE001
                self.load_status[name] = {
                    "connected": False,
                    "record_count": 0,
                    "source_file": filename,
                    "last_processed": None,
                    "error": str(exc),
                }
        self.last_loaded = datetime.now(timezone.utc)
        # invalidate derived caches
        self.graph = None
        self.analytics_cache = {}

    def get(self, name: str) -> pd.DataFrame:
        return self.frames.get(name, pd.DataFrame())

    def reload(self):
        self.load_all()


def get_store() -> DataStore:
    return DataStore.instance()
