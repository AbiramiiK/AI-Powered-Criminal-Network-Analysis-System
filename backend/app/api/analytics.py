from __future__ import annotations

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_data_store
from app.services.data_store import DataStore
from app.analytics.patterns import all_patterns
from app.analytics.risk import compute_risk_scores, risk_for_person

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/patterns")
def patterns(store: DataStore = Depends(get_data_store)):
    result = all_patterns(store)
    total = sum(len(v) for v in result.values())
    return {"total_patterns": total, "patterns": result}


@router.get("/transactions")
def transactions_analytics(store: DataStore = Depends(get_data_store)):
    txns = store.get("transactions").copy()
    if txns.empty:
        return {"total_volume": 0, "total_transactions": 0}
    txns["amount_f"] = pd.to_numeric(txns["amount"], errors="coerce").fillna(0)
    high_value = txns[txns["amount_f"] >= txns["amount_f"].quantile(0.9)]
    by_pattern = txns["pattern_label"].value_counts().to_dict()
    txns["month"] = txns["timestamp"].str[:7]
    volume_over_time = txns.groupby("month")["amount_f"].sum().sort_index().to_dict()
    amount_distribution = {
        "min": float(txns["amount_f"].min()),
        "max": float(txns["amount_f"].max()),
        "mean": float(txns["amount_f"].mean()),
        "median": float(txns["amount_f"].median()),
        "p90": float(txns["amount_f"].quantile(0.9)),
    }
    top_senders = txns.groupby("sender_id")["amount_f"].sum().sort_values(ascending=False).head(10).to_dict()
    top_receivers = txns.groupby("receiver_id")["amount_f"].sum().sort_values(ascending=False).head(10).to_dict()

    return {
        "total_volume": float(txns["amount_f"].sum()),
        "total_transactions": len(txns),
        "high_value_transactions": len(high_value),
        "by_pattern_type": by_pattern,
        "volume_over_time": volume_over_time,
        "amount_distribution": amount_distribution,
        "top_senders": top_senders,
        "top_receivers": top_receivers,
    }


@router.get("/transactions/{transaction_id}")
def transaction_detail(transaction_id: str, store: DataStore = Depends(get_data_store)):
    txns = store.get("transactions")
    match = txns[txns["transaction_id"] == transaction_id]
    if match.empty:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return match.iloc[0].to_dict()


@router.get("/communications")
def communications_analytics(store: DataStore = Depends(get_data_store)):
    cdr = store.get("cdr").copy()
    persons = store.get("persons")
    if cdr.empty:
        return {"total_calls": 0}
    name_map = dict(zip(persons["person_id"], persons["full_name"]))
    cdr["duration_f"] = pd.to_numeric(cdr["duration_seconds"], errors="coerce").fillna(0)

    freq = {}
    for _, row in cdr.iterrows():
        pair = tuple(sorted([row["caller_id"], row["receiver_id"]]))
        freq[pair] = freq.get(pair, 0) + 1
    most_connected_pairs = sorted(freq.items(), key=lambda x: x[1], reverse=True)[:10]

    by_person = {}
    for _, row in cdr.iterrows():
        for pid in (row["caller_id"], row["receiver_id"]):
            by_person[pid] = by_person.get(pid, 0) + 1
    most_active = sorted(by_person.items(), key=lambda x: x[1], reverse=True)[:10]

    return {
        "total_calls": len(cdr),
        "avg_duration_seconds": float(cdr["duration_f"].mean()),
        "by_communication_type": cdr["communication_type"].value_counts().to_dict(),
        "most_connected_pairs": [
            {"person_a": p[0], "person_a_name": name_map.get(p[0], p[0]), "person_b": p[1],
             "person_b_name": name_map.get(p[1], p[1]), "count": c}
            for p, c in most_connected_pairs
        ],
        "most_active_persons": [{"person_id": pid, "name": name_map.get(pid, pid), "call_count": c} for pid, c in most_active],
        "disclaimer": "Frequent communication is a pattern requiring investigation, not proof of criminal activity.",
    }


@router.get("/locations")
def locations_analytics(person_id: str | None = None, store: DataStore = Depends(get_data_store)):
    locations = store.get("locations").copy()
    if person_id:
        locations = locations[locations["person_id"] == person_id]
    if locations.empty:
        return {"total_records": 0, "synthetic_notice": "Synthetic demonstration data"}

    frequent = locations["location_name"].value_counts().head(10).to_dict()

    co_location = {}
    if person_id is None:
        by_loc_day: dict = {}
        for _, row in locations.iterrows():
            key = (row["location_id"], str(row["timestamp"])[:10])
            by_loc_day.setdefault(key, set()).add(row["person_id"])
        pair_counts: dict = {}
        for (loc, day), people in by_loc_day.items():
            people = list(people)
            for i in range(len(people)):
                for j in range(i + 1, len(people)):
                    pair = tuple(sorted([people[i], people[j]]))
                    pair_counts[pair] = pair_counts.get(pair, 0) + 1
        co_location = dict(sorted(pair_counts.items(), key=lambda x: x[1], reverse=True)[:10])

    movement_timeline = locations.sort_values("timestamp").to_dict(orient="records")[:100]

    return {
        "total_records": len(locations),
        "frequent_locations": frequent,
        "co_location_pair_counts": {f"{k[0]}-{k[1]}": v for k, v in co_location.items()},
        "movement_timeline": movement_timeline,
        "synthetic_notice": "SYNTHETIC DEMONSTRATION DATA -- coordinates are synthetic, not real GPS data.",
    }


@router.get("/risk")
def risk_analytics(limit: int = 20, store: DataStore = Depends(get_data_store)):
    scores = compute_risk_scores(store)
    return {"scores": scores[:limit]}


@router.get("/risk/{person_id}")
def risk_for_person_endpoint(person_id: str, store: DataStore = Depends(get_data_store)):
    result = risk_for_person(store, person_id)
    if not result:
        raise HTTPException(status_code=404, detail="Person not found")
    return result


@router.get("/correlation")
def correlation_totals(store: DataStore = Depends(get_data_store)):
    """Aggregate cross-source record totals -- 'where is the evidence coming from'."""
    return {
        "sources": [
            {"source": "FIR", "count": len(store.get("fir"))},
            {"source": "CDR", "count": len(store.get("cdr"))},
            {"source": "Transactions", "count": len(store.get("transactions"))},
            {"source": "Locations", "count": len(store.get("locations"))},
            {"source": "Vehicles", "count": len(store.get("vehicles"))},
            {"source": "Intelligence", "count": len(store.get("intelligence"))},
            {"source": "Evidence", "count": len(store.get("evidence"))},
        ]
    }


@router.get("/correlation/{person_id}")
def correlation_for_person(person_id: str, store: DataStore = Depends(get_data_store)):
    """Cross-source evidence correlation for one person -- how many supporting records
    exist from each source, all computed live from the datasets."""
    persons = store.get("persons")
    if persons[persons["person_id"] == person_id].empty:
        raise HTTPException(status_code=404, detail="Person not found")

    fir = store.get("fir")
    cdr = store.get("cdr")
    txns = store.get("transactions")
    locations = store.get("locations")
    veh_assoc = store.get("vehicle_associations")
    vehicles = store.get("vehicles")
    intel = store.get("intelligence")
    evidence = store.get("evidence")

    fir_count = int(fir["entity_ids"].fillna("").str.contains(person_id).sum()) if not fir.empty else 0
    cdr_count = int((((cdr["caller_id"] == person_id) | (cdr["receiver_id"] == person_id))).sum()) if not cdr.empty else 0
    txn_count = int((((txns["sender_id"] == person_id) | (txns["receiver_id"] == person_id))).sum()) if not txns.empty else 0
    loc_count = int((locations["person_id"] == person_id).sum()) if not locations.empty else 0
    veh_count = int((veh_assoc["person_id"] == person_id).sum()) if not veh_assoc.empty else 0
    veh_count += int((vehicles["primary_owner_id"] == person_id).sum()) if not vehicles.empty else 0
    intel_count = 0
    if not intel.empty:
        intel_count = int(((intel["subject_person_id"] == person_id) | (intel["related_person_ids"].fillna("").str.contains(person_id))).sum())
    evidence_count = int((((evidence["person_id"] == person_id) | (evidence["related_person_id"] == person_id))).sum()) if not evidence.empty else 0

    return {
        "person_id": person_id,
        "sources": [
            {"source": "FIR", "count": fir_count},
            {"source": "CDR", "count": cdr_count},
            {"source": "Transactions", "count": txn_count},
            {"source": "Locations", "count": loc_count},
            {"source": "Vehicles", "count": veh_count},
            {"source": "Intelligence", "count": intel_count},
            {"source": "Evidence", "count": evidence_count},
        ],
        "total_records": fir_count + cdr_count + txn_count + loc_count + veh_count + intel_count + evidence_count,
    }


@router.get("/vehicles")
def vehicle_analytics(store: DataStore = Depends(get_data_store)):
    vehicles = store.get("vehicles")
    veh_assoc = store.get("vehicle_associations")
    events = store.get("events")
    evidence = store.get("evidence")

    if vehicles.empty:
        return {"total_vehicles": 0}

    owner_count = vehicles["primary_owner_id"].value_counts()
    assoc_by_vehicle = veh_assoc.groupby("vehicle_id")["person_id"].nunique() if not veh_assoc.empty else pd.Series(dtype=int)
    shared_vehicles = assoc_by_vehicle[assoc_by_vehicle > 1] if len(assoc_by_vehicle) else assoc_by_vehicle

    persons = store.get("persons")
    name_map = dict(zip(persons["person_id"], persons["full_name"]))

    shared_out = []
    for vid, count in shared_vehicles.sort_values(ascending=False).items():
        people = veh_assoc[veh_assoc["vehicle_id"] == vid]["person_id"].unique().tolist()
        shared_out.append({
            "vehicle_id": vid,
            "associated_person_count": int(count),
            "persons": [{"person_id": p, "name": name_map.get(p, p)} for p in people],
            "label": "Shared Vehicle Association",
        })

    observations = pd.Series(dtype=int)
    if not events.empty:
        veh_events = events[events["vehicle_id"].notna()].copy()
        if not veh_events.empty:
            veh_events["month"] = veh_events["event_timestamp"].str[:7]
            observations = veh_events.groupby("month").size().sort_index()

    evidence_by_type = vehicles["vehicle_type"].value_counts().to_dict()

    return {
        "total_vehicles": len(vehicles),
        "shared_use_vehicles": len(shared_out),
        "shared_vehicles": shared_out[:15],
        "vehicles_by_type": evidence_by_type,
        "observations_over_time": [{"month": m, "count": int(c)} for m, c in observations.items()],
        "total_associations": len(veh_assoc),
    }
