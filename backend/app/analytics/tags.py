"""Analytical highlight tags for network nodes -- used for the network filter panel's
'Analytical' category and for subtle node-highlighting. These are investigative signals,
never accusations: labels stay in the 'Key Connector / High Network Influence /
Potential Investigative Lead' register."""
from __future__ import annotations

from app.services.data_store import DataStore
from app.analytics.centrality import compute_centrality, top_connectors, compute_graph_metrics

CROSS_CASE_ALERT_TYPES = {"CROSS_CASE_CONNECTION"}
MULTI_SOURCE_ALERT_TYPES = {"MULTI_SOURCE_MATCH"}
SUSPICIOUS_PATTERN_ALERT_TYPES = {
    "TRANSACTION_CHAIN", "CIRCULAR_TRANSACTION", "UNUSUAL_TRANSACTION",
    "RAPID_CONTACT_SPIKE", "FREQUENT_CO_LOCATION", "VEHICLE_PERSON_LINK",
    "HIGH_COMMUNICATION_CENTRALITY",
}

TAG_LABELS = {
    "KEY_CONNECTOR": "Key Connector",
    "HIGH_CENTRALITY": "High Network Influence",
    "CROSS_CASE": "Cross-Case Entity",
    "MULTI_SOURCE": "Multi-Source Match",
    "SUSPICIOUS_PATTERN": "Potential Investigative Lead",
}


def compute_analytical_tags(store: DataStore) -> dict[str, list[str]]:
    cache_key = "analytical_tags"
    if cache_key in store.analytics_cache:
        return store.analytics_cache[cache_key]

    tags: dict[str, set[str]] = {}

    def add(pid: str, tag: str):
        if not pid:
            return
        tags.setdefault(pid, set()).add(tag)

    top = top_connectors(store, limit=5)
    for p in top:
        add(p["person_id"], "KEY_CONNECTOR")

    centrality = compute_centrality(store)
    metrics = compute_graph_metrics(store)
    bet_values = list(centrality["betweenness"].values())
    if bet_values:
        sorted_vals = sorted(bet_values, reverse=True)
        cutoff_idx = max(0, min(len(sorted_vals) - 1, metrics["key_connectors"] - 1))
        threshold = sorted_vals[cutoff_idx] if sorted_vals else 0
        for pid, v in centrality["betweenness"].items():
            if v >= threshold and v > 0:
                add(pid, "HIGH_CENTRALITY")

    alerts = store.get("alerts")
    if not alerts.empty:
        for _, row in alerts.iterrows():
            alert_type = row.get("alert_type")
            for pid in (row.get("person_id"), row.get("related_person_id")):
                if not pid:
                    continue
                if alert_type in CROSS_CASE_ALERT_TYPES:
                    add(pid, "CROSS_CASE")
                if alert_type in MULTI_SOURCE_ALERT_TYPES:
                    add(pid, "MULTI_SOURCE")
                if alert_type in SUSPICIOUS_PATTERN_ALERT_TYPES:
                    add(pid, "SUSPICIOUS_PATTERN")

    cases = store.get("cases")
    if not cases.empty:
        appearance_count: dict[str, int] = {}
        for _, row in cases.iterrows():
            poi = row.get("primary_persons_of_interest")
            if isinstance(poi, str):
                for pid in [p.strip() for p in poi.replace(";", "|").split("|") if p.strip()]:
                    appearance_count[pid] = appearance_count.get(pid, 0) + 1
        for pid, count in appearance_count.items():
            if count > 1:
                add(pid, "CROSS_CASE")

    result = {k: sorted(v) for k, v in tags.items()}
    store.analytics_cache[cache_key] = result
    return result
