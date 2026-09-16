from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.deps import get_data_store, get_current_user
from app.services.data_store import DataStore
from app.services.reports import generate_report
from app.services import audit

router = APIRouter(prefix="/api/reports", tags=["reports"])


class ReportRequest(BaseModel):
    case_id: str | None = None
    person_id: str | None = None
    start_date: str | None = None
    end_date: str | None = None


@router.post("/generate")
def generate(payload: ReportRequest, user: dict = Depends(get_current_user), store: DataStore = Depends(get_data_store)):
    report = generate_report(store, case_id=payload.case_id, person_id=payload.person_id,
                              start_date=payload.start_date, end_date=payload.end_date)
    audit.record(user["username"], user["role"], "EXPORTED_REPORT",
                 case_id=payload.case_id, entity=payload.person_id)
    return report
