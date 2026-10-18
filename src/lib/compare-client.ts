"use client";

import { readSseFrames } from "./sse-client";
import type { CompareStreamEvent } from "./schemas";

/**
 * POST the comparison request against /api/compare-stream and relay every
 * typed SSE event. STAGE events are real pipeline progress from the server
 * (resolve → search → fetch → extract → guard); RESULT carries the payload;
 * ERROR carries the honest failure message.
 */
export async function streamCompare(
  body: { query: string; pincode?: string; type?: "medicine" | "lab"; session_id?: string },
  onEvent: (event: CompareStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch("/api/compare-stream", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as { detail?: { message?: string } } | null;
    throw new Error(detail?.detail?.message ?? `Comparison failed (${res.status}).`);
  }
  if (!res.body) throw new Error("Comparison stream returned no body.");
  await readSseFrames<CompareStreamEvent>(res.body, onEvent);
}
