from __future__ import annotations

import logging
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.services.data_store import get_store
from app.api import auth, dashboard, cases, entities, network, analytics, timeline, alerts, data_sources, reports, admin, nlp

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("criminal_network_analysis")

app = FastAPI(
    title="AI-Powered Criminal Network Analysis System (Prototype)",
    description="SIH26 prototype. Uses SYNTHETIC DEMONSTRATION DATA only. All findings are "
                "investigative leads requiring human review, never proof of criminal activity.",
    version="0.1.0",
)

# CORS_ORIGINS: comma-separated list of allowed frontend origins (e.g. the deployed
# Vercel URL). Defaults to "*" so local development and quick demos work with zero
# configuration. The app never relies on cookies for auth (Bearer token in a header),
# so allow_credentials stays False -- this keeps a wildcard origin spec-compliant.
_cors_origins_env = os.environ.get("CORS_ORIGINS", "*").strip()
_cors_origins = ["*"] if _cors_origins_env == "*" else [o.strip() for o in _cors_origins_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "An internal error occurred. Please try again or contact the system administrator."})


@app.on_event("startup")
def startup():
    store = get_store()
    logger.info("Data store initialized. Sources loaded: %s", list(store.frames.keys()))


@app.get("/api/health")
def health():
    store = get_store()
    connected = sum(1 for s in store.load_status.values() if s.get("connected"))
    return {
        "status": "ok",
        "demo_mode": True,
        "sources_connected": connected,
        "sources_total": len(store.load_status),
        "synthetic_data_notice": "This system uses SYNTHETIC DEMONSTRATION DATA only.",
    }


app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(cases.router)
app.include_router(entities.router)
app.include_router(network.router)
app.include_router(analytics.router)
app.include_router(timeline.router)
app.include_router(alerts.router)
app.include_router(data_sources.router)
app.include_router(reports.router)
app.include_router(admin.router)
app.include_router(nlp.router)
