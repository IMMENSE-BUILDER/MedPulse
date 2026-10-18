/**
 * Environment access — single source of truth for keys, mode and model IDs.
 * Works both in Next.js (dotenv loaded by the framework) and in plain Node/vitest.
 */

export type MedpulseMode = "auto" | "demo" | "live";

function str(name: string, fallback = ""): string {
  const v = process.env[name];
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

export const env = {
  tinyfishKey: () => str("TINYFISH_API_KEY"),
  gatewayKey: () => str("AI_GATEWAY_API_KEY"),
  mode: (): MedpulseMode => {
    const m = str("MEDPULSE_MODE", "auto").toLowerCase();
    return m === "demo" || m === "live" ? m : "auto";
  },
  defaultPincode: () => str("DEFAULT_PINCODE", "110053"),
  visionModel: () => str("VISION_MODEL", "xiaomi/mimo-v2.6-flash"),
  textModel: () => str("TEXT_MODEL", "inclusionai/ling-3.0-flash-sante"),
  cacheTtlSeconds: () => {
    const n = Number(str("CACHE_TTL_SECONDS", "3600"));
    return Number.isFinite(n) && n > 0 ? n : 3600;
  },
} as const;

export function hasTinyFish(): boolean {
  return env.tinyfishKey().length > 0;
}

/**
 * The AI SDK's gateway provider authenticates either with an explicit
 * AI_GATEWAY_API_KEY or, on Vercel deployments, with the automatically
 * injected OIDC token (VERCEL_OIDC_TOKEN) — no key required there.
 */
export function hasGateway(): boolean {
  return env.gatewayKey().length > 0 || Boolean(process.env.VERCEL_OIDC_TOKEN);
}

export function gatewayAuthMode(): "key" | "oidc" | "none" {
  if (env.gatewayKey().length > 0) return "key";
  if (process.env.VERCEL_OIDC_TOKEN) return "oidc";
  return "none";
}

/** Live dual-track compare/OCR need both providers; Wave 2 agent needs TinyFish only. */
export function liveCompareEnabled(): boolean {
  const m = env.mode();
  if (m === "demo") return false;
  if (m === "live") return true;
  return hasTinyFish() && hasGateway();
}

export function liveAgentEnabled(): boolean {
  const m = env.mode();
  if (m === "demo") return false;
  if (m === "live") return true;
  return hasTinyFish();
}

export function healthSummary() {
  const mode = env.mode();
  const liveReady = liveCompareEnabled();
  return {
    status: "ok",
    mode: liveReady ? ("live" as const) : ("demo" as const),
    configured_mode: mode,
    tinyfish_key: hasTinyFish(),
    gateway_key: env.gatewayKey().length > 0,
    gateway_auth: gatewayAuthMode(),
    default_pincode: env.defaultPincode(),
    cache_ttl_seconds: env.cacheTtlSeconds(),
  };
}
