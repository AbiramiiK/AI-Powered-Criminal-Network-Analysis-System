from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.deps import get_data_store, get_current_user
from app.services.data_store import DataStore
from app.services import audit
from app.graph.builder import get_full_graph, get_person_graph, select_curated_overview_ids
from app.analytics.centrality import (
    compute_centrality, compute_communities, top_connectors, explain_centrality,
    compute_graph_metrics, person_community_map,
)
from app.analytics.tags import compute_analytical_tags, TAG_LABELS

router = APIRouter(prefix="/api", tags=["network"])

ANALYTICAL_FILTER_MAP = {
    "key_connectors": "KEY_CONNECTOR",
    "high_centrality": "HIGH_CENTRALITY",
    "cross_case": "CROSS_CASE",
    "multi_source": "MULTI_SOURCE",
    "suspicious_patterns": "SUSPICIOUS_PATTERN",
}


def _serialize_graph(g, store: DataStore, node_types=None, relation_types=None,
                      min_connections=0, date_from=None, date_to=None, analytical_filters=None,
                      simplify=False, max_edges=None):
    """Serializes a (sub)graph for the UI. Multi-edges between the same two nodes (e.g.
    dozens of individual CDR calls) are AGGREGATED into one edge per (source, target,
    relation) with a count + a small sample of supporting records, so the graph stays
    readable instead of drawing one line per raw transaction/call."""
    tags = compute_analytical_tags(store)
    analytical_type_filter = {ANALYTICAL_FILTER_MAP[f] for f in (analytical_filters or []) if f in ANALYTICAL_FILTER_MAP}

    nodes = []
    node_ids = set()
    for n, data in g.nodes(data=True):
        ntype = data.get("type", "UNKNOWN")
        if node_types and ntype not in node_types:
            continue
        degree = g.degree(n)
        if degree < min_connections:
            continue
        node_tags = tags.get(n, [])
        if analytical_type_filter and not (set(node_tags) & analytical_type_filter):
            continue
        nodes.append({
            "id": n, "type": ntype, "label": data.get("label", n), "degree": degree,
            "analytical_tags": node_tags,
            **{k: v for k, v in data.items() if k not in ("type", "label")},
        })
        node_ids.add(n)

    groups: dict[tuple, dict] = {}
    for u, v, key, data in g.edges(keys=True, data=True):
        relation = data.get("relation", "LINKED_TO")
        if relation_types and relation not in relation_types:
            continue
        if u not in node_ids or v not in node_ids:
            continue
        ts = data.get("timestamp")
        if ts and (date_from or date_to):
            if date_from and str(ts) < date_from:
                continue
            if date_to and str(ts) > date_to:
                continue

        group_key = (u, v, relation)
        entry = groups.setdefault(group_key, {
            "id": f"{u}|{v}|{relation}", "source": u, "target": v, "relation": relation,
            "count": 0, "total_amount": 0.0, "total_duration": 0.0, "timestamps": [],
            "sample_records": [],
        })
        entry["count"] += 1
        amount = data.get("amount")
        if amount is not None:
            try:
                entry["total_amount"] += float(amount)
            except (TypeError, ValueError):
                pass
        duration = data.get("duration_seconds")
        if duration is not None:
            try:
                entry["total_duration"] += float(duration)
            except (TypeError, ValueError):
                pass
        if ts:
            entry["timestamps"].append(ts)
        if len(entry["sample_records"]) < 3:
            entry["sample_records"].append({k: v2 for k, v2 in data.items() if k != "relation"})

    edges = []
    for (u, v, relation), entry in groups.items():
        timestamps = sorted(t for t in entry["timestamps"] if t)
        edges.append({
            "id": entry["id"], "source": u, "target": v, "relation": relation,
            "count": entry["count"],
            "total_amount": round(entry["total_amount"], 2) if entry["total_amount"] else None,
            "total_duration_seconds": round(entry["total_duration"]) if entry["total_duration"] else None,
            "first_seen": timestamps[0] if timestamps else None,
            "last_seen": timestamps[-1] if timestamps else None,
            "sample_records": entry["sample_records"],
            "label": relation.replace("_", " ").title() + (f" ({entry['count']}x)" if entry["count"] > 1 else ""),
            "strength": "strong" if entry["count"] >= 5 else "moderate" if entry["count"] >= 2 else "weak",
        })

    if simplify and edges:
        # collapse all relation-typed edges between the same pair into ONE representative
        # edge (the strongest relation), so dense curated/overview views stay a clean
        # 'backbone' instead of drawing every relation type between every pair.
        pair_groups: dict[frozenset, list[dict]] = {}
        for e in edges:
            pair_groups.setdefault(frozenset((e["source"], e["target"])), []).append(e)

        simplified = []
        for pair, group in pair_groups.items():
            group.sort(key=lambda e: e["count"], reverse=True)
            dominant = group[0]
            combined_count = sum(e["count"] for e in group)
            relations = sorted({e["relation"] for e in group})
            simplified.append({
                **dominant,
                "count": combined_count,
                "relations": relations,
                "label": (dominant["relation"].replace("_", " ").title() +
                          (f" + {len(relations) - 1} more" if len(relations) > 1 else "") +
                          f" ({combined_count}x)"),
                "strength": "strong" if combined_count >= 8 else "moderate" if combined_count >= 3 else "weak",
            })
        edges = simplified

    if max_edges and len(edges) > max_edges:
        edges = sorted(edges, key=lambda e: e["count"], reverse=True)[:max_edges]

    # drop nodes that lost all their edges purely to a relation-type/date/simplify/cap filter
    if relation_types or date_from or date_to or simplify or max_edges:
        connected = {e["source"] for e in edges} | {e["target"] for e in edges}
        nodes = [n for n in nodes if n["id"] in connected or n.get("type") == "CASE"]

    return nodes, edges


def _metadata(nodes, edges, selected_entity=None, filters_applied=None, extra=None):
    meta = {
        "node_count": len(nodes),
        "edge_count": len(edges),
        "selected_entity": selected_entity,
        "filters_applied": filters_applied or {},
        "calculation_timestamp": datetime.now(timezone.utc).isoformat(),
    }
    if extra:
        meta.update(extra)
    return meta


@router.get("/network/overview")
def network_overview(max_nodes: int = 18, store: DataStore = Depends(get_data_store)):
    """Level 0 view: a curated, analytically-relevant slice of the network (top
    connectors + their linked vehicles/orgs/cases) plus a community summary -- NOT the
    full 1000+ edge graph. This is what the dashboard and the default Network page show
    before the investigator drills in."""
    g = get_full_graph(store)
    ids = select_curated_overview_ids(store, max_nodes=max_nodes)
    subgraph = g.subgraph(ids)
    nodes, edges = _serialize_graph(subgraph, store, simplify=True, max_edges=max_nodes * 2)

    communities = compute_communities(store)
    persons = store.get("persons")
    name_map = dict(zip(persons["person_id"], persons["full_name"]))
    community_summary = [
        {
            "community_id": c["community_id"],
            "size": c["size"],
            "relationship_count": c["relationship_count"],
            "key_connectors": [{"person_id": m, "name": name_map.get(m, m)} for m in c["key_connectors"]],
            "activity_level": c["activity_level"],
        }
        for c in communities["communities"]
    ]

    metrics = compute_graph_metrics(store)

    return {
        "nodes": nodes,
        "edges": edges,
        "communities": community_summary,
        "metrics": metrics,
        "metadata": _metadata(nodes, edges, filters_applied={"view": "curated_overview", "max_nodes": max_nodes}),
    }


@router.get("/network/filtered")
def network_filtered(
    entity_id: str | None = None,
    entity_type: list[str] | None = Query(default=None),
    relationship_type: list[str] | None = Query(default=None),
    case_id: str | None = None,
    community_id: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    max_nodes: int = 60,
    min_degree: int = 0,
    depth: int = 1,
    analytical_filter: list[str] | None = Query(default=None),
    show_all: bool = False,
    simplify: bool = True,
    store: DataStore = Depends(get_data_store),
):
    """Unified, parametrized network query. Never returns the entire heterogeneous graph
    unless `show_all=true` is explicitly requested -- everything else is scoped by
    entity, case, community, or capped by max_nodes so the graph stays readable."""
    g = get_full_graph(store)
    filters_applied = {
        "entity_id": entity_id, "entity_type": entity_type, "relationship_type": relationship_type,
        "case_id": case_id, "community_id": community_id, "date_from": date_from, "date_to": date_to,
        "analytical_filter": analytical_filter, "depth": depth, "show_all": show_all,
    }
    filters_applied = {k: v for k, v in filters_applied.items() if v not in (None, [], False)}

    if show_all:
        working_graph = g
    elif entity_id:
        if entity_id not in g.nodes:
            raise HTTPException(status_code=404, detail="Entity not found")
        undirected = g.to_undirected()
        visited = {entity_id}
        frontier = {entity_id}
        for _ in range(max(1, min(depth, 3))):
            next_frontier = set()
            for node in frontier:
                next_frontier.update(undirected.neighbors(node))
            visited.update(next_frontier)
            frontier = next_frontier
        working_graph = g.subgraph(visited)
    elif case_id:
        if case_id not in g.nodes:
            raise HTTPException(status_code=404, detail="Case not found")
        undirected = g.to_undirected()
        visited = {case_id} | set(undirected.neighbors(case_id))
        working_graph = g.subgraph(visited)
    elif community_id is not None:
        communities = compute_communities(store)
        match = next((c for c in communities["communities"] if c["community_id"] == community_id), None)
        if not match:
            raise HTTPException(status_code=404, detail="Community not found")
        members = set(match["members"])
        undirected = g.to_undirected()
        linked_others = set()
        for m in members:
            if m in undirected:
                for nb in undirected.neighbors(m):
                    if g.nodes[nb].get("type") in ("VEHICLE", "ORGANIZATION", "CASE"):
                        linked_others.add(nb)
        working_graph = g.subgraph(members | linked_others)
    else:
        ids = select_curated_overview_ids(store, max_nodes=min(max_nodes, 25))
        working_graph = g.subgraph(ids)

    nodes, edges = _serialize_graph(
        working_graph, store,
        node_types=set(entity_type) if entity_type else None,
        relation_types=set(relationship_type) if relationship_type else None,
        min_connections=min_degree,
        date_from=date_from, date_to=date_to,
        analytical_filters=analytical_filter,
        simplify=simplify and not show_all,
        max_edges=max_nodes * 4 if not show_all else None,
    )

    # cap to max_nodes, preferring highest-degree nodes, always keeping the selected entity
    if len(nodes) > max_nodes:
        nodes.sort(key=lambda n: (n["id"] == entity_id, n["degree"]), reverse=True)
        kept_ids = {n["id"] for n in nodes[:max_nodes]}
        nodes = [n for n in nodes if n["id"] in kept_ids]
        edges = [e for e in edges if e["source"] in kept_ids and e["target"] in kept_ids]

    if entity_id:
        undirected_ids = set()
        for n in nodes:
            n["is_center"] = n["id"] == entity_id
        community_map = person_community_map(store)
        for n in nodes:
            if n["type"] == "PERSON":
                n["community_id"] = community_map.get(n["id"])

    communities = compute_communities(store)

    return {
        "nodes": nodes,
        "edges": edges,
        "metadata": _metadata(nodes, edges, selected_entity=entity_id, filters_applied=filters_applied,
                               extra={"communities": len(communities["communities"])}),
    }


@router.get("/network/entity/{entity_id}")
def network_entity_detail(entity_id: str, user: dict = Depends(get_current_user), store: DataStore = Depends(get_data_store)):
    """Powers the network details side-panel: works for any node type, with richer
    centrality/community/case data when the entity is a PERSON."""
    g = get_full_graph(store)
    if entity_id not in g.nodes:
        raise HTTPException(status_code=404, detail="Entity not found")

    data = g.nodes[entity_id]
    ntype = data.get("type")
    undirected = g.to_undirected()
    neighbors = list(undirected.neighbors(entity_id))

    relation_breakdown: dict[str, int] = {}
    for nb in neighbors:
        nb_type = g.nodes[nb].get("type", "UNKNOWN")
        relation_breakdown[nb_type] = relation_breakdown.get(nb_type, 0) + 1

    result = {
        "id": entity_id,
        "type": ntype,
        "label": data.get("label", entity_id),
        "direct_connections": len(neighbors),
        "relationship_breakdown": relation_breakdown,
        "attributes": {k: v for k, v in data.items() if k not in ("type", "label")},
    }

    if ntype == "PERSON":
        persons = store.get("persons")
        aliases = store.get("aliases")
        row = persons[persons["person_id"] == entity_id]
        centrality = explain_centrality(store, entity_id)
        tags = compute_analytical_tags(store).get(entity_id, [])
        result.update({
            "full_name": row.iloc[0]["full_name"] if not row.empty else data.get("label"),
            "aliases": aliases[aliases["person_id"] == entity_id]["alias"].tolist(),
            "degree_centrality": centrality.get("degree_centrality"),
            "betweenness_centrality": centrality.get("betweenness_centrality"),
            "pagerank": centrality.get("pagerank"),
            "closeness_centrality": centrality.get("closeness_centrality"),
            "community_id": centrality.get("community_id"),
            "connected_cases": centrality.get("connected_cases", []),
            "classification_label": centrality.get("classification_label"),
            "analytical_tags": tags,
            "analytical_tag_labels": [TAG_LABELS.get(t, t) for t in tags],
            "disclaimer": centrality.get("disclaimer"),
        })
    elif ntype == "CASE":
        cases = store.get("cases")
        row = cases[cases["case_id"] == entity_id]
        if not row.empty:
            result["case_details"] = row.iloc[0].to_dict()

    audit.record(user["username"], user["role"], "VIEWED_NETWORK_ENTITY", entity=entity_id)
    return result


# --- legacy endpoints kept for backward compatibility with existing pages ---

@router.get("/network")
def network(
    node_type: list[str] | None = Query(default=None),
    relation_type: list[str] | None = Query(default=None),
    min_connections: int = 0,
    case_id: str | None = None,
    store: DataStore = Depends(get_data_store),
):
    g = get_full_graph(store)
    nodes, edges = _serialize_graph(g, store, node_types=set(node_type) if node_type else None,
                                     relation_types=set(relation_type) if relation_type else None,
                                     min_connections=min_connections)
    if case_id:
        case_nodes = {case_id}
        for e in edges:
            if e["source"] == case_id:
                case_nodes.add(e["target"])
            if e["target"] == case_id:
                case_nodes.add(e["source"])
        nodes = [n for n in nodes if n["id"] in case_nodes]
        edges = [e for e in edges if e["source"] in case_nodes and e["target"] in case_nodes]
    return {"nodes": nodes, "edges": edges}


@router.get("/network/{person_id}")
def network_ego(
    person_id: str,
    depth: int = 1,
    node_type: list[str] | None = Query(default=None),
    relation_type: list[str] | None = Query(default=None),
    user: dict = Depends(get_current_user),
    store: DataStore = Depends(get_data_store),
):
    g = get_full_graph(store)
    if person_id not in g.nodes:
        raise HTTPException(status_code=404, detail="Entity not found")

    undirected = g.to_undirected()
    visited = {person_id}
    frontier = {person_id}
    for _ in range(max(1, min(depth, 3))):
        next_frontier = set()
        for node in frontier:
            next_frontier.update(undirected.neighbors(node))
        visited.update(next_frontier)
        frontier = next_frontier

    subgraph = g.subgraph(visited)
    nodes, edges = _serialize_graph(subgraph, store, node_types=set(node_type) if node_type else None,
                                     relation_types=set(relation_type) if relation_type else None)

    for n in nodes:
        n["is_center"] = n["id"] == person_id
        n["degree_from_center"] = 0 if n["id"] == person_id else (1 if n["id"] in undirected.neighbors(person_id) else 2)

    audit.record(user["username"], user["role"], "VIEWED_NETWORK", entity=person_id)
    return {"nodes": nodes, "edges": edges}


@router.get("/analytics/centrality")
def centrality(limit: int = 20, store: DataStore = Depends(get_data_store)):
    return {
        "top_connectors": top_connectors(store, limit=limit),
        "graph_stats": {
            "node_count": compute_centrality(store)["node_count"],
            "edge_count": compute_centrality(store)["edge_count"],
        },
        "graph_metrics": compute_graph_metrics(store),
    }


@router.get("/analytics/centrality/{person_id}")
def centrality_for_person(person_id: str, store: DataStore = Depends(get_data_store)):
    result = explain_centrality(store, person_id)
    if not result.get("found"):
        raise HTTPException(status_code=404, detail="Person not found in network")
    return result


@router.get("/analytics/communities")
def communities(store: DataStore = Depends(get_data_store)):
    result = compute_communities(store)
    persons = store.get("persons")
    name_map = dict(zip(persons["person_id"], persons["full_name"]))
    for c in result["communities"]:
        c["member_names"] = [name_map.get(m, m) for m in c["members"]]
        c["key_connector_names"] = [name_map.get(m, m) for m in c["key_connectors"]]
    return result


@router.get("/network/communities")
def network_communities(store: DataStore = Depends(get_data_store)):
    return communities(store)


@router.get("/network/centrality")
def network_centrality(limit: int = 20, metric: str = "betweenness", store: DataStore = Depends(get_data_store)):
    connectors = top_connectors(store, limit=limit)
    key = {"degree": "degree_centrality", "betweenness": "betweenness_centrality",
           "pagerank": "pagerank", "closeness": "closeness_centrality"}.get(metric, "betweenness_centrality")
    connectors.sort(key=lambda x: x.get(key, 0), reverse=True)
    return {"metric": metric, "top_connectors": connectors, "graph_metrics": compute_graph_metrics(store)}
