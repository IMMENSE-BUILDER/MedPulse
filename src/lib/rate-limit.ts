/**
 * Best-effort in-memory rate limiting for the public route handlers.
 *
 * The site is public and Wave 2 (TinyAgent) spends real wallet credit per run,
 * so every paid/AI endpoint gets a small per-IP fixed-window budget. This is
 * intentionally dependency-free: serverless instances each keep their own
 * counters, which is enough to stop casual abuse and demo-day accidents — not
 * a substitute for a shared store.
 */

type Limit = { bucket: string; limit: number; windowMs: number };

/** Per-bucket budgets (requests / window / IP). Tuned to be invisible to a
 *  real user but tight enough to protect the TinyFish wallet. */
export const RATE_LIMITS = {
  /** /api/compare + /api/compare-stream share one bucket. */
  compare: { bucket: "compare", limit: 20, windowMs: 60_000 },
  /** Vision OCR is the most expensive single call. */
  ocr: { bucket: "ocr", limit: 6, windowMs: 60_000 },
  docai: { bucket: "docai", limit: 20, windowMs: 60_000 },
  cart: { bucket: "cart", limit: 30, windowMs: 60_000 },
  /** TinyAgent costs $0.016/step — strictest budget. */
  agent: { bucket: "agent", limit: 4, windowMs: 60_000 },
} as const satisfies Record<string, Limit>;

export type RateLimitKind = keyof typeof RATE_LIMITS;

const buckets = new Map<string, number[]>();
let lastSweep = 0;
const SWEEP_MS = 5 * 60_000;

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first;
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

function sweep(now: number, windowMs: number): void {
  for (const [key, hits] of buckets) {
    const live = hits.filter((t) => now - t < windowMs);
    if (live.length) buckets.set(key, live);
    else buckets.delete(key);
  }
}

export type RateLimitResult = { ok: true } | { ok: false; retryAfter: number };

export function rateLimit(req: Request, bucket: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  if (now - lastSweep > SWEEP_MS || buckets.size > 2000) {
    sweep(now, windowMs);
    lastSweep = now;
  }

  const key = `${bucket}:${clientIp(req)}`;
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    const oldest = hits[0] ?? now;
    return { ok: false, retryAfter: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)) };
  }
  hits.push(now);
  buckets.set(key, hits);
  return { ok: true };
}

/**
 * Returns a ready-to-return 429 response when the caller is over budget,
 * otherwise `null`. The JSON shape matches `jsonError` so the browser SSE
 * clients surface the message they already know how to render.
 */
export function enforceRateLimit(req: Request, bucket: string, limit: number, windowMs: number): Response | null {
  const result = rateLimit(req, bucket, limit, windowMs);
  if (result.ok) return null;
  const message = `Too many requests — try again in ${result.retryAfter}s.`;
  return new Response(JSON.stringify({ detail: { error: "rate_limited", message } }), {
    status: 429,
    headers: { "content-type": "application/json", "retry-after": String(result.retryAfter) },
  });
}

/** Convenience wrapper for the shared budgets above. */
export function guard(req: Request, kind: RateLimitKind): Response | null {
  const { bucket, limit, windowMs } = RATE_LIMITS[kind];
  return enforceRateLimit(req, bucket, limit, windowMs);
}

/** Test/reset hook — never called from app code. */
export function resetRateLimits(): void {
  buckets.clear();
  lastSweep = 0;
}
