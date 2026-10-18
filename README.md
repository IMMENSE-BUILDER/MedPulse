# MedPulse AI — Backend (FastAPI)

Dual-track medicine price comparison: **branded e-pharmacies** vs **Jan Aushadhi / NABL generics**, with prescription OCR,
live pincode stock checks, nearest Kendra lookup and a split-cart optimiser. Built from `PRD v2.0` and your teammate's dashboard.

## Run it (60 seconds)

```bash
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                    # keys optional, see Modes
uvicorn main:app --reload
```
Open http://localhost:8000 (dashboard) · http://localhost:8000/docs (interactive API docs).
Tests: `pytest -q`

## Modes

| Mode | When | Behaviour |
|---|---|---|
| **demo** | no keys in `.env` | Seeded, *illustrative* prices for 4 medicines (Augmentin 625, Telmisartan 40, Metformin 500 SR, Pantoprazole 40). Every response says `data_source: "demo"` and the UI shows a **Demo Data** pill. Never fakes stock: live-pincode returns `in_stock_at_pincode: null`. |
| **live** | `TINYFISH_API_KEY` + `GEMINI_API_KEY` set | Real pipeline below. If a live lookup fails in `auto` mode it falls back to demo data *and says so* in `notes`; set `MEDPULSE_MODE=live` to get a 502 instead. |

## Live pipeline (PRD §5)

```
query ─► salt resolve (local dict → Gemini)
      ─► TinySearch ×2 in parallel   brand → 1mg/pharmeasy/apollo/netmeds · salt → sayacare/janaushadhi*/zeelab/dava/truemeds
      ─► TinyFetch batch (≤10 URLs, ttl=3600, per-URL error isolation) → markdown
      ─► Gemini 2.5 Flash structured extraction (JSON schema; prices only if literally on the page)
      ─► normalise to ₹/10 tabs, savings vs highest branded MRP seen
      ─► NABL badge ONLY if a lab-report link was found AND the fetched report text contains "NABL"
      ─► (optional, costs money) TinyAgent: pincode injection / UMANG Kendra locator, streamed to the drawer
```

## Endpoints

| Method | Route | Notes |
|---|---|---|
| POST | `/api/v2/compare/dual-track` | `{query, pincode, session_id?}` → `DualTrackComparisonResponse` (PRD schema + `data_source`, `notes`) |
| POST | `/api/v2/prescription/analyze` | multipart: `file` (jpg/png/webp/pdf ≤25MB) and/or `text` |
| POST | `/api/v2/verify/live-pincode` | TinyAgent stock + ETA for ≤5 product URLs (≤3 concurrent) |
| POST | `/api/v2/govt/nearest-kendra` | UMANG Jan Aushadhi Sugam via TinyAgent; `include_amrit` |
| POST | `/api/v2/cart/hybrid-optimize` | items `{query, quantity_strips, mode: urgent\|refill}` → two carts + net savings |
| GET | `/api/v2/agent/stream?session_id=` | SSE feed for the TinyAgent drawer |
| GET | `/api/health`, `/api/v2/medicines/suggest?q=` | meta |

```bash
curl -s localhost:8000/api/v2/compare/dual-track -H 'content-type: application/json' \
  -d '{"query":"Augmentin 625 Duo","pincode":"110053"}' | jq '.best_savings_percent, .subsidised_generic_online[0]'
```

**Optimiser rule:** *urgent* = cheapest in-stock offer deliverable ≤ 2 h (else fastest); *refill* = cheapest generic per tablet,
preferring a NABL-verified one within 10 % of the lowest price. Savings are computed per tablet vs the branded reference, so
10- vs 15-tablet strips compare fairly.

## Cost control
Search/Fetch are the free tier (30 req/min, 150 URLs/min, 1000 URLs/day). TinyAgent is ~$0.016/step, so it only runs when the
**Stock Agent** toggle is on (default **off** here; the mock-up had it on), the user clicks Re-scan, or Kendra lookup is requested.
Results are cached 15 min (`CACHE_TTL_SECONDS`); the cache and SSE bus are in-process; use Redis if you run >1 worker.

## Layout
```
main.py                 uvicorn entry (replaces the empty main.py)
app/main.py, config.py  app, CORS, error shape {"detail":{"error","message"}}
app/schemas.py          all request/response models
app/services/           compare · optimizer · prescription · govt · gemini · tinyfish_client · pricing
app/demo_data.py        seeded medicines/vendors/kendras (illustrative!)
static/index.html       teammate's dashboard, patched with ids (tools/patch_dashboard.py)
static/app.js           renders API data into the existing design
tests/                  16 tests; live path tested with fake TinyFish/Gemini clients
```

## Known gaps / before a public launch
- **Live path has not been run against the real TinyFish/Gemini APIs** (no keys during development). It is unit-tested with fakes; expect to tune search queries, extraction prompts and the agent goals on the first real run.
- Demo prices are made up (Augmentin figures mirror the mock-up). The PRD uses ₹52 / ₹223 for Augmentin; the mock-up uses ₹45.20 / ₹204.35. Pick one source of truth. PMBJP ceilings should come from janaushadhi.gov.in.
- Kendra and AMRIT demo entries are placeholders, not a real directory.
- No auth/rate limiting on the API; add before exposing publicly. Uploaded prescriptions are processed in memory and not stored.
- Substitution is informational. Keep the disclaimer: switching brand to generic needs a doctor/pharmacist's OK, and the app links out rather than selling medicines.
