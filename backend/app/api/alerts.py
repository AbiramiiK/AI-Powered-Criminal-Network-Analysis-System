from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.deps import get_data_store, get_current_user
from app.services.data_store import DataStore
from app.services import audit

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("")
def list_alerts(
    severity: str | None = None,
    alert_type: str | None = None,
    case_id: str | None = None,
    analyst_status: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    store: DataStore = Depends(get_data_store),
):
    df = store.get("alerts").copy()
    persons = store.get("persons")
    name_map = dict(zip(persons["person_id"], persons["full_name"]))

    if severity:
        df = df[df["severity"] == severity]
    if alert_type:
        df = df[df["alert_type"] == alert_type]
    if case_id:
        df = df[df["case_id"] == case_id]
    if analyst_status:
        df = df[df["analyst_status"] == analyst_status]
    if start_date:
        df = df[df["alert_timestamp"] >= start_date]
    if end_date:
        df = df[df["alert_timestamp"] <= end_date]

    df = df.sort_values("alert_timestamp", ascending=False)
    records = df.to_dict(orient="records")
    for r in records:
        r["person_name"] = name_map.get(r["person_id"], r["person_id"])
        r["related_person_name"] = name_map.get(r.get("related_person_id"), r.get("related_person_id"))
        r["supporting_sources_list"] = str(r.get("supporting_sources", "")).split("|")

    return {"count": len(records), "alerts": records}


@router.get("/{alert_id}")
def get_alert(alert_id: str, store: DataStore = Depends(get_data_store)):
    df = store.get("alerts")
    match = df[df["alert_id"] == alert_id]
    if match.empty:
        raise HTTPException(status_code=404, detail="Alert not found")
    return match.iloc[0].to_dict()


class AlertStatusUpdate(BaseModel):
    analyst_status: str


ALERT_STATUS_OVERRIDES: dict[str, str] = {}
VALID_STATUSES = {"NEW", "UNDER_REVIEW", "CONFIRMED_PATTERN", "DISMISSED"}


@router.post("/{alert_id}/status")
def update_alert_status(alert_id: str, payload: AlertStatusUpdate, user: dict = Depends(get_current_user),
                          store: DataStore = Depends(get_data_store)):
    if payload.analyst_status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of {VALID_STATUSES}")
    df = store.get("alerts")
    if df[df["alert_id"] == alert_id].empty:
        raise HTTPException(status_code=404, detail="Alert not found")
    ALERT_STATUS_OVERRIDES[alert_id] = payload.analyst_status
    audit.record(user["username"], user["role"], "UPDATED_ALERT_STATUS", entity=alert_id)
    return {"ok": True, "alert_id": alert_id, "analyst_status": payload.analyst_status}


@router.get("/overrides/all")
def get_overrides():
    return ALERT_STATUS_OVERRIDES
