/**
 * Price normalisation and listing guards — behaviour-for-behaviour port of the
 * original implementation; the tests in tests/pricing.test.ts lock this down.
 */

export function perTab(price: number, packSize: number): number {
  return round(price / Math.max(packSize, 1), 4);
}

export function per10Tabs(price: number, packSize: number): number {
  return round(perTab(price, packSize) * 10, 2);
}

export function savingsPct(brandedPer10: number | null | undefined, pricePer10: number): number {
  if (!brandedPer10 || brandedPer10 <= 0) return 0;
  return round(Math.max(0, ((brandedPer10 - pricePer10) / brandedPer10) * 100), 1);
}

export function discountPct(mrp: number | null | undefined, price: number): number {
  if (!mrp || mrp <= 0 || price >= mrp) return 0;
  return round(((mrp - price) / mrp) * 100, 1);
}

const PACK_RE =
  /(?:strip|pack|bottle|box)?\s*of\s*(\d{1,3})\s*(?:tablets?|tabs?|capsules?|caps?)?|(\d{1,3})\s*(?:tablets?|tabs?|capsules?|caps?)\b/i;

/** Best-effort pack size from strings like "Strip of 10 tablets" or "15 Tablets". */
export function parsePackSize(text: string | null | undefined, fallback = 10): number {
  if (!text) return fallback;
  const m = PACK_RE.exec(text);
  if (!m) return fallback;
  const n = Number(m[1] ?? m[2]);
  return Number.isFinite(n) && n >= 1 && n <= 200 ? n : fallback;
}

export function etaText(minutes: number | null | undefined): string {
  if (minutes == null) return "ETA unknown";
  if (minutes < 60) return `~${minutes} mins`;
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)} hrs`;
  const d = Math.round(minutes / (24 * 60));
  return `${d} day${d === 1 ? "" : "s"}`;
}

export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9+ ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

const STRENGTH_RE = /(\d+(?:\.\d+)?)\s*(mg|mcg|µg|ug|g|iu|k)\b/gi;
const TO_MG: Record<string, number> = { mg: 1, g: 1000, mcg: 0.001, "µg": 0.001, ug: 0.001, iu: 1, k: 1000 };

/**
 * All strengths in text, normalised to mg (e.g. "500mg + 125 mg" -> {500, 125}; "0.5 g" -> {500}).
 * Tolerates thousands separators ("60,000 IU", "1,00,000") and the Indian "60K" shorthand
 * (Vitamin D3 60K -> 60000) so D3-60K class listings are not wrongly rejected by the guard.
 */
export function parseStrengths(text: string | null | undefined): Set<number> {
  const out = new Set<number>();
  if (!text) return out;
  const normalized = text.replace(/(\d),(?=\d)/g, "$1");
  for (const m of normalized.matchAll(STRENGTH_RE)) {
    const unit = m[2].toLowerCase();
    out.add(round(Number(m[1]) * TO_MG[unit], 4));
  }
  return out;
}

function formatSet(vals: Iterable<number>): string {
  const arr = [...vals].sort((a, b) => b - a);
  if (!arr.length) return "none";
  return arr.map((v) => `${trimNum(v)}mg`).join(" + ");
}

function trimNum(v: number): string {
  return String(Number(v.toFixed(4)));
}

function setsEqual(a: ReadonlySet<number>, b: ReadonlySet<number>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

function isSubset(subset: ReadonlySet<number>, superset: ReadonlySet<number>): boolean {
  for (const v of subset) if (!superset.has(v)) return false;
  return true;
}

/**
 * Hard guard against wrong-strength matches (e.g. a 500 mg listing shown for a
 * 650 mg search). Returns {ok:false, why} when the listing cannot be trusted.
 */
export function strengthOk(target: ReadonlySet<number>, listingText: string | null | undefined): { ok: boolean; why: string } {
  if (target.size === 0) return { ok: true, why: "" };
  const got = parseStrengths(listingText);
  if (got.size > 0) {
    if (setsEqual(got, target)) return { ok: true, why: "" };
    if (target.size > 1) {
      const sum = round([...target].reduce((a, b) => a + b, 0), 4);
      if (setsEqual(got, new Set([sum]))) return { ok: true, why: "" };
    }
    return { ok: false, why: `strength ${formatSet(got)} does not match ${formatSet(target)}` };
  }
  const bare = new Set<number>();
  for (const m of (listingText ?? "").matchAll(/(?<![\d.])\d+(?:\.\d+)?(?![\d.])/g)) {
    bare.add(Number(m[0]));
  }
  if (bare.size > 0 && isSubset(target, bare)) return { ok: true, why: "" };
  return { ok: false, why: `strength not stated (need ${formatSet(target)})` };
}

const KEY_RE =
  /(₹|\bRs\.?\s*\d|\bINR\b|\bMRP\b|\bprice\b|\bstrip\b|\bpack\b|\btablets?\b|\bcapsules?\b|\bcomposition\b|\bsalt\b|\bmg\b|\bstock\b|\bNABL\b)/i;

/**
 * Keep the page head plus windows around price/pack/composition words;
 * drops menus, footers and reviews before the text is sent to the model.
 */
export function trimPage(text: string | null | undefined, maxChars = 3500, head = 900, window = 220): string {
  const t = text ?? "";
  if (t.length <= maxChars) return t;
  const spans: [number, number][] = [[0, Math.min(head, t.length)]];
  for (const m of t.matchAll(new RegExp(KEY_RE.source, "gi"))) {
    const start = m.index ?? 0;
    spans.push([Math.max(0, start - window), Math.min(t.length, start + m[0].length + window)]);
  }
  spans.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [[...spans[0]] as [number, number]];
  for (const [a, b] of spans.slice(1)) {
    const last = merged[merged.length - 1];
    if (a <= last[1]) last[1] = Math.max(last[1], b);
    else merged.push([a, b]);
  }
  const out: string[] = [];
  let used = 0;
  for (const [a, b] of merged) {
    let chunk = t.slice(a, b);
    if (used + chunk.length > maxChars) chunk = chunk.slice(0, maxChars - used);
    if (chunk) {
      out.push(chunk);
      used += chunk.length;
    }
    if (used >= maxChars) break;
  }
  return out.join("\n…\n");
}

export function round(v: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round((v + Number.EPSILON) * f) / f;
}
