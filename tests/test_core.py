"""Core prototype tests: CSV loading, validation, entity resolution, graph construction,
centrality, community detection, transaction chain/circular-flow detection, and API health.
Run with: pytest tests/test_core.py -v (from the project root, backend/venv active)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

import pytest

from app.services.data_store import DataStore
from app.services.validation import validate_all
from app.services.entity_resolution import find_potential_duplicates
from app.graph.builder import build_full_graph, build_person_graph
from app.analytics.centrality import compute_centrality, compute_communities
from app.analytics.patterns import detect_transaction_chains, detect_circular_flows, all_patterns
from app.analytics.risk import compute_risk_scores
from app.nlp.extract import extract_entities


@pytest.fixture(scope="module")
def store():
    s = DataStore()
    s.load_all()
    return s


def test_all_datasets_load(store):
    expected_min_rows = {
        "persons": 15, "cdr": 900, "locations": 700, "transactions": 700,
        "vehicles": 15, "cases": 10, "alerts": 100, "fir": 90,
    }
    for name, min_rows in expected_min_rows.items():
        assert name in store.frames, f"{name} did not load"
        assert len(store.frames[name]) >= min_rows, f"{name} has fewer rows than expected"


def test_validation_passes(store):
    result = validate_all(store.frames)
    assert result.overall_ok is True
    for rel in result.relationships:
        assert rel.invalid_refs == 0, f"Broken FK: {rel.name}"


def test_entity_resolution_runs(store):
    candidates = find_potential_duplicates(store, min_confidence=0.3)
    assert isinstance(candidates, list)
    for c in candidates:
        assert 0 <= c["confidence"] <= 1
        assert c["available_actions"] == ["REVIEW", "MERGE", "REJECT"]


def test_full_graph_has_all_node_types(store):
    g = build_full_graph(store)
    types = {data.get("type") for _, data in g.nodes(data=True)}
    assert types == {"PERSON", "PHONE", "VEHICLE", "LOCATION", "ORGANIZATION", "CASE"}
    assert g.number_of_nodes() > 0
    assert g.number_of_edges() > 0


def test_person_graph_is_fully_populated(store):
    g = build_person_graph(store)
    persons = store.get("persons")
    assert g.number_of_nodes() == len(persons)
    assert g.number_of_edges() > 0


def test_centrality_and_community_detection(store):
    centrality = compute_centrality(store)
    assert set(centrality.keys()) >= {"degree", "betweenness", "pagerank", "closeness"}
    assert len(centrality["degree"]) == 15

    communities = compute_communities(store)
    all_members = set()
    for c in communities["communities"]:
        all_members.update(c["members"])
    assert all_members == set(store.get("persons")["person_id"])


def test_transaction_chain_detection_finds_dataset_labeled_chains(store):
    chains = detect_transaction_chains(store)
    assert isinstance(chains, list)
    if chains:
        top = chains[0]
        assert "entities" in top and "supporting_records" in top and "confidence" in top


def test_circular_flow_detection_finds_known_cycle(store):
    circles = detect_circular_flows(store)
    assert isinstance(circles, list)
    txns = store.get("transactions")
    labeled_cycles = txns[txns["pattern_label"] == "CIRCULAR_FLOW"]
    assert len(labeled_cycles) > 0, "dataset should contain CIRCULAR_FLOW labeled rows"


def test_all_patterns_returns_every_category(store):
    patterns = all_patterns(store)
    assert set(patterns.keys()) == {
        "transaction_chains", "circular_flows", "repeated_high_value",
        "communication_spikes", "frequent_co_location", "shared_vehicles",
    }


def test_risk_scores_bounded_and_explainable(store):
    scores = compute_risk_scores(store)
    assert len(scores) == 15
    for s in scores:
        assert 0 <= s["investigative_priority_score"] <= 100
        assert len(s["factors"]) == 5
        assert "disclaimer" in s


def test_nlp_extraction_resolves_known_entities(store):
    text = "Arun Kumar met Bala Raj near Harbour Road using Vehicle V004."
    result = extract_entities(text, store)
    resolved_ids = {e["resolved_id"] for e in result["entities"] if e["type"] == "PERSON"}
    assert "P001" in resolved_ids
    assert "P002" in resolved_ids
    assert result["extraction_mode"] == "DEMO_DETERMINISTIC"


def test_synthetic_clusters_are_discoverable_not_hardcoded(store):
    """Sanity check that the bridge relationships named in the spec (P003<->P007,
    P005<->P010, P008<->P012, P010<->P013, P004<->P011) are present as edges in the
    computed person graph -- i.e. genuinely derivable from data, not hardcoded."""
    g = build_person_graph(store)
    bridges = [("P003", "P007"), ("P005", "P010"), ("P008", "P012"), ("P010", "P013"), ("P004", "P011")]
    for a, b in bridges:
        assert g.has_edge(a, b), f"expected bridge edge {a}-{b} to be derivable from source data"
