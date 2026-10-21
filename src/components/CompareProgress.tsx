"use client";

import { Check, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { CompareStage } from "@/lib/schemas";

/**
 * Real pipeline stages streamed from /api/compare-stream — every line here
 * reflects an actual server-side step (resolve → search → fetch → extract →
 * strength guard). Nothing is simulated or mocked.
 *
 * The per-stage timings are measured client-side from the moment each SSE
 * frame actually arrives, so they show real wall-clock latency rather than
 * a server-side estimate.
 */
export function CompareProgress({ stages, live }: { stages: CompareStage[]; live: boolean }) {
  const startedRef = useRef(Date.now());
  const arrivals = useRef(new Map<string, number>());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!live) return;
    startedRef.current = Date.now();
    arrivals.current = new Map();
    setElapsed(0);
    const t = setInterval(() => setElapsed(Math.round((Date.now() - startedRef.current) / 1000)), 500);
    return () => clearInterval(t);
  }, [live]);

  useEffect(() => {
    if (!live) return;
    const now = Date.now();
    for (const stage of stages) {
      if (!arrivals.current.has(stage.step)) arrivals.current.set(stage.step, now);
    }
  }, [stages, live]);

  if (!stages.length) return null;

  const started = startedRef.current;
  const arrivedAt = stages
    .map((stage) => arrivals.current.get(stage.step))
    .filter((t): t is number => t != null);
  const finishedIn = arrivedAt.length ? Math.max(0, (Math.max(...arrivedAt) - started) / 1000) : 0;

  return (
    <section className="rounded-2xl border border-line bg-panel p-4">
      <div className="flex items-center gap-2">
        {live ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
        ) : (
          <Check className="h-3.5 w-3.5 text-brand" />
        )}
        <span className="text-[12px] font-medium text-ink-2">
          {live ? "Live pipeline — real steps from the server" : "Pipeline complete — real server steps"}
        </span>
        <span className="ml-auto font-mono text-[11px] text-faint">
          {live ? `${elapsed}s` : `${finishedIn.toFixed(1)}s total`}
        </span>
      </div>
      <ol className="mt-3 space-y-2">
        {stages.map((s) => {
          const arrived = arrivals.current.get(s.step);
          const at = arrived != null ? Math.max(0, (arrived - started) / 1000) : null;
          return (
            <li key={s.step} className="flex items-start gap-2.5">
              {s.status === "done" ? (
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
              ) : live ? (
                <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-brand-2" />
              ) : (
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-line-2" />
              )}
              <div className="min-w-0 flex-1">
                <div className={`text-[11.5px] ${s.status === "done" ? "text-ink-2" : "text-brand-2"}`}>{s.label}</div>
                {s.detail ? <div className="font-mono text-[10px] leading-relaxed text-faint">{s.detail}</div> : null}
              </div>
              {at != null ? (
                <span
                  className="mt-0.5 shrink-0 font-mono text-[10px] text-faint"
                  title="Measured from the moment this server event arrived"
                >
                  {at.toFixed(1)}s
                </span>
              ) : null}
            </li>
          );
        })}
        {stages.length === 0 ? (
          <li className="flex items-center gap-2.5 text-[11.5px] text-mute">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-2" />
            Connecting to the pipeline…
          </li>
        ) : null}
      </ol>
      {!live ? (
        <p className="mt-2 text-[9.5px] text-faint">
          Stage times are measured from the moment each server event reached this browser.
        </p>
      ) : null}
    </section>
  );
}
