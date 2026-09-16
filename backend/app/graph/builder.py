"""Builds the multi-entity network graph from all loaded datasets using NetworkX.

Two graphs are produced:
  - full graph: heterogeneous MultiDiGraph with PERSON / PHONE / VEHICLE / LOCATION /
    ORGANIZATION / CASE nodes and typed edges (CALLED, TRANSFERRED_MONEY, USED_VEHICLE,
    OBSERVED_AT, MEMBER_OF, MENTIONED_IN, LINKED_TO, ASSOCIATED_WITH).
  - person graph: undirected weighted projection over PERSON nodes only, used for
    centrality / community analytics (aggregates all multi-source person-person signals).
"""
from __future__ import annotations

import networkx as nx
import pandas as pd

from app.services.data_store import DataStore


def _safe_iter_ids(cell: str) -> list[str]:
    if not isinstance(cell, str) or not cell.strip():
        return []
    parts = [p.strip() for p in cell.replace(";", "|").split("|")]
    return [p for p in parts if p]


def build_full_graph(store: DataStore) -> nx.MultiDiGraph:
    g = nx.MultiDiGraph()

    persons = store.get("persons")
    for _, row in persons.iterrows():
        g.add_node(row["person_id"], type="PERSON", label=row["full_name"],
                    primary_alias=row.get("primary_alias"), organization=row.get("organization"),
                    address_zone=row.get("address_zone"))
        for phone_col in ("phone_id_primary", "phone_id_secondary"):
            phone = row.get(phone_col)
            if isinstance(phone, str) and phone.strip():
                if not g.has_node(phone):
                    g.add_node(phone, type="PHONE", label=phone)
                g.add_edge(row["person_id"], phone, key="HAS_PHONE", relation="HAS_PHONE", source="persons")

    vehicles = store.get("vehicles")
    for _, row in vehicles.iterrows():
        g.add_node(row["vehicle_id"], type="VEHICLE", label=f"{row['vehicle_id']} ({row.get('model_label', '')})",
                    registration_id=row.get("registration_id"), vehicle_type=row.get("vehicle_type"),
                    color=row.get("color_description"))
        owner = row.get("primary_owner_id")
        if isinstance(owner, str) and owner.strip() and g.has_node(owner):
            g.add_edge(owner, row["vehicle_id"], key="OWNS_VEHICLE", relation="USED_VEHICLE",
                        relationship_type="PRIMARY_OWNER", source="vehicles")

    veh_assoc = store.get("vehicle_associations")
    for _, row in veh_assoc.iterrows():
        pid, vid = row.get("person_id"), row.get("vehicle_id")
        if pid and vid and g.has_node(pid) and g.has_node(vid):
            g.add_edge(pid, vid, key=f"assoc_{row['association_id']}", relation="USED_VEHICLE",
                        relationship_type=row.get("relationship_type"), source="vehicle_associations")

    locations_df = store.get("locations")
    loc_meta: dict[str, dict] = {}
    for _, row in locations_df.iterrows():
        loc_id = row.get("location_id")
        if not isinstance(loc_id, str):
            continue
        loc_meta.setdefault(loc_id, {"name": row.get("location_name"), "lat": row.get("latitude"), "lon": row.get("longitude")})
    for loc_id, meta in loc_meta.items():
        g.add_node(loc_id, type="LOCATION", label=meta["name"], latitude=meta["lat"], longitude=meta["lon"])
    for _, row in locations_df.iterrows():
        pid, loc_id = row.get("person_id"), row.get("location_id")
        if pid and loc_id and g.has_node(pid) and g.has_node(loc_id):
            g.add_edge(pid, loc_id, key=f"loc_{row['record_id']}", relation="OBSERVED_AT",
                        observation_type=row.get("observation_type"), timestamp=row.get("timestamp"),
                        source="locations")

    orgs = store.get("organizations")
    for _, row in orgs.iterrows():
        g.add_node(row["organization_id"], type="ORGANIZATION", label=row["organization_name"],
                    organization_type=row.get("organization_type"), region=row.get("region"))
    org_links = store.get("person_org_links")
    for _, row in org_links.iterrows():
        pid, oid = row.get("person_id"), row.get("organization_id")
        if pid and oid and g.has_node(pid) and g.has_node(oid):
            g.add_edge(pid, oid, key=f"org_{row['link_id']}", relation="MEMBER_OF",
                        relationship_type=row.get("relationship_type"), confidence=row.get("confidence_score"),
                        source="person_org_links")

    cases = store.get("cases")
    for _, row in cases.iterrows():
        g.add_node(row["case_id"], type="CASE", label=row["case_title"], status=row.get("status"),
                    priority=row.get("priority_level"), crime_category=row.get("crime_category"))
        for pid in _safe_iter_ids(row.get("primary_persons_of_interest", "")):
            if g.has_node(pid):
                g.add_edge(pid, row["case_id"], key=f"case_{row['case_id']}_{pid}", relation="ASSOCIATED_WITH",
                            relationship_type="PRIMARY_POI", source="cases")

    cdr = store.get("cdr")
    for _, row in cdr.iterrows():
        a, b = row.get("caller_id"), row.get("receiver_id")
        if a and b and g.has_node(a) and g.has_node(b):
            g.add_edge(a, b, key=f"cdr_{row['call_id']}", relation="CALLED",
                        communication_type=row.get("communication_type"), duration_seconds=row.get("duration_seconds"),
                        timestamp=row.get("timestamp"), cell_location=row.get("cell_location"), source="cdr")

    txns = store.get("transactions")
    for _, row in txns.iterrows():
        a, b = row.get("sender_id"), row.get("receiver_id")
        if a and b and g.has_node(a) and g.has_node(b):
            g.add_edge(a, b, key=f"txn_{row['transaction_id']}", relation="TRANSFERRED_MONEY",
                        amount=row.get("amount"), pattern_label=row.get("pattern_label"),
                        timestamp=row.get("timestamp"), source="transactions")

    intel = store.get("intelligence")
    for _, row in intel.iterrows():
        subj = row.get("subject_person_id")
        related = _safe_iter_ids(row.get("related_person_ids", ""))
        if subj and g.has_node(subj):
            for r in related:
                if g.has_node(r):
                    g.add_edge(subj, r, key=f"intel_{row['intelligence_id']}_{r}", relation="LINKED_TO",
                                intelligence_category=row.get("intelligence_category"),
                                priority=row.get("priority_level"), source="intelligence")
        loc_id = row.get("related_location_id")
        if subj and loc_id and g.has_node(subj) and g.has_node(loc_id):
            g.add_edge(subj, loc_id, key=f"intel_loc_{row['intelligence_id']}", relation="OBSERVED_AT",
                        source="intelligence")
        veh_id = row.get("related_vehicle_id")
        if subj and veh_id and g.has_node(subj) and g.has_node(veh_id):
            g.add_edge(subj, veh_id, key=f"intel_veh_{row['intelligence_id']}", relation="USED_VEHICLE",
                        source="intelligence")

    events = store.get("events")
    for _, row in events.iterrows():
        pid, related = row.get("person_id"), row.get("related_person_id")
        case_id = row.get("case_id")
        if pid and g.has_node(pid) and case_id and g.has_node(case_id):
            g.add_edge(pid, case_id, key=f"evt_case_{row['event_id']}", relation="ASSOCIATED_WITH",
                        relationship_type="EVENT_LINK", source="events")
        if pid and related and g.has_node(pid) and g.has_node(related):
            g.add_edge(pid, related, key=f"evt_{row['event_id']}", relation="LINKED_TO",
                        event_type=row.get("event_type"), timestamp=row.get("event_timestamp"), source="events")
        loc_id = row.get("location_id")
        if pid and loc_id and g.has_node(pid) and g.has_node(loc_id):
            g.add_edge(pid, loc_id, key=f"evt_loc_{row['event_id']}", relation="OBSERVED_AT", source="events")
        veh_id = row.get("vehicle_id")
        if pid and veh_id and g.has_node(pid) and g.has_node(veh_id):
            g.add_edge(pid, veh_id, key=f"evt_veh_{row['event_id']}", relation="USED_VEHICLE", source="events")

    fir = store.get("fir")
    for _, row in fir.iterrows():
        pids = _safe_iter_ids(row.get("entity_ids", ""))
        pids = [p for p in pids if g.has_node(p)]
        for i in range(len(pids)):
            for j in range(i + 1, len(pids)):
                g.add_edge(pids[i], pids[j], key=f"fir_{row['fir_id']}", relation="MENTIONED_IN",
                            fir_id=row.get("fir_id"), crime_category=row.get("crime_category"),
                            location=row.get("location"), source="fir")

    alerts = store.get("alerts")
    for _, row in alerts.iterrows():
        pid, related = row.get("person_id"), row.get("related_person_id")
        if pid and related and g.has_node(pid) and g.has_node(related):
            g.add_edge(pid, related, key=f"alert_{row['alert_id']}", relation="LINKED_TO",
                        alert_type=row.get("alert_type"), severity=row.get("severity"), source="alerts")

    return g


def build_person_graph(store: DataStore) -> nx.Graph:
    """Undirected weighted projection over PERSON nodes for centrality/community analytics."""
    persons = store.get("persons")
    g = nx.Graph()
    for _, row in persons.iterrows():
        g.add_node(row["person_id"], label=row["full_name"], primary_alias=row.get("primary_alias"),
                    organization=row.get("organization"))

    def bump(a, b, relation, weight=1.0):
        if not a or not b or a == b:
            return
        if a not in g.nodes or b not in g.nodes:
            return
        if g.has_edge(a, b):
            g[a][b]["weight"] += weight
            g[a][b]["relations"].add(relation)
        else:
            g.add_edge(a, b, weight=weight, relations={relation})

    cdr = store.get("cdr")
    for _, row in cdr.iterrows():
        bump(row.get("caller_id"), row.get("receiver_id"), "CALLED", 1.0)

    txns = store.get("transactions")
    for _, row in txns.iterrows():
        bump(row.get("sender_id"), row.get("receiver_id"), "TRANSFERRED_MONEY", 1.0)

    intel = store.get("intelligence")
    for _, row in intel.iterrows():
        subj = row.get("subject_person_id")
        for r in _safe_iter_ids(row.get("related_person_ids", "")):
            bump(subj, r, "LINKED_TO_INTEL", 0.5)

    events = store.get("events")
    for _, row in events.iterrows():
        bump(row.get("person_id"), row.get("related_person_id"), "EVENT_LINK", 0.5)

    fir = store.get("fir")
    for _, row in fir.iterrows():
        pids = _safe_iter_ids(row.get("entity_ids", ""))
        for i in range(len(pids)):
            for j in range(i + 1, len(pids)):
                bump(pids[i], pids[j], "MENTIONED_IN_FIR", 0.5)

    veh_assoc = store.get("vehicle_associations")
    veh_owner: dict[str, str] = {}
    vehicles = store.get("vehicles")
    for _, row in vehicles.iterrows():
        veh_owner[row["vehicle_id"]] = row.get("primary_owner_id")
    by_vehicle: dict[str, set] = {}
    for _, row in veh_assoc.iterrows():
        by_vehicle.setdefault(row["vehicle_id"], set()).add(row["person_id"])
    for vid, owner in veh_owner.items():
        if owner:
            by_vehicle.setdefault(vid, set()).add(owner)
    for vid, people in by_vehicle.items():
        people = list(people)
        for i in range(len(people)):
            for j in range(i + 1, len(people)):
                bump(people[i], people[j], "SHARED_VEHICLE", 0.5)

    alerts = store.get("alerts")
    for _, row in alerts.iterrows():
        bump(row.get("person_id"), row.get("related_person_id"), "ALERT_LINK", 0.5)

    locations_df = store.get("locations")
    by_loc_day: dict[tuple, set] = {}
    for _, row in locations_df.iterrows():
        ts = row.get("timestamp")
        day = ts[:10] if isinstance(ts, str) else None
        loc_id = row.get("location_id")
        pid = row.get("person_id")
        if day and loc_id and pid:
            by_loc_day.setdefault((loc_id, day), set()).add(pid)
    for key, people in by_loc_day.items():
        people = list(people)
        if len(people) < 2:
            continue
        for i in range(len(people)):
            for j in range(i + 1, len(people)):
                bump(people[i], people[j], "CO_LOCATED", 0.25)

    for u, v, data in g.edges(data=True):
        data["relations"] = sorted(data["relations"])

    return g


def get_full_graph(store: DataStore) -> nx.MultiDiGraph:
    with store._graph_lock:
        if store.graph is None:
            store.graph = build_full_graph(store)
        return store.graph


def get_person_graph(store: DataStore) -> nx.Graph:
    cache_key = "person_graph"
    with store._graph_lock:
        if cache_key not in store.analytics_cache:
            store.analytics_cache[cache_key] = build_person_graph(store)
        return store.analytics_cache[cache_key]


def select_curated_overview_ids(store: DataStore, max_nodes: int = 18) -> set[str]:
    """Picks a small, analytically-relevant node set for the default/dashboard network
    view: the most influential persons plus the vehicles/organizations/cases directly
    linked to them. Avoids dumping the entire heterogeneous graph on first load."""
    from app.analytics.centrality import top_connectors

    max_persons = max(4, round(max_nodes * 0.55))
    top = top_connectors(store, limit=max_persons)
    person_ids = {p["person_id"] for p in top}

    g = get_full_graph(store)
    selected: set[str] = set(person_ids)
    remaining = max_nodes - len(selected)
    if remaining <= 0:
        return selected

    linked_others: list[tuple[str, int]] = []
    for pid in person_ids:
        if pid not in g.nodes:
            continue
        for nb in g.neighbors(pid):
            ntype = g.nodes[nb].get("type")
            if ntype in ("VEHICLE", "ORGANIZATION", "CASE") and nb not in selected:
                linked_others.append((nb, g.degree(nb)))

    linked_others.sort(key=lambda x: x[1], reverse=True)
    seen = set()
    for node_id, _ in linked_others:
        if node_id in seen:
            continue
        seen.add(node_id)
        selected.add(node_id)
        if len(selected) >= max_nodes:
            break

    return selected
