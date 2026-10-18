"use client";

import { AlertTriangle, Bot, Building2, HeartPulse, Loader2, ShieldCheck } from "lucide-react";
import { inr, pct } from "@/lib/format";
import type { DualTrackComparison, Kendra } from "@/lib/schemas";

export function ClinicalSaltBanner({
  cmp,
  kendras,
  onFindKendra,
  agentRunning,
}: {
  cmp: DualTrackComparison;
  kendras: Kendra[] | null;
  onFindKendra: () => void;
  agentRunning: boolean;
}) {
  const benchmark = cmp.govt_benchmark;
  const seeded = benchmark?.nearest_walk_in_kendra ?? null;
  const kendraList = kendras ?? (seeded ? [seeded] : []);

  return (
    <section className="rounded-2xl border border-line bg-panel p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="text-[15px] font-semibold tracking-tight">{cmp.active_salt}</h2>
        <span className="rounded-full border border-line bg-panel-2 px-2.5 py-1 text-[10px] text-mute">
          query: {cmp.query_brand}
        </span>
        {benchmark ? (
          <span className="rounded-full border border-brand/40 bg-brand/10 px-2.5 py-1 text-[10px] font-medium text-brand-2">
            PMBJP ceiling {inr(benchmark.official_mrp_per_10_tabs_inr)} / 10 tabs
          </span>
        ) : null}
        {cmp.best_savings_percent > 0 ? (
          <span className="rounded-full border border-brand/40 bg-brand/10 px-2.5 py-1 text-[10px] font-semibold text-brand-2">
            Save up to {pct(cmp.best_savings_percent)} with generics
          </span>
        ) : null}
        <span
          className={`ml-auto rounded-full border px-2.5 py-1 text-[10px] ${
            cmp.data_source === "live" ? "border-brand/40 bg-brand/10 text-brand-2" : "border-warn/40 bg-warn/10 text-warn"
          }`}
        >
          {cmp.data_source === "live" ? "LIVE DATA" : "DEMO DATA"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-line bg-inset p-3.5">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-brand-2">
            <ShieldCheck className="h-3.5 w-3.5" />
            Official benchmark
          </div>
          {benchmark ? (
            <>
              <div className="mt-1.5 font-mono text-lg font-semibold">
                {inr(benchmark.official_mrp_per_10_tabs_inr)}
                <span className="text-[10px] font-normal text-faint"> / 10 tabs</span>
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-faint">
                {benchmark.certification} · bioequivalence {benchmark.bioequivalence_index_percent ?? "—"}% · drug code{" "}
                {benchmark.drug_code ?? "—"}
              </p>
            </>
          ) : (
            <p className="mt-1.5 text-[11px] leading-relaxed text-faint">
              No PMBJP master entry for this salt — generics are compared against live branded listings instead.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-line bg-inset p-3.5">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-ink-2">
            <Building2 className="h-3.5 w-3.5 text-faint" />
            Jan Aushadhi Kendra near {cmp.user_pincode}
          </div>
          {kendraList.length ? (
            <ul className="mt-1.5 space-y-1.5">
              {kendraList.slice(0, 3).map((k) => (
                <li key={k.kendra_id} className="text-[10px] leading-relaxed text-mute">
                  <span className="font-medium text-ink-2">{k.name}</span>
                  {k.distance_km != null ? <span className="text-faint"> · {k.distance_km} km</span> : null}
                  <br />
                  {k.address}
                  {k.stock_note ? <span className="text-faint"> · {k.stock_note}</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5 text-[11px] text-faint">No kendra loaded yet.</p>
          )}
          <button
            type="button"
            onClick={onFindKendra}
            disabled={agentRunning}
            className="mt-2 flex items-center gap-1.5 rounded-lg border border-line bg-panel-2 px-2.5 py-1 text-[10px] text-mute transition-colors hover:border-brand/40 hover:text-brand-2 disabled:opacity-50"
          >
            {agentRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bot className="h-3 w-3" />}
            Find live via UMANG agent
          </button>
        </div>

        <div className="rounded-xl border border-line bg-inset p-3.5">
          {cmp.amrit_hospital_alert ? (
            <>
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-warn">
                <HeartPulse className="h-3.5 w-3.5" />
                AMRIT hospital alert
              </div>
              <p className="mt-1.5 text-[10px] leading-relaxed text-mute">{cmp.amrit_hospital_alert.message}</p>
              <ul className="mt-1.5 space-y-1 text-[10px] text-faint">
                {cmp.amrit_hospital_alert.outlets.map((o) => (
                  <li key={o.kendra_id}>{o.name} — {o.address}</li>
                ))}
              </ul>
            </>
          ) : cmp.safety_tip ? (
            <>
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-ink-2">
                <HeartPulse className="h-3.5 w-3.5 text-faint" />
                Safety tip
              </div>
              <p className="mt-1.5 text-[10px] leading-relaxed text-mute">{cmp.safety_tip.en}</p>
              <p className="mt-1 text-[10px] leading-relaxed text-faint">{cmp.safety_tip.hi}</p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-ink-2">
                <HeartPulse className="h-3.5 w-3.5 text-faint" />
                Before switching brands
              </div>
              <p className="mt-1.5 text-[10px] leading-relaxed text-mute">
                Generics are salt-equivalent, but confirm any substitution with your doctor or pharmacist.
              </p>
              <p className="mt-1 text-[10px] leading-relaxed text-faint">
                जेनेरिक दवाएँ नमक के आधार पर समान हैं — बदलने से पहले डॉक्टर या फार्मासिस्ट से पुष्टि करें।
              </p>
            </>
          )}
        </div>
      </div>

      {cmp.notes.length ? (
        <ul className="mt-3 space-y-1">
          {cmp.notes.slice(0, 4).map((n, i) => (
            <li key={i} className="flex items-start gap-1.5 text-[10px] leading-relaxed text-faint">
              <AlertTriangle
                className={`mt-0.5 h-3 w-3 shrink-0 ${
                  /failed|incomplete|demo data/i.test(n) ? "text-warn" : "text-line-2"
                }`}
              />
              {n}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
