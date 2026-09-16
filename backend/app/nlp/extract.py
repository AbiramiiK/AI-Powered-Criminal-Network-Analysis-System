"""Deterministic demo-mode NLP: entity extraction + alias resolution + relationship
extraction over investigator-pasted FIR/intelligence text. Works fully offline using the
known-entity dictionaries built from the loaded datasets, so the prototype never depends
on an external LLM API key. The architecture leaves room for a pluggable LLM provider
later (see extract_entities(..., llm_provider=None))."""
from __future__ import annotations

import re

from app.services.data_store import DataStore

RELATIONSHIP_VERBS = [
    (re.compile(r"\bmet\b|\bmeeting\b|\bmeet\b", re.I), "associated_with"),
    (re.compile(r"\bcall(ed)?\b|\bcontact(ed)?\b", re.I), "communicated_with"),
    (re.compile(r"\btransfer(red)?\b|\bpaid\b|\bpayment\b", re.I), "transacted_with"),
    (re.compile(r"\bnear\b|\bat\b|\blocat(ed|ion)\b", re.I), "observed_at"),
    (re.compile(r"\busing\b|\bvehicle\b|\bdrove\b|\bdriving\b", re.I), "used_vehicle"),
]

DATE_RE = re.compile(r"\b(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b")
PHONE_RE = re.compile(r"\bSIM-\d{3,5}\b|\b\+?\d{10,13}\b")
VEHICLE_RE = re.compile(r"\bV\d{3}\b|\b[A-Z]{2}-SYN-\d{3,4}\b", re.I)


def _build_entity_dictionary(store: DataStore) -> dict:
    persons = store.get("persons")
    aliases = store.get("aliases")
    locations = store.get("locations")
    organizations = store.get("organizations")
    vehicles = store.get("vehicles")

    person_lookup: dict[str, str] = {}
    for _, row in persons.iterrows():
        for col in ("full_name", "primary_alias", "alternate_alias"):
            val = row.get(col)
            if isinstance(val, str) and val.strip():
                person_lookup[val.strip().lower()] = row["person_id"]
    for _, row in aliases.iterrows():
        val = row.get("alias")
        if isinstance(val, str) and val.strip():
            person_lookup[val.strip().lower()] = row["person_id"]

    location_lookup: dict[str, str] = {}
    for _, row in locations.iterrows():
        name = row.get("location_name")
        if isinstance(name, str) and name.strip():
            location_lookup[name.strip().lower()] = row["location_id"]

    org_lookup: dict[str, str] = {}
    for _, row in organizations.iterrows():
        name = row.get("organization_name")
        if isinstance(name, str):
            org_lookup[name.strip().lower()] = row["organization_id"]

    vehicle_ids = set(vehicles["vehicle_id"].tolist())

    return {
        "persons": person_lookup,
        "locations": location_lookup,
        "organizations": org_lookup,
        "vehicle_ids": vehicle_ids,
    }


def extract_entities(text: str, store: DataStore, llm_provider=None) -> dict:
    """Extracts PERSON / LOCATION / PHONE / VEHICLE / ORGANIZATION / EVENT / DATE entities
    and simple relationships from free text. If an llm_provider callable is supplied it is
    used instead (future extension point); otherwise deterministic demo-mode matching runs
    so the app works with zero external dependencies."""
    if llm_provider is not None:
        try:
            return llm_provider(text)
        except Exception:  # noqa: BLE001 -- always fall back to demo mode
            pass

    dictionary = _build_entity_dictionary(store)
    lowered = text.lower()

    found_persons = []
    for name, pid in dictionary["persons"].items():
        pattern = r"\b" + re.escape(name) + r"\b"
        if re.search(pattern, lowered):
            found_persons.append({"type": "PERSON", "value": name, "resolved_id": pid, "confidence": 0.92})

    seen_pids = set()
    dedup_persons = []
    for p in sorted(found_persons, key=lambda x: -len(x["value"])):
        if p["resolved_id"] in seen_pids:
            continue
        seen_pids.add(p["resolved_id"])
        dedup_persons.append(p)

    found_locations = []
    for name, lid in dictionary["locations"].items():
        pattern = r"\b" + re.escape(name) + r"\b"
        if re.search(pattern, lowered):
            found_locations.append({"type": "LOCATION", "value": name, "resolved_id": lid, "confidence": 0.85})
    seen_lids = set()
    dedup_locations = []
    for l in found_locations:
        if l["resolved_id"] in seen_lids:
            continue
        seen_lids.add(l["resolved_id"])
        dedup_locations.append(l)

    found_orgs = []
    for name, oid in dictionary["organizations"].items():
        if name and re.search(r"\b" + re.escape(name) + r"\b", lowered):
            found_orgs.append({"type": "ORGANIZATION", "value": name, "resolved_id": oid, "confidence": 0.8})

    found_vehicles = [{"type": "VEHICLE", "value": m.group(0), "resolved_id": m.group(0).upper(), "confidence": 0.9}
                       for m in VEHICLE_RE.finditer(text)]
    found_vehicles = [v for v in found_vehicles if v["resolved_id"] in dictionary["vehicle_ids"]] or found_vehicles

    found_phones = [{"type": "PHONE", "value": m.group(0), "resolved_id": m.group(0), "confidence": 0.7}
                     for m in PHONE_RE.finditer(text)]

    found_dates = [{"type": "DATE", "value": m.group(0), "resolved_id": None, "confidence": 0.75}
                    for m in DATE_RE.finditer(text)]

    events = []
    for pattern, relation in RELATIONSHIP_VERBS:
        if pattern.search(text):
            events.append({"type": "EVENT", "value": relation.replace("_", " "), "relation": relation})

    relationships = []
    person_ids_in_order = [p["resolved_id"] for p in dedup_persons]
    if len(person_ids_in_order) >= 2 and events:
        relation = events[0]["relation"]
        for i in range(len(person_ids_in_order) - 1):
            relationships.append({
                "source": person_ids_in_order[i],
                "target": person_ids_in_order[i + 1],
                "relation": relation,
                "confidence": 0.7,
            })
    elif len(person_ids_in_order) >= 2:
        for i in range(len(person_ids_in_order) - 1):
            relationships.append({
                "source": person_ids_in_order[i],
                "target": person_ids_in_order[i + 1],
                "relation": "associated_with",
                "confidence": 0.55,
            })

    all_entities = dedup_persons + dedup_locations + found_orgs + found_vehicles + found_phones + found_dates
    overall_confidence = round(sum(e["confidence"] for e in all_entities) / len(all_entities), 2) if all_entities else 0.0

    return {
        "input_text": text,
        "entities": all_entities,
        "events_detected": events,
        "relationships": relationships,
        "overall_confidence": overall_confidence,
        "extraction_mode": "DEMO_DETERMINISTIC" if llm_provider is None else "LLM",
        "disclaimer": "Extracted entities and relationships are unverified leads requiring analyst confirmation.",
    }
