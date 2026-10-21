"use client";

import { Check, Copy, Minus, Plus, Wallet } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { clockOf, inr0, pct } from "@/lib/format";
import type { DualTrackComparison } from "@/lib/schemas";

/**
 * Turns the comparison into a plain-language savings receipt.
 *
 * Everything shown here is derived from the real offers in this comparison:
 * cheapest strength-matched generic vs the branded reference (both already
 * normalised per 10 tabs). The monthly/yearly figures are an explicit
 * projection from an adjustable "strips per month" assumption — never a
 * fabricated usage statistic.
 */
export function SavingsReceipt({ cmp }: { cmp: DualTrackComparison }) {
  const [strips, setStrips] = useState(2);
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const cheapest = useMemo(() => {
    const list = cmp.subsidised_generic_online;
    if (!list.length) return null;
    return list.reduce((best, offer) => (offer.price_per_10_tabs_inr < best.price_per_10_tabs_inr ? offer : best));
  }, [cmp.subsidised_generic_online]);

  const brandedPer10 = useMemo(() => {
    if (cmp.branded_reference_per_10_tabs_inr != null) return cmp.branded_reference_per_10_tabs_inr;
    if (!cmp.branded_express_online.length) return null;
    return Math.min(...cmp.branded_express_online.map((o) => o.price_per_10_tabs_inr));
  }, [cmp.branded_reference_per_10_tabs_inr, cmp.branded_express_online]);

  if (!cheapest || brandedPer10 == null) return null;
  const perStrip = brandedPer10 - cheapest.price_per_10_tabs_inr;
  if (perStrip <= 0) return null;

  const savePercent = Math.round((perStrip / brandedPer10) * 100);
  const monthly = perStrip * strips;
  const yearly = monthly * 12;

  const receiptText = (): string => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const asOf = new Date(cmp.generated_at);
    return [
      "MedPulse AI — savings receipt",
      `${cmp.query_brand} (${cmp.active_salt})`,
      "",
      `Generic : ${inr0(cheapest.price_per_10_tabs_inr)} / 10-tab strip — ${cheapest.platform}`,
      `Branded : ${inr0(brandedPer10)} / 10-tab strip (reference)`,
      `Savings : ${inr0(perStrip)} per strip — ${pct(savePercent)} less`,
      "",
      `Projection: ${strips} strip${strips === 1 ? "" : "s"}/month ≈ ${inr0(monthly)}/month · ${inr0(yearly)}/year`,
      `Prices as of ${asOf.toLocaleString("en-IN")} · ${cmp.data_source === "live" ? "live listings" : "demo fixtures"}`,
      "Projection only — confirm the final price, pack size and dose at checkout.",
      origin,
    ]
      .filter(Boolean)
      .join("\n");
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(receiptText());
      setCopied("ok");
    } catch {
      window.prompt("Copy your savings receipt", receiptText());
      setCopied("fail");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied("idle"), 2200);
  };

  return (
    <section className="rounded-2xl border border-brand/30 bg-panel p-5">
      <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-brand-2">
              <Wallet className="h-3.5 w-3.5" />
              What switching saves you
            </span>
            {cmp.data_source === "demo" ? (
              <span className="rounded-full border border-warn/40 bg-warn/10 px-2 py-0.5 text-[9px] text-warn">
                demo prices
              </span>
            ) : null}
          </div>
          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
            <span className="font-mono text-[28px] font-semibold leading-none tracking-tight">{inr0(perStrip)}</span>
            <span className="text-[11px] text-faint">per 10-tab strip · {pct(savePercent)} less than branded</span>
          </div>
          <p className="mt-2 max-w-xl text-[11px] leading-relaxed text-mute">
            {inr0(cheapest.price_per_10_tabs_inr)} generic ({cheapest.platform}) vs {inr0(brandedPer10)} branded
            reference
            {cmp.govt_benchmark ? ` · PMBJP ceiling ${inr0(cmp.govt_benchmark.official_mrp_per_10_tabs_inr)}` : ""}
          </p>
        </div>

        <div className="ml-auto rounded-xl border border-line bg-inset p-3.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStrips((s) => Math.max(1, s - 1))}
              aria-label="Fewer strips per month"
              className="grid h-6 w-6 place-items-center rounded-md border border-line text-mute transition-colors hover:border-brand/40 hover:text-brand-2"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="w-10 text-center font-mono text-[13px] font-semibold">{strips}</span>
            <button
              type="button"
              onClick={() => setStrips((s) => Math.min(12, s + 1))}
              aria-label="More strips per month"
              className="grid h-6 w-6 place-items-center rounded-md border border-line text-mute transition-colors hover:border-brand/40 hover:text-brand-2"
            >
              <Plus className="h-3 w-3" />
            </button>
            <span className="text-[10px] text-faint">strips / month</span>
          </div>
          <div className="mt-2 font-mono text-[13px] font-semibold text-brand-2">
            {inr0(monthly)}
            <span className="text-[10px] font-normal text-faint"> / month</span>
            <span className="text-faint"> · </span>
            {inr0(yearly)}
            <span className="text-[10px] font-normal text-faint"> / year</span>
          </div>
          <div className="mt-1 text-[9.5px] text-faint">
            Projection — 1 strip = 10 tablets · prices as of {clockOf(cmp.generated_at)}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <p className="max-w-xl text-[9.5px] leading-relaxed text-faint">
          Based on the real listings above — cheapest strength-matched generic vs the branded reference. Confirm pack
          size and dose with your doctor or pharmacist before switching.
        </p>
        <button
          type="button"
          onClick={() => void onCopy()}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-line bg-panel-2 px-3 py-1.5 text-[10px] font-medium text-mute transition-colors hover:border-brand/40 hover:text-brand-2"
        >
          {copied === "ok" ? <Check className="h-3 w-3 text-brand-2" /> : <Copy className="h-3 w-3" />}
          {copied === "ok" ? "Receipt copied" : copied === "fail" ? "Copy manually" : "Copy receipt"}
        </button>
      </div>
    </section>
  );
}
