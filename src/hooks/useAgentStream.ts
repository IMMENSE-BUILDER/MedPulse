"use client";

import { useCallback, useRef, useState } from "react";
import { streamAgent } from "@/lib/agent-client";
import type { AgentEvent, AgentStreamRequest } from "@/lib/schemas";

export type AgentLogLine = { id: number; ts: number; kind: "start" | "log" | "url" | "done" | "error"; text: string };

export type AgentView = {
  id: string;
  label: string;
  url: string;
  productUrl: string | null;
};

export type AgentDockState = {
  open: boolean;
  running: boolean;
  target: string | null;
  lines: AgentLogLine[];
  streams: AgentView[];
  ok: boolean | null;
  error: string | null;
  result: unknown;
};

export type OnAgentComplete = (result: unknown, ok: boolean, error: string | null) => void;

const EMPTY: AgentDockState = {
  open: false,
  running: false,
  target: null,
  lines: [],
  streams: [],
  ok: null,
  error: null,
  result: null,
};

export function useAgentStream() {
  const [state, setState] = useState<AgentDockState>(EMPTY);
  const abortRef = useRef<AbortController | null>(null);
  const seqRef = useRef(0);

  const push = useCallback((kind: AgentLogLine["kind"], text: string) => {
    seqRef.current += 1;
    const line: AgentLogLine = { id: seqRef.current, ts: Date.now(), kind, text };
    setState((s) => ({ ...s, lines: [...s.lines.slice(-80), line] }));
  }, []);

  const run = useCallback(
    async (body: AgentStreamRequest, target: string, onComplete?: OnAgentComplete) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setState({
        open: true,
        running: true,
        target,
        lines: [{ id: ++seqRef.current, ts: Date.now(), kind: "start", text: `run -> ${target}` }],
        streams: [],
        ok: null,
        error: null,
        result: null,
      });
      try {
        await streamAgent(
          body,
          (event: AgentEvent) => {
            switch (event.type) {
              case "STARTED":
                push("start", `agent ${event.run_id} - ${event.goal}`);
                break;
              case "STREAMING_URL": {
                const id = event.product_url || event.run_id || `${event.label ?? "agent"}-${Date.now()}`;
                const label = event.label ?? event.product_url ?? "live agent";
                const entry: AgentView = {
                  id,
                  label,
                  url: event.streaming_url,
                  productUrl: event.product_url ?? null,
                };
                setState((s) => {
                  const index = s.streams.findIndex((stream) => stream.id === id);
                  const streams =
                    index >= 0
                      ? s.streams.map((stream, i) => (i === index ? entry : stream))
                      : [...s.streams, entry];
                  return { ...s, streams };
                });
                push("url", `${label}: live view attached`);
                break;
              }
              case "PROGRESS":
                push("log", event.purpose);
                break;
              case "COMPLETE":
                setState((s) => ({
                  ...s,
                  running: false,
                  ok: event.ok,
                  error: event.error,
                  result: event.result,
                  lines: [
                    ...s.lines,
                    {
                      id: ++seqRef.current,
                      ts: Date.now(),
                      kind: event.ok ? "done" : "error",
                      text: event.ok ? "run complete" : `run finished - ${event.error ?? "no result"}`,
                    },
                  ],
                }));
                onComplete?.(event.result, event.ok, event.error);
                break;
            }
          },
          controller.signal,
        );
      } catch (e) {
        if (!controller.signal.aborted) {
          const message = e instanceof Error ? e.message : String(e);
          setState((s) => ({ ...s, running: false, error: message }));
          push("error", message);
        }
      } finally {
        setState((s) => (s.running ? { ...s, running: false } : s));
      }
    },
    [push],
  );

  const close = useCallback(() => {
    abortRef.current?.abort();
    setState((s) => ({ ...s, open: false, running: false, streams: [] }));
  }, []);

  const setOpen = useCallback((open: boolean) => {
    setState((s) => ({ ...s, open }));
  }, []);

  return { state, run, close, setOpen };
}
