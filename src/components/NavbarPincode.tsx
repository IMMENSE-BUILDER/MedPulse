"use client";

import { Bot, ChevronDown, Crown, Loader2, LocateFixed, MapPin, Stethoscope, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLanguage } from "@/lib/i18n";
import { AGENT_SCOPE_LABEL, AGENT_SCOPE_SHORT, type AgentScope } from "@/lib/agent-scope";

export function NavbarPincode({
  mode,
  keys,
  pincode,
  onPincode,
  autoVerify,
  onAutoVerify,
  onOpenAgent,
  onOpenDocAi,
  onOpenPremium,
  premiumActive,
  onLocate,
  locating,
  locateMsg,
  agentRunning,
}: {
  mode: "live" | "demo" | null;
  keys: { tinyfish: boolean; gateway: boolean } | null;
  pincode: string;
  onPincode: (value: string) => void;
  autoVerify: AgentScope | null;
  onAutoVerify: (scope: AgentScope | null) => void;
  onOpenAgent: () => void;
  onOpenDocAi: () => void;
  onOpenPremium: () => void;
  premiumActive: boolean;
  onLocate: () => void;
  locating: boolean;
  locateMsg: string | null;
  agentRunning: boolean;
}) {
  const [draft, setDraft] = useState(pincode);
  const [autoOpen, setAutoOpen] = useState(false);
  const { lang, tr } = useLanguage();
  useEffect(() => setDraft(pincode), [pincode]);
  const valid = /^\d{6}$/.test(draft);

  const chooseAuto = (scope: AgentScope | null) => {
    onAutoVerify(scope);
    setAutoOpen(false);
  };

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
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-2 px-4 lg:px-6">
        <Link href="/" aria-label="MedPulse AI home" className="shrink-0">
          <Logo className="h-9 w-auto sm:h-11" />
        </Link>

        <div className="ml-auto flex items-center gap-2">
          {modeChip}
          <button
            type="button"
            onClick={onOpenPremium}
            className={`hidden h-9 items-center gap-1.5 rounded-xl border px-3 text-[11px] font-semibold transition-colors sm:flex ${
              premiumActive
                ? "border-warn/50 bg-warn/10 text-warn"
                : "border-line bg-panel-2 text-mute hover:border-warn/40 hover:text-warn"
            }`}
            title={`MedPulse Premium - ₹299/month mock preview`}
          >
            <Crown className="h-3.5 w-3.5" />
            {tr("Premium", "प्रीमियम")}
          </button>
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
            onClick={() => setAutoOpen(true)}
            className={`hidden h-9 items-center gap-2 rounded-xl border px-3 text-[12px] transition-colors md:flex ${
              autoVerify ? "border-brand/40 bg-brand/10 text-brand-2" : "border-line bg-inset text-mute hover:text-ink-2"
            }`}
            title="Choose what the live browser agent should verify automatically"
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
            {autoVerify ? (lang === "hi" ? `ऑटो: ${AGENT_SCOPE_SHORT[autoVerify]}` : `Auto: ${AGENT_SCOPE_SHORT[autoVerify]}`) : tr("Auto-verify", "अपने आप जाँच")}
            <ChevronDown className="h-3 w-3 opacity-70" />
          </button>

          <button
            type="button"
            onClick={onOpenDocAi}
            className="flex h-9 items-center gap-2 rounded-xl border border-brand/30 bg-brand/10 px-3 text-[12px] font-medium text-brand-2 transition-colors hover:border-brand/60"
            title="DocAI — general medical help & consulting"
          >
            <Stethoscope className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{tr("DocAI", "DocAI")}</span>
          </button>

          <button
            type="button"
            onClick={onOpenAgent}
            className="flex h-9 items-center gap-2 rounded-xl border border-line bg-panel-2 px-3 text-[12px] font-medium text-ink-2 transition-colors hover:border-line-2 hover:text-ink"
          >
            {agentRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" /> : <Bot className="h-3.5 w-3.5" />}
            {tr("Agent", "एजेंट")}
          </button>

          <LanguageToggle />
        </div>
      </div>
    </header>

      {autoOpen ? (
        <div
          className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4"
          role="presentation"
          onMouseDown={() => setAutoOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="auto-verify-title"
            className="w-full max-w-md rounded-2xl border border-line bg-panel p-4 shadow-pop"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-brand/40 bg-brand/10">
                <Bot className="h-4 w-4 text-brand-2" />
              </span>
              <div className="min-w-0">
                <h2 id="auto-verify-title" className="text-sm font-semibold">
                  {tr("Auto-verify with the live agent", "लाइव एजेंट से अपने आप जाँच")}
                </h2>
                <p className="mt-1 text-[11px] leading-relaxed text-mute">
                  {tr(
                    "Choose which listings the browser agent should check. It runs immediately on the current live results and on every new live comparison.",
                    "चुनें कि ब्राउज़र एजेंट किन दवाओं की जाँच करे। यह मौजूदा नतीजों पर तुरंत चलेगा और हर नई लाइव तुलना पर दोबारा चलेगा।",
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAutoOpen(false)}
                className="ml-auto grid h-7 w-7 shrink-0 place-items-center rounded-lg text-faint transition-colors hover:bg-panel-2 hover:text-ink-2"
                aria-label="Close auto-verify choices"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {(["generic", "branded", "all"] as const).map((scope) => (
                <button
                  key={scope}
                  type="button"
                  onClick={() => chooseAuto(scope)}
                  className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                    autoVerify === scope
                      ? "border-brand/50 bg-brand/10"
                      : "border-line bg-inset hover:border-brand/40 hover:bg-brand/5"
                  }`}
                >
                  <Bot className="mt-0.5 h-4 w-4 shrink-0 text-brand-2" />
                  <span>
                    <span className="block text-[12px] font-medium text-ink-2">
                      {scope === "generic"
                        ? tr("Subsidised generic substitutes", "सस्ती जेनेरिक दवाइयाँ")
                        : scope === "branded"
                          ? tr("Branded express medicines", "ब्रांडेड दवाइयाँ")
                          : tr("All medicine offers", "सभी दवाइयाँ")}
                    </span>
                    <span className="mt-0.5 block text-[10px] leading-relaxed text-faint">
                      {scope === "generic"
                        ? tr("Run every Track B generic listing in the live browser.", "लाइव ब्राउज़र में सभी Track B जेनेरिक दवाइयाँ जाँचें।")
                        : scope === "branded"
                          ? tr("Run every Track C branded express listing in the live browser.", "लाइव ब्राउज़र में सभी Track C ब्रांडेड दवाइयाँ जाँचें।")
                          : tr("Run every generic and branded medicine link in one pass.", "सभी जेनेरिक और ब्रांडेड दवाओं को एक साथ जाँचें।")}
                    </span>
                  </span>
                </button>
              ))}

              {autoVerify ? (
                <button
                  type="button"
                  onClick={() => chooseAuto(null)}
                  className="w-full rounded-xl border border-line px-3 py-2 text-[11px] text-mute transition-colors hover:border-danger/40 hover:text-danger"
                >
                  {tr("Turn off auto-verify", "अपने आप जाँच बंद करें")}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
