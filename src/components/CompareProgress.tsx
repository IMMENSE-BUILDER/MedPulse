"use client";

import { Check, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { CompareStage } from "@/lib/schemas";

/**
 * Real pipeline stages streamed from /api/compare-stream — every line here
 * reflects an actual server-side step (resolve → search → fetch → extract →
 * strength guard). Nothing is simulated or mocked.
 */
export function CompareProgress({ stages, live }: { stages: CompareStage[]; live: boolean }) {
  const startedRef = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!live) return;
    startedRef.current = Date.now();
    setElapsed(0);
    const t = setInterval(() => setElapsed(Math.round((Date.now() - startedRef.current) / 1000)), 500);
    return () => clearInterval(t);
  }, [live]);

  if (!live) return null;

  return (
    <section className="rounded-2xl border border-line bg-panel p-4">
      <div className="flex items-center gap-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
        <span className="text-[12px] font-medium text-ink-2">Live pipeline — real steps from the server</span>
        <span className="ml-auto font-mono text-[11px] text-faint">{elapsed}s</span>
      </div>
      <ol className="mt-3 space-y-2">
        {stages.map((s) => (
          <li key={s.step} className="flex items-start gap-2.5">
            {s.status === "done" ? (
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
            ) : (
              <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-brand-2" />
            )}
            <div className="min-w-0">
              <div className={`text-[11.5px] ${s.status === "done" ? "text-ink-2" : "text-brand-2"}`}>{s.label}</div>
              {s.detail ? <div className="font-mono text-[10px] leading-relaxed text-faint">{s.detail}</div> : null}
            </div>
          </li>
        ))}
        {stages.length === 0 ? (
          <li className="flex items-center gap-2.5 text-[11.5px] text-mute">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-2" />
            Connecting to the pipeline…
          </li>
        ) : null}
      </ol>
    </section>
  );
}
