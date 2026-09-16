from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import get_data_store
from app.services.data_store import DataStore

router = APIRouter(prefix="/api/timeline", tags=["timeline"])


@router.get("")
def timeline(
    case_id: str | None = None,
    person_id: str | None = None,
    event_type: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    store: DataStore = Depends(get_data_store),
):
    items = []

    events = store.get("events")
    if not events.empty:
        df = events
        if case_id:
            df = df[df["case_id"] == case_id]
        if person_id:
            df = df[(df["person_id"] == person_id) | (df["related_person_id"] == person_id)]
        if event_type:
            df = df[df["event_type"] == event_type]
        for _, row in df.iterrows():
            items.append({"timestamp": row["event_timestamp"], "source": "INVESTIGATION_EVENT",
                          "type": row["event_type"], "description": row["event_description"],
                          "person_id": row["person_id"], "related_person_id": row.get("related_person_id"),
                          "case_id": row.get("case_id"), "confidence": row.get("confidence_score")})

    cdr = store.get("cdr")
    if not cdr.empty and (not event_type or event_type == "CALL_DETECTED"):
        df = cdr
        if person_id:
            df = df[(df["caller_id"] == person_id) | (df["receiver_id"] == person_id)]
        for _, row in df.iterrows():
            items.append({"timestamp": row["timestamp"], "source": "CDR", "type": "COMMUNICATION",
                          "description": f"{row['communication_type']} between {row['caller_id']} and {row['receiver_id']} ({row['duration_seconds']}s)",
                          "person_id": row["caller_id"], "related_person_id": row["receiver_id"],
                          "case_id": None, "confidence": None})

    txns = store.get("transactions")
    if not txns.empty and (not event_type or event_type == "TRANSACTION_DETECTED"):
        df = txns
        if person_id:
            df = df[(df["sender_id"] == person_id) | (df["receiver_id"] == person_id)]
        for _, row in df.iterrows():
            items.append({"timestamp": row["timestamp"], "source": "TRANSACTIONS", "type": "TRANSACTION",
                          "description": f"{row['transaction_type']} INR {row['amount']} {row['sender_id']} -> {row['receiver_id']} ({row['pattern_label']})",
                          "person_id": row["sender_id"], "related_person_id": row["receiver_id"],
                          "case_id": None, "confidence": None})

    locations = store.get("locations")
    if not locations.empty and (not event_type or event_type == "LOCATION_OBSERVED"):
        df = locations
        if person_id:
            df = df[df["person_id"] == person_id]
        for _, row in df.iterrows():
            items.append({"timestamp": row["timestamp"], "source": "LOCATION_RECORDS", "type": "LOCATION_OBSERVED",
                          "description": f"{row['person_id']} observed at {row['location_name']} ({row['observation_type']})",
                          "person_id": row["person_id"], "related_person_id": None,
                          "case_id": None, "confidence": None})

    fir = store.get("fir")
    if not fir.empty and (not event_type or event_type == "FIR_REGISTERED"):
        df = fir
        if person_id:
            df = df[df["entity_ids"].fillna("").str.contains(person_id)]
        for _, row in df.iterrows():
            items.append({"timestamp": row["report_date"], "source": "FIR", "type": "FIR_REGISTERED",
                          "description": f"{row['crime_category']} FIR at {row['location']}: {row['persons_mentioned']}",
                          "person_id": None, "related_person_id": None, "case_id": None, "confidence": None})

    intel = store.get("intelligence")
    if not intel.empty and (not event_type or event_type == "INTELLIGENCE_RECEIVED"):
        df = intel
        if person_id:
            df = df[(df["subject_person_id"] == person_id) | (df["related_person_ids"].fillna("").str.contains(person_id))]
        for _, row in df.iterrows():
            items.append({"timestamp": row["report_date"], "source": "INTEL_REPORT", "type": "INTELLIGENCE_RECEIVED",
                          "description": row["information_text"], "person_id": row["subject_person_id"],
                          "related_person_id": None, "case_id": None, "confidence": None})

    evidence = store.get("evidence")
    if not evidence.empty and (not event_type or event_type == "EVIDENCE_COLLECTED"):
        df = evidence
        if person_id:
            df = df[(df["person_id"] == person_id) | (df["related_person_id"] == person_id)]
        for _, row in df.iterrows():
            items.append({"timestamp": row["collection_date"], "source": "EVIDENCE", "type": "EVIDENCE_COLLECTED",
                          "description": row["description"], "person_id": row["person_id"],
                          "related_person_id": row.get("related_person_id"), "case_id": None,
                          "confidence": row.get("confidence_score")})

    def in_range(ts):
        if not ts or not isinstance(ts, str):
            return False
        if start_date and ts < start_date:
            return False
        if end_date and ts > end_date:
            return False
        return True

    if start_date or end_date:
        items = [i for i in items if in_range(i["timestamp"])]

    items.sort(key=lambda x: x["timestamp"] or "")
    return {"count": len(items), "events": items}
