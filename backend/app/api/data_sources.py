from __future__ import annotations

import io

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form

from app.api.deps import get_data_store, get_current_user
from app.services.data_store import DataStore
from app.services.validation import validate_all, result_to_dict
from app.services import audit
from app.utils.config import DATASET_FILES, DATA_DIR

router = APIRouter(prefix="/api/data", tags=["data"])

SOURCE_LABELS = {
    "fir": "FIR / Police Reports",
    "cdr": "CDR Records",
    "transactions": "Financial Transactions",
    "locations": "Location Records",
    "vehicles": "Vehicle Records",
    "vehicle_associations": "Vehicle Associations",
    "intelligence": "Intelligence Reports",
    "organizations": "Organizations",
    "evidence": "Evidence",
    "events": "Investigation Events",
    "persons": "Persons",
    "aliases": "Entity Aliases",
    "person_org_links": "Person-Organization Links",
    "cases": "Cases",
    "alerts": "Alerts",
}


@router.get("/sources")
def list_sources(store: DataStore = Depends(get_data_store)):
    sources = []
    for name, status in store.load_status.items():
        sources.append({
            "id": name,
            "label": SOURCE_LABELS.get(name, name),
            "connected": status.get("connected", False),
            "record_count": status.get("record_count", 0),
            "last_processed": status.get("last_processed"),
            "source_file": status.get("source_file"),
            "source_type": "CSV",
            "error": status.get("error"),
        })
    return {"sources": sources, "last_loaded": store.last_loaded.isoformat() if store.last_loaded else None}


@router.get("/validate")
def validate(store: DataStore = Depends(get_data_store)):
    result = validate_all(store.frames)
    return result_to_dict(result)


@router.post("/upload")
async def upload_dataset(
    dataset: str = Form(...),
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
    store: DataStore = Depends(get_data_store),
):
    if dataset not in DATASET_FILES:
        raise HTTPException(status_code=400, detail=f"Unknown dataset '{dataset}'. Must be one of {list(DATASET_FILES.keys())}")

    content = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(content), dtype=str)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {exc}")

    preview = df.head(10).to_dict(orient="records")
    errors = []
    from app.utils.config import REQUIRED_COLUMNS
    required = REQUIRED_COLUMNS.get(dataset, [])
    missing = [c for c in required if c not in df.columns]
    if missing:
        errors.append(f"Missing required columns: {missing}")

    audit.record(user["username"], user["role"], "UPLOADED_DATA", entity=dataset)

    return {
        "dataset": dataset,
        "filename": file.filename,
        "row_count": len(df),
        "columns": list(df.columns),
        "preview": preview,
        "errors": errors,
        "valid": len(errors) == 0,
        "note": "Preview only in this demo -- to persist, save the file into the data/ directory and click 'Process All Sources'.",
    }


@router.post("/process")
def process_all(user: dict = Depends(get_current_user), store: DataStore = Depends(get_data_store)):
    store.reload()
    result = validate_all(store.frames)
    audit.record(user["username"], user["role"], "PROCESSED_DATA_SOURCES")
    return {
        "pipeline_stages": ["INGEST", "VALIDATE", "NORMALIZE", "RESOLVE_ENTITIES", "BUILD_GRAPH", "ANALYZE"],
        "status": "COMPLETE",
        "validation": result_to_dict(result),
        "sources": {name: status for name, status in store.load_status.items()},
    }
