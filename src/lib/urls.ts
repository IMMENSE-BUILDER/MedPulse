/** URL hygiene for search results: keep product-ish pages from allowed domains. */
import { domainOf } from "./domains";
import type { SearchHit } from "./tinyfish";

const SKIP_PATH =
  /(\/blog|\/category|\/collections?(?:\/|$)|\/search|\/tag|\/health-articles|\/prescription|\/otc|\/list|\/author)/i;

export function cleanUrls(hits: SearchHit[], allowed: readonly string[], maxPerDomain = 2, cap = 10): string[] {
  const perDomain = new Map<string, number>();
  const out: string[] = [];
  for (const hit of hits) {
    let url: URL;
    try {
      url = new URL(hit.url);
    } catch {
      continue;
    }
    const d = domainOf(hit.url);
    if (!allowed.some((x) => d === x || d.endsWith("." + x))) continue;
    if (SKIP_PATH.test(url.pathname)) continue;
    const n = perDomain.get(d) ?? 0;
    if (n >= maxPerDomain) continue;
    perDomain.set(d, n + 1);
    out.push(hit.url);
    if (out.length >= cap) break;
  }
  return out;
}

export function dedupe(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    const key = item.replace(/\/+$/, "").toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}

/** Fetch the same URL twice? Normalise before comparing. */
export function sameUrl(a: string, b: string): boolean {
  const norm = (u: string) => u.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "").toLowerCase();
  return norm(a) === norm(b);
}
