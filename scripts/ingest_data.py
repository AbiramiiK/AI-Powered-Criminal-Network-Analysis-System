"""Standalone ingestion CLI. Run: python scripts/ingest_data.py
Loads every dataset from data/ and reports record counts per source (the same loader the
FastAPI backend uses at startup)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from app.services.data_store import DataStore


def main():
    store = DataStore()
    store.load_all()

    print("=" * 60)
    print("DATA INGESTION REPORT")
    print("=" * 60)
    total = 0
    for name, status in store.load_status.items():
        connected = "CONNECTED" if status["connected"] else "MISSING"
        print(f"[{connected:9s}] {name:20s} {status['record_count']:5d} records  ({status['source_file']})")
        total += status.get("record_count", 0)
    print("-" * 60)
    print(f"Total records ingested: {total}")


if __name__ == "__main__":
    main()
