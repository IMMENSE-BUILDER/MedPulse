# MedPulse AI — PRD v5.0 build

Real-time price comparison for Indian prescription medicines and diagnostic lab tests.
One search prices everything three ways at once — the **PMBJP / Jan Aushadhi government benchmark** (Track A),
**subsidised generic listings matched by active salt** (Track B), and **branded express e-pharmacies** (Track C) —
plus **diagnostic lab test packages** (Track D). A split-cart optimiser then builds an express + refill basket
with realistic INR savings.

The public front door is a 3D welcome page at `/`; the comparison dashboard lives at `/engine`. Legacy `/?q=&pin=&type=` share links forward to `/engine` automatically.

Built on Next.js (App Router) + TypeScript, the Vercel AI Gateway, and the TinyFish SDK:

- **Wave 1 (always on, no TinyAgent spend):** `TinySearch` → `TinyFetch` → dual-model structured extraction. Progressive live discovery with a hard strength guard (a 500 mg listing can never be shown for a 650 mg query) and per-10-tabs price normalisation. Every stage streams as it completes — there is no fixed latency promise.
- **Wave 2 (on-demand):** `TinyAgent` stealth browser streams its runs as typed SSE events and renders parallel live browser tiles inside the floating PiP dock — pincode stock verification and Jan Aushadhi Kendra lookup.
- **Agent Run:** one click verifies every displayed medicine link in the live browser; each offer's "Stock unverified - run agent" line is also clickable. Auto-verify opens a scope chooser (generic substitutes, branded express, or all) and runs that scope on each live comparison. Lab results get the same Agent Run control.
- **Expanded medicine library:** the local typeahead now covers 350 curated medicine and lab entries, with common Indian brands, salt names and lab tests, and shows up to 9 matches.
- **Premium (mock):** a gold Premium badge shows a ₹299/month panel. The first agent action opens it; one click on “Unlock preview — no payment” bypasses it for that browser. No payment or subscription is implemented.
- **Prescription intelligence:** a photographed prescription is read by a dedicated vision model and structured by a clinical text model (both via the Vercel AI Gateway), with an English + हिन्दी dosing schedule and established drug-interaction flags. Both OCR legs run with hidden reasoning disabled for latency; model names/IDs are never returned by the API.
- **DocAI (general help):** a safety-first chat for general medicine and symptom questions, answered by the clinical text model — emergencies are routed to 108/112, and it never guesses prices.
- **Trust & impact layer:**
  - **Savings receipt** — real per-10-tab generic vs branded delta, an adjustable strips-per-month projection, and a copyable plain-text receipt.
  - **Provenance on every offer** — how the price was verified, the source host as an outbound link, the NABL batch when present, and price freshness ("as of …").
  - **Shareable results** — `?q=&pin=&type=` stays in the address bar, rehydrates on load, and a copy-link button is available on every result header.
  - **Real per-stage timings** — measured client-side from actual SSE arrivals; the completed pipeline panel stays visible with its total.
  - **Honest empty state** — explains the real pipeline and offers working example queries instead of fake progress.
- **Live-location pincode:** one tap (with browser permission) reverse-geocodes your coordinates into a delivery pincode and remembers it locally (`/api/locate`).
- **Instant typeahead:** as you type, a dropdown suggests matching medicines/lab tests from a curated in-app catalog (brand names + their common salt compositions) — pick one to compare it, or hit **"Search ⋯ in live prices anyway"** to run your exact text through the full live pipeline. Suggestions are instant and local; the AI pipeline stays in the real search.
- **Light theme only:** a single light clinical palette with a soft six-colour ambient mesh. There is no dark-mode toggle or saved theme preference. Model names are never surfaced in the UI.
- **Hindi UI:** an EN/हिं toggle in the top corner translates interface labels into simple Hindi. Medicine names, salts, lab test names and other standard terms stay in English.
- **Undecodable queries never dead-end:** a brand like "D60" that can't be priced (unknown salt, or no trustworthy listing found) triggers a real search across the tracked portals; the reliable picks come back as one-tap alternatives. Vitamin D3-60K formats ("60,000 IU", "60K") parse correctly in the strength guard.

## Quick start

```bash
npm install
# copy .env.example to .env.local and fill in keys
npm run dev          # → http://localhost:3000
```

Scripts: `npm run dev` · `npm run build` · `npm start` · `npm run typecheck` · `npm test`

## Environment (`.env.local`)

| Variable | Required | Purpose |
| --- | --- | --- |
| `TINYFISH_API_KEY` | for live search/fetch + Wave 2 agent | `@tiny-fish/sdk` — Search/Fetch are free-tier, Agent is `$0.016/step` and only runs on demand |
| `AI_GATEWAY_API_KEY` | for live extraction/OCR | Vercel AI Gateway — routes a vision model (prescription OCR only) and a clinical text model (all text/JSON tasks) |
| `MEDPULSE_MODE` | no | `auto` (default: live when both keys exist, else labelled demo), `demo` (force demo), `live` (hard-require keys, return 503 otherwise) |
| `DEFAULT_PINCODE` | no | Default delivery pincode (default `110053`) |
| `CACHE_TTL_SECONDS` | no | Discovery/extraction cache TTL (default 3600 = 1 hr) |
| `VISION_MODEL` / `TEXT_MODEL` | no | Model-ID overrides. The defaults live only in `src/lib/env.ts`; model IDs are never shown in the UI, API responses or docs. |

Demo mode is honest: every response carries `data_source:"demo"` plus a visible note, and the agent "run" is an explicitly-labelled simulation. With only a TinyFish key the app is still fully clickable — the kendra finder can run live, while comparisons stay demo until a Gateway key is added.

## Rate limits & cost controls

Every paid/AI-backed route has a per-IP fixed-window budget, enforced **before** body parsing (SSE routes return a plain 429 JSON before starting a stream). The 429 body matches the normal error shape and carries a `Retry-After` header.

| Endpoint | Budget per IP |
| --- | --- |
| `POST /api/compare` + `POST /api/compare-stream` (shared bucket) | 20 / min |
| `POST /api/ocr` | 6 / min |
| `POST /api/docai` | 20 / min |
| `POST /api/optimize-cart` | 30 / min |
| `POST /api/agent-stream` | 4 / min |

Implementation: `src/lib/rate-limit.ts`. Counters are in-memory per serverless instance — good for casual-abuse and demo-day protection, **not** a distributed quota. The Wave 2 agent is also capped at ≤10 URLs and ≤5 concurrent runs per Agent Run; multiple streaming URLs render as parallel browser tiles; Auto-verify uses the selected scope.

## API (PRD §9 contract)

| Endpoint | Body / Query | Returns |
| --- | --- | --- |
| `POST /api/compare` | `{query, pincode, type?:"medicine"\|"lab"}` | `DualTrackComparison` (govt benchmark, generic offers, branded offers, AMRIT alert, bilingual safety tip, notes) or `LabComparison` |
| `POST /api/compare-stream` | same body as `/api/compare` | SSE: `STAGE` (real pipeline progress with live counts) → `RESULT` — or `ERROR` |
| `POST /api/locate` | `{lat, lng}` | `{pincode, area, city, state, source}` — reverse-geocoded Indian pincode (free providers) |
| `POST /api/ocr` | `{image_base64, mime_type}` or `{text}` | structured medicines + salts + EN/HI schedule + interactions. No model IDs in the response. |
| `POST /api/agent-stream` | `{kind:"stock"\|"lab"\|"kendra", pincode, product_urls?[≤10]}` | SSE: `STARTED`, `STREAMING_URL`, `PROGRESS`, `COMPLETE` |
| `POST /api/docai` | `{messages:[{role:"user"\|"assistant", content}]}` (≤16) | DocAI reply + `data_source:"live"\|"demo"` |
| `POST /api/optimize-cart` | `{items:[{query, quantity_strips, mode:"urgent"\|"refill"}], pincode}` | `express_cart`, `generic_cart`, totals, `net_savings_inr`, checkout links |
| `GET /api/health` | — | mode, key status, demo query lists — never model IDs |
| `GET /api/suggest?q=` | — | demo suggestions for the search box |

Example:

```bash
curl -s -X POST http://localhost:3000/api/compare \
  -H "content-type: application/json" \
  -d '{"query":"Augmentin 625 Duo","pincode":"110053"}' | jq .data_source
```

## Architecture

Everything lives in `src/lib/` — each file owns exactly one concern:

- `ai-router.ts` — the only module that talks to the Vercel AI Gateway (dual-model routing, zod schemas, OCR reasoning settings).
- `tinyfish.ts` — the only module that talks to the TinyFish SDK (search / fetch / agent-stream).
- `compare.ts` · `labs.ts` · `optimizer.ts` · `prescription.ts` — the four pipelines.
- `pricing.ts` — per-10-tabs normalisation, pack parsing, the strength guard, page trimming.
- `rate-limit.ts` — per-IP budgets for every paid/AI route (see above).
- `catalog.ts` — curated in-app medicine/lab catalog + instant typeahead scorer for the search box (client-side, no network).
- `cache.ts` — in-memory TTL cache (default 1 hr).
- `schemas.ts` — zod contracts shared by API, AI structured output and the frontend.
- `sse.ts` / `sse-client.ts` — typed SSE helpers (server stream responder + shared browser frame parser).
- `compare-client.ts` · `agent-client.ts` — browser-side SSE readers for their endpoints.
- `demo-seed.ts` — illustrative fixtures used in demo mode (Augmentin 625 Duo, Dolo 650, Telma 40, Glycomet SR 500, Pan 40, HbA1c, Full Body Checkup).

Trust surfaces live in `src/components/`: `SavingsReceipt.tsx`, `ShareLinkButton.tsx`, `CompareProgress.tsx` (real stage timings) and the provenance chips inside `DualTrackGrid.tsx`.

Full conventions and guardrails: see `AGENTS.md`.

## Verification

```bash
npm run typecheck   # tsc --noEmit
npm test            # Vitest — 42 tests across pricing, schedule, demo pipelines, optimizer, catalog, rate limits
npm run build       # production build
```

## Performance notes

- **Compare discovery is genuinely live** — portal search/fetch and model extraction determine the duration. The UI streams each real stage and shows the measured arrival time; it never claims a fixed latency.
- **OCR is two-stage** (vision extraction → Rx structuring). Both stages pin reasoning to `none`: hidden reasoning was adding ~6 s to the vision call and ~10–20 s to structuring without improving the output. Warm OCR calls measured ~5–9 s (8.8 s in a production warm test); the first call after idle can be slower (~20 s cold start).
- Accuracy is validated on clean printed prescriptions. Spot-check handwritten/real-world photos; if structuring accuracy drops, reasoning can be raised for that leg as a deliberate trade-off.
- Route handlers set `maxDuration` up to 300 s for agent/cart work — adjust to your plan limits.

## Deploying (Vercel)

Two ways — dashboard import or straight from this folder:

```bash
npx vercel login     # once, browser confirm
npx vercel link --yes
npx vercel --prod --yes
```

Or: push to GitHub and use **Add New → Project** in the Vercel dashboard (framework preset: Next.js; no extra config).

Environment variables:

- `TINYFISH_API_KEY` — required for live search/fetch and the Wave 2 agent.
- `AI_GATEWAY_API_KEY` — optional on Vercel: the AI SDK's gateway provider can authenticate via the auto-injected OIDC token instead. Check `/api/health` → `gateway_auth` (`"key"` | `"oidc"` | `"none"`).

Notes:

- Environment-variable changes require a new deployment to take effect.
- The TTL cache in `src/lib/cache.ts` is in-memory; for multi-instance deployments swap it for Vercel KV/Redis behind the same interface.
- `.vercelignore` keeps `.env*` and all local-only files out of deployments.

## Documentation

- [`docs/MASTER_SPEC.md`](docs/MASTER_SPEC.md) — full product + engineering spec with a ready-to-use PPT generation brief (start here for decks and onboarding).
- [`docs/screenshots/`](docs/screenshots/README.md) — final deck captures and the screenshot capture standard.
- [`AGENTS.md`](AGENTS.md) — architecture rules, dual-model routing, UI conventions and guardrails.
- [`DESIGN.md`](DESIGN.md) — visual system and component/token reference.

## Security

- `.env.local` is gitignored — never commit keys, and rotate any key that has been shared in plain text.
- Agent runs never log in, add to cart, or checkout.
- Model IDs are env-only and must never appear in the UI, API responses or documentation (including this README).
- Rate limits are best-effort per instance; they protect the TinyFish wallet and demo, not a multi-region quota.
- All pricing is indicative; every UI surface reminds users to confirm at checkout and with a pharmacist.

---

**By Satyam and Sujal** ❤️
