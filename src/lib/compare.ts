/**
 * Live dual-track comparison pipeline — Wave 1 (PRD §4/§5).
 *
 * Track A: PMBJP / Jan Aushadhi official benchmark (local master, live later)
 * Track B: subsidised generics online  (query = active salt, strength-guarded)
 * Track C: branded express            (query = brand name, pincode-verified later)
 *
 * Every external call is guarded; any failure falls back to labelled demo data
 * in auto mode and surfaces a clear error in live mode.
 */
import { extractOffersBatch, resolveSalt, suggestFromSearchResults } from "./ai-router";
import { cacheGet, cacheSet } from "./cache";
import { amritAlertFor, compareDemo, findMedicine, kendrasFor, medicineNames } from "./demo-seed";
import { BRANDED_DOMAINS, GENERIC_DOMAINS, categoryFor, domainOf, platformFor } from "./domains";
import { env, hasGateway, hasTinyFish, liveCompareEnabled } from "./env";
import { ApiError, assertLiveConfig, describeError } from "./errors";
import { runPool } from "./pool";
import {
  discountPct,
  normalizeName,
  parsePackSize,
  parseStrengths,
  per10Tabs,
  perTab,
  savingsPct,
  strengthOk,
} from "./pricing";
import type { AiOffer, AlternativeSuggestion, CompareStage, DualTrackComparison, Offer, SafetyTip } from "./schemas";
import { tfFetch, tfSearch, type FetchPage } from "./tinyfish";
import { cleanUrls } from "./urls";
import { dedupe } from "./urls";

const EXTRACT_CACHE_TTL = 3600;
const NABL_DOMAINS = new Set(["sayacare.in", "janaushadhi.gov.in"]);

/** Empty-result pipeline failures where alternatives are more useful than a dead end. */
const SUGGEST_ERRORS = new Set(["no_listings_found", "no_offers_extracted", "fetch_failed"]);

export type CompareOptions = {
  query: string;
  pincode: string;
  sessionId?: string;
  /** Real pipeline progress for the SSE route — never simulated. */
  onProgress?: (stage: CompareStage) => void;
};

type Report = (stage: CompareStage) => void;

/* ----------------------------------------------------------- entrypoint */

export async function compareMedicines(opts: CompareOptions): Promise<DualTrackComparison> {
  const { query, pincode, onProgress: report } = opts;
  if (env.mode() === "live") {
    assertLiveConfig(["tinyfish", "gateway"], { tinyfish: hasTinyFish(), gateway: hasGateway() });
  }
  const live = liveCompareEnabled();
  const cacheKey = `cmp:${live ? "live" : "demo"}:${normalizeName(query)}:${pincode}`;
  const cached = cacheGet<DualTrackComparison>(cacheKey);
  if (cached) {
    report?.({ step: "cache", label: "Serving from 1-hour result cache", status: "done" });
    return cached;
  }

  if (!live) {
    report?.({ step: "resolve", label: "Resolving query (demo fixtures)", status: "start" });
    const demo = compareDemo(query, pincode);
    if (!demo) {
      throw new ApiError(404, {
        error: "unknown_medicine_in_demo_mode",
        message:
          `Demo mode knows: ${medicineNames().join(", ")}. ` +
          "Add both API keys to .env.local (see .env.example) to look up anything else live.",
      });
    }
    report?.({
      step: "resolve",
      label: "Resolving query (demo fixtures)",
      status: "done",
      detail: "labelled demo data — no live calls",
    });
    cacheSet(cacheKey, demo);
    return demo;
  }

  let result: DualTrackComparison;
  try {
    result = await compareLive(query, pincode, report);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) throw e;
    const reason = describeError(e);
    const suggestable = e instanceof ApiError && SUGGEST_ERRORS.has(e.payload.error);
    const demo = env.mode() === "live" ? null : compareDemo(query, pincode);
    if (demo) {
      demo.notes.unshift(`Live lookup failed: ${reason}. Showing DEMO data.`);
      result = demo;
    } else if (suggestable) {
      // No usable offers/price — don't dead-end: search and suggest real alternatives.
      return unresolvedResult(
        query,
        pincode,
        [`No usable live price could be extracted (${reason}).`],
        report,
        `No reliable live price was found for "${query}" — searched the tracked portals for similar medicines.`,
      );
    } else if (env.mode() === "live") {
      throw e instanceof ApiError ? e : new ApiError(502, { error: "upstream_failure", message: reason });
    } else {
      throw new ApiError(502, {
        error: "live_lookup_failed",
        message: `Live lookup failed (${reason}) and there is no demo entry for "${query}".`,
      });
    }
  }
  if (result.status !== "unresolved" && !result.notes.some((n) => n.toLowerCase().startsWith("incomplete"))) {
    cacheSet(cacheKey, result);
  }
  return result;
}

/* --------------------------------------------------------- live pipeline */

type SaltInfo = {
  brand: string;
  manufacturer: string | null;
  salt: string;
  strengths: Set<number>;
  pack: number;
  drugCode: string | null;
  mrpPerPack: number | null;
  ceilingPer10: number | null;
  refPer10: number | null;
  local: boolean;
  frequency: string | null;
  safety: SafetyTip | null;
};

async function resolveQuery(query: string): Promise<SaltInfo | null> {
  const local = findMedicine(query);
  if (local) {
    return {
      brand: local.brand,
      manufacturer: local.manufacturer,
      salt: local.salt,
      strengths: parseStrengths(local.salt),
      pack: local.pack_size,
      drugCode: local.drug_code,
      mrpPerPack: local.branded_mrp,
      ceilingPer10: local.pmbjp_ceiling_per10,
      refPer10: per10Tabs(local.branded_mrp, local.pack_size),
      local: true,
      frequency: local.typical_frequency,
      safety: local.safety_tip,
    };
  }
  const resolved = await resolveSalt(query);
  if (!resolved.is_medicine) return null;
  const salt = resolved.active_salt ?? (resolved.salts.length ? resolved.salts.join(" + ") : null);
  if (!salt) return null;
  const strengths = parseStrengths(resolved.strengths.join(" "));
  return {
    brand: resolved.brand_name ?? query,
    manufacturer: resolved.manufacturer,
    salt,
    strengths,
    pack: resolved.typical_pack_size && resolved.typical_pack_size > 0 ? resolved.typical_pack_size : 10,
    drugCode: null,
    mrpPerPack: null,
    ceilingPer10: null,
    refPer10: null,
    local: false,
    frequency: null,
    safety: null,
  };
}

async function compareLive(query: string, pincode: string, report?: Report): Promise<DualTrackComparison> {
  const notes: string[] = [];
  report?.({ step: "resolve", label: "Decoding to the active salt", status: "start" });
  const saltInfo = await resolveQuery(query);
  if (!saltInfo) {
    report?.({
      step: "resolve",
      label: "Decoding to the active salt",
      status: "done",
      detail: `"${query}" was not recognised as a medicine brand or salt — searching alternatives`,
    });
    return unresolvedResult(query, pincode, notes, report);
  }
  report?.({
    step: "resolve",
    label: "Decoding to the active salt",
    status: "done",
    detail: `${saltInfo.salt} · ${saltInfo.local ? "PMBJP local master" : "AI salt decode"}`,
  });

  // 1) Discover listings on both tracks in parallel.
  report?.({
    step: "search",
    label: "Searching generic + branded pharmacy networks",
    status: "start",
    detail: `Track B generics for "${saltInfo.salt}" · Track C branded for "${saltInfo.brand}"`,
  });
  const genericQuery = `${saltInfo.salt} tablets price strip`;
  const brandedQuery = `${saltInfo.brand} ${saltInfo.manufacturer ?? ""} price`.trim();
  const [genericHits, brandedHits] = await Promise.all([
    tfSearch(genericQuery, GENERIC_DOMAINS, `Find subsidised generic listings of ${saltInfo.salt} for price comparison in India`),
    tfSearch(brandedQuery, BRANDED_DOMAINS, `Find branded pack listings of ${saltInfo.brand} for price comparison in India`),
  ]);
  const urls = dedupe([...cleanUrls(brandedHits, BRANDED_DOMAINS), ...cleanUrls(genericHits, GENERIC_DOMAINS)]);
  if (urls.length === 0) {
    report?.({ step: "search", label: "Searching generic + branded pharmacy networks", status: "done", detail: "no usable listings found" });
    throw new ApiError(502, { error: "no_listings_found", message: "Search returned no usable listings across the tracked portals." });
  }
  notes.push(`TinySearch found ${urls.length} listings across ${new Set(urls.map(domainOf)).size} portals.`);
  report?.({
    step: "search",
    label: "Searching generic + branded pharmacy networks",
    status: "done",
    detail: `${urls.length} listings across ${new Set(urls.map(domainOf)).size} portals`,
  });

  // 2) Fetch page content (markdown, server-side, cached for 1h).
  report?.({ step: "fetch", label: "Fetching listing pages (TinyFetch, 1h cache)", status: "start" });
  const { pages, errors } = await tfFetch(urls, `Extract price, pack size and strength for ${saltInfo.salt}`);
  if (errors.length) notes.push(`${errors.length} page fetch(es) failed (${errors.slice(0, 2).map((e) => e.url).join(", ")}…).`);
  if (pages.length === 0) {
    report?.({ step: "fetch", label: "Fetching listing pages (TinyFetch, 1h cache)", status: "done", detail: "all pages failed to fetch" });
    throw new ApiError(502, { error: "fetch_failed", message: "All tracked listings failed to fetch." });
  }
  report?.({
    step: "fetch",
    label: "Fetching listing pages (TinyFetch, 1h cache)",
    status: "done",
    detail: `${pages.length} pages fetched${errors.length ? `, ${errors.length} failed` : ""}`,
  });

  // 3) Structured extraction (one call per 5 pages, 2 in flight, per-URL cache).
  report?.({
    step: "extract",
    label: "Extracting prices with AI",
    status: "start",
    detail: `${pages.length} page(s) in batches of 5`,
  });
  const { byIndex, failedBatches } = await extractPages(pages, saltInfo.brand, saltInfo.salt);
  if (failedBatches > 0) notes.push(`Incomplete extraction: ${failedBatches} AI batch(es) failed — result not cached.`);
  report?.({
    step: "extract",
    label: "Extracting prices with AI",
    status: "done",
    detail: failedBatches > 0 ? `${failedBatches} batch(es) failed` : "all batches parsed",
  });

  // 4) Assemble, strength-guard, verify NABL.
  report?.({ step: "guard", label: "Strength guard + NABL verification", status: "start" });
  const { offers, drops } = buildOffers(pages, byIndex, saltInfo, notes);
  if (offers.length === 0) {
    report?.({
      step: "guard",
      label: "Strength guard + NABL verification",
      status: "done",
      detail: "no trustworthy price found — searching similar products",
    });
    throw new ApiError(502, {
      error: "no_offers_extracted",
      message: "Listings were fetched but no trustworthy price could be extracted.",
    });
  }
  await verifyNabl(offers);
  const genericCount = offers.filter((o) => o.category !== "branded").length;
  report?.({
    step: "guard",
    label: "Strength guard + NABL verification",
    status: "done",
    detail: `${genericCount} generic + ${offers.length - genericCount} branded offers kept`,
  });
  return assemble(saltInfo, pincode, offers, notes, drops);
}

/* ----------------------------------------------- unresolved suggestions */

/**
 * The query didn't decode to a salt — instead of a dead end, search the
 * tracked portals for the raw query and let the text model pick the most
 * plausible real products (names must come from the search results).
 */
async function unresolvedResult(
  query: string,
  pincode: string,
  notes: string[],
  report?: Report,
  firstNote = `"${query}" could not be decoded to an active salt.`,
): Promise<DualTrackComparison> {
  report?.({ step: "suggest", label: "Searching similar products on tracked portals", status: "start" });
  let suggestions: AlternativeSuggestion[] = [];
  let portalCount = 0;
  let rawCount = 0;
  try {
    const domains = [...BRANDED_DOMAINS, ...GENERIC_DOMAINS];
    const hits = await tfSearch(
      `${query} tablet medicine`,
      domains,
      `Find medicines similar to "${query}" — the user's query could not be decoded to a salt`,
    );
    const candidates = hits.slice(0, 16);
    rawCount = candidates.length;
    portalCount = new Set(candidates.map((h) => h.site)).size;
    if (candidates.length > 0) {
      const ai = await suggestFromSearchResults({
        query,
        candidates: candidates.map((h) => ({ title: h.title, snippet: h.snippet, site: h.site })),
      });
      if (ai.is_medicine) {
        suggestions = ai.suggestions
          .slice(0, 4)
          .map((s) => ({ name: s.name.trim(), reason: s.reason ?? null }))
          .filter((s) => s.name.length >= 2);
      }
    }
  } catch {
    /* suggestions are best-effort — the honest note below still shows */
  }
  notes.unshift(firstNote);
  if (rawCount > 0) notes.push(`TinySearch found ${rawCount} raw results on ${portalCount} portals for "${query}".`);
  if (suggestions.length) notes.push("Pick the closest match below, or type the exact brand / generic name.");
  else notes.push("No similar medicine was found on the tracked portals — try the exact brand or generic name.");
  report?.({
    step: "suggest",
    label: "Searching similar products on tracked portals",
    status: "done",
    detail: suggestions.length
      ? `${suggestions.length} reliable pick(s) from ${portalCount} portals`
      : "no similar products found",
  });
  return {
    query_brand: query,
    active_salt: "",
    user_pincode: pincode,
    govt_benchmark: null,
    subsidised_generic_online: [],
    branded_express_online: [],
    amrit_hospital_alert: null,
    branded_reference_mrp_inr: null,
    branded_reference_per_10_tabs_inr: null,
    best_savings_percent: 0,
    safety_tip: null,
    data_source: "live",
    notes,
    generated_at: new Date().toISOString(),
    status: "unresolved",
    suggestions,
  };
}

/* ------------------------------------------------------------- extraction */

type ExtractResult = { byIndex: Map<number, AiOffer[]>; failedBatches: number };

async function extractPages(pages: FetchPage[], target: string, salt: string): Promise<ExtractResult> {
  const byIndex = new Map<number, AiOffer[]>();
  const missing: { page: FetchPage; idx: number }[] = [];
  pages.forEach((page, idx) => {
    const hit = cacheGet<AiOffer[]>(`x:${page.url}`);
    if (hit) byIndex.set(idx, hit);
    else missing.push({ page, idx });
  });

  const BATCH = 5;
  const chunks: { page: FetchPage; idx: number }[][] = [];
  for (let i = 0; i < missing.length; i += BATCH) chunks.push(missing.slice(i, i + BATCH));

  let failedBatches = 0;
  const results = await runPool(
    chunks.map((chunk) => async () => ({
      chunk,
      map: await extractOffersBatch(chunk.map((c) => c.page), target, salt),
    })),
    2,
  );
  for (const r of results) {
    if (r.status === "rejected") {
      failedBatches += 1;
      continue;
    }
    const { chunk, map } = r.value;
    chunk.forEach((item, i) => {
      const offers = map.get(i + 1) ?? [];
      byIndex.set(item.idx, offers);
      cacheSet(`x:${item.page.url}`, offers, EXTRACT_CACHE_TTL);
    });
  }
  return { byIndex, failedBatches };
}

/* ---------------------------------------------------------------- offers */

type DropStats = { noPrice: number; offTarget: number };

function emptyDrops(): DropStats {
  return { noPrice: 0, offTarget: 0 };
}

/** Human-readable reason list for skipped listings (shown when a track is empty). */
function dropDetail(d: DropStats): string {
  const parts: string[] = [];
  if (d.noPrice) parts.push(`${d.noPrice} without a shown price`);
  if (d.offTarget) parts.push(`${d.offTarget} off-target`);
  return parts.length ? ` (skipped: ${parts.join(", ")})` : "";
}

function buildOffers(
  pages: FetchPage[],
  byIndex: Map<number, AiOffer[]>,
  saltInfo: SaltInfo,
  notes: string[],
): { offers: Offer[]; drops: { branded: DropStats; generic: DropStats } } {
  const offers: Offer[] = [];
  const filtered: string[] = [];
  const drops = { branded: emptyDrops(), generic: emptyDrops() };
  for (const [idx, page] of pages.entries()) {
    const bucket = categoryFor(page.url) === "branded" ? drops.branded : drops.generic;
    for (const a of byIndex.get(idx) ?? []) {
      if (!a.is_target_product) {
        bucket.offTarget += 1;
        continue;
      }
      if (a.price_inr == null || a.price_inr <= 0) {
        bucket.noPrice += 1;
        continue;
      }
      const text = [a.product_name, a.strength_text].filter(Boolean).join(" ");
      const check = strengthOk(saltInfo.strengths, text);
      if (!check.ok) {
        filtered.push(`${a.product_name ?? page.url}: ${check.why}`);
        continue;
      }
      const pack =
        a.pack_size_units && a.pack_size_units >= 1 && a.pack_size_units <= 200
          ? a.pack_size_units
          : parsePackSize(a.product_name ?? page.title);
      offers.push({
        platform: platformFor(page.url),
        category: categoryFor(page.url),
        product_name: a.product_name ?? page.title ?? page.url,
        manufacturer: a.manufacturer,
        badges: [],
        mrp_inr: a.mrp_inr,
        price_inr: a.price_inr,
        pack_size: pack,
        price_per_10_tabs_inr: per10Tabs(a.price_inr, pack),
        price_per_tab_inr: perTab(a.price_inr, pack),
        discount_percent: discountPct(a.mrp_inr, a.price_inr),
        savings_vs_branded_percent: 0,
        nabl_lab_report_verified: false,
        nabl_batch_id: null,
        nabl_report_url: a.nabl_report_url,
        equivalence_percent: null,
        delivery_eta: "Run agent to verify",
        eta_minutes: null,
        in_stock: null,
        stock_note: null,
        verified_by: "TinyFetch",
        product_url: page.url,
      });
    }
  }
  if (filtered.length) {
    notes.push(`Strength guard filtered ${filtered.length} wrong-strength listing(s): ${filtered.slice(0, 2).join(" | ")}`);
  }
  return { offers, drops };
}

/* ------------------------------------------------------------ NABL check */

async function verifyNabl(offers: Offer[]): Promise<void> {
  const candidates = offers.filter((o) => o.nabl_report_url && NABL_DOMAINS.has(domainOf(o.nabl_report_url)));
  if (candidates.length === 0) return;
  const urls = dedupe(candidates.map((o) => o.nabl_report_url as string));
  const { pages } = await tfFetch(urls, "Check for NABL accreditation statements and batch identifiers in lab-report PDFs", 86_400);
  for (const offer of candidates) {
    const url = offer.nabl_report_url as string;
    const page = pages.find((p) => sameUrlLoose(p.url, url));
    if (!page) continue;
    if (/nabl/i.test(page.text)) {
      offer.nabl_lab_report_verified = true;
      offer.nabl_batch_id = extractBatchId(page.text);
    }
  }
}

function sameUrlLoose(a: string, b: string): boolean {
  const norm = (u: string) => u.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "").toLowerCase();
  return norm(a) === norm(b);
}

function extractBatchId(text: string): string | null {
  const m = /batch\s*(?:no\.?|number|id)?\s*[:\-]?\s*([A-Z0-9\-\/]{4,24})/i.exec(text);
  return m?.[1] ?? null;
}

/* --------------------------------------------------------------- assemble */

function assemble(
  saltInfo: SaltInfo,
  pincode: string,
  offers: Offer[],
  notes: string[],
  drops: { branded: DropStats; generic: DropStats },
): DualTrackComparison {
  const generics = offers.filter((o) => o.category !== "branded");
  const branded = offers.filter((o) => o.category === "branded");
  const brandedRefs = branded.map((o) => o.price_per_10_tabs_inr).filter((n) => n > 0);
  const liveRef = brandedRefs.length ? Math.max(...brandedRefs) : null;
  const reference = [saltInfo.refPer10, liveRef].filter((n): n is number => n != null && n > 0);
  const refPer10 = reference.length ? Math.max(...reference) : null;

  for (const o of offers) o.savings_vs_branded_percent = savingsPct(refPer10, o.price_per_10_tabs_inr);
  generics.sort((a, b) => a.price_per_10_tabs_inr - b.price_per_10_tabs_inr);
  branded.sort((a, b) => a.price_inr - b.price_inr);

  if (generics.length === 0) notes.push("No subsidised generic listing passed the strength guard — branded offers only." + dropDetail(drops.generic));
  if (branded.length === 0) notes.push("No branded listing matched — showing generics only." + dropDetail(drops.branded));
  notes.push("Delivery ETAs and pincode stock are verified on demand with the live browser agent.");

  const kendras = kendrasFor(pincode, 1);
  const priced = offers.map((o) => o.price_inr);
  return {
    query_brand: saltInfo.brand,
    active_salt: saltInfo.salt,
    user_pincode: pincode,
    govt_benchmark:
      saltInfo.local && saltInfo.drugCode != null && saltInfo.ceilingPer10 != null
        ? {
            scheme: "PMBJP Jan Aushadhi Official Benchmark",
            drug_code: saltInfo.drugCode,
            official_mrp_per_10_tabs_inr: saltInfo.ceilingPer10,
            bioequivalence_index_percent: 98.9,
            certification: "WHO-GMP Certified",
            nearest_walk_in_kendra: kendras[0] ?? null,
          }
        : null,
    subsidised_generic_online: generics,
    branded_express_online: branded,
    amrit_hospital_alert: priced.length ? amritAlertFor(saltInfo.brand, Math.max(...priced)) : null,
    branded_reference_mrp_inr: saltInfo.mrpPerPack ?? (branded.find((o) => o.mrp_inr != null)?.mrp_inr ?? null),
    branded_reference_per_10_tabs_inr: refPer10,
    best_savings_percent: generics.length ? Math.max(0, ...generics.map((o) => o.savings_vs_branded_percent)) : 0,
    safety_tip: saltInfo.safety,
    data_source: "live",
    notes,
    generated_at: new Date().toISOString(),
  };
}
