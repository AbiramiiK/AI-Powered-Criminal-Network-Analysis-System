"""Investigation report generator. Produces a structured, explainable report for a case
and/or person, with recommendations framed as investigative actions -- never accusations."""
from __future__ import annotations

from datetime import datetime, timezone

import pandas as pd

from app.services.data_store import DataStore
from app.analytics.centrality import explain_centrality
from app.analytics.risk import risk_for_person
from app.analytics.patterns import all_patterns


def _safe_iter_ids(cell) -> list[str]:
    if not isinstance(cell, str) or not cell.strip():
        return []
    return [p.strip() for p in cell.replace(";", "|").split("|") if p.strip()]


def generate_report(store: DataStore, case_id: str | None = None, person_id: str | None = None,
                     start_date: str | None = None, end_date: str | None = None) -> dict:
    cases = store.get("cases")
    persons = store.get("persons")
    alerts = store.get("alerts")
    events = store.get("events")
    evidence = store.get("evidence")
    intelligence = store.get("intelligence")
    cdr = store.get("cdr")
    txns = store.get("transactions")
    locations = store.get("locations")
    vehicles = store.get("vehicles")
    veh_assoc = store.get("vehicle_associations")

    case_row = None
    if case_id:
        match = cases[cases["case_id"] == case_id]
        if not match.empty:
            case_row = match.iloc[0].to_dict()

    poi_ids = _safe_iter_ids(case_row.get("primary_persons_of_interest")) if case_row else ([person_id] if person_id else [])

    def in_range(ts: str) -> bool:
        if not ts:
            return True
        if start_date and ts < start_date:
            return False
        if end_date and ts > end_date:
            return False
        return True

    key_entities = []
    for pid in poi_ids:
        row = persons[persons["person_id"] == pid]
        if row.empty:
            continue
        r = row.iloc[0]
        centrality = explain_centrality(store, pid)
        risk = risk_for_person(store, pid)
        key_entities.append({
            "person_id": pid,
            "name": r["full_name"],
            "aliases": r.get("primary_alias"),
            "organization": r.get("organization"),
            "network_role": centrality.get("classification_label"),
            "investigative_priority_score": risk["investigative_priority_score"] if risk else None,
        })

    case_alerts = alerts[alerts["case_id"] == case_id] if case_id and not alerts.empty else alerts[
        alerts["person_id"].isin(poi_ids) | alerts["related_person_id"].isin(poi_ids)] if poi_ids and not alerts.empty else alerts.iloc[0:0]

    case_events = events[events["case_id"] == case_id] if case_id and not events.empty else events[
        events["person_id"].isin(poi_ids)] if poi_ids and not events.empty else events.iloc[0:0]
    case_events = case_events[case_events["event_timestamp"].apply(in_range)]

    comms = cdr[(cdr["caller_id"].isin(poi_ids)) | (cdr["receiver_id"].isin(poi_ids))] if poi_ids and not cdr.empty else cdr.iloc[0:0]
    comms = comms[comms["timestamp"].apply(in_range)]

    financial = txns[(txns["sender_id"].isin(poi_ids)) | (txns["receiver_id"].isin(poi_ids))] if poi_ids and not txns.empty else txns.iloc[0:0]
    financial = financial[financial["timestamp"].apply(in_range)]

    loc_records = locations[locations["person_id"].isin(poi_ids)] if poi_ids and not locations.empty else locations.iloc[0:0]

    owned_vehicles = vehicles[vehicles["primary_owner_id"].isin(poi_ids)] if poi_ids and not vehicles.empty else vehicles.iloc[0:0]
    assoc_vehicles = veh_assoc[veh_assoc["person_id"].isin(poi_ids)] if poi_ids and not veh_assoc.empty else veh_assoc.iloc[0:0]

    intel_hits = intelligence[intelligence["subject_person_id"].isin(poi_ids)] if poi_ids and not intelligence.empty else intelligence.iloc[0:0]

    ev_hits = evidence[(evidence["person_id"].isin(poi_ids)) | (evidence["related_person_id"].isin(poi_ids))] if poi_ids and not evidence.empty else evidence.iloc[0:0]

    patterns = all_patterns(store)
    relevant_patterns = []
    for category, items in patterns.items():
        for item in items:
            if not poi_ids or any(pid in item["entities"] for pid in poi_ids):
                relevant_patterns.append({**item, "category": category})

    recommendations = []
    for pat in relevant_patterns[:8]:
        recommendations.append(
            f"Review the relationship between {' and '.join(pat['entity_names'])} using the cited "
            f"{pat['pattern_type'].replace('_', ' ').lower()} records ({', '.join(str(s) for s in pat['supporting_records'][:3])})."
        )
    for _, alert_row in case_alerts.head(5).iterrows():
        recommendations.append(
            f"Investigate alert {alert_row['alert_id']} ({alert_row['alert_type']}) involving "
            f"{alert_row['person_id']} and {alert_row.get('related_person_id', 'N/A')}; current status: {alert_row['analyst_status']}."
        )
    if not recommendations:
        recommendations.append("No high-confidence patterns were detected for the selected scope. Continue routine monitoring.")

    timeline_items = []
    for _, row in case_events.iterrows():
        timeline_items.append({"timestamp": row["event_timestamp"], "type": row["event_type"],
                                "description": row["event_description"], "source": "investigation_events"})
    for _, row in comms.iterrows():
        timeline_items.append({"timestamp": row["timestamp"], "type": "COMMUNICATION",
                                "description": f"{row['communication_type']} between {row['caller_id']} and {row['receiver_id']}",
                                "source": "cdr"})
    for _, row in financial.iterrows():
        timeline_items.append({"timestamp": row["timestamp"], "type": "TRANSACTION",
                                "description": f"{row['transaction_type']} of INR {row['amount']} from {row['sender_id']} to {row['receiver_id']}",
                                "source": "transactions"})
    timeline_items.sort(key=lambda x: x["timestamp"] or "")

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "scope": {"case_id": case_id, "person_id": person_id, "start_date": start_date, "end_date": end_date},
        "case_overview": case_row,
        "key_entities": key_entities,
        "network_summary": {
            "primary_persons_of_interest": poi_ids,
            "relationship_count": len(relevant_patterns),
        },
        "important_relationships": relevant_patterns[:15],
        "communication_patterns": {
            "total_records": len(comms),
            "sample": comms.head(10).to_dict(orient="records"),
        },
        "financial_patterns": {
            "total_records": len(financial),
            "total_volume": float(pd.to_numeric(financial["amount"], errors="coerce").fillna(0).sum()) if len(financial) else 0.0,
            "sample": financial.head(10).to_dict(orient="records"),
        },
        "location_patterns": {
            "total_records": len(loc_records),
            "sample": loc_records.head(10).to_dict(orient="records"),
        },
        "vehicle_associations": {
            "owned": owned_vehicles.to_dict(orient="records"),
            "associated": assoc_vehicles.to_dict(orient="records"),
        },
        "intelligence_findings": intel_hits.head(10).to_dict(orient="records"),
        "evidence_summary": {
            "total_records": len(ev_hits),
            "by_status": ev_hits["evidence_status"].value_counts().to_dict() if len(ev_hits) else {},
            "sample": ev_hits.head(10).to_dict(orient="records"),
        },
        "analytical_alerts": case_alerts.to_dict(orient="records"),
        "timeline": timeline_items[:50],
        "recommended_investigative_actions": recommendations,
        "disclaimer": (
            "This report presents investigative leads and analytical patterns derived from synthetic "
            "demonstration data. It does not constitute proof of criminal activity. All findings require "
            "human investigator review and independent verification before any action is taken."
        ),
    }
    return report
