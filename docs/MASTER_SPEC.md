# MedPulse AI — Master Product & Engineering Spec

> **Purpose:** the single detailed source of truth for the whole MedPulse AI codebase and website. Written to be handed directly to an AI presentation agent to generate a pitch deck.
>
> **Status:** live production build (PRD v5.0).  
> **Production:** https://medpulse-ai-snowy.vercel.app  
> **Repository:** https://github.com/Sujal-cyber11/MedPulse  
> **Team:** Satyam and Sujal  
> **Last updated:** 21 October 2026

---

## 0. How to use this document (PPT agent instructions)

1. Use **only** the facts in this document. Do not invent customers, revenue, funding, partnerships, user counts, clinical outcomes, or competitor statistics.
2. Prices, savings percentages and latency numbers are **observed snapshots**. Always label them as “observed in a live run” or “measured in testing”, not as guarantees.
3. Never mention underlying AI model names or model IDs. Use “vision model” and “clinical text model”. Model identity is intentionally private and must not appear in the deck.
4. Never show API keys, environment values, or `.env.local` contents.
5. Keep the honesty framing: demo data is labelled demo; live data is labelled live; prices are indicative and must be confirmed at checkout.
6. Preferred pitch tone: clear, technical but accessible, evidence-led, no hype.
7. A ready-to-paste generation prompt and a 12-slide outline are in **§14**.

---

## 1. Executive summary

### One-liner

**MedPulse AI turns one medicine search into a transparent, three-way price comparison — government generic benchmark, subsidised generic pharmacies, and branded express pharmacies — then shows exactly how much switching saves and where every price came from.**

### 30-second pitch

Indians often overpay for medicines because the same active salt is sold under many brand names at very different prices. MedPulse AI decodes a brand or salt, searches both subsidised generic portals and mainstream branded pharmacies, normalises every listing to a fair per-10-tablet price, and applies a hard strength guard so an incorrect dose can never be compared. It also compares diagnostic lab packages, reads photographed prescriptions, and verifies stock on demand with a live browser agent. The result is a savings receipt with provenance, real timings, and shareable links — not a black-box price quote.

### 2-minute pitch

MedPulse AI is a Next.js web app for Indian patients, caregivers and price-sensitive chronic-medication users. A user searches a brand such as “Augmentin 625 Duo” or a lab test such as “HbA1c”. The app resolves the query to its active salt and strength, searches generic and branded pharmacy networks in parallel, extracts real listings, normalises pack sizes to a per-10-tablet basis, and filters out any listing whose strength does not match. Results are shown in three tracks: the PMBJP/Jan Aushadhi government benchmark (Track A), subsidised generic online listings (Track B), and branded express e-pharmacies (Track C). Track D covers diagnostic labs.

Above the offers, a savings receipt converts the cheapest strength-matched generic and the branded reference into a plain-language delta: rupees saved per strip, percentage saved, and a user-adjustable monthly/yearly projection. Every offer carries provenance — how it was verified, the source host, the NABL batch when available, and how fresh the price is. Results are shareable through `?q=&pin=&type=` URLs. A real-time stage tracker shows actual pipeline arrivals, not a fake progress bar.

The app also reads a photographed prescription with a dedicated vision model, structures it with a clinical text model, and returns medicines, salts, an English + Hindi dosing schedule and interaction flags. A safety-first DocAI chat answers general medicine questions, routes emergencies to 108/112, and never invents prices. For on-demand confidence, a TinyAgent stealth browser checks pincode stock and locates Jan Aushadhi Kendras inside a non-blocking picture-in-picture dock.

The engineering choices are deliberately honest: live vs demo is always labelled, the strength guard is non-negotiable, model IDs never surface, paid routes are rate-limited, and every AI output is schema-validated. The current build has 42 automated tests, a clean typecheck and production build, and 17/17 checks in a production browser smoke run.

---

## 2. Problem

### 2.1 The user problem

- **Same salt, different price.** Branded medicines and generic equivalents can differ substantially in price even when the active salt and strength are identical.
- **Fragmented discovery.** Generic portals, Jan Aushadhi listings, branded e-pharmacies and lab providers are separate sites with different pack sizes, discounts and stock states.
- **Unfair comparisons.** A ₹90 strip of 6 and a ₹150 strip of 10 cannot be compared directly; pack-size normalisation is essential.
- **Strength mismatches.** A 500 mg listing must never be shown as a match for a 650 mg prescription. A fair comparison has to enforce this explicitly.
- **Prescription friction.** Patients struggle to decode brand names, salts, frequencies and durations, especially when handwriting is unclear.
- **Trust gap.** AI-generated health and price answers are often opaque. Users cannot tell whether a price is live, a fixture, verified, stale, or invented.
- **Lab price opacity.** Diagnostic package prices and included parameters vary widely across providers.

### 2.2 What existing categories do not solve together

| Category | Typical limitation |
| --- | --- |
| Branded e-pharmacy search | Shows branded packs; does not systematically map to the cheapest strength-matched generic |
| Generic-only portals | Good generic prices, but no side-by-side branded reference or fair pack normalisation across portals |
| Coupon/aggregator sites | Discount-led, not salt-led; weak provenance and strength guarantees |
| AI health chatbots | Fluent answers, but often no live prices, no source trail and no transactional guardrails |
| Manual Jan Aushadhi lookup | Authoritative benchmark, but no live branded comparison or prescription workflow |

MedPulse AI’s differentiator is the **combination**: salt-first matching, three price tracks, a hard strength guard, provenance on every offer, and a trust layer that makes the comparison explainable.

---

## 3. Product overview

### 3.1 What it is

A responsive Next.js web application that:

The public front door is `/` — a 3D welcome/landing page. The price engine and all comparison tools live at `/engine`; legacy `/?q=&pin=&type=` links 307-forward to `/engine`.

1. Resolves a medicine brand/salt or lab test.
2. Discovers live listings across tracked Indian portals.
3. Extracts and normalises offers.
4. Applies a strength guard and per-10-tablet pricing.
5. Presents Track A/B/C medicine prices or Track D lab prices.
6. Quantifies savings, provenance and freshness.
7. Supports prescription OCR, DocAI chat, split-cart optimisation and live-agent stock checks.

### 3.2 Target users

- **Patients and caregivers** paying out of pocket, especially for chronic medicines.
- **Price-sensitive households** comparing branded vs generic options.
- **Jan Aushadhi-curious users** who need a trusted benchmark and a nearby kendra.
- **Prescription holders** who need help decoding a doctor’s brand names and doses.
- **Diagnostic-test shoppers** comparing lab package prices and included parameters.

### 3.3 What it is not

- Not a pharmacy: it does not sell, add to cart, or check out.
- Not a medical device: it is an assistive information tool, not a diagnosis or prescribing system.
- Not a substitute for a doctor or pharmacist: every surface carries a verification reminder.
- Not a guaranteed price feed: prices are indicative and can change at the pharmacy.

---

## 4. Feature specification

### 4.1 Search and clinical salt decoding

**User sees:** a search box with medicine/lab tabs, instant local typeahead suggestions, and example-query pills in the empty state.

**Behaviour:**

- The catalog provides instant client-side suggestions for known brands and lab tests. No network or AI call per keystroke.
- Selecting a suggestion fills the query and runs the real comparison.
- “Search ⋯ in live prices anyway” always runs the user’s exact text through the live pipeline.
- The pipeline resolves a brand to its active salt(s) and strength using the curated catalog first, then the clinical text model.
- If the query is not a medicine, or no trustworthy price can be extracted, the app does not dead-end: it runs a real search across tracked portals and offers up to four evidence-backed alternatives.

**Files:** `src/components/SearchPanel.tsx`, `src/lib/catalog.ts`, `src/lib/compare.ts`, `src/lib/ai-router.ts` (`resolveSalt`).

### 4.2 Track A/B/C medicine comparison

**User sees:** two-column offer grids (generic vs branded) with per-10-tablet prices, strike-through MRP, discount percentage, NABL badge when present, provenance, and outbound source links.

**Tracks:**

- **Track A — government benchmark:** PMBJP / Jan Aushadhi official ceiling price and kendra context.
- **Track B — subsidised generics online:** salt-matched listings from generic portals, strength-guarded.
- **Track C — branded express:** brand-name listings from mainstream e-pharmacies, with delivery/ETA context and on-demand stock verification.

**Rules:**

- Every medicine offer is normalised to **price per 10 tablets/capsules**; raw pack prices are never compared directly.
- The **strength guard** rejects any listing whose parsed strength does not match the resolved salt strength. Example: a 500 mg paracetamol listing must not appear for a 650 mg query.
- A branded reference price is used for savings calculations; it is derived from the current comparison, not invented.
- If only branded offers survive the guard, the UI says so honestly rather than forcing a generic comparison.

**Files:** `src/lib/compare.ts`, `src/lib/pricing.ts`, `src/components/DualTrackGrid.tsx`, `src/components/ClinicalSaltBanner.tsx`.

### 4.3 Track D — diagnostic lab comparison

**User sees:** a lab tab and a dedicated lab grid with package price, MRP, discount, included parameters, NABL context and source provenance.

**Behaviour:** resolves the test/package, searches tracked lab providers, extracts package details, normalises the comparison, and labels data source honestly.

**Files:** `src/lib/labs.ts`, `src/components/LabGrid.tsx`, `src/lib/ai-router.ts` (`extractLabsBatch`).

### 4.4 Savings receipt

**User sees:** a panel titled “What switching saves you”, showing:

- Rupee saving per 10-tablet strip.
- Percentage saved vs the branded reference.
- Cheapest generic platform and branded reference price.
- PMBJP ceiling when available.
- A strips-per-month stepper (1–12).
- Monthly and yearly projection.
- A “Copy receipt” action with a plain-text receipt.

**Rules:**

- Uses only real offers from the current comparison.
- Renders only when a positive, strength-matched delta exists.
- Monthly/yearly figures are explicitly labelled as projections from the user’s strips-per-month assumption; no adherence or usage statistic is invented.
- Demo prices are labelled “demo prices”.

**Files:** `src/components/SavingsReceipt.tsx`, `src/lib/format.ts`.

### 4.5 Provenance and freshness

**User sees:** on every offer card:

- How the price was verified (`verified_by`, or “demo fixture”).
- The source host as an outbound link.
- NABL batch/report badge when present.
- “As of …” freshness derived from the comparison timestamp.
- Stock state: “Stock unverified — run agent”, “In stock”, or “agent-verified”.

**Why it matters:** users can audit the claim instead of trusting a black-box number.

**Files:** `src/components/DualTrackGrid.tsx`, `src/lib/schemas.ts`.

### 4.6 Shareable comparison links

**User sees:** a “Copy link” pill in each result header.

**Behaviour:**

- Successful comparisons keep `?q=<query>&pin=<pincode>&type=<medicine|lab>` in the address bar via `history.replaceState`.
- On boot, the app hydrates those params and re-runs the comparison.
- Clipboard failure falls back to a prompt with the URL.
- A missing health response must not block hydration.

**Files:** `src/app/page.tsx`, `src/components/ShareLinkButton.tsx`, `src/lib/urls.ts`.

### 4.7 Real progress and stage timings

**User sees:** a pipeline panel listing the real stages — resolve → search → fetch → extract → guard (plus suggest when needed) — with actual counts and client-measured arrival times. After completion, the panel stays visible with the total.

**Rules:**

- Stage events come from the real server pipeline over SSE.
- Timings are measured from the moment each SSE frame reaches the browser; nothing is simulated or estimated.
- The UI never displays a fake progress bar or fabricated steps.

**Files:** `src/components/CompareProgress.tsx`, `src/lib/compare-client.ts`, `src/app/api/compare-stream/route.ts`, `src/lib/sse.ts`.

### 4.8 Prescription OCR

**User sees:** a camera/file dropzone; after processing, a structured prescription card with extracted text, medicines, salts, dose schedule, duration, interaction flags and a bilingual disclaimer.

**Flow:**

1. Client sends a base64 image (PDFs are rejected client-side in v1).
2. Vision model transcribes the image and returns rough medicine lines as validated JSON.
3. Clinical text model structures the transcription into brand names, salts/strengths, frequency, instructions, duration and interactions.
4. Server builds English + Hindi schedules and returns the result.

**Trust and safety:**

- Both OCR legs run with hidden reasoning disabled to keep scans fast; outputs remain schema-validated.
- The API response never contains model names or IDs.
- The app has no database or image storage; uploads are processed in the request.
- Disclaimer: assistive tool only, not a medical device; verify every medicine, strength and dose with a doctor or pharmacist.
- Demo mode returns a clearly labelled sample, not a fake live result.

**Observed performance:** full pipeline improved from ~27 s to ~5–9 s in local tests; a production warm call measured 8.8 s (first call after idle can be ~20 s due to cold start).

**Files:** `src/app/api/ocr/route.ts`, `src/lib/prescription.ts`, `src/lib/ai-router.ts`, `src/components/PrescriptionDropzone.tsx`.

### 4.9 DocAI — general medical help

**User sees:** a chat dock for general medicine and symptom questions, with a visible safety footer.

**Behaviour:**

- Uses the clinical text model with a safety-first system prompt.
- Emergencies are redirected to 108/112.
- Never advises changing a prescribed dose; never invents prices.
- Demo mode returns a labelled demo reply.

**Files:** `src/app/api/docai/route.ts`, `src/lib/ai-router.ts` (`docaiChat`), `src/components/DocAiDock.tsx`.

### 4.10 Split-cart optimiser

**User sees:** an express vs refill cart recommendation with item-level and total savings, plus outbound checkout links.

**Behaviour:** classifies items as urgent or refill, combines the cheapest suitable offers, and reports `net_savings_inr`. It never performs checkout or logs into a pharmacy.

**Files:** `src/app/api/optimize-cart/route.ts`, `src/lib/optimizer.ts`, `src/components/SplitCartDrawer.tsx`.

### 4.11 Wave 2 — live agent verification

**User sees:** a non-blocking picture-in-picture dock with a streaming browser view and a monospace progress terminal; result cards are patched with stock/kendra outcomes.

**Behaviour:**

- User-triggered only; the explicit Auto-verify toggle is the sole automatic path and only for live results.
- Stock checks ≤5 URLs, ≤3 concurrent runs.
- Pincode injection into pharmacy stock modals.
- Jan Aushadhi Kendra lookup via UMANG.
- Never logs in, adds to cart, or checks out.
- With no key or in demo mode, an explicitly labelled simulation runs — no fake stock numbers.

**Files:** `src/app/api/agent-stream/route.ts`, `src/lib/agent-client.ts`, `src/hooks/useAgentStream.ts`, `src/components/LiveAgentPipDock.tsx`.

### 4.12 Pincode and live location

**User sees:** a pincode field in the navbar and a locate button.

**Behaviour:**

- Locate uses browser permission; coordinates are reverse-geocoded through free providers to an Indian pincode.
- The chosen pincode is stored under `medpulse:pincode`.
- Changing the pincode re-resolves the current comparison and re-optimises the cart.
- If geocoding fails, the app shows an honest message and never invents a pincode.

**Files:** `src/app/api/locate/route.ts`, `src/components/NavbarPincode.tsx`.

### 4.13 Light/dark theme and branding

- Dark clinical theme by default; light theme available from the navbar.
- Theme is applied before first paint and stored under `medpulse:theme` to avoid flash.
- Brand mark: blue blister grid on a white rounded tile + wordmark, used consistently in the navbar, footer and favicon.
- Icons/metadata: `icon.svg`, `icon.png`, `apple-icon.png`, `opengraph-image.png`.
- Palette: near-black surfaces, blue accents — light blue `#0000ff` by default, dark blue `#0041c2` on hover — with Geist + JetBrains Mono. White text on solid blue buttons.

**Files:** `src/components/ThemeToggle.tsx`, `src/components/Logo.tsx`, `src/app/layout.tsx`, `src/app/globals.css`.

### 4.14 Empty state and unresolved queries

- The empty state explains the real pipeline and offers example-query pills that actually run; it never shows placeholder prices or fake progress.
- Undecodable or unpriceable queries trigger a real portal search; up to four suggestions that appear in the results are shown as clickable alternatives.
- Unresolved results are never cached.

**Files:** `src/app/page.tsx`, `src/components/UnresolvedPanel.tsx`, `src/lib/compare.ts`.

### 4.15 Rate limits

Per-IP fixed-window budgets, enforced before body parsing:

| Endpoint | Budget |
| --- | --- |
| compare + compare-stream (shared) | 20 / min |
| OCR | 6 / min |
| DocAI | 20 / min |
| optimize-cart | 30 / min |
| agent-stream | 4 / min |

429 responses use the normal error shape and a `Retry-After` header. Counters are in-memory per serverless instance — best-effort abuse protection, not a distributed quota.

**Files:** `src/lib/rate-limit.ts`, all API routes.

---

## 5. User journeys

### 5.1 First visit

1. User lands on the dashboard; no demo query auto-runs.
2. Empty state explains the three tracks and the real pipeline.
3. Example query pills offer one-tap starts.
4. Pincode defaults to 110053 and can be changed or located.

### 5.2 Search a branded medicine

1. User types “Augmentin 625 Duo”; local suggestions appear instantly.
2. User runs the comparison.
3. Live stage panel shows resolve → search → fetch → extract → guard with real counts.
4. Results show Track A benchmark, Track B generics and Track C branded offers, all per 10 tablets.
5. Savings receipt shows the delta and projection.
6. Provenance rows show source and freshness.
7. URL updates to a shareable `?q=&pin=&type=` link.

### 5.3 Share a result

1. User clicks “Copy link”.
2. Recipient opens the URL; the app hydrates query, pincode and type and re-runs the comparison.
3. The result is independently produced by their own request, not a cached screenshot.

### 5.4 Scan a prescription

1. User opens the prescription dropzone and takes/selects a photo.
2. The app shows a busy state while OCR runs.
3. Result shows extracted text, medicines, salts, schedules and interactions.
4. User can tap a medicine to run its price comparison.
5. Disclaimer reminds them to verify with a doctor/pharmacist.

### 5.5 Verify stock with the agent

1. User reviews live offers.
2. User clicks “Verify stock” (or enables Auto-verify).
3. PiP dock streams the agent run; terminal shows progress.
4. Result cards are updated with stock/kendra outcomes.
5. User is taken to the source pharmacy for the final purchase — the app never checks out.

### 5.6 Build a split cart

1. User adds medicines with quantities and urgency.
2. Optimiser splits express vs refill.
3. Drawer shows totals and net savings with checkout links.

---

## 6. Architecture

### 6.1 High-level

```text
Browser (Next.js App Router UI)
  ├─ /api/compare-stream  ── SSE stages + final comparison
  │     └─ resolve salt → TinySearch (generic + branded) → TinyFetch
  │           → text-model extraction → normalise → strength guard → cache
  ├─ /api/ocr             ── vision transcription → text-model structuring
  ├─ /api/docai           ── clinical text model (safety prompt)
  ├─ /api/optimize-cart   ── deterministic split-cart rules
  ├─ /api/agent-stream    ── SSE proxy to TinyAgent (PiP browser view)
  ├─ /api/locate          ── coordinates → Indian pincode
  └─ /api/health, /api/suggest
```

### 6.2 Two-wave execution

- **Wave 1** is always on: TinyFish Search + Fetch, dual-model extraction, normalisation, strength guard. No TinyAgent wallet spend. TinyFish Search/Fetch are free-tier; gateway tokens are billed.
- **Wave 2** is user-triggered: TinyAgent stealth browser costs `$0.016/step`, streams into a PiP dock, and is capped at ≤5 URLs and ≤3 concurrent runs.

### 6.3 Dual-model routing

- **Vision model:** only prescription images (`/api/ocr`, `visionExtractRx`).
- **Clinical text model:** all text/JSON tasks — salt resolution, offer/lab extraction, Rx structuring, DocAI.
- Both roles run through the Vercel AI Gateway.
- Model IDs live only in environment defaults and are never exposed in UI, API responses or documentation.
- Schema-constrained generation is avoided where the provider lacks structured-output support; the app embeds JSON Schema in prompts, parses tolerantly, and zod-validates with one repair retry.
- OCR pins reasoning off on both legs to avoid hidden reasoning latency; the trade-off is documented and benchmarked.

### 6.4 Caching and state

- In-memory TTL cache (default 1 hour) for extraction/comparison results; unresolved results are not cached.
- Client settings: `medpulse:pincode`, `medpulse:theme`.
- No database, no accounts, no auth, no server-side user data store.
- Rate-limit counters and cache are per serverless instance.

### 6.5 Failure behaviour

- Every external call is guarded.
- In `auto` mode, a failed live pipeline returns a clearly labelled demo fallback with a note; in `live` mode it returns an explicit error instead.
- Agent failures surface in the dock; no fake stock numbers.

### 6.6 Deployment

- Next.js 16 App Router on Vercel.
- Route handlers run Node.js; `maxDuration` up to 120 s for compare/OCR and 300 s for agent/cart.
- Environment variables: TinyFish key, AI Gateway key (or Vercel OIDC), mode, default pincode, cache TTL, optional model overrides.
- `.env.local` is gitignored; environment changes require a new deployment.

---

## 7. Codebase map

```text
MedPulse-main/
├── README.md                     # usage, API, deploy, performance notes
├── AGENTS.md                     # engineering rules and architecture guardrails
├── DESIGN.md                     # visual system and trust-surface conventions
├── docs/MASTER_SPEC.md           # this document — PPT-ready master spec
├── src/
│   ├── app/
│   │   ├── page.tsx              # 3D welcome/landing + legacy-share redirect
│   │   ├── engine/page.tsx       # price-engine dashboard + share hydration + empty state
│   │   ├── layout.tsx            # metadata, fonts, theme bootstrap
│   │   ├── globals.css           # Tailwind v4 tokens, dark/light themes
│   │   ├── icon.svg/.png         # brand icons
│   │   ├── apple-icon.png
│   │   ├── opengraph-image.png   # social share card
│   │   └── api/
│   │       ├── compare/route.ts          # one-shot comparison
│   │       ├── compare-stream/route.ts   # SSE live stages + result
│   │       ├── ocr/route.ts              # prescription OCR
│   │       ├── docai/route.ts            # general medical chat
│   │       ├── agent-stream/route.ts     # TinyAgent SSE proxy
│   │       ├── optimize-cart/route.ts    # split cart
│   │       ├── locate/route.ts           # reverse geocode
│   │       ├── health/route.ts           # mode/key status only
│   │       └── suggest/route.ts          # demo suggestions
│   ├── components/
│   │   ├── NavbarPincode.tsx     # logo, pincode, auto-verify, theme
│   │   ├── SearchPanel.tsx       # tabs, typeahead, quick pills
│   │   ├── CompareProgress.tsx   # real stage tracker/timings
│   │   ├── ClinicalSaltBanner.tsx# PMBJP benchmark + safety
│   │   ├── DualTrackGrid.tsx     # generic vs branded + provenance
│   │   ├── SavingsReceipt.tsx    # savings + projection + copy
│   │   ├── ShareLinkButton.tsx   # copy current comparison URL
│   │   ├── LabGrid.tsx           # Track D labs
│   │   ├── PrescriptionDropzone.tsx
│   │   ├── DocAiDock.tsx
│   │   ├── LiveAgentPipDock.tsx  # PiP iframe + SSE terminal
│   │   ├── SplitCartDrawer.tsx
│   │   ├── UnresolvedPanel.tsx
│   │   ├── ThemeToggle.tsx
│   │   └── Logo.tsx
│   ├── hooks/useAgentStream.ts
│   └── lib/
│       ├── ai-router.ts          # only AI Gateway caller
│       ├── tinyfish.ts           # only TinyFish SDK caller
│       ├── compare.ts            # Track A/B/C pipeline
│       ├── labs.ts               # Track D pipeline
│       ├── prescription.ts       # OCR orchestration
│       ├── optimizer.ts          # split-cart rules
│       ├── pricing.ts            # normalisation + strength guard
│       ├── rate-limit.ts         # per-IP budgets
│       ├── cache.ts              # in-memory TTL cache
│       ├── catalog.ts            # local typeahead catalog
│       ├── domains.ts            # portal registry
│       ├── demo-seed.ts          # labelled demo fixtures
│       ├── schedule.ts           # EN/HI dosing schedule
│       ├── schemas.ts            # zod contracts
│       ├── sse.ts / sse-client.ts
│       ├── compare-client.ts / agent-client.ts
│       └── env.ts / errors.ts / format.ts / urls.ts / pool.ts
└── tests/                        # 42 Vitest tests across 6 files
```

### Where to change what

| Goal | File |
| --- | --- |
| Add/rename a portal or lab | `src/lib/domains.ts` |
| Change pricing/normalisation rules | `src/lib/pricing.ts` |
| Change comparison stages | `src/lib/compare.ts`, `compare-stream/route.ts` |
| Change AI prompts/schemas | `src/lib/ai-router.ts`, `schemas.ts` |
| Change OCR behaviour | `src/lib/prescription.ts`, `api/ocr/route.ts` |
| Change rate limits | `src/lib/rate-limit.ts` |
| Change the savings UI | `src/components/SavingsReceipt.tsx` |
| Change provenance display | `src/components/DualTrackGrid.tsx` |
| Change share URL behaviour | `src/app/page.tsx`, `ShareLinkButton.tsx` |
| Change theme tokens | `src/app/globals.css` |

---

## 8. Tech stack

| Layer | Technology | Why |
| --- | --- | --- |
| Framework | Next.js 16 App Router, TypeScript | Server route handlers + React UI in one deployable; no separate backend |
| Styling | Tailwind CSS v4, custom `@theme` tokens | Fast, consistent dark/light clinical UI |
| Icons | lucide-react | Clear, lightweight iconography |
| AI | AI SDK v7 + zod v4, Vercel AI Gateway | Unified model routing, schema-validated outputs |
| Web execution | TinyFish SDK (Search / Fetch / Agent) | Real portal discovery + on-demand stealth-browser verification |
| Tests | Vitest 5 | Fast unit coverage for pricing, schedules, demo, optimizer, catalog, rate limits |
| Hosting | Vercel | Serverless route handlers, previews, production aliasing |
| Persistence | None (localStorage for settings) | No auth/database needed for the current scope |
| Caching | In-memory TTL | Simple, dependency-free; documented as per-instance |
| Rate limiting | In-memory fixed window | Protects paid routes without external infrastructure |

---

## 9. API reference

| Endpoint | Request | Response | Limit |
| --- | --- | --- | --- |
| `POST /api/compare` | `{query, pincode, type?}` | comparison object or lab comparison | 20/min shared |
| `POST /api/compare-stream` | same | SSE stages + final result | 20/min shared |
| `POST /api/ocr` | `{image_base64, mime_type}` or `{text}` | extracted text, medicines, salts, schedules, interactions | 6/min |
| `POST /api/docai` | `{messages:[...]}` ≤16 | reply + data source | 20/min |
| `POST /api/optimize-cart` | `{items, pincode}` | express/generic carts, totals, savings | 30/min |
| `POST /api/agent-stream` | `{kind, pincode, product_urls?}` | SSE `STARTED`/`STREAMING_URL`/`PROGRESS`/`COMPLETE` | 4/min |
| `POST /api/locate` | `{lat, lng}` | pincode/area/city/state/source | — |
| `GET /api/health` | — | mode, key status, demo lists (never model IDs) | — |
| `GET /api/suggest` | `?q=` | demo suggestions | — |

All AI/paid endpoints return a normalised 429 with `Retry-After` when over budget.

---

## 10. Domain rules and data semantics

### 10.1 Tracks

- **Track A:** PMBJP / Jan Aushadhi government benchmark.
- **Track B:** subsidised generic online pharmacies.
- **Track C:** branded express e-pharmacies.
- **Track D:** diagnostic labs.

### 10.2 Portal registry

- Branded: 1mg, PharmEasy, Apollo Pharmacy, Netmeds.
- Generic: SayaCare, Jan Aushadhi Online, Jan Aushadhi Store, APJ Jan Aushadhi, Zeelab, DavaIndia, Truemeds.
- Government: Jan Aushadhi master, UMANG kendra locator, AMRIT.
- Labs: Redcliffe, Lal PathLabs, Orange Health, Healthians.

### 10.3 Pricing semantics

- All medicine comparisons use `price_per_10_tabs_inr`.
- Pack parsing converts strips/packs to per-10-tablet units before comparison.
- The strength guard compares parsed salt strengths; mismatches are dropped.
- Savings receipt uses the cheapest strength-matched generic and a real branded reference from the same comparison.

### 10.4 Data source semantics

- `live`: produced from real portal/model calls in this request/cache window.
- `demo`: labelled fixtures; no LLM call in demo mode; never presented as live.
- `verified_by`: provenance string on offers; demo fixtures say so.
- `generated_at`: source of “as of …” freshness.

### 10.5 Privacy and persistence

- No database, auth, or user profile.
- No app-level image storage; uploaded prescriptions are processed in-request.
- Settings live in localStorage.
- API keys stay server-side in environment variables.

---

## 11. Trust, safety and guardrails

1. **Strength guard** — never compare a different strength.
2. **Per-10-tablet normalisation** — never compare raw pack prices.
3. **Live/demo honesty** — every response and UI surface labels the source.
4. **Provenance** — verification method, source host, NABL batch, freshness.
5. **No model IDs** — never exposed in UI, API responses or docs.
6. **Schema validation** — every AI value entering the app is zod-validated; one repair retry.
7. **Rate limits** — every paid/AI route guarded before body parsing.
8. **Medical safety** — disclaimers, no diagnosis, no dose changes, emergencies to 108/112.
9. **No checkout** — the agent only checks stock; purchases happen on the source site.
10. **Honest failures** — auto mode falls back to labelled demo; live mode surfaces errors.

---

## 12. Verified results and evidence

> These are snapshots from production/local testing, not guarantees. Live prices and latency vary.

### 12.1 Product proof

| Evidence | Result |
| --- | --- |
| Live search: Augmentin 625 Duo | 3 generic + 3 branded offers in the latest captured live run |
| Observed savings | 65.3% less than the branded reference; the receipt rounds this to 65% |
| Observed receipt | ~₹160 saved per 10-tablet strip; ~₹3.8k/year at 2 strips/month (projection) |
| Portal coverage in one run | 14 listings across 9 portals |
| Pipeline window | 8.8 s total in the captured run, with client-measured stage timings |
| Strength guard example | Dolo 650 run returned branded offers only because the generic listings failed the strength guard |
| Share link | `?q=Augmentin+625+Duo+Tablet&pin=110053` rehydrated and re-ran successfully |
| Rate limiting | 20 requests → 429 with `Retry-After` in production |
| OCR | ~27 s baseline → ~5–9 s local; 8.8 s production warm; correct medicines/salts |
| Cold start | First OCR after idle observed at ~20.3 s |

### 12.2 Engineering proof

- **42/42 Vitest tests** across 6 files: pricing, schedule, demo, optimizer, catalog, rate limits.
- **TypeScript typecheck:** clean.
- **Production build:** clean (Next.js 16).
- **Production browser smoke (external harness):** 17/17 checks, including empty state, example pills, live badge, real stage timings, savings receipt, provenance, copy link, share-link rehydration, and rate limiting.

### 12.3 What the numbers mean

- The savings figure is a comparison against a branded reference in the same live run — not a claim about every pharmacy or every city.
- The OCR timing improvement comes from disabling hidden reasoning on both OCR legs; quality was validated on clean printed prescriptions and should be spot-checked on handwriting.
- Rate limiting is best-effort per instance, not a distributed quota.

---

## 13. Differentiation

| Dimension | MedPulse AI |
| --- | --- |
| Matching unit | Active salt + strength, not just brand name |
| Price tracks | Government benchmark + generic + branded + labs in one view |
| Fairness | Per-10-tablet normalisation + hard strength guard |
| Trust | Provenance, freshness, live/demo labels, real stage timings |
| Prescription | Vision OCR + clinical structuring + bilingual schedule |
| Verification | On-demand live-agent stock checks and kendra lookup |
| Safety | Medical disclaimers, emergency routing, no checkout |
| Transparency | Shareable links, no black-box model IDs, schema-validated AI |
| Cost control | Rate limits + user-triggered agent + in-memory caching |

**Positioning:** not another pharmacy search, and not another health chatbot — a **transparent price-intelligence layer** that sits between a prescription and a purchase.

---

## 14. PPT generation brief

### 14.1 Deck parameters

- **Audience:** judges/investors/partners evaluating a technical healthcare product.
- **Length:** 10–12 slides (12 recommended).
- **Tone:** evidence-led, confident, honest; no hype or invented traction.
- **Aspect ratio:** 16:9.
- **Visual style:** near-black surfaces, blue accents (light blue `#0000ff` default, dark blue `#0041c2` hover), mono data labels; match the product’s dark clinical aesthetic. Use screenshots where possible.
- **Rule:** every number slide must cite “observed in a live run” or “measured in testing”.

### 14.2 12-slide outline

1. **Title** — MedPulse AI; “One search. Three price tracks. Real provenance.” Team names. Product URL/QR.
2. **The problem** — same salt, wildly different prices; fragmented portals; unfair pack comparisons; prescription friction; trust gap.
3. **The insight** — compare the active salt and strength, not the brand; normalise to 10 tablets; guard the dose.
4. **The product in one screen** — annotated dashboard screenshot: search, three tracks, savings receipt, provenance, timings.
5. **How it works** — simple two-wave architecture diagram: resolve → search/fetch → extract → guard → results; on-demand agent.
6. **The trust layer** — savings receipt, provenance chips, share links, real timings, honest empty state.
7. **Prescription intelligence** — photo → vision transcription → clinical structuring → EN/HI schedule + interactions; show the OCR result screenshot.
8. **Live verification** — PiP agent checking pincode stock and Jan Aushadhi kendras; “no checkout, no login”.
9. **Proof** — observed 65.3% savings, ~₹160/strip, 14 listings/9 portals; 42 tests; 17/17 production checks; OCR 27s → 5–9s. Caveat label.
10. **Safety & reliability** — strength guard, live/demo honesty, rate limits, schema validation, no model IDs, disclaimers.
11. **Differentiation & roadmap** — comparison table; roadmap: PWA/offline, voice EN/HI, OCR streaming, richer interaction checks, shared rate-limit store, more portals.
12. **Close** — “From prescription to fair price, with the receipts.” Links: production URL + repo. Thank you.

### 14.3 Visual asset checklist

| Asset | Location / action |
| --- | --- |
| Brand icon | `src/app/icon.svg`, `src/app/icon.png` |
| Apple icon | `src/app/apple-icon.png` |
| Social card | `src/app/opengraph-image.png` |
| Logo lockup | Render from `src/components/Logo.tsx` or screenshot the navbar |
| Welcome hero | `docs/screenshots/00-welcome-dark.png` + `00-welcome-light.png` (captured) |
| Dashboard empty state | `docs/screenshots/01-empty-dark.png` (captured) |
| Live results + savings receipt | `docs/screenshots/02-results-dark.png` + `03-receipt-dark.png` (captured from a live Augmentin 625 Duo run) |
| OCR result | `docs/screenshots/04-ocr-dark.png` (captured from a live OCR run) |
| Agent PiP | Pending — capture as `05-agent-pip-dark.png` from a user-triggered stock run |
| Share link | Pending — capture as `08-share-light.png` |
| Light theme | `docs/screenshots/06-empty-light.png` (captured) |
| Palette hover | `docs/screenshots/07-hover-dark.png` (captured; dark-blue hover `#0041c2`) |
| Architecture diagram | Recreate from §6.1; keep it to 5 boxes + 2 arrows |

> Final deck captures belong in `docs/screenshots/` — see its README for the capture standard and planned filenames. Use fresh 1440px captures after the blue palette update. Earlier smoke screenshots in `C:\Users\Administrator\AppData\Local\Temp\opencode\medpulse-e2e\` predate the palette change; do not use them in the final deck.

### 14.4 Claims to use / avoid

**Use:**

- “Observed 65.3% lower than the branded reference in a live run.”
- “42 automated tests; 17/17 production browser checks.”
- “Structured prescription output with an English + Hindi schedule.”
- “Strength-guarded, per-10-tablet comparison.”
- “Live and demo data are always labelled.”

**Avoid:**

- Any model name or model ID.
- “Guaranteed savings”, “always cheapest”, “FDA/CE certified”, “clinically proven”.
- Invented user counts, revenue, funding, partnerships, or city coverage.
- “Sub-3-second” or any fixed latency claim.
- “PWA” or “offline-capable” (not implemented).
- “Replaces a doctor/pharmacist”.
- Claiming rate limits are distributed/global.

### 14.5 Ready-to-paste PPT agent prompt

```text
Create a 12-slide, 16:9 pitch deck for MedPulse AI using ONLY the attached
docs/MASTER_SPEC.md as the source of truth. Follow the 12-slide outline in §14.2
and the tone/claims rules in §14.1–§14.4.

Key constraints:
- Never mention AI model names or model IDs. Say "vision model" / "clinical text model".
- Never invent metrics, customers, revenue, funding, partnerships or clinical claims.
- Label every performance/savings number as "observed in a live run" or "measured in testing".
- Do not claim PWA/offline support, guarantees, or regulatory certification.
- Use the product's dark clinical aesthetic: near-black surfaces, blue accents
  (light blue #0000ff default, dark blue #0041c2 on hover), Geist-style sans for
  headings, JetBrains Mono for data labels.
- Include the strength guard, per-10-tablet normalisation, live/demo honesty,
  provenance, savings receipt, shareable links and real stage timings.
- Use screenshots for the product and OCR slides; keep diagrams minimal.
- End with the production URL and repo link.
Return an editable deck outline first, then the slide-by-slide copy and visual notes.
```

---

## 15. Demo script (5 minutes)

**Pre-demo checklist**

1. Warm the OCR endpoint with one throwaway scan (first call after idle can be slow).
2. Confirm the production deployment is live and the pincode is 110053 (or the demo city).
3. Clear the browser console; keep one tab on the dashboard.
4. Have a prescription image ready; avoid sensitive real patient data.
5. Know the fallback: if live fails, the app labels demo data honestly — do not hide it.

**Flow**

1. **Empty state (20 s):** show the three tracks and example pills; explain “real stages, no fake progress”.
2. **Search Augmentin 625 Duo (90 s):** run it; narrate the real stage panel; point out the strength guard.
3. **Results + receipt (60 s):** show per-10-tablet prices, savings receipt, provenance, freshness.
4. **Share (20 s):** copy the link; open it in a new tab; show it rehydrates.
5. **Prescription OCR (60 s):** upload the image; show medicines, salts, EN/HI schedule, disclaimer.
6. **Agent (45 s):** trigger a stock check; show the PiP stream; note “no login, no checkout”.
7. **Close (25 s):** recap the trust layer, 42 tests, 17/17 checks; point to the repo and production URL.

---

## 16. Roadmap

**Near term**

- Installable PWA: web manifest + service worker + offline last-result cache (not implemented today).
- OCR streaming/progress and a confidence/review step for handwritten prescriptions.
- Voice search in English and Hindi.
- Richer interaction checks and pharmacist-review guidance.
- Price history and alerting for chronic medicines.

**Platform**

- Shared rate-limit/cache store (Vercel KV/Redis) for multi-instance correctness.
- More generic/lab portals and city-level stock coverage.
- Structured feedback loop for strength-guard edge cases.

**Explicitly out of scope today**

- Accounts/auth, checkout, order fulfilment, insurance claims, diagnosis.
- Distributed rate limiting or a persistent database.

---

## 17. Glossary

| Term | Meaning |
| --- | --- |
| **Salt** | Active pharmaceutical ingredient(s) in a medicine, e.g. paracetamol. |
| **Strength** | Dose per unit, e.g. 650 mg. |
| **PMBJP / Jan Aushadhi** | Government generic-medicine programme and its price benchmark. |
| **Track A/B/C/D** | Government benchmark / subsidised generics / branded express / labs. |
| **Per-10-tablet price** | Normalised price used to compare packs fairly. |
| **Strength guard** | Rule that rejects listings whose strength does not match the query. |
| **Wave 1** | Always-on search/fetch/extract pipeline; no TinyAgent spend. |
| **Wave 2** | User-triggered TinyAgent stealth-browser verification. |
| **PiP** | Picture-in-picture dock showing the live agent browser. |
| **Provenance** | Evidence of how a price was obtained and when. |
| **Live / demo** | Real data vs clearly labelled fixtures. |
| **NABL** | Indian accreditation for testing/calibration labs. |

---

## 18. Documentation map

| Document | What it covers |
| --- | --- |
| `README.md` | Quick start, environment, rate limits, API, architecture summary, verification, deployment, security |
| `AGENTS.md` | Strict engineering rules, dual-model routing, TinyFish cost controls, repo conventions, UI guardrails |
| `DESIGN.md` | Visual system, palette, typography, components, trust-surface conventions |
| `docs/MASTER_SPEC.md` | This document: full product/engineering spec + PPT generation brief |
| `docs/screenshots/` | Final deck captures, capture standard and pending-shot checklist |
| `src/lib/schemas.ts` | Machine-readable API and AI contracts |
| `tests/` | Unit tests for pricing, schedules, demo, optimizer, catalog, rate limits |

**Source-of-truth order for PPT claims:** live code + `docs/MASTER_SPEC.md` → `README.md` → `AGENTS.md` → `DESIGN.md`. If a number is not in the spec or verified by a run, do not put it on a slide.
