from __future__ import annotations

from collections import defaultdict

import pandas as pd
from fastapi import APIRouter, Depends

from app.api.deps import get_data_store
from app.services.data_store import DataStore
from app.services.entity_resolution import find_potential_duplicates
from app.graph.builder import get_full_graph, select_curated_overview_ids
from app.analytics.centrality import compute_graph_metrics, compute_communities
from app.api.network import _serialize_graph

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary")
def summary(store: DataStore = Depends(get_data_store)):
    persons = store.get("persons")
    cases = store.get("cases")
    alerts = store.get("alerts")
    vehicles = store.get("vehicles")
    organizations = store.get("organizations")
    locations = store.get("locations")
    cdr = store.get("cdr")
    transactions = store.get("transactions")
    fir = store.get("fir")
    intelligence = store.get("intelligence")
    evidence = store.get("evidence")

    g = get_full_graph(store)
    metrics = compute_graph_metrics(store)

    total_entities = len(persons) + len(vehicles) + len(organizations) + (locations["location_id"].nunique() if not locations.empty else 0)
    active_cases = cases[cases["status"].isin(["OPEN", "ACTIVE_ANALYSIS", "UNDER_REVIEW"])] if not cases.empty else cases
    high_priority_leads = alerts[alerts["severity"].isin(["HIGH", "CRITICAL"])] if not alerts.empty else alerts
    unresolved_matches = find_potential_duplicates(store, min_confidence=0.3)

    recent_alerts = alerts.sort_values("alert_timestamp", ascending=False).head(8) if not alerts.empty else alerts
    person_names = dict(zip(persons["person_id"], persons["full_name"]))
    recent_alerts_out = []
    for _, row in recent_alerts.iterrows():
        recent_alerts_out.append({
            "alert_id": row["alert_id"],
            "severity": row["severity"],
            "alert_type": row["alert_type"],
            "person": person_names.get(row["person_id"], row["person_id"]),
            "person_id": row["person_id"],
            "related_person": person_names.get(row.get("related_person_id"), row.get("related_person_id")),
            "related_person_id": row.get("related_person_id"),
            "case_id": row["case_id"],
            "timestamp": row["alert_timestamp"],
            "confidence": row["confidence_score"],
            "status": row["analyst_status"],
            "explanation": row["explanation"],
        })

    cases_by_category = cases["crime_category"].value_counts().to_dict() if not cases.empty else {}
    cases_by_region = cases["region"].value_counts().to_dict() if not cases.empty else {}
    cases_by_status = cases["status"].value_counts().to_dict() if not cases.empty else {}

    # curated network overview (never the full 65+ node / 1000+ edge graph)
    ids = select_curated_overview_ids(store, max_nodes=18)
    subgraph = g.subgraph(ids)
    overview_nodes, overview_edges = _serialize_graph(subgraph, store, simplify=True, max_edges=30)

    cross_source_totals = {
        "FIR": len(fir), "CDR": len(cdr), "Transactions": len(transactions),
        "Locations": len(locations), "Vehicles": len(vehicles),
        "Intelligence": len(intelligence), "Evidence": len(evidence),
    }

    last_loaded = store.last_loaded.isoformat() if store.last_loaded else None

    return {
        "kpis": {
            "total_cases": len(cases),
            "active_investigations": len(active_cases),
            "high_priority_leads": len(high_priority_leads),
            "total_entities": int(total_entities),
            "network_relationships": metrics["relationship_count"],
            "analytical_alerts": len(alerts),
            "data_sources": len(store.load_status),
            "data_sources_connected": sum(1 for s in store.load_status.values() if s.get("connected")),
            "unresolved_entity_matches": len(unresolved_matches),
        },
        "recent_alerts": recent_alerts_out,
        "network_overview": {"nodes": overview_nodes, "edges": overview_edges},
        "network_metrics": metrics,
        "cases_by_category": cases_by_category,
        "cases_by_region": cases_by_region,
        "cases_by_status": cases_by_status,
        "cross_source_totals": cross_source_totals,
        "data_status": {
            "all_synchronized": all(s.get("connected") for s in store.load_status.values()),
            "last_loaded": last_loaded,
        },
        "synthetic_data_notice": (
            "SYNTHETIC DEMONSTRATION DATA — all person-level investigation records shown in this "
            "prototype are fictional and intended only for demonstrating analytical workflows."
        ),
    }


@router.get("/case-distribution")
def case_distribution(store: DataStore = Depends(get_data_store)):
    cases = store.get("cases")
    total = len(cases)
    if total == 0:
        return {"by_category": [], "by_status": [], "by_region": []}

    def breakdown(col: str):
        counts = cases[col].value_counts()
        return [
            {"label": label, "count": int(count), "percentage": round(count / total * 100, 1)}
            for label, count in counts.items()
        ]

    return {
        "by_category": sorted(breakdown("crime_category"), key=lambda x: x["count"], reverse=True),
        "by_status": breakdown("status"),
        "by_region": sorted(breakdown("region"), key=lambda x: x["count"], reverse=True),
        "total_cases": total,
    }


SOURCE_CATEGORY = {
    "cdr": "communication",
    "transactions": "financial",
    "locations": "location",
    "intelligence": "intelligence",
    "events": "investigation",
    "fir": "investigation",
}
DATE_COLUMN = {
    "cdr": "timestamp", "transactions": "timestamp", "locations": "timestamp",
    "intelligence": "report_date", "events": "event_timestamp", "fir": "report_date",
}


@router.get("/activity")
def activity(store: DataStore = Depends(get_data_store)):
    """Multi-source monthly activity series (for the Investigation Activity Timeline)
    plus a day-of-week x hour-of-day heatmap computed from real investigation-event
    timestamps."""
    monthly: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))

    for name, category in SOURCE_CATEGORY.items():
        df = store.get(name)
        date_col = DATE_COLUMN[name]
        if df.empty or date_col not in df.columns:
            continue
        months = df[date_col].astype(str).str.slice(0, 7)
        for month in months.dropna():
            if len(month) == 7:
                monthly[month][category] += 1
                monthly[month]["total"] += 1

    series = []
    for month in sorted(monthly.keys()):
        row = monthly[month]
        series.append({
            "month": month,
            "total": row.get("total", 0),
            "communication": row.get("communication", 0),
            "financial": row.get("financial", 0),
            "location": row.get("location", 0),
            "intelligence": row.get("intelligence", 0),
            "investigation": row.get("investigation", 0),
        })

    events = store.get("events")
    heatmap = []
    if not events.empty:
        ts = pd.to_datetime(events["event_timestamp"], errors="coerce")
        valid = events.assign(_ts=ts).dropna(subset=["_ts"])
        grouped = valid.groupby([valid["_ts"].dt.dayofweek, valid["_ts"].dt.hour]).size()
        day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        for (day, hour), count in grouped.items():
            heatmap.append({"day": day_names[day], "day_index": int(day), "hour": int(hour), "count": int(count)})

    return {"series": series, "heatmap": heatmap}


@router.get("/alerts")
def dashboard_alerts(
    severity: str | None = None,
    alert_type: str | None = None,
    case_id: str | None = None,
    limit: int = 8,
    store: DataStore = Depends(get_data_store),
):
    alerts = store.get("alerts").copy()
    persons = store.get("persons")
    name_map = dict(zip(persons["person_id"], persons["full_name"]))

    filtered = alerts
    if severity:
        filtered = filtered[filtered["severity"] == severity]
    if alert_type:
        filtered = filtered[filtered["alert_type"] == alert_type]
    if case_id:
        filtered = filtered[filtered["case_id"] == case_id]

    latest = filtered.sort_values("alert_timestamp", ascending=False).head(limit)
    latest_out = []
    for _, row in latest.iterrows():
        latest_out.append({
            "alert_id": row["alert_id"], "severity": row["severity"], "alert_type": row["alert_type"],
            "person_id": row["person_id"], "person": name_map.get(row["person_id"], row["person_id"]),
            "related_person_id": row.get("related_person_id"),
            "related_person": name_map.get(row.get("related_person_id"), row.get("related_person_id")),
            "case_id": row["case_id"], "confidence": row["confidence_score"],
            "timestamp": row["alert_timestamp"], "status": row["analyst_status"],
            "explanation": row["explanation"],
        })

    trend_source = filtered.copy()
    trend_source["month"] = trend_source["alert_timestamp"].astype(str).str.slice(0, 7)
    trend = trend_source.groupby("month").size().sort_index()
    trend_out = [{"month": m, "count": int(c)} for m, c in trend.items()]

    return {
        "latest_alerts": latest_out,
        "trend": trend_out,
        "total_matching": len(filtered),
        "by_severity": filtered["severity"].value_counts().to_dict(),
        "by_type": filtered["alert_type"].value_counts().to_dict(),
    }
