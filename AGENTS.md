# AGENTS.md — MedPulse AI Architecture & Coding Guidelines

> Source of truth for the PRD v5.0 build. Keep this file in sync with the code.

## 1. Project Overview
**MedPulse AI** is a Next.js (App Router) web app that compares real-time Indian prescription medicine and diagnostic lab prices across **mainstream branded e-pharmacies** and **government-subsidised / NABL-tested generic portals** (PMBJP Jan Aushadhi, AMRIT, SayaCare, …) plus **diagnostic labs** (Track D).

Public routes: **`/`** is the 3D welcome/landing page; **`/engine`** is the price engine. Legacy `/?q=&pin=&type=` links 307-forward to `/engine` so shared comparisons keep working.

Two core engineering challenges:
1. **Clinical Salt Decoding** — mapping expensive prescribed brand names to their exact WHO-GMP active salt composition.
2. **Two-Wave Progressive Execution** — progressive, zero-TinyAgent-spend price discovery in **Wave 1** (`TinySearch` + `TinyFetch` + AI extraction), then on-demand streaming stealth-browser verification (`TinyAgent`) rendered inside a Picture-in-Picture `<iframe>` dock in **Wave 2**. Latency is whatever the real network + models take; never advertise a fixed latency guarantee.

Full product/engineering spec and PPT generation brief: `docs/MASTER_SPEC.md`. Keep it in sync with shipped behavior.

## 2. Tech Stack & Core Dependencies
- **Framework:** Next.js 16 (App Router, TypeScript, Route Handlers). No Server Actions — the API surface is explicit route handlers.
- **Styling:** Tailwind CSS v4 (`@theme` tokens in `src/app/globals.css`) + `lucide-react`. Blue (`#0000ff` default, dark-blue `#0041c2` on hover) on a light-only canvas. There is no dark theme.
- **3D:** Three.js 0.160 (bundled) for the procedural welcome scene only. No textures or model files.
- **AI:** `ai` package (AI SDK) + `zod` v4 schemas, routed **exclusively** through the Vercel AI Gateway.
- **Web execution:** `@tiny-fish/sdk` (Search / Fetch / Agent).
- **Tests:** Vitest (`tests/*.test.ts`, 45 tests).
- **Required env (`.env.local`, never committed):**
  ```env
  TINYFISH_API_KEY="..."            # Search/Fetch (free tier) + Agent (paid, on-demand)
  AI_GATEWAY_API_KEY="..."          # enables the live dual-model pipeline
  MEDPULSE_MODE=auto                # auto | demo | live
  DEFAULT_PINCODE=110053
  CACHE_TTL_SECONDS=3600
  # VISION_MODEL / TEXT_MODEL       # optional overrides; never expose these IDs
  ```

## 3. Strict Dual-Model AI Routing (CRITICAL)
All LLM calls go through `src/lib/ai-router.ts` and the Vercel AI Gateway. **Never mix the models up.**

> Model IDs are **env-configured** (defaults in `src/lib/env.ts`, override via `VISION_MODEL` / `TEXT_MODEL`) and are **never surfaced in the UI, API responses or documentation** — no badges, no footers, no `/api/health` fields, no README/DESIGN examples. Never hardcode a model ID outside `src/lib/env.ts` defaults.

### A. Vision model (`VISION_MODEL`) — prescription OCR
- **Only** for uploaded prescription images (`/api/ocr`, `visionExtractRx`). Never for text/JSON tasks.
- Output: raw transcription + rough medicine lines, handed to the text model.
- OCR pins `reasoning: "none"` on **both** legs (`visionExtractRx` and the Rx `structureRx` call) via `generateValidated`. The structuring leg is still the text model doing JSON — only its reasoning setting changes. The default models are reasoning models; leaving reasoning on adds ~6 s (vision) and ~10–20 s (structuring) of hidden thinking without improving the output. Do not remove this without benchmarking — it is the main OCR latency lever.
- The OCR response must never include the model name/ID (no `models` field) — see §7.12.

### B. Text model (`TEXT_MODEL`) — clinical reasoning / salt mapping / JSON
- **All** non-vision tasks: salt decoding, listing extraction, lab extraction, Rx structuring + interactions.
- **DocAI chat** (`/api/docai`, `docaiChat()`): free-form general medical help & consulting — same model, safety-first system prompt (emergency redirect to 108/112, no dose changes, no invented prices).
- Demo mode (`MEDPULSE_MODE=demo`, or auto-without-gateway) makes **no LLM calls at all** — it serves labelled demo fixtures. (The gateway's zero-cost `-free` tier for the text model has ended.)
- Implementation note: the gateway provider currently serving the text model has no `structured-output` capability, so schema-constrained calls (`generateObject` / `Output.object`, also deprecated in AI SDK v7) 400 for that model. We embed the schema's JSON Schema in the prompt, parse the reply tolerantly and zod-validate it, retrying once on invalid output — everything entering the app is still schema-validated.

## 4. TinyFish Escalation & Cost-Control Rules
Protect the prepaid wallet (`$0.016/step` for TinyAgent). Enforce the **Two-Wave pattern**:

### Wave 1 — zero-TinyAgent discovery (always on)
1. `tf.search.query()` — `location: "IN"`, always pass a `purpose`. Branded portals queried by **brand name**; generic portals by **chemical salt**; labs (Track D) by **test/package name**.
2. `tf.fetch.getContents()` — batch ≤10 URLs, `format: "markdown"`, `ttl` 3600. Per-URL extraction results are cached 1 hr (`x:<url>` keys).
3. Progress is streamed **for real** — the compare pipeline emits live stage events (`resolve → search → fetch → extract → guard`, unresolved queries add `suggest`) through `POST /api/compare-stream` (`jsonSseResponse`). STAGE frames carry actual counts (listings, portals, pages, failed batches). Never simulate progress.

### Wave 2 — live stealth browser (`$0.016/step`, user-triggered ONLY)
- **Never** auto-run the agent in a loop without consent. The only auto path is the explicit **Auto-verify** scope chooser, and it only fires for **live** results, with a chosen scope (generics, branded, or all), up to 10 URLs, and at most 5 concurrent runs.
- `browser_profile: BrowserProfile.STEALTH`, pincode injection (`110053` default) into pharmacy modals. Kendra lookup opens `https://janaushadhi.gov.in/near-by-kendra` for the live browser view and concurrently calls the locator's `getAllKendraByStateDistrict` API (guest token) for reliable rows. API rows win if present; the agent path is the fallback. The text model deduplicates/cleans the list. Surface timeouts/errors in the results modal; keep the live PiP above the modal. The results modal offers a client-generated PDF (`jspdf`) containing every kendra for that pincode.
- The PiP dock renders one live browser tile per active run (2-column grid when multiple runs stream in parallel), so every agent screen is visible during a demo.
- Agents must **never** log in, add to cart, or checkout. Stock check only.
- **SSE contract** (`POST /api/agent-stream`, via `src/lib/sse.ts`) — forward all frames:
  - `STARTED` `{run_id, goal}`
  - `STREAMING_URL` `{streaming_url}` → rendered inside the PiP `<iframe>`
  - `PROGRESS` `{purpose}` → appended to the monospace step terminal
  - `COMPLETE` `{ok, result, error, video_url}` → patches the relevant quote cards
- With no TinyFish key (or in demo mode) the route runs an **honest labelled simulation** — never fake live stock numbers.

## 5. Domain Registry (Track A/B/C/D)
- **Branded (Track C):** `1mg.com`, `pharmeasy.in`, `apollopharmacy.in`, `netmeds.com`
- **Subsidised generics (Track B):** `sayacare.in`, `janaushadhionline.com`, `janaushadhistore.in`, **`apijanaushadhi.in`**, `zeelabpharmacy.com`, `davaindia.com`, `truemeds.in`
- **Govt (Track A):** `janaushadhi.gov.in` (PMBJP master + near-by-kendra locator), `lifecarehll.com` (AMRIT)
- **Labs (Track D):** `redcliffelabs.com`, `lalpathlabs.com`, `orangehealth.in`, `healthians.com`

Edit `src/lib/domains.ts` only — nothing else hardcodes domains.

## 6. Repository Structure (as built)
```text
MedPulse-main/
├── AGENTS.md
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Public welcome: 3D hero + local history → /engine
│   │   ├── engine/page.tsx             # Dashboard: search + Rx + dual-track grid + PiP dock + cart
│   │   ├── welcome.css                 # Welcome styles, scoped under .welcome-root
│   │   ├── ambient.css                 # Fixed light-mode gradient mesh behind every page
│   │   ├── layout.tsx                  # Fonts + metadata + light-first theme bootstrap
│   │   ├── globals.css                 # Tailwind v4 theme tokens
│   │   ├── icon.svg / icon.png         # Browser tab icon (blister-grid logo)
│   │   ├── apple-icon.png              # iOS home-screen icon (same logo, cropped)
│   │   ├── opengraph-image.png         # Social share card (+ .alt.txt)
│   │   └── api/
│   │       ├── compare/route.ts        # POST medicines (A/B/C) or {type:"lab"} (D)
│   │       ├── compare-stream/route.ts # POST SSE: real pipeline stages + final result
│   │       ├── locate/route.ts         # POST coordinates → Indian pincode (reverse geocode)
│   │       ├── ocr/route.ts            # POST vision OCR + structuring
│   │       ├── agent-stream/route.ts   # POST SSE proxy for TinyAgent
│   │       ├── docai/route.ts          # POST DocAI general help & consulting chat
│   │       ├── optimize-cart/route.ts  # POST split-cart optimizer
│   │       ├── health/route.ts         # GET mode + key status (never model IDs)
│   │       └── suggest/route.ts        # GET demo suggestions
│   ├── components/
│   │   ├── welcome/                    # WelcomePage, WelcomeScene (three), auth + motion wiring
│   │   ├── SiteAmbient.tsx             # Six-blob light-mode mesh rendered behind the app
│   │   ├── Logo.tsx                    # Brand lockup (blister-grid badge + wordmark) — navbar + footer
│   │   ├── NavbarPincode.tsx           # Logo + Pincode + Auto-verify scope chooser + status
│   │   ├── SearchPanel.tsx             # Medicine/Lab tabs + typeahead dropdown + quick pills
│   │   ├── PrescriptionDropzone.tsx    # capture="environment" camera + Rx result
│   │   ├── ClinicalSaltBanner.tsx      # PMBJP ceiling + kendra + AMRIT/bilingual safety
│   │   ├── CompareProgress.tsx         # Real pipeline stage tracker (SSE from compare-stream)
│   │   ├── DualTrackGrid.tsx           # Generic vs Branded columns (+ per-10-tabs pricing + provenance chips)
│   │   ├── LabGrid.tsx                 # Track D lab offer rows
│   │   ├── SavingsReceipt.tsx          # Savings per strip + adjustable monthly/yearly projection + copy receipt
│   │   ├── ShareLinkButton.tsx         # Copies the current ?q=&pin=&type= result URL
│   │   ├── LiveAgentPipDock.tsx        # Non-blocking PiP iframe + SSE terminal
│   │   ├── SplitCartDrawer.tsx         # Express vs refill cart + checkout links
│   │   ├── UnresolvedPanel.tsx         # Undecodable query → reliable real search picks
│   │   ├── DocAiDock.tsx               # DocAI chat dock (general help & consulting)
│   ├── hooks/useAgentStream.ts         # Agent dock state machine
│   └── lib/
│       ├── ai-router.ts                # ONLY file that talks to the AI Gateway
│       ├── tinyfish.ts                 # ONLY file that talks to the TinyFish SDK
│       ├── compare.ts                  # Wave 1 live pipeline + demo fallback
│       ├── labs.ts                     # Track D pipeline
│       ├── optimizer.ts                # Split-cart rules
│       ├── prescription.ts             # OCR orchestration + demo sample
│       ├── pricing.ts                  # per-10-tabs normalisation, strength guard, trimPage
│       ├── catalog.ts                  # curated medicine/lab catalog + instant typeahead scorer
│       ├── schedule.ts                 # EN/HI dosing schedule
│       ├── domains.ts                  # Track A/B/C/D registry
│       ├── demo-seed.ts                # Labelled demo fixtures (used when no keys)
│       ├── cache.ts                    # In-memory TTL cache (default 1 hr)
│       ├── rate-limit.ts               # Per-IP fixed-window budgets for public/AI routes
│       ├── env.ts / errors.ts / pool.ts / sse.ts / format.ts / urls.ts
│       ├── welcome-store.ts            # Local-only profile/session/history for the welcome page
│       ├── schemas.ts                  # zod contracts (PRD §9 shapes)
│       ├── agent-client.ts             # Browser-side SSE reader (agent-stream)
│       ├── compare-client.ts           # Browser-side SSE reader (compare-stream)
│       └── sse-client.ts               # Shared SSE frame parser
├── tests/                              # Vitest: pricing, schedule, demo, optimizer, catalog, rate limits, DocAI (45)
├── docs/
│   ├── MASTER_SPEC.md                  # Full product/engineering spec + PPT generation brief
│   └── screenshots/                    # Final deck captures (see README.md inside)
├── README.md                           # User/API/deploy docs — keep in sync with shipped behavior
├── DESIGN.md                           # Design-system reference for the UI surfaces
└── .env.local / .env.example
```

## 7. UI/UX Conventions
1. **Mobile camera:** the dropzone input keeps `accept="image/*,application/pdf"` + `capture="environment"`. PDFs are rejected client-side with a clear message (vision pipeline is image-only in v1) — do not silently POST PDFs.
2. **Fair price normalisation:** every medicine card shows `price_per_10_tabs_inr` alongside strike-through MRP and % discount. Never compare raw pack prices.
3. **Non-blocking PiP dock:** `fixed right-4 z-50` (raised above the cart bar when the cart is open). It must never block scrolling or clicking Wave 1 results. Runs are abortable (close = abort).
4. **Demo resilience + honesty:** without keys the app serves labelled demo data (`data_source:"demo"`, notes marked) for the seeded queries (Augmentin 625 Duo, Dolo 650, Telma 40, Glycomet SR 500, Pan 40, HbA1c, Full Body Checkup). Demo results are never dressed up as live; the agent simulation says so in its errors.
5. **Pincode changes re-resolve** the current comparison and re-optimise the cart automatically.
6. **DocAI honesty + safety:** the DocAI dock answers general medical questions only via the text model. Always keep the footer disclaimer (not a doctor / emergencies 108–112), never invent prices, never advise changing prescribed doses, and in demo mode return the clearly labelled demo reply.
7. **Live-location pincode:** the navbar locate button (`/api/locate`, bigdatacloud → nominatim fallback) sets the delivery pincode from real coordinates — only via the browser permission prompt or an explicit click. Store the chosen pincode in `medpulse:pincode`; never invent a pincode when geocoding fails — show the honest message instead.
8. **Unresolved queries never dead-end:** a query that cannot be decoded to a salt — or whose listings yield no trustworthy price (D3-60K class etc.) — runs a real TinySearch across the tracked portals and the text model picks up to 4 suggestions **that must appear in the search results** (rendered as clickable picks in `UnresolvedPanel`). If the suggestion path fails, fall back to the honest error. `status:"unresolved"` results are never cached.
9. **Real progress only:** `/api/compare-stream` emits real pipeline stage events with actual counts — the tracker (`CompareProgress`) must never display simulated or fabricated steps. The completed panel may stay visible with its real arrival timings, always labelled as measured in the browser.
10. **Typeahead suggestions are local + honest:** the search dropdown filters the curated catalog (`src/lib/catalog.ts`) client-side — instant, no network, no AI call per keystroke. Selecting a suggestion fills the box and runs the real compare; the **"Search ⋯ in live prices anyway"** row always runs the user's exact text through the live pipeline. Never invent suggestion names from the network here, and never present catalog hints as live prices.
11. **Light theme only:** `<html class="light">` is fixed in `layout.tsx`; there is no toggle, no `medpulse:theme` preference and no dark palette. Add colors as tokens in `globals.css`, never as per-component hardcoded values.
12. **Never surface model IDs:** no badges, footers, dock chips, API response fields or docs may show the underlying model names — they live only as env defaults in `src/lib/env.ts` (see §3). The OCR response in particular must not contain a `models` field.
13. **Branding & icons:** the brand mark is the blue blister-grid lockup on a white rounded tile, rendered by `Logo.tsx` (navbar + footer) — never re-create the badge or wordmark inline. Tab/app/social icons are file-based app metadata: `icon.svg` / `icon.png` / `apple-icon.png` / `opengraph-image.png`. If the logo ever changes, regenerate those files (the generator lives outside the repo in the logos demo workspace).
14. **Shareable results:** `engine/page.tsx` keeps `?q=&pin=&type=` in the address bar via `history.replaceState` after every successful comparison, and hydrates those params on boot (skipping the demo auto-query). `ShareLinkButton` copies the current URL. The public welcome lives at `/`; a root URL carrying any of those params is **307-forwarded** to `/engine` so old shared links keep working. Never break a shared link — a missing `/api/health` response must not block hydration.
15. **Provenance is visible:** every offer card shows how it was verified (`verified_by`, or "demo fixture"), the source host as an outbound link, the NABL batch when present, and "as of …" from the comparison's `generated_at`. Never hide that demo prices are fixtures.
16. **Savings receipt:** `SavingsReceipt` may only use real per-10-tab offers from the current comparison. The monthly/yearly numbers are an explicit projection from a user-adjustable "strips per month" assumption and must stay labelled as a projection — never invent adherence or usage statistics.
17. **Rate limits / cost guard:** `src/lib/rate-limit.ts` holds the per-IP budgets (compare 20/min, OCR 6/min, DocAI 20/min, cart 30/min, agent 4/min). Every new paid or AI-backed route must add a bucket and call `guard()` before parsing the body. SSE routes must return the plain 429 JSON **before** starting a stream.

18. **Premium gate (mock):** the navbar Premium badge and the first agent action open `PremiumModal` (₹299/month). `ensurePremium()` gates Agent Run, per-offer verify, Auto-verify, lab run, kendra and the agent console; one click unlocks a localStorage preview and resumes the pending action. No payment, checkout, account or subscription exists.

19. **Ambient mesh:** a fixed six-blob mesh (`.site-ambient`, `src/app/ambient.css`) sits behind every page, plus a warmer `.hero-ambient` mesh in the welcome hero (`welcome.css`). Both are always on in the single light theme and frozen under `prefers-reduced-motion`. Keep them low-opacity and behind content.
20. **Hindi UI:** `LanguageProvider` (`src/lib/i18n.tsx`) persists `medpulse:lang`; `LanguageToggle` sits in the top corner. Translate UI labels with `tr("English", "हिंदी")`; never translate medicine names, salts, lab test names or standard clinical terms.

## 8. Common Commands
- Install: `npm install`
- Dev: `npm run dev` → http://localhost:3000
- Typecheck: `npm run typecheck`
- Tests: `npm test`
- Prod build: `npm run build && npm start`

## 9. Never Do
- Never hardcode API keys in source (`.env.local` only, gitignored).
- Never call the vision model for text tasks or the text model for images.
- Never surface model IDs in the UI, API responses or docs; never re-add a `models` field to the OCR response.
- Never remove the OCR `reasoning: "none"` pins without re-benchmarking both OCR legs.
- Never auto-run TinyAgent outside the Auto-verify scope choice / Agent Run click; never log in or checkout with the agent.
- Never present demo numbers as live; always keep `data_source` accurate.
- Never bypass the strength guard (`strengthOk`) — a 500 mg listing must not appear for a 650 mg query.
- Never add a bundler/backend/database beyond Next.js route handlers without approval.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
