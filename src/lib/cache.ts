/**
 * In-process TTL cache (PRD AGENTS.md §6.4 — demo resilience, 1 hour by default).
 * Swap for Vercel KV / Redis if running multiple serverless instances.
 */
import { env } from "./env";

type Entry = { expiresAt: number; value: unknown };

const store = new Map<string, Entry>();

export function cacheGet<T>(key: string): T | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    store.delete(key);
    return null;
  }
  return hit.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlSeconds?: number): void {
  const ttl = ttlSeconds ?? env.cacheTtlSeconds();
  store.set(key, { expiresAt: Date.now() + ttl * 1000, value });
  if (store.size > 500) {
    // crude bound: drop the 100 soonest-to-expire entries
    const oldest = [...store.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt).slice(0, 100);
    for (const [k] of oldest) store.delete(k);
  }
}

export async function withCache<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
  const hit = cacheGet<T>(key);
  if (hit !== null) return hit;
  const value = await fn();
  cacheSet(key, value, ttlSeconds);
  return value;
}

export function cacheClear(): void {
  store.clear();
}
