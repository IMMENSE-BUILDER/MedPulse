"use client";

import { Bot, Loader2, LocateFixed, MapPin, Stethoscope } from "lucide-react";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";

export function NavbarPincode({
  mode,
  keys,
  pincode,
  onPincode,
  autoVerify,
  onAutoVerify,
  onOpenAgent,
  onOpenDocAi,
  onLocate,
  locating,
  locateMsg,
  agentRunning,
}: {
  mode: "live" | "demo" | null;
  keys: { tinyfish: boolean; gateway: boolean } | null;
  pincode: string;
  onPincode: (value: string) => void;
  autoVerify: boolean;
  onAutoVerify: (value: boolean) => void;
  onOpenAgent: () => void;
  onOpenDocAi: () => void;
  onLocate: () => void;
  locating: boolean;
  locateMsg: string | null;
  agentRunning: boolean;
}) {
  const [draft, setDraft] = useState(pincode);
  useEffect(() => setDraft(pincode), [pincode]);
  const valid = /^\d{6}$/.test(draft);

  const modeChip =
    mode === "live" ? (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand/10 px-2.5 py-1 text-[11px] font-medium text-brand-2">
        <span className="dot-live h-1.5 w-1.5 rounded-full bg-brand" />
        LIVE
      </span>
    ) : (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border border-warn/40 bg-warn/10 px-2.5 py-1 text-[11px] font-medium text-warn"
        title="Labelled demo data. Add API keys in .env.local to go live."
      >
        <span className="h-1.5 w-1.5 rounded-full bg-warn" />
        DEMO
      </span>
    );

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-2 px-4 lg:px-6">
        <div className="grid h-7 w-7 place-items-center rounded-lg bg-brand text-[12px] font-bold text-[#03150f]">MP</div>
        <div className="mr-2 leading-tight">
          <div className="text-sm font-semibold tracking-tight">MedPulse AI</div>
          <div className="hidden text-[10px] text-faint sm:block">branded ⇄ generic price engine</div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {modeChip}
          {locateMsg ? (
            <span className="hidden max-w-[240px] truncate text-[10px] text-warn md:inline" title={locateMsg}>
              {locateMsg}
            </span>
          ) : null}

          <label
            className={`flex h-9 items-center gap-1.5 rounded-xl border bg-inset px-2.5 ${
              valid ? "border-line" : "border-danger/60"
            }`}
            title={keys ? `TinyFish key: ${keys.tinyfish ? "set" : "missing"} · Gateway key: ${keys.gateway ? "set" : "missing"}` : ""}
          >
            <MapPin className="h-3.5 w-3.5 text-faint" />
            <input
              value={draft}
              onChange={(e) => {
                const next = e.target.value.replace(/\D/g, "").slice(0, 6);
                setDraft(next);
                if (/^\d{6}$/.test(next)) onPincode(next);
              }}
              onBlur={() => {
                if (!valid) setDraft(pincode);
              }}
              inputMode="numeric"
              aria-label="Delivery pincode"
              className="w-[74px] bg-transparent text-center font-mono text-[12px] outline-none placeholder:text-faint"
              placeholder="pincode"
            />
          </label>

          <button
            type="button"
            onClick={onLocate}
            disabled={locating}
            className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-inset text-mute transition-colors hover:border-brand/40 hover:text-brand-2 disabled:opacity-60"
            title="Use my current location to set the delivery pincode (asks for permission)"
          >
            {locating ? <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" /> : <LocateFixed className="h-3.5 w-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => onAutoVerify(!autoVerify)}
            className={`hidden h-9 items-center gap-2 rounded-xl border px-3 text-[12px] transition-colors md:flex ${
              autoVerify ? "border-brand/40 bg-brand/10 text-brand-2" : "border-line bg-inset text-mute hover:text-ink-2"
            }`}
            title="Automatically verify branded stock with the live browser agent after a live comparison"
          >
            <span
              className={`relative h-4 w-7 rounded-full transition-colors ${autoVerify ? "bg-brand/70" : "bg-line-2"}`}
            >
              <span
                className={`absolute top-0.5 h-3 w-3 rounded-full bg-ink transition-all ${
                  autoVerify ? "left-3.5" : "left-0.5"
                }`}
              />
            </span>
            Auto-verify
          </button>

          <button
            type="button"
            onClick={onOpenDocAi}
            className="flex h-9 items-center gap-2 rounded-xl border border-brand/30 bg-brand/10 px-3 text-[12px] font-medium text-brand-2 transition-colors hover:border-brand/60"
            title="DocAI — general medical help & consulting"
          >
            <Stethoscope className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">DocAI</span>
          </button>

          <button
            type="button"
            onClick={onOpenAgent}
            className="flex h-9 items-center gap-2 rounded-xl border border-line bg-panel-2 px-3 text-[12px] font-medium text-ink-2 transition-colors hover:border-line-2 hover:text-ink"
          >
            {agentRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" /> : <Bot className="h-3.5 w-3.5" />}
            Agent
          </button>

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
