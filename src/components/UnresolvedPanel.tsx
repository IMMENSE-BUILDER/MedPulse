"use client";

import { ArrowRight, SearchX } from "lucide-react";

import type { DualTrackComparison } from "@/lib/schemas";

/**
 * Shown when a query could not be decoded to an active salt. Instead of a
 * dead-end error, the pipeline searched the tracked portals and the text
 * model picked up to 4 reliable suggestions (names taken from real results).
 */
export function UnresolvedPanel({
  cmp,
  onPick,
}: {
  cmp: DualTrackComparison;
  onPick: (name: string) => void;
}) {
  const suggestions = cmp.suggestions ?? [];
  return (
    <section className="rounded-2xl border border-warn/40 bg-panel p-5">
      <div className="flex items-start gap-3">
        <SearchX className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
        <div>
          <div className="text-sm font-medium text-ink-2">
            No usable live prices for &ldquo;{cmp.query_brand}&rdquo;
          </div>
          <p className="mt-1 text-[11px] text-mute">
            {suggestions.length
              ? "Searched the tracked pharmacy portals — these are the reliable picks that most likely match what you meant:"
              : "Searched the tracked pharmacy portals but found no similar medicine. Try the exact brand or generic name."}
          </p>
        </div>
      </div>

      {suggestions.length ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {suggestions.map((s) => (
            <button
              key={s.name}
              type="button"
              onClick={() => onPick(s.name)}
              className="group flex items-center justify-between gap-3 rounded-xl border border-line bg-panel-2 px-4 py-3 text-left transition-colors hover:border-brand/40"
            >
              <span className="min-w-0">
                <span className="block truncate text-[12.5px] font-medium text-ink-2">{s.name}</span>
                {s.reason ? <span className="block truncate text-[10.5px] text-faint">{s.reason}</span> : null}
              </span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-faint transition-colors group-hover:text-brand-2" />
            </button>
          ))}
        </div>
      ) : null}

      {cmp.notes.length ? (
        <ul className="mt-4 space-y-1 border-t border-line pt-3">
          {cmp.notes.map((n) => (
            <li key={n} className="text-[10px] leading-relaxed text-faint">
              · {n}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
