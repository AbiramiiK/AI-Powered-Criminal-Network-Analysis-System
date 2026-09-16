from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import get_data_store, get_current_user
from app.services.data_store import DataStore
from app.services import audit
from app.services.auth import DEMO_USERS

router = APIRouter(prefix="/api", tags=["admin"])


@router.get("/audit")
def get_audit_logs(limit: int = 200):
    return {"logs": audit.get_logs(limit=limit)}


@router.get("/admin/users")
def list_users():
    return {"users": [{"username": u, "role": v["role"], "name": v["name"]} for u, v in DEMO_USERS.items()]}


@router.get("/admin/system-status")
def system_status(store: DataStore = Depends(get_data_store)):
    total_records = sum(s.get("record_count", 0) for s in store.load_status.values())
    connected = sum(1 for s in store.load_status.values() if s.get("connected"))
    return {
        "demo_mode": True,
        "llm_provider_configured": False,
        "database": "In-memory pandas DataFrames (SQLite-compatible schema; see data/ CSVs)",
        "graph_engine": "NetworkX",
        "sources_connected": connected,
        "sources_total": len(store.load_status),
        "total_records_loaded": total_records,
        "last_loaded": store.last_loaded.isoformat() if store.last_loaded else None,
    }


@router.get("/evidence")
def list_evidence(person_id: str | None = None, evidence_type: str | None = None, store: DataStore = Depends(get_data_store)):
    df = store.get("evidence")
    if person_id:
        df = df[(df["person_id"] == person_id) | (df["related_person_id"] == person_id)]
    if evidence_type:
        df = df[df["evidence_type"] == evidence_type]
    return {"count": len(df), "evidence": df.to_dict(orient="records")}


@router.get("/intelligence")
def list_intelligence(person_id: str | None = None, category: str | None = None, store: DataStore = Depends(get_data_store)):
    df = store.get("intelligence")
    if person_id:
        df = df[(df["subject_person_id"] == person_id) | (df["related_person_ids"].fillna("").str.contains(person_id))]
    if category:
        df = df[df["intelligence_category"] == category]
    return {"count": len(df), "intelligence": df.to_dict(orient="records")}
