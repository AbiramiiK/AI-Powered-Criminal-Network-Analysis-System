"""Graph analytics: centrality measures and community detection over the person graph.
All results are explainable investigative-priority signals, never "criminal" labels."""
from __future__ import annotations

from statistics import mean, pstdev

import networkx as nx

from app.services.data_store import DataStore
from app.graph.builder import get_person_graph, get_full_graph


def compute_centrality(store: DataStore) -> dict:
    cache_key = "centrality"
    if cache_key in store.analytics_cache:
        return store.analytics_cache[cache_key]

    g = get_person_graph(store)
    if g.number_of_nodes() == 0:
        result = {"degree": {}, "betweenness": {}, "pagerank": {}, "closeness": {}, "node_count": 0, "edge_count": 0}
        store.analytics_cache[cache_key] = result
        return result

    degree = nx.degree_centrality(g)
    betweenness = nx.betweenness_centrality(g, weight="weight", normalized=True)
    pagerank = nx.pagerank(g, weight="weight")
    closeness = nx.closeness_centrality(g)

    result = {
        "degree": degree,
        "betweenness": betweenness,
        "pagerank": pagerank,
        "closeness": closeness,
        "node_count": g.number_of_nodes(),
        "edge_count": g.number_of_edges(),
    }
    store.analytics_cache[cache_key] = result
    return result


def compute_communities(store: DataStore) -> dict:
    cache_key = "communities"
    if cache_key in store.analytics_cache:
        return store.analytics_cache[cache_key]

    g = get_person_graph(store)
    if g.number_of_nodes() == 0:
        result = {"communities": [], "modularity": None}
        store.analytics_cache[cache_key] = result
        return result

    communities = list(nx.algorithms.community.greedy_modularity_communities(g, weight="weight"))
    try:
        modularity = nx.algorithms.community.modularity(g, communities, weight="weight")
    except Exception:  # noqa: BLE001
        modularity = None

    centrality = compute_centrality(store)
    events = store.get("events")
    alerts = store.get("alerts")

    community_list = []
    for idx, c in enumerate(communities):
        members = sorted(list(c))
        subgraph = g.subgraph(members)
        member_bet = sorted(members, key=lambda m: centrality["betweenness"].get(m, 0), reverse=True)
        key_connectors = member_bet[:min(3, len(member_bet))]

        activity_count = 0
        if not events.empty:
            activity_count += int((events["person_id"].isin(members) | events["related_person_id"].isin(members)).sum())
        if not alerts.empty:
            activity_count += int((alerts["person_id"].isin(members) | alerts["related_person_id"].isin(members)).sum())
        avg_activity = activity_count / max(1, len(members))
        activity_level = "High" if avg_activity >= 20 else "Medium" if avg_activity >= 10 else "Low"

        community_list.append({
            "community_id": idx,
            "members": members,
            "size": len(c),
            "relationship_count": subgraph.number_of_edges(),
            "key_connectors": key_connectors,
            "activity_level": activity_level,
            "activity_count": activity_count,
        })

    result = {"communities": community_list, "modularity": modularity}
    store.analytics_cache[cache_key] = result
    return result


def person_community_map(store: DataStore) -> dict[str, int]:
    result = compute_communities(store)
    mapping = {}
    for c in result["communities"]:
        for m in c["members"]:
            mapping[m] = c["community_id"]
    return mapping


def compute_graph_metrics(store: DataStore) -> dict:
    """High-level network metrics shown on the dashboard 'Network Metrics' card and the
    Network Analysis page. Computed from the actual graphs -- never hardcoded."""
    cache_key = "graph_metrics"
    if cache_key in store.analytics_cache:
        return store.analytics_cache[cache_key]

    full_g = get_full_graph(store)
    person_g = get_person_graph(store)
    centrality = compute_centrality(store)
    communities = compute_communities(store)

    bet_values = list(centrality["betweenness"].values())
    if bet_values:
        threshold = mean(bet_values) + (pstdev(bet_values) if len(bet_values) > 1 else 0)
        key_connector_count = sum(1 for v in bet_values if v > threshold and v > 0)
        key_connector_count = max(key_connector_count, min(3, len(bet_values)))
    else:
        key_connector_count = 0

    # de-duplicate the heterogeneous MultiDiGraph edge count the same way the API does
    seen_pairs = set()
    for u, v, data in full_g.edges(data=True):
        seen_pairs.add((u, v, data.get("relation")))

    result = {
        "node_count": full_g.number_of_nodes(),
        "relationship_count": len(seen_pairs),
        "communities": len(communities["communities"]),
        "key_connectors": key_connector_count,
        "average_degree": round(sum(dict(person_g.degree()).values()) / person_g.number_of_nodes(), 2) if person_g.number_of_nodes() else 0,
        "network_density": round(nx.density(person_g), 4) if person_g.number_of_nodes() > 1 else 0,
        "modularity": round(communities["modularity"], 4) if communities["modularity"] is not None else None,
    }
    store.analytics_cache[cache_key] = result
    return result


def top_connectors(store: DataStore, limit: int = 10) -> list[dict]:
    """Ranks persons by a combined influence signal (degree + betweenness + pagerank)."""
    centrality = compute_centrality(store)
    persons_df = store.get("persons")
    name_map = dict(zip(persons_df["person_id"], persons_df["full_name"]))
    g = get_person_graph(store)

    cache_key = "communities"
    if cache_key in store.analytics_cache:
        community_map = {m: c["community_id"] for c in store.analytics_cache[cache_key]["communities"] for m in c["members"]}
    else:
        community_map = {}

    cases = store.get("cases")

    def cases_for(pid: str) -> list[str]:
        if cases.empty:
            return []
        matches = cases[cases["primary_persons_of_interest"].fillna("").str.contains(pid)]
        return matches["case_id"].tolist()

    scores = []
    for pid in centrality["degree"].keys():
        deg = centrality["degree"].get(pid, 0)
        bet = centrality["betweenness"].get(pid, 0)
        pr = centrality["pagerank"].get(pid, 0)
        clo = centrality["closeness"].get(pid, 0)
        combined = (deg * 0.35) + (bet * 0.35) + (pr * 0.30)

        neighbors = list(g.neighbors(pid)) if pid in g.nodes else []
        my_community = community_map.get(pid)
        cross_community = sum(1 for n in neighbors if community_map.get(n) is not None and community_map.get(n) != my_community)

        scores.append({
            "person_id": pid,
            "name": name_map.get(pid, pid),
            "degree_centrality": round(deg, 4),
            "betweenness_centrality": round(bet, 4),
            "pagerank": round(pr, 4),
            "closeness_centrality": round(clo, 4),
            "combined_influence_score": round(combined, 4),
            "direct_connections": len(neighbors),
            "cross_community_connections": cross_community,
            "community_id": my_community,
            "cases_involved": cases_for(pid),
        })

    scores.sort(key=lambda x: x["combined_influence_score"], reverse=True)
    return scores[:limit]


def explain_centrality(store: DataStore, person_id: str) -> dict:
    """Human-readable explanation of why a person's centrality score is what it is."""
    centrality = compute_centrality(store)
    g = get_person_graph(store)

    if person_id not in g.nodes:
        return {"person_id": person_id, "found": False}

    deg = centrality["degree"].get(person_id, 0)
    bet = centrality["betweenness"].get(person_id, 0)
    pr = centrality["pagerank"].get(person_id, 0)
    clo = centrality["closeness"].get(person_id, 0)
    neighbors = list(g.neighbors(person_id))

    community_map = person_community_map(store)
    cases = store.get("cases")
    connected_cases = cases[cases["primary_persons_of_interest"].fillna("").str.contains(person_id)]["case_id"].tolist() if not cases.empty else []

    reasons = []
    if deg > 0.5:
        reasons.append("High degree centrality: directly connected to a large share of the observed network.")
    elif deg > 0.25:
        reasons.append("Moderate degree centrality: connected to a above-average number of entities.")
    if bet > 0.1:
        reasons.append("High betweenness: frequently sits on the shortest path between other entities, consistent with a 'key connector' role.")
    if pr > (1.0 / max(g.number_of_nodes(), 1)) * 1.5:
        reasons.append("Above-average PageRank: connected to other well-connected entities.")
    if not reasons:
        reasons.append("Centrality signals are within the typical range for this network; no standout connector pattern detected.")

    return {
        "person_id": person_id,
        "found": True,
        "degree_centrality": round(deg, 4),
        "betweenness_centrality": round(bet, 4),
        "pagerank": round(pr, 4),
        "closeness_centrality": round(clo, 4),
        "direct_connections": len(neighbors),
        "neighbor_ids": neighbors,
        "explanation": reasons,
        "community_id": community_map.get(person_id),
        "connected_cases": connected_cases,
        "classification_label": "High network influence" if (deg > 0.5 or bet > 0.1) else (
            "Key connector" if bet > 0.05 else "Standard network participant"),
        "disclaimer": "This score reflects network structure only. It is not evidence of criminal leadership or wrongdoing.",
    }
