/**
 * Thin adapter over the TinyFish SDK (@tiny-fish/sdk):
 *   search.query  — Track A/B/C/D URL discovery (free tier)
 *   fetch.getContents — markdown extraction (free tier)
 *   agent.stream  — Wave 2 live stealth browser (paid, on-demand only)
 */
import { BrowserProfile, TinyFish } from "@tiny-fish/sdk";
import { env } from "./env";
import { describeError } from "./errors";

export type SearchHit = { url: string; title: string; snippet: string; site: string };
export type FetchPage = { url: string; title: string; text: string };
export type FetchErrors = { url: string; error: string }[];

let client: TinyFish | null = null;

function getClient(): TinyFish {
  if (!client) client = new TinyFish({ apiKey: env.tinyfishKey(), maxRetries: 2, timeout: 60_000 });
  return client;
}

export function tinyfishReady(): boolean {
  return env.tinyfishKey().length > 0;
}

export async function tfSearch(query: string, domains: readonly string[], purpose: string): Promise<SearchHit[]> {
  const resp = await getClient().search.query({
    query,
    purpose,
    location: "IN",
    language: "en",
    include_domains: domains.join(","),
  });
  return resp.results.map((r) => ({ url: r.url, title: r.title, snippet: r.snippet, site: r.site_name }));
}

const FETCH_BATCH = 10;

export async function tfFetch(
  urls: string[],
  purpose: string,
  ttl = 3600,
): Promise<{ pages: FetchPage[]; errors: FetchErrors }> {
  if (urls.length === 0) return { pages: [], errors: [] };
  const tf = getClient();
  const chunks: string[][] = [];
  for (let i = 0; i < urls.length; i += FETCH_BATCH) chunks.push(urls.slice(i, i + FETCH_BATCH));

  const pages: FetchPage[] = [];
  const errors: FetchErrors = [];
  const settled = await Promise.allSettled(
    chunks.map((chunk) =>
      tf.fetch.getContents({ urls: chunk, purpose, format: "markdown", ttl, per_url_timeout_ms: 45_000 }),
    ),
  );
  for (const s of settled) {
    if (s.status === "rejected") {
      errors.push({ url: "*", error: describeError(s.reason) });
      continue;
    }
    for (const r of s.value.results) {
      if (r.format === "markdown") pages.push({ url: r.url, title: r.title ?? "", text: r.text ?? "" });
    }
    for (const e of s.value.errors) errors.push({ url: e.url, error: e.error });
  }
  return { pages, errors };
}

export type AgentCallbacks = {
  onStarted?: (runId: string) => void;
  onStreamUrl?: (streamingUrl: string) => void;
  onProgress?: (purpose: string) => void;
};

export type AgentOutcome = {
  result: Record<string, unknown> | null;
  streamingUrl: string | null;
  error: string | null;
};

/**
 * Run a stealth browser agent and stream its progress through callbacks.
 * Used only by /api/agent-stream (Wave 2), which is user-triggered.
 */
export async function tfRunAgent(opts: {
  goal: string;
  url: string;
  outputSchema: Record<string, unknown>;
  callbacks?: AgentCallbacks;
  timeoutMs?: number;
  signal?: AbortSignal;
}): Promise<AgentOutcome> {
  const out: AgentOutcome = { result: null, streamingUrl: null, error: null };
  const timeoutMs = opts.timeoutMs ?? 180_000;
  const signal = opts.signal
    ? AbortSignal.any([opts.signal, AbortSignal.timeout(timeoutMs)])
    : AbortSignal.timeout(timeoutMs);

  try {
    const stream = await getClient().agent.stream(
      {
        goal: opts.goal,
        url: opts.url,
        browser_profile: BrowserProfile.STEALTH,
        output_schema: opts.outputSchema,
        agent_config: { max_duration_seconds: Math.round(timeoutMs / 1000) },
      },
      { signal },
    );
    for await (const ev of stream) {
      switch (ev.type) {
        case "STARTED":
          opts.callbacks?.onStarted?.(ev.run_id);
          break;
        case "STREAMING_URL":
          out.streamingUrl = ev.streaming_url;
          opts.callbacks?.onStreamUrl?.(ev.streaming_url);
          break;
        case "PROGRESS":
          opts.callbacks?.onProgress?.(ev.purpose);
          break;
        case "COMPLETE":
          if (ev.status === "COMPLETED" && !ev.error) out.result = ev.result ?? null;
          else out.error = ev.error?.message ?? `run status ${ev.status}`;
          break;
        case "HEARTBEAT":
          break;
      }
    }
  } catch (e) {
    out.error = describeError(e);
  }
  return out;
}

/**
 * Browser-agent output schema for a pincode stock check.
 * Keep this strictly structural: TinyFish's agent API rejects non-structural
 * keywords such as `description` (BadRequestError at #/properties/…).
 * Field meanings are spelled out in the run goal passed to tfRunAgent instead.
 */
export const STOCK_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    in_stock: { type: "boolean" },
    delivery_eta: { type: "string" },
    price_inr: { type: "number" },
  },
  required: ["in_stock"],
};

/** Browser-agent output schema for the UMANG Jan Aushadhi Kendra locator. */
export const KENDRA_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    kendras: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kendra_id: { type: "string" },
          name: { type: "string" },
          address: { type: "string" },
          distance_km: { type: "number" },
          phone: { type: "string" },
        },
        required: ["name", "address"],
      },
    },
  },
  required: ["kendras"],
};

export const UMANG_URL = "https://web.umang.gov.in/";
