"use client";

import { Bot, ChevronDown, ChevronUp, Loader2, MonitorPlay, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { AgentDockState } from "@/hooks/useAgentStream";

const LINE_STYLE: Record<string, string> = {
  start: "text-ink-2",
  log: "text-mute",
  url: "text-brand-2",
  done: "text-brand",
  error: "text-danger",
};

function timeOf(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-IN", { hour12: false });
}

export function LiveAgentPipDock({
  state,
  onClose,
  raised = false,
}: {
  state: AgentDockState;
  onClose: () => void;
  raised?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const termRef = useRef<HTMLDivElement>(null);
  const bottom = raised ? "bottom-20" : "bottom-4";
  const streamCount = state.streams.length;
  const wide = streamCount > 1;

  useEffect(() => {
    if (state.running) setCollapsed(false);
  }, [state.running]);

  useEffect(() => {
    const el = termRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.lines]);

  if (!state.open && !state.running) return null;

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className={`fixed ${bottom} right-4 z-50 flex h-10 items-center gap-2 rounded-full border border-line bg-panel px-4 text-[11px] text-mute shadow-pop transition-colors hover:border-brand/40 hover:text-brand-2`}
      >
        {state.running ? <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" /> : <Bot className="h-3.5 w-3.5" />}
        {streamCount > 0
          ? `${streamCount} agent view${streamCount === 1 ? "" : "s"}${state.running ? " running" : ""}`
          : state.running
            ? "Agent running..."
            : "Agent console"}
      </button>
    );
  }

  const dot = state.running ? "bg-brand dot-live" : state.ok === true ? "bg-brand" : state.ok === false ? "bg-danger" : "bg-faint";

  return (
    <aside
      className={`fixed ${bottom} right-4 z-50 ${
        wide ? "w-[min(96vw,780px)]" : "w-[min(92vw,400px)]"
      } overflow-hidden rounded-2xl border border-line bg-panel shadow-pop`}
    >
      <div className="flex h-11 items-center gap-2 border-b border-line px-3">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        <span className="truncate text-[11px] font-medium text-ink-2">{state.target ?? "Live agent"}</span>
        {streamCount > 0 ? (
          <span className="ml-1 rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 font-mono text-[9px] text-brand-2">
            {streamCount} live
          </span>
        ) : null}
        <span className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="grid h-7 w-7 place-items-center rounded-lg text-faint transition-colors hover:bg-panel-2 hover:text-ink-2"
            title="Collapse"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded-lg text-faint transition-colors hover:bg-panel-2 hover:text-danger"
            title="Close and stop"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </span>
      </div>

      {streamCount > 0 ? (
        <div className="border-b border-line p-2">
          <div className="mb-1.5 flex items-center gap-1.5 px-1 text-[10px] text-faint">
            <MonitorPlay className="h-3 w-3 text-brand" />
            {streamCount === 1 ? "live browser view" : `${streamCount} live browser views`}
            {state.running ? " - running in parallel" : ""}
          </div>
          <div
            className={`grid max-h-[52vh] gap-2 overflow-y-auto ${
              wide ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"
            }`}
          >
            {state.streams.map((stream) => (
              <div key={stream.id} className="overflow-hidden rounded-lg border border-line bg-black">
                <div className="flex items-center gap-1.5 border-b border-line bg-panel-2 px-2 py-1.5 text-[10px] text-faint">
                  <span className="dot-live h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                  <span className="truncate">{stream.label}</span>
                  <span className="ml-auto shrink-0 text-[8px] uppercase tracking-wider text-brand-2">live</span>
                </div>
                <iframe
                  src={stream.url}
                  title={`Live agent browser - ${stream.label}`}
                  className={`${wide ? "h-40" : "h-44"} w-full bg-black`}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div ref={termRef} className="max-h-36 space-y-1 overflow-y-auto p-3 font-mono text-[10.5px] leading-relaxed">
        {state.lines.map((line) => (
          <div key={line.id} className="flex gap-2">
            <span className="shrink-0 text-faint">{timeOf(line.ts)}</span>
            <span className={LINE_STYLE[line.kind] ?? "text-mute"}>{line.text}</span>
          </div>
        ))}
        {state.running ? (
          <div className="flex items-center gap-2 text-faint">
            <ChevronUp className="h-3 w-3 animate-pulse" />
            working...
          </div>
        ) : null}
      </div>

      {state.error && !state.running ? (
        <div className="border-t border-line px-3 py-2 text-[10px] leading-relaxed text-warn">{state.error}</div>
      ) : null}
    </aside>
  );
}
