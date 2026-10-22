/**
 * POST /api/agent-stream — Wave 2 live browser agent (SSE).
 *
 * kind:"stock"  -> verify up to 10 medicine URLs against a pincode (max 5 concurrent)
 * kind:"lab"    -> verify up to 10 diagnostic lab URLs against a pincode
 * kind:"kendra" -> find all Jan Aushadhi Kendras near a pincode via janaushadhi.gov.in
 *
 * Emits the typed contract: STARTED, STREAMING_URL, PROGRESS, COMPLETE.
 * Without a TinyFish key (or in demo mode) it runs an honest simulation so the
 * PiP dock stays demonstrable.
 */
import { kendrasFor } from "@/lib/demo-seed";
import { KENDRA_SCHEMA, STOCK_SCHEMA, tfRunAgent } from "@/lib/tinyfish";
import { summarizeKendras } from "@/lib/ai-router";
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
    const label = hostOf(url);
    let runId = "";
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
        onStarted: (id) => {
          runId = id;
          send({
            type: "STARTED",
            run_id: id,
            goal: `Pincode ${pincode} ${kind === "lab" ? "lab" : "stock"} check on ${label}`,
            label,
            product_url: url,
          });
        },
        onStreamUrl: (streamingUrl) =>
          send({
            type: "STREAMING_URL",
            streaming_url: streamingUrl,
            run_id: runId || undefined,
            label,
            product_url: url,
          }),
        onProgress: (purpose) =>
          send({
            type: "PROGRESS",
            purpose: `${label}: ${purpose}`,
            run_id: runId || undefined,
            label,
          }),
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

  await runPool(jobs, 5);
  const finalChecks = checks.filter((c): c is StockCheck => c !== null);
  send({
    type: "COMPLETE",
    ok: finalChecks.some((c) => c.in_stock_at_pincode !== null),
    result: { kind, checks: finalChecks },
    error:
      finalChecks.length > 0 && finalChecks.every((c) => c.error)
        ? (finalChecks[0].error ?? "all stock checks failed")
        : null,
    video_url: finalChecks.find((c) => c.streaming_url)?.streaming_url ?? null,
  });
}

async function runKendraLive(pincode: string, send: Send, signal: AbortSignal): Promise<void> {
  let streamingUrl: string | null = null;
  const agentAbort = new AbortController();
  const agentPromise = tfRunAgent({
    goal:
      "Open https://janaushadhi.gov.in/near-by-kendra . Select the State for the pincode, " +
      `enter ${pincode} in the Pin Code field and click Search. Collect every table row across all Next pages.`,
    url: "https://janaushadhi.gov.in/near-by-kendra",
    outputSchema: KENDRA_SCHEMA,
    timeoutMs: 240_000,
    signal: AbortSignal.any([signal, agentAbort.signal]),
    callbacks: {
      onStarted: (runId) => send({ type: "STARTED", run_id: runId, goal: `Jan Aushadhi Kendra finder near ${pincode}` }),
      onStreamUrl: (url) => {
        streamingUrl = url;
        send({ type: "STREAMING_URL", streaming_url: url, label: "janaushadhi.gov.in" });
      },
      onProgress: (purpose) => send({ type: "PROGRESS", purpose: `janaushadhi.gov.in: ${purpose}`, label: "janaushadhi.gov.in" }),
    },
  });

  // The official locator API returns the same rows the page renders. Use it as
  // a fast, reliable data path while the live browser provides the visual.
  const apiRows = await fetchKendraApi(pincode).catch(() => []);
  if (apiRows.length) {
    send({ type: "PROGRESS", purpose: `Official locator returned ${apiRows.length} kendras; cleaning the list…` });
    // Give the live browser a short window to attach its streaming view.
    await sleep(6_000);
    agentAbort.abort();
    let kendras = apiRows;
    try {
      kendras = await summarizeKendras(apiRows, pincode);
    } catch {
      /* keep the official rows if the text model is unavailable */
    }
    send({
      type: "COMPLETE",
      ok: kendras.length > 0,
      result: { kind: "kendra", kendras },
      error: null,
      video_url: streamingUrl,
    });
    return;
  }

  const outcome = await agentPromise;
  const raw = normalizeKendras(outcome.result);
  let kendras = raw;
  try {
    if (raw.length) kendras = await summarizeKendras(raw, pincode);
  } catch {
    /* keep the raw locator rows if the text model is unavailable */
  }
  send({
    type: "COMPLETE",
    ok: kendras.length > 0,
    result: { kind: "kendra", kendras },
    error: outcome.error,
    video_url: outcome.streamingUrl ?? streamingUrl,
  });
}

type KendraApiRow = {
  id?: number;
  contactPerson?: string;
  contactNumber?: string;
  storeCode?: string;
  pinCode?: string | number;
  stateName?: string;
  districtName?: string;
  kendraAddress?: string;
  status?: number;
};

async function fetchKendraApi(pincode: string): Promise<Kendra[]> {
  const tokenRes = await fetch("https://janaushadhi.gov.in:8443/auth/generateGuestToken", {
    signal: AbortSignal.timeout(15_000),
  });
  if (!tokenRes.ok) throw new Error(`locator token ${tokenRes.status}`);
  const tokenJson = (await tokenRes.json()) as { responseBody?: string };
  const token = tokenJson.responseBody;
  if (!token) throw new Error("locator token missing");

  const rows: KendraApiRow[] = [];
  let pageIndex = 0;
  let totalPages = 1;
  do {
    const res = await fetch("https://janaushadhi.gov.in:8443/api/v1/website/getAllKendraByStateDistrict", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        pageIndex,
        pageSize: 100,
        stateId: 0,
        districtId: 0,
        pinCode: Number(pincode),
        storeCode: "",
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`locator API ${res.status}`);
    const json = (await res.json()) as {
      responseBody?: { addKendraResponseList?: KendraApiRow[]; totalPages?: number };
    };
    const body = json.responseBody;
    if (!body) throw new Error("locator API empty response");
    rows.push(...(body.addKendraResponseList ?? []));
    totalPages = Math.max(1, body.totalPages ?? 1);
    pageIndex += 1;
  } while (pageIndex < totalPages && pageIndex < 20);

  return rows
    .filter((r) => r.kendraAddress)
    .map((r, index) => {
      const owner = r.contactPerson?.trim() || null;
      const code = r.storeCode?.trim() || null;
      return {
        kendra_id: code ?? `ja-${r.id ?? index + 1}`,
        name: owner ? `Jan Aushadhi Kendra - ${owner}` : "Jan Aushadhi Kendra",
        address: r.kendraAddress ?? "",
        pincode: r.pinCode != null ? String(r.pinCode) : null,
        distance_km: null,
        phone: r.contactNumber?.trim() || null,
        stock_note: null,
        source_portal: "janaushadhi.gov.in (official locator API)",
        kendra_code: code,
        owner_name: owner,
        state: r.stateName ?? null,
        district: r.districtName ?? null,
      };
    });
}

function normalizeKendras(result: Record<string, unknown> | null): Kendra[] {
  const raw = result && Array.isArray((result as { kendras?: unknown }).kendras) ? ((result as { kendras: unknown[] }).kendras) : [];
  return raw
    .map((item, i): Kendra | null => {
      const r = (item ?? {}) as Record<string, unknown>;
      const owner = typeof r.owner_name === "string" ? r.owner_name : null;
      const code = typeof r.kendra_code === "string" ? r.kendra_code : null;
      const name =
        typeof r.name === "string" && r.name.trim()
          ? r.name
          : owner
            ? `Jan Aushadhi Kendra - ${owner}`
            : "Jan Aushadhi Kendra";
      const address = typeof r.address === "string" ? r.address : null;
      if (!address) return null;
      return {
        kendra_id: typeof r.kendra_id === "string" ? r.kendra_id : code ?? `ja-${i + 1}`,
        name,
        address,
        pincode: typeof r.pincode === "string" ? r.pincode : null,
        distance_km: typeof r.distance_km === "number" ? r.distance_km : null,
        phone: typeof r.phone === "string" ? r.phone : null,
        stock_note: null,
        source_portal: "janaushadhi.gov.in (live agent)",
        kendra_code: code,
        owner_name: owner,
        state: typeof r.state === "string" ? r.state : null,
        district: typeof r.district === "string" ? r.district : null,
      };
    })
    .filter((k): k is Kendra => k !== null)
    .slice(0, 100);
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
