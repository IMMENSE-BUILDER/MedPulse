import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clientIp, enforceRateLimit, rateLimit, resetRateLimits } from "@/lib/rate-limit";

function request(ip: string | null, forwarded = true): Request {
  const headers = new Headers();
  if (ip) {
    if (forwarded) headers.set("x-forwarded-for", ip);
    else headers.set("x-real-ip", ip);
  }
  return new Request("https://example.test/api/compare", { method: "POST", headers });
}

beforeEach(() => {
  resetRateLimits();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-21T10:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("rate limiting", () => {
  it("allows requests up to the limit", () => {
    for (let i = 0; i < 3; i += 1) {
      expect(enforceRateLimit(request("1.1.1.1"), "test", 3, 60_000)).toBeNull();
    }
  });

  it("returns a 429 with Retry-After once the budget is spent", async () => {
    expect(enforceRateLimit(request("2.2.2.2"), "test", 2, 60_000)).toBeNull();
    expect(enforceRateLimit(request("2.2.2.2"), "test", 2, 60_000)).toBeNull();
    const blocked = enforceRateLimit(request("2.2.2.2"), "test", 2, 60_000);
    expect(blocked).not.toBeNull();
    expect(blocked?.status).toBe(429);
    expect(blocked?.headers.get("retry-after")).toBe("60");
    const body = (await blocked?.json()) as { detail?: { error?: string; message?: string } };
    expect(body.detail?.error).toBe("rate_limited");
    expect(body.detail?.message).toContain("Too many requests");
  });

  it("keeps separate budgets per IP", () => {
    expect(enforceRateLimit(request("3.3.3.3"), "test", 1, 60_000)).toBeNull();
    expect(enforceRateLimit(request("3.3.3.3"), "test", 1, 60_000)).not.toBeNull();
    expect(enforceRateLimit(request("4.4.4.4"), "test", 1, 60_000)).toBeNull();
  });

  it("keeps separate budgets per bucket", () => {
    expect(rateLimit(request("5.5.5.5"), "compare", 1, 60_000).ok).toBe(true);
    expect(rateLimit(request("5.5.5.5"), "compare", 1, 60_000).ok).toBe(false);
    expect(rateLimit(request("5.5.5.5"), "agent", 1, 60_000).ok).toBe(true);
  });

  it("refills after the window elapses", () => {
    expect(rateLimit(request("6.6.6.6"), "test", 1, 60_000).ok).toBe(true);
    expect(rateLimit(request("6.6.6.6"), "test", 1, 60_000).ok).toBe(false);
    vi.advanceTimersByTime(60_001);
    expect(rateLimit(request("6.6.6.6"), "test", 1, 60_000).ok).toBe(true);
  });

  it("uses a single fallback bucket when no IP header is present", () => {
    expect(clientIp(request(null))).toBe("unknown");
    expect(rateLimit(request(null), "test", 1, 60_000).ok).toBe(true);
    expect(rateLimit(request(null), "test", 1, 60_000).ok).toBe(false);
  });

  it("reads the first address from a proxy chain", () => {
    const req = new Request("https://example.test/api/compare", {
      headers: { "x-forwarded-for": "9.9.9.9, 10.0.0.1, 10.0.0.2" },
    });
    expect(clientIp(req)).toBe("9.9.9.9");
  });

  it("falls back to x-real-ip", () => {
    expect(clientIp(request("7.7.7.7", false))).toBe("7.7.7.7");
  });
});
