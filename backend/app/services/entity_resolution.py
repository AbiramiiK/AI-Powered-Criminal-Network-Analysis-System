"""Entity resolution: detects possible duplicate/alias identities across DIFFERENT
person records using fuzzy string matching, shared identifiers, organization and
location overlap. High-impact merges are NEVER performed automatically -- every
suggestion requires human review (Review / Merge / Reject)."""
from __future__ import annotations

from difflib import SequenceMatcher
from itertools import combinations

from app.services.data_store import DataStore


def _similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a.lower().strip(), b.lower().strip()).ratio()


def _alias_set(person_id: str, persons_df, aliases_df) -> set[str]:
    names = set()
    row = persons_df[persons_df["person_id"] == person_id]
    if not row.empty:
        r = row.iloc[0]
        for col in ("full_name", "primary_alias", "alternate_alias"):
            val = r.get(col)
            if isinstance(val, str) and val.strip():
                names.add(val.strip())
    person_aliases = aliases_df[aliases_df["person_id"] == person_id]
    for _, r in person_aliases.iterrows():
        if isinstance(r.get("alias"), str) and r["alias"].strip():
            names.add(r["alias"].strip())
    return names


def find_potential_duplicates(store: DataStore, min_confidence: float = 0.30, limit: int = 50) -> list[dict]:
    persons = store.get("persons")
    aliases = store.get("aliases")
    events = store.get("events")
    cdr = store.get("cdr")

    person_ids = persons["person_id"].tolist()
    results = []

    for pid_a, pid_b in combinations(person_ids, 2):
        row_a = persons[persons["person_id"] == pid_a].iloc[0]
        row_b = persons[persons["person_id"] == pid_b].iloc[0]

        names_a = _alias_set(pid_a, persons, aliases)
        names_b = _alias_set(pid_b, persons, aliases)

        best_name_sim = 0.0
        best_pair = (None, None)
        for na in names_a:
            for nb in names_b:
                sim = _similarity(na, nb)
                if sim > best_name_sim:
                    best_name_sim = sim
                    best_pair = (na, nb)

        reasons = []
        signals = []

        if best_name_sim >= 0.55:
            reasons.append(f"Alias/name similarity: '{best_pair[0]}' vs '{best_pair[1]}' ({round(best_name_sim*100)}% similar)")
            signals.append(best_name_sim)

        phones_a = {row_a.get("phone_id_primary"), row_a.get("phone_id_secondary")} - {None, ""}
        phones_b = {row_b.get("phone_id_primary"), row_b.get("phone_id_secondary")} - {None, ""}
        shared_phones = phones_a & phones_b
        if shared_phones:
            reasons.append(f"Shared phone identifier: {', '.join(shared_phones)}")
            signals.append(0.95)

        if row_a.get("organization") and row_a.get("organization") == row_b.get("organization") and row_a.get("organization") != "Independent":
            reasons.append(f"Shared organization: {row_a.get('organization')}")
            signals.append(0.35)

        if row_a.get("address_zone") == row_b.get("address_zone"):
            reasons.append(f"Shared address zone: {row_a.get('address_zone')}")
            signals.append(0.25)

        interaction_count = 0
        if not events.empty:
            interaction_count += int((((events["person_id"] == pid_a) & (events["related_person_id"] == pid_b)) |
                                       ((events["person_id"] == pid_b) & (events["related_person_id"] == pid_a))).sum())
        if not cdr.empty:
            interaction_count += int((((cdr["caller_id"] == pid_a) & (cdr["receiver_id"] == pid_b)) |
                                       ((cdr["caller_id"] == pid_b) & (cdr["receiver_id"] == pid_a))).sum())
        if interaction_count >= 5:
            reasons.append(f"Repeated relationship: {interaction_count} recorded interactions (calls/events) between records")
            signals.append(min(0.3, interaction_count / 100))

        if not signals:
            continue

        confidence = round(min(0.99, sum(signals) / max(1, len(signals)) * (1 + 0.05 * (len(signals) - 1))), 2)
        if confidence < min_confidence:
            continue

        results.append({
            "person_a": {"person_id": pid_a, "name": row_a["full_name"]},
            "person_b": {"person_id": pid_b, "name": row_b["full_name"]},
            "confidence": confidence,
            "reasons": reasons,
            "recommended_action": "REVIEW",
            "available_actions": ["REVIEW", "MERGE", "REJECT"],
        })

    results.sort(key=lambda r: r["confidence"], reverse=True)
    return results[:limit]
