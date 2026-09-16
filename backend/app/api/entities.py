from __future__ import annotations

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.api.deps import get_data_store, get_current_user
from app.services.data_store import DataStore
from app.services import audit
from app.services.entity_resolution import find_potential_duplicates
from app.analytics.centrality import explain_centrality
from app.analytics.risk import risk_for_person

router = APIRouter(prefix="/api", tags=["entities"])


@router.get("/search")
def global_search(q: str = Query(..., min_length=1), store: DataStore = Depends(get_data_store)):
    ql = q.lower().strip()
    results = []

    persons = store.get("persons")
    for _, row in persons.iterrows():
        hay = " ".join(str(row.get(c, "")) for c in
                        ("person_id", "full_name", "primary_alias", "alternate_alias", "phone_id_primary", "phone_id_secondary")).lower()
        if ql in hay:
            results.append({"category": "PERSON", "id": row["person_id"], "label": row["full_name"],
                             "subtitle": row.get("primary_alias"), "route": f"/entities/person/{row['person_id']}"})

    aliases = store.get("aliases")
    for _, row in aliases.iterrows():
        if isinstance(row.get("alias"), str) and ql in row["alias"].lower():
            results.append({"category": "PERSON", "id": row["person_id"], "label": row["alias"],
                             "subtitle": f"Alias for {row['person_id']}", "route": f"/entities/person/{row['person_id']}"})

    vehicles = store.get("vehicles")
    for _, row in vehicles.iterrows():
        hay = f"{row['vehicle_id']} {row.get('registration_id','')} {row.get('model_label','')}".lower()
        if ql in hay:
            results.append({"category": "VEHICLE", "id": row["vehicle_id"], "label": row["vehicle_id"],
                             "subtitle": row.get("registration_id"), "route": f"/entities?type=vehicle&id={row['vehicle_id']}"})

    locations = store.get("locations")
    for loc_id, name in dict(zip(locations["location_id"], locations["location_name"])).items():
        if ql in str(name).lower() or ql in str(loc_id).lower():
            results.append({"category": "LOCATION", "id": loc_id, "label": name, "subtitle": loc_id,
                             "route": f"/analytics/locations?location={loc_id}"})

    orgs = store.get("organizations")
    for _, row in orgs.iterrows():
        hay = f"{row['organization_id']} {row['organization_name']}".lower()
        if ql in hay:
            results.append({"category": "ORGANIZATION", "id": row["organization_id"], "label": row["organization_name"],
                             "subtitle": row.get("organization_type"), "route": f"/entities?type=organization&id={row['organization_id']}"})

    cases = store.get("cases")
    for _, row in cases.iterrows():
        hay = f"{row['case_id']} {row['case_title']}".lower()
        if ql in hay:
            results.append({"category": "CASE", "id": row["case_id"], "label": row["case_title"],
                             "subtitle": row["case_id"], "route": f"/cases/{row['case_id']}"})

    seen = set()
    dedup = []
    for r in results:
        key = (r["category"], r["id"])
        if key in seen:
            continue
        seen.add(key)
        dedup.append(r)

    return {"query": q, "count": len(dedup), "results": dedup[:50]}


@router.get("/entities")
def list_entities(type: str | None = None, store: DataStore = Depends(get_data_store)):
    out = {}
    if type in (None, "person"):
        persons = store.get("persons")
        out["persons"] = persons.to_dict(orient="records")
    if type in (None, "vehicle"):
        out["vehicles"] = store.get("vehicles").to_dict(orient="records")
    if type in (None, "organization"):
        out["organizations"] = store.get("organizations").to_dict(orient="records")
    if type in (None, "location"):
        locations = store.get("locations")
        if not locations.empty:
            unique = locations.drop_duplicates("location_id")[["location_id", "location_name", "latitude", "longitude"]]
            out["locations"] = unique.to_dict(orient="records")
        else:
            out["locations"] = []
    return out


@router.get("/entities/{entity_id}")
def get_entity(entity_id: str, store: DataStore = Depends(get_data_store)):
    persons = store.get("persons")
    match = persons[persons["person_id"] == entity_id]
    if not match.empty:
        return {"type": "PERSON", "data": match.iloc[0].to_dict()}

    vehicles = store.get("vehicles")
    match = vehicles[vehicles["vehicle_id"] == entity_id]
    if not match.empty:
        return {"type": "VEHICLE", "data": match.iloc[0].to_dict()}

    orgs = store.get("organizations")
    match = orgs[orgs["organization_id"] == entity_id]
    if not match.empty:
        return {"type": "ORGANIZATION", "data": match.iloc[0].to_dict()}

    locations = store.get("locations")
    match = locations[locations["location_id"] == entity_id]
    if not match.empty:
        return {"type": "LOCATION", "data": match.iloc[0].to_dict()}

    raise HTTPException(status_code=404, detail="Entity not found")


@router.get("/persons/{person_id}")
def get_person(person_id: str, user: dict = Depends(get_current_user), store: DataStore = Depends(get_data_store)):
    persons = store.get("persons")
    match = persons[persons["person_id"] == person_id]
    if match.empty:
        raise HTTPException(status_code=404, detail="Person not found")
    profile = match.iloc[0].to_dict()

    aliases = store.get("aliases")
    person_aliases = aliases[aliases["person_id"] == person_id].to_dict(orient="records")

    cdr = store.get("cdr")
    comms = cdr[(cdr["caller_id"] == person_id) | (cdr["receiver_id"] == person_id)]

    txns = store.get("transactions")
    transactions = txns[(txns["sender_id"] == person_id) | (txns["receiver_id"] == person_id)]

    locations = store.get("locations")
    person_locations = locations[locations["person_id"] == person_id]

    vehicles = store.get("vehicles")
    owned_vehicles = vehicles[vehicles["primary_owner_id"] == person_id]
    veh_assoc = store.get("vehicle_associations")
    assoc_vehicles = veh_assoc[veh_assoc["person_id"] == person_id]

    fir = store.get("fir")
    fir_mentions = fir[fir["entity_ids"].fillna("").str.contains(person_id)]

    intel = store.get("intelligence")
    intel_as_subject = intel[intel["subject_person_id"] == person_id]
    intel_as_related = intel[intel["related_person_ids"].fillna("").str.contains(person_id)]

    evidence = store.get("evidence")
    person_evidence = evidence[(evidence["person_id"] == person_id) | (evidence["related_person_id"] == person_id)]

    alerts = store.get("alerts")
    person_alerts = alerts[(alerts["person_id"] == person_id) | (alerts["related_person_id"] == person_id)]

    org_links = store.get("person_org_links")
    person_orgs = org_links[org_links["person_id"] == person_id]
    orgs = store.get("organizations")
    org_details = orgs[orgs["organization_id"].isin(person_orgs["organization_id"])]

    events = store.get("events")
    person_events = events[(events["person_id"] == person_id) | (events["related_person_id"] == person_id)].sort_values("event_timestamp")

    associated_persons = set(comms["caller_id"]).union(comms["receiver_id"])
    associated_persons.update(transactions["sender_id"])
    associated_persons.update(transactions["receiver_id"])
    associated_persons.update(person_events["person_id"])
    associated_persons.update(person_events["related_person_id"].dropna())
    associated_persons.discard(person_id)
    person_names = dict(zip(persons["person_id"], persons["full_name"]))
    associated_persons_detail = [{"person_id": pid, "name": person_names.get(pid, pid)} for pid in associated_persons if pid]

    centrality = explain_centrality(store, person_id)
    risk = risk_for_person(store, person_id)

    audit.record(user["username"], user["role"], "VIEWED_ENTITY", entity=person_id)

    return {
        "profile": profile,
        "aliases": person_aliases,
        "centrality": centrality,
        "risk": risk,
        "associated_persons": associated_persons_detail,
        "associated_vehicles": {
            "owned": owned_vehicles.to_dict(orient="records"),
            "associated": assoc_vehicles.to_dict(orient="records"),
        },
        "associated_organizations": org_details.assign(
            relationship_type=lambda d: d["organization_id"].map(dict(zip(person_orgs["organization_id"], person_orgs["relationship_type"])))
        ).to_dict(orient="records") if not org_details.empty else [],
        "communications": {
            "total": len(comms),
            "records": comms.sort_values("timestamp", ascending=False).head(50).to_dict(orient="records"),
        },
        "transactions": {
            "total": len(transactions),
            "total_volume": float(pd.to_numeric(transactions["amount"], errors="coerce").fillna(0).sum()) if len(transactions) else 0.0,
            "records": transactions.sort_values("timestamp", ascending=False).head(50).to_dict(orient="records"),
        },
        "locations": person_locations.sort_values("timestamp", ascending=False).head(50).to_dict(orient="records"),
        "fir_mentions": fir_mentions.to_dict(orient="records"),
        "intelligence": {
            "as_subject": intel_as_subject.to_dict(orient="records"),
            "as_related": intel_as_related.to_dict(orient="records"),
        },
        "evidence": person_evidence.to_dict(orient="records"),
        "alerts": person_alerts.to_dict(orient="records"),
        "timeline": person_events.to_dict(orient="records"),
    }


@router.get("/entity-resolution/candidates")
def entity_resolution_candidates(min_confidence: float = 0.3, store: DataStore = Depends(get_data_store)):
    return {"candidates": find_potential_duplicates(store, min_confidence=min_confidence)}


class EntityResolutionReview(BaseModel):
    person_a: str
    person_b: str
    action: str  # REVIEW | MERGE | REJECT
    notes: str | None = None


REVIEW_LOG: list[dict] = []


@router.post("/entity-resolution/review")
def entity_resolution_review(payload: EntityResolutionReview, user: dict = Depends(get_current_user)):
    if payload.action not in ("REVIEW", "MERGE", "REJECT"):
        raise HTTPException(status_code=400, detail="Invalid action")
    entry = {
        "person_a": payload.person_a,
        "person_b": payload.person_b,
        "action": payload.action,
        "notes": payload.notes,
        "reviewed_by": user["username"],
    }
    REVIEW_LOG.append(entry)
    if payload.action == "MERGE":
        audit.record(user["username"], user["role"], "MERGED_ENTITIES", entity=f"{payload.person_a}+{payload.person_b}")
    else:
        audit.record(user["username"], user["role"], f"ENTITY_RESOLUTION_{payload.action}", entity=f"{payload.person_a}+{payload.person_b}")
    return {"ok": True, "entry": entry, "note": "High-impact merges require human review; this demo records the decision without altering underlying datasets."}


@router.get("/entity-resolution/log")
def entity_resolution_log():
    return {"log": REVIEW_LOG}
