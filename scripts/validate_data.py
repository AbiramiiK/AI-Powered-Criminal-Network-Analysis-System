"""Standalone dataset validation CLI. Run: python scripts/validate_data.py
Prints a human-readable validation report; exits non-zero if any dataset is missing."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from app.services.data_store import DataStore
from app.services.validation import validate_all


def main():
    store = DataStore()
    store.load_all()
    result = validate_all(store.frames)

    print("=" * 70)
    print("DATASET VALIDATION REPORT")
    print("=" * 70)
    for name, report in result.datasets.items():
        status = "OK" if report.file_found and not report.missing_columns else "FAIL"
        print(f"[{status}] {name:20s} rows={report.row_count:5d} dup_ids={report.duplicate_ids} "
              f"invalid_dates={report.invalid_dates} synthetic_ok={report.synthetic_flag_ok}")
        for err in report.errors:
            print(f"        ! {err}")

    print("\n" + "=" * 70)
    print("RELATIONSHIP / FOREIGN-KEY CHECKS")
    print("=" * 70)
    for rel in result.relationships:
        status = "OK" if rel.invalid_refs == 0 else "WARN"
        print(f"[{status}] {rel.name:40s} valid={rel.valid_refs}/{rel.total_refs}")
        if rel.sample_invalid:
            print(f"        sample invalid ids: {rel.sample_invalid}")

    print("\n" + "=" * 70)
    print(f"OVERALL: {'PASS' if result.overall_ok else 'FAIL'}")
    print("=" * 70)

    sys.exit(0 if result.overall_ok else 1)


if __name__ == "__main__":
    main()
