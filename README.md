# AI-Powered Criminal Network Analysis System — SIH 2026 Prototype

Repository: https://github.com/AbiramiiK/AI-Powered-Criminal-Network-Analysis-System

> **⚠️ SYNTHETIC DEMONSTRATION DATA ONLY.** Every person, case, transaction, alert and
> intelligence report in this repository is fictional, generated for prototype
> demonstration. This is **not** a real criminal database and does **not** contain real
> police intelligence. All analytical output is framed as an *investigative lead*, never
> a conclusion of guilt — see [Ethical Design](#ethical--security-design) below.

## 1. Project Overview

A full-stack investigator dashboard that ingests fragmented, multi-source investigation
data (FIRs, CDR/call records, financial transactions, location observations, vehicles,
intelligence reports, evidence, organizations, cases and alerts), resolves entities,
builds a multi-relational graph, runs real graph analytics (NetworkX), detects
investigative patterns, computes an explainable "Investigative Priority Score", and
presents everything through a professional investigator-facing web UI.

Every number on screen — KPIs, centrality scores, detected patterns, risk scores — is
computed live from the CSVs in `data/`. Nothing is hardcoded.

## 2. Architecture

```
sih26/
├── data/                  # 15 synthetic CSV datasets (source of truth)
├── backend/                # FastAPI + Pandas + NetworkX
│   └── app/
│       ├── main.py         # app wiring, CORS, global error handler
│       ├── api/             # one router per feature area
│       ├── services/        # data_store, validation, auth, audit, entity_resolution, reports
│       ├── analytics/       # centrality, communities, pattern detection, risk scoring
│       ├── graph/           # NetworkX graph construction (full + person-projection)
│       └── nlp/             # deterministic demo-mode entity/relationship extraction
├── frontend/                # React 19 + TypeScript + Vite + Tailwind v4
│   └── src/
│       ├── pages/            # one file per route
│       ├── layouts/          # sidebar + top bar shell
│       ├── graph/            # Cytoscape.js network visualization component
│       ├── components/       # shared UI (Badge, KPICard, Section, GlobalSearch, ...)
│       ├── services/api.ts   # typed Axios client for every backend endpoint
│       └── hooks/useAuth.tsx # session/RBAC context
├── scripts/                 # validate_data.py, ingest_data.py, build_graph.py (CLIs)
├── tests/                   # pytest suite (12 tests, all passing)
└── README.md
```

**Why this stack:** FastAPI + Pandas + NetworkX keeps the whole analytics pipeline in
one process with zero external services (no Neo4j, no cloud DB) — the entire backend
loads 15 CSVs into memory at startup, builds the graph once, and serves everything from
cached DataFrames. This is intentionally simple for a prototype: reliable, fast to
demo, and easy to extend with a real database later without changing the API surface.

## 3. Data Flow

```
CSV files (data/)
   → DataStore.load_all()            in-memory pandas DataFrames, cached
   → validate_all()                  schema / FK / duplicate / date checks
   → build_full_graph()              heterogeneous NetworkX MultiDiGraph
                                      (PERSON / PHONE / VEHICLE / LOCATION / ORGANIZATION / CASE)
   → build_person_graph()            weighted undirected projection for analytics
   → centrality / communities        degree, betweenness, PageRank, closeness, greedy-modularity
   → pattern detectors               transaction chains, circular flows, repeated high-value,
                                      communication spikes, co-location, shared vehicles
   → risk.py                         explainable Investigative Priority Score
   → FastAPI routers                 JSON over REST
   → React pages                     tables, charts (Recharts), graph (Cytoscape.js)
```

The graph and analytics results are cached on the `DataStore` singleton and only
recomputed when `/api/data/process` (Process All Sources) is called.

## 4. Dataset Summary

15 CSVs in `data/`, ~3,570 total records, 100% referential integrity (verified by
`scripts/validate_data.py`):

| Dataset | Rows | Key columns |
|---|---|---|
| persons.csv | 15 | person_id (P001–P015), full_name, aliases, phone IDs |
| cdr_records.csv | 1000 | caller_id, receiver_id, timestamp, duration |
| location_records.csv | 800 | person_id, location_id, lat/lon, timestamp |
| transactions.csv | 720 | sender_id, receiver_id, amount, pattern_label |
| vehicles.csv / vehicle_associations.csv | 20 / 35 | vehicle_id, owner, associations |
| intelligence_reports.csv | 160 | subject/related persons, category, reliability |
| entity_aliases.csv | 68 | alias variants per person |
| organizations.csv / person_organization_links.csv | 10 / 35 | org membership |
| evidence_records.csv | 220 | multi-entity evidence links |
| investigation_events.csv | 260 | per-case event log |
| cases.csv | 10 | case metadata, POIs |
| alerts.csv | 120 | pre-flagged analytical alerts |
| synthetic_fir_reports.csv | 100 | FIR narratives, co-mentioned persons |

## 5. Installation

**Prerequisites:** Python 3.11+, Node.js 20+.

### Clone

```bash
git clone https://github.com/AbiramiiK/AI-Powered-Criminal-Network-Analysis-System.git
cd AI-Powered-Criminal-Network-Analysis-System
```

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
```

### Frontend

```bash
cd frontend
npm install
```

## 6. Running the Prototype

**Terminal 1 — backend (http://127.0.0.1:8000):**
```bash
cd backend
venv\Scripts\python.exe -m uvicorn app.main:app --port 8000
```

**Terminal 2 — frontend (http://localhost:5173):**
```bash
cd frontend
npm run dev
```

The Vite dev server proxies `/api/*` to the backend (see `frontend/vite.config.ts`), so
no CORS configuration is needed in development. Open http://localhost:5173.

## 7. Demo Login

| Role | Username | Password | Lands on |
|---|---|---|---|
| Investigator | `investigator` | `investigator123` | Dashboard |
| Analyst | `analyst` | `analyst123` | Pattern Analysis |
| Admin | `admin` | `admin123` | Admin |

Authentication is a demo in-memory token store (`backend/app/services/auth.py`) — good
enough to demonstrate RBAC, not intended for production use.

## 8. Main Features Implemented

- **Dashboard** — 8 real-time KPIs, click-to-filter case-status/category/region charts, a
  multi-series toggleable activity timeline, a day×hour activity heatmap, an alert trend
  chart, a curated network overview with live metrics, a priority-leads panel and a
  cross-source evidence distribution chart — all computed live, all drilling down into
  the relevant page (e.g. clicking a case-status segment filters `/cases`)
- **Cases** — search/filter grid (filters shareable via URL for dashboard drill-down),
  case detail with 11 tabs (overview, POIs, network, timeline, alerts, evidence,
  intelligence, transactions, locations, vehicles, patterns)
- **Network Analysis** — progressive-disclosure graph (curated overview → community →
  entity ego-network → 2nd-degree expansion → explicit "Show All Relationships"),
  entity/relationship/analytical/date filters, live search, a real entity details panel
  (centrality, community, connected cases, relationship breakdown), and
  Network/Communities/Centrality/Relationships/Timeline tabs
- **Entity Explorer** — search persons, vehicles, locations, organizations
- **Person Profile** — 10 tabs covering every data source connected to a person
- **Entity Resolution** — fuzzy alias matching + shared identifiers + org/zone overlap + interaction frequency, human-in-the-loop Review/Merge/Reject
- **Data Sources** — per-source connection status, record counts, CSV upload preview, "Process All Sources" pipeline, full validation report
- **Timeline** — unified chronological feed across 7 source types with filters and a monthly volume chart
- **Pattern Analysis** — 6 categories of graph/statistically-detected patterns (see below)
- **AI / NLP Analysis** — deterministic entity + relationship extraction from pasted text
- **Risk & Influence** — explainable Investigative Priority Score with itemized factors
- **Alerts** — filterable alert queue with status workflow (NEW → UNDER_REVIEW → CONFIRMED_PATTERN / DISMISSED)
- **Reports** — 13-section structured investigation report generator, JSON export + print
- **Audit Logs** — every view/merge/export/login is recorded and displayed live
- **Admin** — user list, system status, data source health, model configuration

## 9. AI/ML & Graph Analytics Techniques Implemented

**Entity resolution:** `difflib.SequenceMatcher` fuzzy string matching over names and
aliases, combined with shared-phone-ID, organization-overlap, address-zone-overlap and
interaction-frequency signals into a weighted confidence score.

**Graph construction:** NetworkX `MultiDiGraph` over 6 node types and 8 relation types,
built directly from the 15 CSVs (see `backend/app/graph/builder.py`). A second
weighted-undirected **person-projection graph** aggregates CDR, transactions,
intelligence, FIR co-mentions, shared vehicles, alerts and same-day co-location into
edge weights for analytics.

**Centrality & community detection:** exact degree / betweenness / PageRank / closeness
centrality (`networkx`), greedy-modularity community detection. Verified against a
public-dataset benchmark (Enron email network, 36.7K nodes) to confirm the approach
scales — see `data/enron_graph_benchmark_report.txt` and
`graph_scale_benchmark_comparison.csv`.

**Pattern detection** (`backend/app/analytics/patterns.py`) — each pattern is
independently *computed* from the raw transaction/CDR/location graphs, not just
re-displayed from the dataset's pre-existing `pattern_label` column (though agreement
with that label is reported as a cross-check):
- Transaction chains — directed-graph path search with a 72h time window
- Circular flows — `nx.simple_cycles` on the transaction digraph
- Repeated high-value transfers — per-pair aggregation above the 75th percentile
- Communication spikes — per-pair daily call counts vs. mean+2σ
- Frequent co-location — same-location/same-day person-pair aggregation
- Shared-vehicle links — vehicle_associations + primary ownership aggregation

**Investigative Priority Score** (`backend/app/analytics/risk.py`) — a transparent 0–100
score built from 5 itemized, inspectable factors (communication centrality, transaction
anomaly, cross-case connections, multi-source connections, location/vehicle anomaly).
Deliberately **not** called a "criminal probability" — see Ethical Design.

**NLP:** deterministic dictionary-matching extraction (`backend/app/nlp/extract.py`)
against every known person/alias/location/organization/vehicle in the dataset, plus
regex for dates/phones/vehicle IDs and simple verb-pattern relationship extraction. No
external LLM call is made; the function signature accepts an optional `llm_provider`
callable so a real LLM can be plugged in later without touching the API contract.

## 10. Known Limitations

- **Dense synthetic graph:** the 15-person dataset was generated so every person
  interacts with almost every other person at least once (see
  `dataset_relationship_summary.csv`). As a result, raw **degree centrality is 1.0 for
  nearly everyone** — it stops being a useful differentiator on its own. The
  `top_connectors` ranking and the Investigative Priority Score therefore lean on
  betweenness/PageRank and pattern-hit counts, which do differentiate. On a real,
  larger CDR network this saturation would not occur (see the Enron benchmark in
  `data/` for how the same algorithms behave on a 36K-node real graph).
- **Investigative Priority Score saturation:** because of the above density, several
  persons legitimately hit 100/100. The scoring weights are tunable in
  `backend/app/analytics/risk.py` if a less-saturated distribution is preferred for a
  specific demo.
- **Entity resolution finds no *exact* duplicates** by design — the 15 canonical
  persons in this dataset are already cleanly resolved (their alias variants are
  correctly attributed under one `person_id` each in `entity_aliases.csv`). The
  Entity Resolution page therefore surfaces its *best fuzzy candidates* (max ~67%
  confidence) rather than a slam-dunk duplicate — which is the honest, correct
  behavior for clean data, not a bug.
- **Location map** uses a coordinate scatter plot (Recharts) rather than a tile-based
  map (no mapping library/API key dependency was introduced); coordinates are
  synthetic and explicitly labeled as such.
- **Auth is demo-only** — in-memory token store, not JWT/OAuth, not for production.
- **No persistent database** — data lives in memory (reloaded from CSV at startup or on
  "Process All Sources"); a CSV upload validates and previews but does not write back to
  disk in this prototype.
- Frontend production bundle is a single ~380KB gzipped chunk (Cytoscape + Recharts +
  React); code-splitting was left out to keep the build simple for a prototype.

## 11. SIH Demo Flow

1. **Login** as `investigator` → lands on **Dashboard** (KPIs, recent alerts, mini network, charts)
2. **Cases** → open *Cross-Regional Financial Flow Review* (CASE-001) → **Network** tab shows the case's POI graph
3. **Network Analysis** (sidebar) → click a highly-connected node (e.g. Charan Das / P003) → side panel shows role + connection count → **Open Full Profile**
4. **Person Profile** → walk through Communications / Transactions / Locations / Vehicles / Intelligence / Evidence tabs
5. **Timeline** → filter by that person to see their chronological footprint across all 7 sources
6. **Pattern Analysis** → show a detected Circular Transaction Flow or Transaction Chain with its supporting record IDs
7. **Risk & Influence** → show the person's Investigative Priority Score with itemized factors
8. **Alerts** → filter to CRITICAL severity, open one, mark it UNDER_REVIEW
9. **Entity Resolution** → show a fuzzy-match candidate and record a Review/Merge decision
10. **Reports** → generate a full investigation report for CASE-001, export as JSON
11. **Audit Logs** → show that every action just taken was recorded

## 12. Testing

```bash
# Data validation (also runnable standalone)
python scripts/validate_data.py

# Graph construction sanity check
python scripts/build_graph.py

# Full pytest suite (12 tests: data loading, validation, entity resolution,
# graph construction, centrality/communities, pattern detection, risk scoring,
# NLP extraction, and a check that the spec's named bridge relationships are
# genuinely *derivable* from the data rather than hardcoded)
cd backend && venv\Scripts\python.exe -m pytest ../tests/test_core.py -v
```

All 12 tests pass; dataset validation reports 100% referential integrity across 13
foreign-key relationships.

## 13. API Reference

All endpoints are under `/api`. Selected highlights (see `backend/app/api/*.py` for the
full set — dashboard, cases, entities, network, analytics, timeline, alerts, data,
reports, admin, nlp, auth):

```
GET  /api/health
GET  /api/dashboard/summary                   GET /api/dashboard/activity
GET  /api/dashboard/alerts                    GET /api/dashboard/case-distribution
GET  /api/cases                               GET /api/cases/{case_id}
GET  /api/search?q=...
GET  /api/persons/{person_id}
GET  /api/network                             GET /api/network/{person_id}
GET  /api/network/overview                    GET /api/network/filtered
GET  /api/network/entity/{id}                 GET /api/network/communities
GET  /api/network/centrality
GET  /api/analytics/centrality                GET /api/analytics/communities
GET  /api/analytics/patterns
GET  /api/analytics/transactions               GET /api/analytics/communications
GET  /api/analytics/locations                  GET /api/analytics/risk
GET  /api/analytics/correlation                GET /api/analytics/correlation/{person_id}
GET  /api/analytics/vehicles
GET  /api/timeline
GET  /api/alerts                               POST /api/alerts/{id}/status
GET  /api/entity-resolution/candidates         POST /api/entity-resolution/review
GET  /api/data/sources                         GET /api/data/validate
POST /api/data/upload                          POST /api/data/process
POST /api/reports/generate
POST /api/nlp/extract
GET  /api/audit
POST /api/auth/login
```

Interactive Swagger docs are available at `http://127.0.0.1:8000/docs` while the
backend is running.

## 14. Security & Ethical Design

- **Human-in-the-loop everywhere** — entity merges, alert status changes and report
  generation are all explicit human actions; nothing auto-executes.
- **No definitive criminal classification** — the UI and API consistently use
  "investigative lead", "person of interest", "requires verification", "investigative
  priority score" — never "criminal", "guilty", or "leader". See the disclaimers baked
  into every analytics response (`risk.py`, `patterns.py`, `reports.py`).
- **Explainability** — every alert, pattern and risk score carries a plain-language
  explanation and a list of supporting source record IDs.
- **RBAC** — three roles (Investigator/Analyst/Admin) with role-aware landing pages.
- **Audit logging** — every case/entity view, network view, merge, export and login is
  recorded (`backend/app/services/audit.py`) and visible on `/audit`.
- **Synthetic data labeling** — a persistent banner ("SYNTHETIC DEMONSTRATION DATA") is
  shown on every page; API responses also carry a `synthetic_data_notice`.
- **Graceful degradation** — the app runs fully in DEMO MODE with zero external
  dependencies (no LLM key, no cloud DB, no Neo4j); a missing/malformed CSV is reported
  clearly in the validation pipeline rather than silently invented.

## 15. Environment Variables

None are required to run the prototype (DEMO MODE). The NLP module's
`extract_entities(text, store, llm_provider=None)` signature is the intended extension
point for wiring in a real LLM provider later (e.g. reading an API key from an env var
and passing a provider callable) without changing any API contracts or frontend code.
