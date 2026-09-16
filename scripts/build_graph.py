"""Standalone graph-build CLI. Run: python scripts/build_graph.py
Builds the full heterogeneous graph and the person-projection graph, prints stats."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from app.services.data_store import DataStore
from app.graph.builder import build_full_graph, build_person_graph
from app.analytics.centrality import compute_centrality, compute_communities


def main():
    store = DataStore()
    store.load_all()

    full_graph = build_full_graph(store)
    print(f"Full heterogeneous graph: {full_graph.number_of_nodes()} nodes, {full_graph.number_of_edges()} edges")

    node_type_counts = {}
    for _, data in full_graph.nodes(data=True):
        t = data.get("type", "UNKNOWN")
        node_type_counts[t] = node_type_counts.get(t, 0) + 1
    print("Node types:", node_type_counts)

    person_graph = build_person_graph(store)
    print(f"\nPerson projection graph: {person_graph.number_of_nodes()} nodes, {person_graph.number_of_edges()} edges")

    store.frames = store.frames  # already loaded
    store.graph = full_graph
    store.analytics_cache["person_graph"] = person_graph

    centrality = compute_centrality(store)
    top_degree = sorted(centrality["degree"].items(), key=lambda x: x[1], reverse=True)[:5]
    top_betweenness = sorted(centrality["betweenness"].items(), key=lambda x: x[1], reverse=True)[:5]
    print("\nTop 5 by degree centrality:", top_degree)
    print("Top 5 by betweenness centrality:", top_betweenness)

    communities = compute_communities(store)
    print(f"\nCommunities detected: {len(communities['communities'])} (modularity={communities['modularity']})")
    for c in communities["communities"]:
        print(f"  Community {c['community_id']}: {c['members']}")


if __name__ == "__main__":
    main()
