"use client";

import { readSseFrames } from "./sse-client";
import type { AgentEvent, AgentStreamRequest } from "./schemas";

/** POST the agent request and relay every typed SSE event to `onEvent`. */
export async function streamAgent(
  body: AgentStreamRequest,
  onEvent: (event: AgentEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch("/api/agent-stream", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as { detail?: { message?: string } } | null;
    throw new Error(detail?.detail?.message ?? `Agent stream failed (${res.status}).`);
  }
  if (!res.body) throw new Error("Agent stream returned no body.");
  await readSseFrames<AgentEvent>(res.body, onEvent);
}
