"""Dataset validation pipeline: existence, schema, FK integrity, dates, duplicates."""
from __future__ import annotations

import pandas as pd
from dataclasses import dataclass, field
from typing import Any

from app.utils.config import DATA_DIR, DATASET_FILES, REQUIRED_COLUMNS


@dataclass
class DatasetReport:
    name: str
    file_found: bool
    row_count: int = 0
    missing_columns: list[str] = field(default_factory=list)
    duplicate_ids: int = 0
    invalid_dates: int = 0
    synthetic_flag_ok: bool = True
    errors: list[str] = field(default_factory=list)


@dataclass
class RelationshipCheck:
    name: str
    source: str
    target: str
    total_refs: int
    valid_refs: int
    invalid_refs: int
    sample_invalid: list[str] = field(default_factory=list)


@dataclass
class ValidationResult:
    datasets: dict[str, DatasetReport]
    relationships: list[RelationshipCheck]
    overall_ok: bool


ID_COLUMNS = {
    "persons": "person_id",
    "cdr": "call_id",
    "locations": "record_id",
    "transactions": "transaction_id",
    "vehicles": "vehicle_id",
    "vehicle_associations": "association_id",
    "intelligence": "intelligence_id",
    "aliases": "alias_id",
    "organizations": "organization_id",
    "person_org_links": "link_id",
    "evidence": "evidence_id",
    "events": "event_id",
    "cases": "case_id",
    "alerts": "alert_id",
    "fir": "fir_id",
}

DATE_COLUMNS = {
    "cdr": "timestamp",
    "locations": "timestamp",
    "transactions": "timestamp",
    "intelligence": "report_date",
    "evidence": "collection_date",
    "events": "event_timestamp",
    "cases": "opening_date",
    "alerts": "alert_timestamp",
    "fir": "report_date",
}


def validate_all(frames: dict[str, pd.DataFrame]) -> ValidationResult:
    dataset_reports: dict[str, DatasetReport] = {}

    for name, filename in DATASET_FILES.items():
        path = DATA_DIR / filename
        file_found = path.exists()
        report = DatasetReport(name=name, file_found=file_found)
        if not file_found:
            report.errors.append(f"Missing dataset file: {filename}")
            dataset_reports[name] = report
            continue

        df = frames.get(name)
        if df is None:
            report.errors.append("Failed to load into memory")
            dataset_reports[name] = report
            continue

        report.row_count = len(df)

        required = REQUIRED_COLUMNS.get(name, [])
        report.missing_columns = [c for c in required if c not in df.columns]
        if report.missing_columns:
            report.errors.append(f"Missing columns: {report.missing_columns}")

        id_col = ID_COLUMNS.get(name)
        if id_col and id_col in df.columns:
            dup = int(df[id_col].duplicated().sum())
            report.duplicate_ids = dup
            if dup:
                report.errors.append(f"{dup} duplicate {id_col} values")

        date_col = DATE_COLUMNS.get(name)
        if date_col and date_col in df.columns:
            parsed = pd.to_datetime(df[date_col], errors="coerce")
            invalid = int(parsed.isna().sum() - df[date_col].isna().sum())
            report.invalid_dates = max(invalid, 0)
            if report.invalid_dates:
                report.errors.append(f"{report.invalid_dates} unparseable dates in {date_col}")

        if "synthetic_data" in df.columns:
            ok = bool((df["synthetic_data"].astype(str).str.upper() == "TRUE").all())
            report.synthetic_flag_ok = ok
            if not ok:
                report.errors.append("Not all rows flagged synthetic_data=True")

        dataset_reports[name] = report

    relationships: list[RelationshipCheck] = []
    persons = frames.get("persons")
    valid_person_ids = set(persons["person_id"]) if persons is not None else set()

    def check_fk(check_name: str, df: pd.DataFrame | None, col: str, valid_ids: set,
                 source: str, target: str, allow_empty: bool = True):
        if df is None or col not in df.columns:
            return
        vals = df[col].dropna()
        if allow_empty:
            vals = vals[vals.astype(str).str.strip() != ""]
        total = len(vals)
        if total == 0:
            relationships.append(RelationshipCheck(check_name, source, target, 0, 0, 0))
            return
        valid_mask = vals.astype(str).isin(valid_ids)
        valid_count = int(valid_mask.sum())
        invalid_count = total - valid_count
        sample_invalid = vals[~valid_mask].astype(str).unique().tolist()[:5]
        relationships.append(RelationshipCheck(check_name, source, target, total, valid_count, invalid_count, sample_invalid))

    check_fk("persons -> CDR (caller)", frames.get("cdr"), "caller_id", valid_person_ids, "Person", "CDR")
    check_fk("persons -> CDR (receiver)", frames.get("cdr"), "receiver_id", valid_person_ids, "Person", "CDR")
    check_fk("persons -> transactions (sender)", frames.get("transactions"), "sender_id", valid_person_ids, "Person", "Transaction")
    check_fk("persons -> transactions (receiver)", frames.get("transactions"), "receiver_id", valid_person_ids, "Person", "Transaction")
    check_fk("persons -> locations", frames.get("locations"), "person_id", valid_person_ids, "Person", "Location")
    check_fk("persons -> vehicles (primary owner)", frames.get("vehicles"), "primary_owner_id", valid_person_ids, "Person", "Vehicle")
    check_fk("persons -> vehicle_associations", frames.get("vehicle_associations"), "person_id", valid_person_ids, "Person", "Vehicle")
    check_fk("persons -> intelligence (subject)", frames.get("intelligence"), "subject_person_id", valid_person_ids, "Person", "Intelligence")
    check_fk("persons -> person_org_links", frames.get("person_org_links"), "person_id", valid_person_ids, "Person", "Organization")
    check_fk("persons -> evidence (primary)", frames.get("evidence"), "person_id", valid_person_ids, "Person", "Evidence")
    check_fk("FIR -> evidence", frames.get("evidence"), "related_fir_id", set(frames["fir"]["fir_id"]) if frames.get("fir") is not None else set(), "FIR", "Evidence")

    cases = frames.get("cases")
    valid_case_ids = set(cases["case_id"]) if cases is not None else set()
    check_fk("cases -> events", frames.get("events"), "case_id", valid_case_ids, "Case", "InvestigationEvent")
    check_fk("cases -> alerts", frames.get("alerts"), "case_id", valid_case_ids, "Case", "Alert")

    overall_ok = all(r.file_found and not r.missing_columns for r in dataset_reports.values())
    return ValidationResult(datasets=dataset_reports, relationships=relationships, overall_ok=overall_ok)


def result_to_dict(result: ValidationResult) -> dict[str, Any]:
    return {
        "overall_ok": result.overall_ok,
        "datasets": {
            name: {
                "file_found": r.file_found,
                "row_count": r.row_count,
                "missing_columns": r.missing_columns,
                "duplicate_ids": r.duplicate_ids,
                "invalid_dates": r.invalid_dates,
                "synthetic_flag_ok": r.synthetic_flag_ok,
                "errors": r.errors,
            }
            for name, r in result.datasets.items()
        },
        "relationships": [
            {
                "name": rel.name,
                "source": rel.source,
                "target": rel.target,
                "total_refs": rel.total_refs,
                "valid_refs": rel.valid_refs,
                "invalid_refs": rel.invalid_refs,
                "sample_invalid": rel.sample_invalid,
            }
            for rel in result.relationships
        ],
    }
