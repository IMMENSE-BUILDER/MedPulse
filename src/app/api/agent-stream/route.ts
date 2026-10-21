/**
 * POST /api/agent-stream — Wave 2 live browser agent (SSE).
 *
 * kind:"stock"  -> verify up to 10 medicine URLs against a pincode (max 3 concurrent)
 * kind:"lab"    -> verify up to 10 diagnostic lab URLs against a pincode
 * kind:"kendra" -> find Jan Aushadhi Kendras near a pincode via UMANG
 *
 * Emits the typed contract: STARTED, STREAMING_URL, PROGRESS, COMPLETE.
 * Without a TinyFish key (or in demo mode) it runs an honest simulation so the
 * PiP dock stays demonstrable.
 */
import { kendrasFor } from "@/lib/demo-seed";
import { KENDRA_SCHEMA, STOCK_SCHEMA, UMANG_URL, tfRunAgent } from "@/lib/tinyfish";
import { platformFor } from "@/lib/domains";
import { env, hasTinyFish, liveAgentEnabled } from "@/lib/env";
import { assertLiveConfig, apiErrorResponse, validationResponse } from "@/lib/errors";
import { hostOf } from "@/lib/format";
import { runPool } from "@/lib/pool";
import { guard } from "@/lib/rate-limit";
import { AgentStreamRequestSchema, type AgentEvent, type Kendra, type StockCheck } from "@/lib/schemas";
import { agentSseResponse } from "@/lib/sse";

export const runtime = "nodejs";
export const maxDuration = 300;

type Send = (event: AgentEvent) => void;

export async function POST(req: Request) {
  const limited = guard(req, "agent");
  if (limited) return limited;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return validationResponse("Request body must be JSON.");
  }
  const parsed = AgentStreamRequestSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return validationResponse(issue ? issue.message : "Invalid request.");
  }
  if (env.mode() === "live") {
    try {
      assertLiveConfig(["tinyfish"], { tinyfish: hasTinyFish(), gateway: true });
    } catch (e) {
      return apiErrorResponse(e);
    }
  }

  const request = parsed.data;
  const live = liveAgentEnabled();

  return agentSseResponse(async (send, signal) => {
    if (!live) {
      await runSimulated(request, send, signal);
      return;
    }
    if (request.kind === "kendra") {
      await runKendraLive(request.pincode, send, signal);
      return;
    }
    await runStockLive(request.product_urls ?? [], request.pincode, send, signal, request.kind);
  }, req.signal);
}

/* ------------------------------------------------------------------ live */

async function runStockLive(
  urls: string[],
  pincode: string,
  send: Send,
  signal: AbortSignal,
  kind: "stock" | "lab",
): Promise<void> {
  const checks: Array<StockCheck | null> = new Array(urls.length).fill(null);
  const jobs = urls.map((url, i) => async () => {
    const goal =
      kind === "lab"
        ? `You are verifying a diagnostic lab test package in India. Open ${url}, set the delivery pincode to ${pincode} ` +
          "if the site shows a location selector (close any popups), wait for the page to settle and the price to render, " +
          `then report whether home collection is available for pincode ${pincode}, the displayed package price in INR, ` +
          "and the earliest available slot or report turnaround shown on the page. Never book a test and never log in."
        : `You are verifying medicine availability in India. Open ${url}, set the delivery pincode to ${pincode} ` +
          "if the site shows a location selector (close any popups), wait for the page to settle and the price to " +
          `render, then report whether this exact product can be delivered to pincode ${pincode}, the displayed ` +
          "selling price in INR, and the delivery ETA text shown on the page. Never add items to a cart and never log in.";

    const outcome = await tfRunAgent({
      goal,
      url,
      outputSchema: STOCK_SCHEMA,
      timeoutMs: 180_000,
      signal,
      callbacks: {
        onStarted: (runId) =>
          send({
            type: "STARTED",
            run_id: runId,
            goal: `Pincode ${pincode} ${kind === "lab" ? "lab" : "stock"} check on ${hostOf(url)}`,
          }),
        onStreamUrl: (streamingUrl) => send({ type: "STREAMING_URL", streaming_url: streamingUrl }),
        onProgress: (purpose) => send({ type: "PROGRESS", purpose: `${hostOf(url)}: ${purpose}` }),
      },
    });
    const result = (outcome.result ?? {}) as Record<string, unknown>;
    checks[i] = {
      product_url: url,
      platform: platformFor(url),
      in_stock_at_pincode: typeof result.in_stock === "boolean" ? result.in_stock : null,
      delivery_eta: typeof result.delivery_eta === "string" ? result.delivery_eta : null,
      price_inr: typeof result.price_inr === "number" ? result.price_inr : null,
      error: outcome.error,
      verified_by: outcome.error ? "TinyAgent (error)" : "TinyAgent (live)",
      streaming_url: outcome.streamingUrl,
    };
  });

  await runPool(jobs, 3);
  const finalChecks = checks.filter((c): c is StockCheck => c !== null);
  send({
    type: "COMPLETE",
    ok: finalChecks.some((c) => c.in_stock_at_pincode !== null),
    result: { kind: "stock", checks: finalChecks },
    error:
      finalChecks.length > 0 && finalChecks.every((c) => c.error)
        ? (finalChecks[0].error ?? "all stock checks failed")
        : null,
    video_url: finalChecks.find((c) => c.streaming_url)?.streaming_url ?? null,
  });
}

async function runKendraLive(pincode: string, send: Send, signal: AbortSignal): Promise<void> {
  const outcome = await tfRunAgent({
    goal:
      "Open UMANG (Government of India services app). Navigate to the Jan Aushadhi Kendra locator " +
      `(PM Bharatiya Janaushadhi Pariyojana). Search for kendras near pincode ${pincode}. Report up to 5 outlets ` +
      "with name, full address, distance in km if shown, and phone if shown. Do not log in.",
    url: UMANG_URL,
    outputSchema: KENDRA_SCHEMA,
    timeoutMs: 180_000,
    signal,
    callbacks: {
      onStarted: (runId) => send({ type: "STARTED", run_id: runId, goal: `Jan Aushadhi Kendra finder near ${pincode}` }),
      onStreamUrl: (streamingUrl) => send({ type: "STREAMING_URL", streaming_url: streamingUrl }),
      onProgress: (purpose) => send({ type: "PROGRESS", purpose: `UMANG: ${purpose}` }),
    },
  });

  const kendras = normalizeKendras(outcome.result);
  send({
    type: "COMPLETE",
    ok: kendras.length > 0,
    result: { kind: "kendra", kendras },
    error: outcome.error,
    video_url: outcome.streamingUrl,
  });
}

function normalizeKendras(result: Record<string, unknown> | null): Kendra[] {
  const raw = result && Array.isArray((result as { kendras?: unknown }).kendras) ? ((result as { kendras: unknown[] }).kendras) : [];
  return raw
    .map((item, i): Kendra | null => {
      const r = (item ?? {}) as Record<string, unknown>;
      const name = typeof r.name === "string" ? r.name : null;
      const address = typeof r.address === "string" ? r.address : null;
      if (!name || !address) return null;
      return {
        kendra_id: typeof r.kendra_id === "string" ? r.kendra_id : `umang-${i + 1}`,
        name,
        address,
        pincode: typeof r.pincode === "string" ? r.pincode : null,
        distance_km: typeof r.distance_km === "number" ? r.distance_km : null,
        phone: typeof r.phone === "string" ? r.phone : null,
        stock_note: null,
        source_portal: "web.umang.gov.in (live agent)",
      };
    })
    .filter((k): k is Kendra => k !== null)
    .slice(0, 5);
}

/* ------------------------------------------------------------- simulated */

async function runSimulated(
  request: { kind: "stock" | "lab" | "kendra"; pincode: string; product_urls?: string[] },
  send: Send,
  signal: AbortSignal,
): Promise<void> {
  const runId = `sim_${Math.random().toString(36).slice(2, 10)}`;
  const label =
    request.kind === "kendra"
      ? `Jan Aushadhi Kendra finder near ${request.pincode}`
      : request.kind === "lab"
        ? `Pincode ${request.pincode} lab check (simulated)`
        : `Pincode ${request.pincode} stock check (simulated)`;
  send({ type: "STARTED", run_id: runId, goal: `${label} — demo simulation, no browser session` });

  const pages = request.kind === "kendra" ? ["web.umang.gov.in"] : (request.product_urls ?? []).slice(0, 3).map(hostOf);
  const steps = [
    ...pages.map((p) => `Opening ${p} …`),
    "Setting delivery pincode …",
    "Reading price and stock blocks …",
    "Checking home-delivery coverage …",
  ];
  for (const step of steps) {
    if (signal.aborted) return;
    await sleep(420);
    send({ type: "PROGRESS", purpose: step });
  }

  if (request.kind === "kendra") {
    const kendras = kendrasFor(request.pincode, 3);
    send({
      type: "COMPLETE",
      ok: false,
      result: { kind: "kendra", kendras },
      error: "Demo simulation — set TINYFISH_API_KEY and MEDPULSE_MODE=auto for a real UMANG session.",
      video_url: null,
    });
    return;
  }

  const checks: StockCheck[] = (request.product_urls ?? []).map((url) => ({
    product_url: url,
    platform: platformFor(url),
    in_stock_at_pincode: null,
    delivery_eta: null,
    price_inr: null,
    error: "Demo simulation — no real stock information",
    verified_by: "demo-simulated",
    streaming_url: null,
  }));
  send({
    type: "COMPLETE",
    ok: false,
    result: { kind: "stock", checks },
    error: "Demo simulation — set TINYFISH_API_KEY and MEDPULSE_MODE=auto for a real browser session.",
    video_url: null,
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
