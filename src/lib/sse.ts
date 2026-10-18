/**
 * Server-Sent Events helpers.
 *
 *  - jsonSseResponse : generic typed JSON event stream (keepalive + abort aware)
 *  - agentSseResponse: the Wave 2 agent contract (STARTED / STREAMING_URL /
 *    PROGRESS / COMPLETE) built on top of the generic helper.
 */
import { describeError } from "./errors";
import type { AgentEvent } from "./schemas";

export function jsonSseResponse<T>(opts: {
  run: (send: (event: T) => void, signal: AbortSignal) => Promise<void>;
  onError?: (e: unknown, send: (event: T) => void) => void;
  external?: AbortSignal;
}): Response {
  const controller = new AbortController();
  const external = opts.external;
  if (external) {
    if (external.aborted) controller.abort();
    else external.addEventListener("abort", () => controller.abort(), { once: true });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(streamController) {
      let closed = false;
      const send = (event: T): void => {
        if (closed) return;
        try {
          streamController.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          closed = true;
        }
      };
      const keepalive = setInterval(() => {
        if (closed) return;
        try {
          streamController.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          /* stream already closed */
        }
      }, 15_000);

      try {
        await opts.run(send, controller.signal);
      } catch (e) {
        try {
          opts.onError?.(e, send);
        } catch {
          /* closed */
        }
      } finally {
        closed = true;
        clearInterval(keepalive);
        try {
          streamController.close();
        } catch {
          /* already closed */
        }
      }
    },
    cancel() {
      controller.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}

/** Wave 2 agent contract (see AGENTS.md §4). */
export function agentSseResponse(
  run: (send: (event: AgentEvent) => void, signal: AbortSignal) => Promise<void>,
  external?: AbortSignal,
): Response {
  return jsonSseResponse<AgentEvent>({
    external,
    run,
    onError: (e, send) => {
      send({ type: "COMPLETE", ok: false, result: null, error: describeError(e), video_url: null });
    },
  });
}
