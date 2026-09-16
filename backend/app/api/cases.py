from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.deps import get_data_store, get_current_user
from app.services.data_store import DataStore
from app.services import audit
from app.analytics.patterns import all_patterns

router = APIRouter(prefix="/api/cases", tags=["cases"])


def _split(cell) -> list[str]:
    if not isinstance(cell, str) or not cell.strip():
        return []
    return [p.strip() for p in cell.replace(";", "|").split("|") if p.strip()]


@router.get("")
def list_cases(
    q: str | None = None,
    status: str | None = None,
    priority: str | None = None,
    region: str | None = None,
    crime_category: str | None = None,
    store: DataStore = Depends(get_data_store),
):
    df = store.get("cases").copy()
    if q:
        ql = q.lower()
        df = df[df["case_title"].str.lower().str.contains(ql) | df["case_id"].str.lower().str.contains(ql) |
                df["description"].str.lower().str.contains(ql)]
    if status:
        df = df[df["status"] == status]
    if priority:
        df = df[df["priority_level"] == priority]
    if region:
        df = df[df["region"] == region]
    if crime_category:
        df = df[df["crime_category"] == crime_category]

    alerts = store.get("alerts")
    events = store.get("events")

    result = []
    for _, row in df.iterrows():
        case_alerts = alerts[alerts["case_id"] == row["case_id"]] if not alerts.empty else alerts
        case_events = events[events["case_id"] == row["case_id"]] if not events.empty else events
        result.append({
            **row.to_dict(),
            "poi_list": _split(row.get("primary_persons_of_interest")),
            "alert_count": len(case_alerts),
            "event_count": len(case_events),
        })
    return {"count": len(result), "cases": result}


@router.get("/{case_id}")
def get_case(case_id: str, user: dict = Depends(get_current_user), store: DataStore = Depends(get_data_store)):
    cases = store.get("cases")
    match = cases[cases["case_id"] == case_id]
    if match.empty:
        raise HTTPException(status_code=404, detail="Case not found")
    row = match.iloc[0].to_dict()
    poi_ids = _split(row.get("primary_persons_of_interest"))

    persons = store.get("persons")
    poi_details = persons[persons["person_id"].isin(poi_ids)].to_dict(orient="records")

    alerts = store.get("alerts")
    case_alerts = alerts[alerts["case_id"] == case_id].to_dict(orient="records") if not alerts.empty else []

    events = store.get("events")
    case_events = events[events["case_id"] == case_id].sort_values("event_timestamp").to_dict(orient="records") if not events.empty else []

    evidence = store.get("evidence")
    case_evidence = evidence[evidence["person_id"].isin(poi_ids)].to_dict(orient="records") if poi_ids and not evidence.empty else []

    intel = store.get("intelligence")
    case_intel = intel[intel["subject_person_id"].isin(poi_ids)].to_dict(orient="records") if poi_ids and not intel.empty else []

    txns = store.get("transactions")
    case_txns = txns[(txns["sender_id"].isin(poi_ids)) | (txns["receiver_id"].isin(poi_ids))].to_dict(orient="records") if poi_ids and not txns.empty else []

    locations = store.get("locations")
    case_locations = locations[locations["person_id"].isin(poi_ids)].to_dict(orient="records") if poi_ids and not locations.empty else []

    vehicles = store.get("vehicles")
    case_vehicles = vehicles[vehicles["primary_owner_id"].isin(poi_ids)].to_dict(orient="records") if poi_ids and not vehicles.empty else []

    patterns = all_patterns(store)
    relevant_patterns = []
    for category, items in patterns.items():
        for item in items:
            if any(pid in item["entities"] for pid in poi_ids):
                relevant_patterns.append({**item, "category": category})

    audit.record(user["username"], user["role"], "VIEWED_CASE", case_id=case_id)

    return {
        "case": row,
        "persons_of_interest": poi_details,
        "alerts": case_alerts,
        "timeline": case_events,
        "evidence": case_evidence,
        "intelligence": case_intel,
        "transactions": case_txns,
        "locations": case_locations,
        "vehicles": case_vehicles,
        "network_patterns": relevant_patterns,
    }
