"""Explainable 'Investigative Priority Score' -- NOT a criminal-probability score.
Combines network centrality, transaction anomalies, cross-case links, and multi-source
signals into a transparent 0-100 score with itemized, inspectable factors."""
from __future__ import annotations

from app.services.data_store import DataStore
from app.analytics.centrality import compute_centrality
from app.analytics.patterns import all_patterns


def _level(value: float, low: float, high: float) -> str:
    if value >= high:
        return "High"
    if value >= low:
        return "Medium"
    return "Low"


def compute_risk_scores(store: DataStore) -> list[dict]:
    persons = store.get("persons")
    centrality = compute_centrality(store)
    patterns = all_patterns(store)
    alerts = store.get("alerts")
    events = store.get("events")

    involved_in_pattern: dict[str, list[dict]] = {}
    for category, items in patterns.items():
        for item in items:
            for pid in item["entities"]:
                involved_in_pattern.setdefault(pid, []).append({"category": category, "explanation": item["explanation"]})

    cross_case_alerts = alerts[alerts["alert_type"] == "CROSS_CASE_CONNECTION"] if not alerts.empty else alerts
    multi_source_alerts = alerts[alerts["alert_type"] == "MULTI_SOURCE_MATCH"] if not alerts.empty else alerts

    results = []
    for _, row in persons.iterrows():
        pid = row["person_id"]
        deg = centrality["degree"].get(pid, 0)
        bet = centrality["betweenness"].get(pid, 0)

        anomaly_hits = involved_in_pattern.get(pid, [])
        txn_anomaly_count = sum(1 for h in anomaly_hits if h["category"] in
                                 ("transaction_chains", "circular_flows", "repeated_high_value"))
        comm_anomaly_count = sum(1 for h in anomaly_hits if h["category"] == "communication_spikes")
        location_anomaly_count = sum(1 for h in anomaly_hits if h["category"] == "frequent_co_location")
        vehicle_link_count = sum(1 for h in anomaly_hits if h["category"] == "shared_vehicles")

        cross_case = int(((cross_case_alerts["person_id"] == pid) | (cross_case_alerts["related_person_id"] == pid)).sum()) if not cross_case_alerts.empty else 0
        multi_source = int(((multi_source_alerts["person_id"] == pid) | (multi_source_alerts["related_person_id"] == pid)).sum()) if not multi_source_alerts.empty else 0

        related_events = int(((events["person_id"] == pid) | (events["related_person_id"] == pid)).sum()) if not events.empty else 0

        comm_score = min(30, deg * 100 * 0.3 + bet * 100 * 0.4)
        txn_score = min(25, txn_anomaly_count * 8)
        cross_case_score = min(20, cross_case * 7)
        multi_source_score = min(15, multi_source * 5)
        location_score = min(10, location_anomaly_count * 3 + vehicle_link_count * 2)

        total = round(comm_score + txn_score + cross_case_score + multi_source_score + location_score)
        total = min(100, total)

        factors = [
            {"factor": "Communication centrality", "level": _level(comm_score, 8, 18), "score": round(comm_score, 1),
             "detail": f"Degree centrality {round(deg,3)}, betweenness {round(bet,3)} in the communication/network graph."},
            {"factor": "Transaction anomaly", "level": _level(txn_score, 8, 16), "score": round(txn_score, 1),
             "detail": f"{txn_anomaly_count} detected transaction-chain/circular-flow/repeated-high-value pattern hits."},
            {"factor": "Cross-case connections", "level": _level(cross_case_score, 7, 14), "score": round(cross_case_score, 1),
             "detail": f"{cross_case} CROSS_CASE_CONNECTION alert(s) referencing this person."},
            {"factor": "Multi-source connections", "level": _level(multi_source_score, 5, 10), "score": round(multi_source_score, 1),
             "detail": f"{multi_source} MULTI_SOURCE_MATCH alert(s) referencing this person."},
            {"factor": "Location / vehicle anomaly", "level": _level(location_score, 3, 7), "score": round(location_score, 1),
             "detail": f"{location_anomaly_count} co-location pattern(s), {vehicle_link_count} shared-vehicle link(s)."},
        ]

        results.append({
            "person_id": pid,
            "name": row["full_name"],
            "investigative_priority_score": total,
            "factors": factors,
            "related_event_count": related_events,
            "supporting_pattern_hits": anomaly_hits[:10],
            "disclaimer": "Investigative Priority Score reflects data patterns only. It is not proof of criminal activity "
                           "and must be reviewed by a human investigator before any action is taken.",
        })

    results.sort(key=lambda r: r["investigative_priority_score"], reverse=True)
    return results


def risk_for_person(store: DataStore, person_id: str) -> dict | None:
    for r in compute_risk_scores(store):
        if r["person_id"] == person_id:
            return r
    return None
