"""Pattern detection: transaction chains, circular flows, repeated high-value transfers,
communication spikes, frequent co-location, shared-vehicle links -- computed directly from
the raw CSVs using graph + statistical methods (not just re-displaying dataset labels).
Every pattern returned carries an explanation, involved entities, source records and a
confidence score. Nothing here asserts guilt -- these are investigative leads."""
from __future__ import annotations

from collections import defaultdict
from statistics import mean, pstdev

import networkx as nx
import pandas as pd

from app.services.data_store import DataStore


def _name_map(store: DataStore) -> dict:
    persons = store.get("persons")
    return dict(zip(persons["person_id"], persons["full_name"]))


def detect_transaction_chains(store: DataStore, max_results: int = 25) -> list[dict]:
    txns = store.get("transactions")
    if txns.empty:
        return []
    names = _name_map(store)
    txns = txns.copy()
    txns["amount_f"] = pd.to_numeric(txns["amount"], errors="coerce")
    txns["ts"] = pd.to_datetime(txns["timestamp"], errors="coerce")
    txns = txns.dropna(subset=["ts"]).sort_values("ts")

    g = nx.DiGraph()
    for _, row in txns.iterrows():
        g.add_edge(row["sender_id"], row["receiver_id"], txn_id=row["transaction_id"],
                    amount=row["amount_f"], ts=row["ts"])

    results = []
    seen_paths = set()
    for node in g.nodes:
        for nxt in g.successors(node):
            for nxt2 in g.successors(nxt):
                if nxt2 == node:
                    continue
                for nxt3 in g.successors(nxt2):
                    if nxt3 in (node, nxt):
                        continue
                    path = (node, nxt, nxt2, nxt3)
                    if path in seen_paths:
                        continue
                    edges = [g[node][nxt], g[nxt][nxt2], g[nxt2][nxt3]]
                    times = [e["ts"] for e in edges]
                    if times != sorted(times):
                        continue
                    span_hours = (times[-1] - times[0]).total_seconds() / 3600
                    if span_hours > 72:
                        continue
                    seen_paths.add(path)
                    labeled = txns[(txns["transaction_id"].isin([e["txn_id"] for e in edges]))]
                    chain_labeled = (labeled["pattern_label"] == "TRANSACTION_CHAIN").sum()
                    confidence = round(min(0.95, 0.45 + 0.15 * chain_labeled + max(0, (72 - span_hours) / 200)), 2)
                    results.append({
                        "pattern_type": "TRANSACTION_CHAIN",
                        "entities": list(path),
                        "entity_names": [names.get(p, p) for p in path],
                        "explanation": (
                            f"Funds moved sequentially {' -> '.join(path)} within "
                            f"{round(span_hours, 1)} hours, consistent with a layering / fan-out chain typology."
                        ),
                        "supporting_records": [e["txn_id"] for e in edges],
                        "confidence": confidence,
                        "timestamp": times[0].isoformat(),
                        "analyst_review_state": "REQUIRES_REVIEW",
                        "dataset_label_agreement": f"{chain_labeled}/3 hops labeled TRANSACTION_CHAIN in source data",
                    })

    results.sort(key=lambda r: r["confidence"], reverse=True)
    return results[:max_results]


def detect_circular_flows(store: DataStore, max_results: int = 25) -> list[dict]:
    txns = store.get("transactions")
    if txns.empty:
        return []
    names = _name_map(store)
    txns = txns.copy()
    txns["amount_f"] = pd.to_numeric(txns["amount"], errors="coerce")
    txns["ts"] = pd.to_datetime(txns["timestamp"], errors="coerce")

    g = nx.MultiDiGraph()
    for _, row in txns.iterrows():
        g.add_edge(row["sender_id"], row["receiver_id"], txn_id=row["transaction_id"],
                    amount=row["amount_f"], ts=row["ts"], label=row["pattern_label"])

    simple_g = nx.DiGraph(g)
    results = []
    try:
        cycles = [c for c in nx.simple_cycles(simple_g, length_bound=5) if 3 <= len(c) <= 5]
    except TypeError:
        cycles = [c for c in nx.simple_cycles(simple_g) if 3 <= len(c) <= 5]

    for cycle in cycles[:200]:
        edge_records = []
        for i in range(len(cycle)):
            a, b = cycle[i], cycle[(i + 1) % len(cycle)]
            if g.has_edge(a, b):
                edge_data = list(g.get_edge_data(a, b).values())[0]
                edge_records.append(edge_data)
        if len(edge_records) != len(cycle):
            continue
        labeled = sum(1 for e in edge_records if e.get("label") == "CIRCULAR_FLOW")
        confidence = round(min(0.95, 0.4 + 0.15 * labeled), 2)
        results.append({
            "pattern_type": "CIRCULAR_FLOW",
            "entities": cycle,
            "entity_names": [names.get(p, p) for p in cycle],
            "explanation": (
                f"Funds traced a closed loop through {' -> '.join(cycle)} -> {cycle[0]}, "
                "matching the 'Cycle' money-laundering typology (funds returning toward the originator)."
            ),
            "supporting_records": [e["txn_id"] for e in edge_records],
            "confidence": confidence,
            "timestamp": min(e["ts"] for e in edge_records if pd.notna(e["ts"])).isoformat() if any(pd.notna(e["ts"]) for e in edge_records) else None,
            "analyst_review_state": "REQUIRES_REVIEW",
            "dataset_label_agreement": f"{labeled}/{len(cycle)} hops labeled CIRCULAR_FLOW in source data",
        })

    results.sort(key=lambda r: r["confidence"], reverse=True)
    return results[:max_results]


def detect_repeated_high_value(store: DataStore, max_results: int = 25) -> list[dict]:
    txns = store.get("transactions")
    if txns.empty:
        return []
    names = _name_map(store)
    txns = txns.copy()
    txns["amount_f"] = pd.to_numeric(txns["amount"], errors="coerce")
    threshold = txns["amount_f"].quantile(0.75)

    grouped = txns.groupby(["sender_id", "receiver_id"])
    results = []
    for (sender, receiver), grp in grouped:
        high_value = grp[grp["amount_f"] >= threshold]
        if len(high_value) < 2:
            continue
        labeled = (grp["pattern_label"] == "REPEATED_HIGH_VALUE").sum()
        confidence = round(min(0.95, 0.4 + 0.1 * len(high_value) + 0.1 * labeled), 2)
        results.append({
            "pattern_type": "REPEATED_HIGH_VALUE",
            "entities": [sender, receiver],
            "entity_names": [names.get(sender, sender), names.get(receiver, receiver)],
            "explanation": (
                f"{len(high_value)} high-value transfers (>= INR {int(threshold):,}) were recorded between "
                f"{sender} and {receiver}, consistent with stacked/repeated bilateral transfer typology."
            ),
            "supporting_records": high_value["transaction_id"].tolist(),
            "confidence": confidence,
            "timestamp": None,
            "analyst_review_state": "REQUIRES_REVIEW",
            "dataset_label_agreement": f"{labeled}/{len(grp)} txns labeled REPEATED_HIGH_VALUE in source data",
        })

    results.sort(key=lambda r: r["confidence"], reverse=True)
    return results[:max_results]


def detect_communication_spikes(store: DataStore, max_results: int = 25) -> list[dict]:
    cdr = store.get("cdr")
    if cdr.empty:
        return []
    names = _name_map(store)
    cdr = cdr.copy()
    cdr["ts"] = pd.to_datetime(cdr["timestamp"], errors="coerce")
    cdr["day"] = cdr["ts"].dt.date
    cdr["pair"] = cdr.apply(lambda r: tuple(sorted([r["caller_id"], r["receiver_id"]])), axis=1)

    daily_counts = cdr.groupby(["pair", "day"]).size().reset_index(name="count")
    results = []
    for pair, grp in daily_counts.groupby("pair"):
        counts = grp["count"].tolist()
        if len(counts) < 3:
            continue
        avg, sd = mean(counts), pstdev(counts) if len(counts) > 1 else 0
        spike_days = grp[grp["count"] > avg + 2 * sd] if sd > 0 else grp[grp["count"] == max(counts)]
        if spike_days.empty:
            continue
        top = spike_days.sort_values("count", ascending=False).iloc[0]
        a, b = pair
        confidence = round(min(0.95, 0.4 + (top["count"] - avg) / max(avg, 1) * 0.2), 2)
        matching = cdr[(cdr["pair"] == pair) & (cdr["day"] == top["day"])]
        results.append({
            "pattern_type": "RAPID_CONTACT_SPIKE",
            "entities": [a, b],
            "entity_names": [names.get(a, a), names.get(b, b)],
            "explanation": (
                f"Communication between {a} and {b} spiked to {int(top['count'])} contacts on {top['day']} "
                f"versus a daily average of {round(avg, 1)}. This is a communication pattern requiring investigation, "
                "not proof of coordination."
            ),
            "supporting_records": matching["call_id"].tolist(),
            "confidence": confidence,
            "timestamp": str(top["day"]),
            "analyst_review_state": "REQUIRES_REVIEW",
        })

    results.sort(key=lambda r: r["confidence"], reverse=True)
    return results[:max_results]


def detect_frequent_co_location(store: DataStore, max_results: int = 25) -> list[dict]:
    locations_df = store.get("locations")
    if locations_df.empty:
        return []
    names = _name_map(store)
    locs = locations_df.copy()
    locs["day"] = locs["timestamp"].str[:10]

    by_loc_day: dict[tuple, set] = defaultdict(set)
    loc_name: dict[str, str] = {}
    for _, row in locs.iterrows():
        by_loc_day[(row["location_id"], row["day"])].add(row["person_id"])
        loc_name[row["location_id"]] = row["location_name"]

    pair_counts: dict[tuple, list] = defaultdict(list)
    for (loc_id, day), people in by_loc_day.items():
        people = sorted(people)
        for i in range(len(people)):
            for j in range(i + 1, len(people)):
                pair_counts[(people[i], people[j])].append((loc_id, day))

    results = []
    for (a, b), occurrences in pair_counts.items():
        if len(occurrences) < 3:
            continue
        distinct_locs = {loc for loc, _ in occurrences}
        confidence = round(min(0.95, 0.4 + 0.08 * len(occurrences)), 2)
        results.append({
            "pattern_type": "FREQUENT_CO_LOCATION",
            "entities": [a, b],
            "entity_names": [names.get(a, a), names.get(b, b)],
            "explanation": (
                f"{a} and {b} were observed at the same location on {len(occurrences)} separate days "
                f"across {len(distinct_locs)} location(s), a co-location pattern requiring investigation."
            ),
            "supporting_records": [f"{loc}@{day}" for loc, day in occurrences[:10]],
            "confidence": confidence,
            "timestamp": None,
            "analyst_review_state": "REQUIRES_REVIEW",
        })

    results.sort(key=lambda r: r["confidence"], reverse=True)
    return results[:max_results]


def detect_shared_vehicles(store: DataStore, max_results: int = 25) -> list[dict]:
    veh_assoc = store.get("vehicle_associations")
    vehicles = store.get("vehicles")
    if veh_assoc.empty:
        return []
    names = _name_map(store)
    by_vehicle: dict[str, set] = defaultdict(set)
    owner_map = dict(zip(vehicles["vehicle_id"], vehicles["primary_owner_id"]))
    for _, row in veh_assoc.iterrows():
        by_vehicle[row["vehicle_id"]].add(row["person_id"])
    for vid, owner in owner_map.items():
        if isinstance(owner, str) and owner:
            by_vehicle[vid].add(owner)

    results = []
    for vid, people in by_vehicle.items():
        people = sorted(p for p in people if isinstance(p, str))
        if len(people) < 2:
            continue
        assoc_rows = veh_assoc[veh_assoc["vehicle_id"] == vid]
        for i in range(len(people)):
            for j in range(i + 1, len(people)):
                a, b = people[i], people[j]
                confidence = 0.65
                results.append({
                    "pattern_type": "VEHICLE_PERSON_LINK",
                    "entities": [a, b],
                    "entity_names": [names.get(a, a), names.get(b, b)],
                    "explanation": f"{a} and {b} are both associated with vehicle {vid} (shared use / observed together).",
                    "supporting_records": assoc_rows["association_id"].tolist() or [vid],
                    "confidence": confidence,
                    "timestamp": None,
                    "analyst_review_state": "REQUIRES_REVIEW",
                })

    results.sort(key=lambda r: r["confidence"], reverse=True)
    return results[:max_results]


def all_patterns(store: DataStore) -> dict:
    return {
        "transaction_chains": detect_transaction_chains(store),
        "circular_flows": detect_circular_flows(store),
        "repeated_high_value": detect_repeated_high_value(store),
        "communication_spikes": detect_communication_spikes(store),
        "frequent_co_location": detect_frequent_co_location(store),
        "shared_vehicles": detect_shared_vehicles(store),
    }
