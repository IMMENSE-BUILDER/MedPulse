"use client";

import { ExternalLink, FlaskConical, Home, Timer } from "lucide-react";
import { inr0, pct } from "@/lib/format";
import type { LabComparison } from "@/lib/schemas";

export function LabGrid({ labs }: { labs: LabComparison }) {
  return (
    <section className="rounded-2xl border border-line bg-panel p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg border border-brand/40 bg-brand/10">
          <FlaskConical className="h-4 w-4 text-brand-2" />
        </span>
        <div className="leading-tight">
          <div className="text-[13px] font-semibold">{labs.query} · Track D</div>
          <div className="text-[10px] text-faint">
            {labs.offers.length} labs · home collection in {labs.pincode}
          </div>
        </div>
        {labs.best_price_inr != null ? (
          <span className="rounded-full border border-brand/40 bg-brand/10 px-2.5 py-1 text-[10px] font-semibold text-brand-2">
            Best {inr0(labs.best_price_inr)} · save {pct(labs.best_savings_percent)} vs highest
          </span>
        ) : null}
        <span
          className={`ml-auto rounded-full border px-2.5 py-1 text-[10px] ${
            labs.data_source === "live" ? "border-brand/40 bg-brand/10 text-brand-2" : "border-warn/40 bg-warn/10 text-warn"
          }`}
        >
          {labs.data_source === "live" ? "LIVE DATA" : "DEMO DATA"}
        </span>
      </div>

      <div className="mt-4 space-y-2.5">
        {labs.offers.map((offer) => (
          <div
            key={`${offer.lab}-${offer.product_url ?? offer.test_name}`}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-inset p-4"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[13px] font-medium">
                {offer.lab}
                {offer.discount_percent > 0 ? (
                  <span className="rounded-md border border-brand/40 bg-brand/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand-2">
                    −{Math.round(offer.discount_percent)}%
                  </span>
                ) : null}
              </div>
              <div className="mt-0.5 text-[11px] text-mute">{offer.test_name}</div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-faint">
                {offer.parameters != null ? <span>{offer.parameters} parameters</span> : null}
                {offer.turnaround ? (
                  <span className="inline-flex items-center gap-1">
                    <Timer className="h-3 w-3" />
                    report in {offer.turnaround}
                  </span>
                ) : null}
                {offer.earliest_slot ? <span>slot: {offer.earliest_slot}</span> : null}
                {offer.home_collection ? (
                  <span className="inline-flex items-center gap-1">
                    <Home className="h-3 w-3" />
                    home collection
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="font-mono text-lg font-semibold leading-none">{inr0(offer.price_inr)}</div>
                {offer.mrp_inr && offer.mrp_inr > offer.price_inr ? (
                  <div className="mt-0.5 font-mono text-[10px] text-faint line-through">{inr0(offer.mrp_inr)}</div>
                ) : null}
              </div>
              {offer.product_url ? (
                <a
                  href={offer.product_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-line-2 bg-panel-2 px-3 text-[11px] text-ink-2 transition-colors hover:border-brand/50"
                >
                  Book
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {labs.notes.length ? (
        <ul className="mt-3 space-y-1">
          {labs.notes.slice(0, 3).map((n, i) => (
            <li key={i} className="text-[10px] text-faint">
              • {n}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
