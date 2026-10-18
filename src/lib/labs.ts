/**
 * Track D — diagnostic lab test price comparison (PRD §4, Wave 1 #4).
 * Same search → fetch → structured-extraction pipeline as medicines, but
 * scoped to LAB_DOMAINS and priced per package with at-home collection info.
 */
import { extractLabsBatch } from "./ai-router";
import { cacheGet, cacheSet } from "./cache";
import { LAB_TESTS, labNames, labsDemo } from "./demo-seed";
import { LAB_DOMAINS, LAB_PLATFORM_NAMES, domainOf } from "./domains";
import { env, hasGateway, hasTinyFish, liveCompareEnabled } from "./env";
import { ApiError, assertLiveConfig, describeError } from "./errors";
import { runPool } from "./pool";
import { discountPct, normalizeName } from "./pricing";
import type { AiLab, CompareStage, LabComparison, LabOffer } from "./schemas";
import { tfFetch, tfSearch, type FetchPage } from "./tinyfish";
import { cleanUrls, dedupe } from "./urls";

export async function compareLabs(opts: {
  query: string;
  pincode: string;
  /** Real pipeline progress for the SSE route — never simulated. */
  onProgress?: (stage: CompareStage) => void;
}): Promise<LabComparison> {
  const { query, pincode, onProgress: report } = opts;
  if (env.mode() === "live") {
    assertLiveConfig(["tinyfish", "gateway"], { tinyfish: hasTinyFish(), gateway: hasGateway() });
  }
  const live = liveCompareEnabled();
  const cacheKey = `labs:${live ? "live" : "demo"}:${normalizeName(query)}:${pincode}`;
  const cached = cacheGet<LabComparison>(cacheKey);
  if (cached) {
    report?.({ step: "cache", label: "Serving from 1-hour result cache", status: "done" });
    return cached;
  }

  if (!live) {
    const demo = labsDemo(query, pincode);
    if (!demo) {
      throw new ApiError(404, {
        error: "unknown_test_in_demo_mode",
        message: `Demo mode knows: ${labNames().join(", ")}. Add both API keys to .env.local to look up anything else live.`,
      });
    }
    report?.({ step: "resolve", label: "Lab query (demo fixtures)", status: "done", detail: "labelled demo data — no live calls" });
    cacheSet(cacheKey, demo);
    return demo;
  }

  let result: LabComparison;
  try {
    result = await compareLabsLive(query, pincode, report);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) throw e;
    const reason = describeError(e);
    if (env.mode() === "live") {
      throw e instanceof ApiError ? e : new ApiError(502, { error: "upstream_failure", message: reason });
    }
    const demo = labsDemo(query, pincode);
    if (!demo) {
      throw new ApiError(502, {
        error: "live_lookup_failed",
        message: `Live lab lookup failed (${reason}) and there is no demo entry for "${query}".`,
      });
    }
    demo.notes.unshift(`Live lookup failed: ${reason}. Showing DEMO data.`);
    result = demo;
  }
  if (!result.notes.some((n) => n.toLowerCase().startsWith("incomplete"))) cacheSet(cacheKey, result);
  return result;
}

async function compareLabsLive(query: string, pincode: string, report?: (stage: CompareStage) => void): Promise<LabComparison> {
  const notes: string[] = [];
  report?.({ step: "search", label: "Searching diagnostic lab networks", status: "start" });
  const hits = await tfSearch(`${query} price at home collection`, LAB_DOMAINS, `Compare ${query} prices across Indian diagnostic labs`);
  const urls = cleanUrls(hits, LAB_DOMAINS, 2, 8);
  if (urls.length === 0) {
    throw new ApiError(502, { error: "no_listings_found", message: "Search returned no usable lab listings." });
  }
  notes.push(`TinySearch found ${urls.length} lab listings across ${new Set(urls.map(domainOf)).size} labs.`);
  report?.({
    step: "search",
    label: "Searching diagnostic lab networks",
    status: "done",
    detail: `${urls.length} listings across ${new Set(urls.map(domainOf)).size} labs`,
  });

  report?.({ step: "fetch", label: "Fetching lab package pages", status: "start" });
  const { pages, errors } = await tfFetch(urls, `Extract package price, included parameters and earliest home-collection slot for ${query}`);
  if (errors.length) notes.push(`${errors.length} page fetch(es) failed.`);
  if (pages.length === 0) throw new ApiError(502, { error: "fetch_failed", message: "All lab listings failed to fetch." });
  report?.({
    step: "fetch",
    label: "Fetching lab package pages",
    status: "done",
    detail: `${pages.length} pages fetched${errors.length ? `, ${errors.length} failed` : ""}`,
  });

  report?.({ step: "extract", label: "Extracting package prices with AI", status: "start" });
  const { byIndex, failedBatches } = await extractLabs(pages, query);
  if (failedBatches > 0) notes.push(`Incomplete extraction: ${failedBatches} AI batch(es) failed — result not cached.`);
  report?.({
    step: "extract",
    label: "Extracting package prices with AI",
    status: "done",
    detail: failedBatches > 0 ? `${failedBatches} batch(es) failed` : "all batches parsed",
  });

  const offers: LabOffer[] = [];
  for (const [idx, page] of pages.entries()) {
    const domain = domainOf(page.url);
    for (const a of byIndex.get(idx) ?? []) {
      if (!a.is_target_test || a.price_inr == null || a.price_inr <= 0) continue;
      offers.push({
        platform: LAB_PLATFORM_NAMES[domain] ?? page.title ?? domain,
        lab: LAB_PLATFORM_NAMES[domain] ?? domain,
        test_name: a.test_name ?? query,
        price_inr: a.price_inr,
        mrp_inr: a.mrp_inr,
        discount_percent: discountPct(a.mrp_inr, a.price_inr),
        parameters: a.parameters,
        turnaround: a.turnaround,
        earliest_slot: a.earliest_slot,
        home_collection: a.home_collection,
        product_url: page.url,
        verified_by: "TinyFetch",
      });
    }
  }
  if (offers.length === 0) {
    throw new ApiError(502, { error: "no_offers_extracted", message: "Lab pages were fetched but no usable price could be extracted." });
  }
  offers.sort((a, b) => a.price_inr - b.price_inr);
  report?.({
    step: "guard",
    label: "Assembling lab comparison",
    status: "done",
    detail: `${offers.length} priced package(s) kept`,
  });
  const best = offers[0].price_inr;
  const highest = Math.max(...offers.map((o) => o.price_inr));
  return {
    query,
    pincode,
    offers,
    best_price_inr: best,
    highest_price_inr: highest,
    best_savings_percent: highest > 0 ? Math.round(((highest - best) / highest) * 1000) / 10 : 0,
    data_source: "live",
    notes,
    generated_at: new Date().toISOString(),
  };
}

async function extractLabs(pages: FetchPage[], target: string): Promise<{ byIndex: Map<number, AiLab[]>; failedBatches: number }> {
  const byIndex = new Map<number, AiLab[]>();
  const missing: { page: FetchPage; idx: number }[] = [];
  pages.forEach((page, idx) => {
    const hit = cacheGet<AiLab[]>(`lx:${page.url}`);
    if (hit) byIndex.set(idx, hit);
    else missing.push({ page, idx });
  });
  const BATCH = 5;
  const chunks: { page: FetchPage; idx: number }[][] = [];
  for (let i = 0; i < missing.length; i += BATCH) chunks.push(missing.slice(i, i + BATCH));
  let failedBatches = 0;
  const results = await runPool(
    chunks.map((chunk) => async () => ({ chunk, map: await extractLabsBatch(chunk.map((c) => c.page), target) })),
    2,
  );
  for (const r of results) {
    if (r.status === "rejected") {
      failedBatches += 1;
      continue;
    }
    r.value.chunk.forEach((item, i) => {
      const labs = r.value.map.get(i + 1) ?? [];
      byIndex.set(item.idx, labs);
      cacheSet(`lx:${item.page.url}`, labs, 3600);
    });
  }
  return { byIndex, failedBatches };
}

/** Labs that exist in demo mode — handy for the UI quick-pills. */
export const demoLabTests = LAB_TESTS.map((t) => t.test);
