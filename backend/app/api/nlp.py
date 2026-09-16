from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.deps import get_data_store
from app.services.data_store import DataStore
from app.nlp.extract import extract_entities

router = APIRouter(prefix="/api/nlp", tags=["nlp"])


class ExtractRequest(BaseModel):
    text: str


@router.post("/extract")
def extract(payload: ExtractRequest, store: DataStore = Depends(get_data_store)):
    return extract_entities(payload.text, store)


@router.get("/sample-text")
def sample_text():
    return {
        "samples": [
            "Arun Kumar met Bala Raj near Harbour Road using Vehicle V004. Communication metadata suggests repeated contact between them on 2026-04-12.",
            "Field observations noted Charan Das and Lokesh Mani near North Railway Junction. Their possible association is unverified and requires further investigation.",
            "Source indicates Eshan Ravi transferred funds to Prakash Dev via SIM-1004 on 2026-06-02, possibly connected to Old Warehouse District.",
        ]
    }
