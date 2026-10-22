"use client";

import { CheckCircle2, Clock, ExternalLink, Loader2, Pill, ShieldCheck, ShoppingBag, Bot, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { AGENT_SCOPE_LABEL, type AgentScope } from "@/lib/agent-scope";
import { useLanguage } from "@/lib/i18n";
import { inr0, hostOf, timeAgo } from "@/lib/format";
import type { CartMode, DualTrackComparison, Offer } from "@/lib/schemas";

function StockLine({
  offer,
  onRun,
  disabled,
}: {
  offer: Offer;
  onRun: () => void;
  disabled: boolean;
}) {
  const { tr } = useLanguage();
  if (offer.in_stock === true) {
    return (
      <span className="inline-flex items-center gap-1 text-brand-2">
        <CheckCircle2 className="h-3 w-3" />
        {tr("In stock", "स्टॉक में")}
        {offer.verified_by.includes("Agent") ? tr(" - agent-verified", " - एजेंट से जाँचा") : ""}
      </span>
    );
  }
  if (offer.in_stock === false) {
    return (
      <span className="inline-flex items-center gap-1 text-danger">
        <XCircle className="h-3 w-3" />
        {tr("Out of stock at pincode", "इस पिनकोड पर स्टॉक नहीं")}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onRun}
      disabled={disabled}
      className="inline-flex items-center gap-1 text-faint transition-colors hover:text-brand-2 disabled:cursor-not-allowed disabled:opacity-50"
      title={tr("Run the live browser agent on this exact listing", "इसी दवा पर लाइव ब्राउज़र एजेंट चलाएँ")}
    >
      <Bot className="h-3 w-3" />
      {tr("Stock unverified - run agent", "स्टॉक नहीं जाँचा - एजेंट चलाएँ")}
    </button>
  );
}

function OfferCard({
  offer,
  accent,
  added,
  generatedAt,
  onAdd,
  onVerify,
  verifyDisabled,
}: {
  offer: Offer;
  accent: "generic" | "branded";
  added: boolean;
  generatedAt?: string;
  onAdd: () => void;
  onVerify: () => void;
  verifyDisabled: boolean;
}) {
  const { tr } = useLanguage();
  const border =
    accent === "generic"
      ? "border-brand/25 hover:border-brand/50"
      : "border-line hover:border-line-2";
  const badgeStyle =
    accent === "generic"
      ? "border-brand/40 bg-brand/10 text-brand-2"
      : "border-line-2 bg-panel-2 text-mute";

  return (
    <article className={`flex flex-col gap-2.5 rounded-xl border bg-inset p-4 transition-colors ${border}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-semibold tracking-wide text-ink-2">{offer.platform}</span>
        {offer.badges.slice(0, 2).map((b) => (
          <span key={b} className={`rounded-full border px-2 py-0.5 text-[9px] font-medium tracking-wide ${badgeStyle}`}>
            {b}
          </span>
        ))}
        {offer.nabl_lab_report_verified ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-brand/40 bg-brand/10 px-2 py-0.5 text-[9px] font-medium text-brand-2">
            <ShieldCheck className="h-2.5 w-2.5" />
            NABL {offer.nabl_batch_id ?? "verified"}
          </span>
        ) : null}
      </div>

      <p className="line-clamp-2 text-[12px] leading-snug text-mute" title={offer.product_name}>
        {offer.product_name}
      </p>

      <div className="flex items-end gap-2">
        <span className="font-mono text-[22px] font-semibold leading-none tracking-tight">{inr0(offer.price_inr)}</span>
        {offer.mrp_inr && offer.mrp_inr > offer.price_inr ? (
          <>
            <span className="font-mono text-[11px] text-faint line-through">{inr0(offer.mrp_inr)}</span>
            <span className="rounded-md border border-brand/40 bg-brand/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand-2">
              −{Math.round(offer.discount_percent)}%
            </span>
          </>
        ) : null}
      </div>

      <div className="font-mono text-[10px] text-faint">
        {inr0(offer.price_per_10_tabs_inr)} / 10 tabs · ₹{offer.price_per_tab_inr.toFixed(2)} / tab · pack {offer.pack_size}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-mute">
        {offer.delivery_eta.toLowerCase().includes("run agent") ? (
          <button
            type="button"
            onClick={onVerify}
            disabled={verifyDisabled}
            className="inline-flex items-center gap-1 text-faint transition-colors hover:text-brand-2 disabled:cursor-not-allowed disabled:opacity-50"
            title="Run the live browser agent on this exact listing"
          >
            <Clock className="h-3 w-3" />
            {offer.delivery_eta}
          </button>
        ) : (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3 text-faint" />
            {offer.delivery_eta}
          </span>
        )}
        <StockLine offer={offer} onRun={onVerify} disabled={verifyDisabled} />
        {offer.equivalence_percent ? <span className="text-faint">equivalence {offer.equivalence_percent}%</span> : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line pt-2 text-[9.5px] text-faint">
        <span className="inline-flex min-w-0 items-center gap-1" title="How this price was verified">
          <ShieldCheck className="h-2.5 w-2.5 shrink-0 text-brand-2/80" />
          <span className="truncate">
            {offer.verified_by === "demo-seed" ? "demo fixture" : `verified · ${offer.verified_by}`}
          </span>
        </span>
        {offer.product_url ? (
          <a
            href={offer.product_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 transition-colors hover:text-brand-2"
            title={`Open the source listing on ${hostOf(offer.product_url)}`}
          >
            {hostOf(offer.product_url)}
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
        ) : null}
        {generatedAt ? (
          <span className="ml-auto" title={`Prices generated at ${new Date(generatedAt).toLocaleString("en-IN")}`}>
            as of {timeAgo(generatedAt)}
          </span>
        ) : null}
      </div>

      {accent === "generic" && offer.savings_vs_branded_percent > 0 ? (
        <p className="text-[11px] font-medium text-brand-2">Save {Math.round(offer.savings_vs_branded_percent)}% vs branded reference price</p>
      ) : null}

      <div className="mt-auto flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={onAdd}
          className={`flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
            added
              ? "border border-brand/50 bg-brand/15 text-brand-2"
              : accent === "generic"
                ? "bg-brand text-white hover:bg-brand-hover"
                : "border border-line-2 bg-panel-2 text-ink-2 hover:border-brand/50 hover:text-ink"
          }`}
        >
          <ShoppingBag className="h-3 w-3" />
          {added ? tr("In cart", "कार्ट में") : accent === "generic" ? tr("Add refill", "रीफिल जोड़ें") : tr("Add express", "एक्सप्रेस जोड़ें")}
        </button>
        {offer.product_url ? (
          <a
            href={offer.product_url}
            target="_blank"
            rel="noreferrer"
            className="grid h-8 w-8 place-items-center rounded-lg border border-line text-faint transition-colors hover:border-line-2 hover:text-ink-2"
            title={`Open listing on ${hostOf(offer.product_url)}`}
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
      </div>
    </article>
  );
}

function ColumnHeader({
  icon,
  title,
  subtitle,
  count,
  action,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  count: number;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      {icon}
      <div className="leading-tight">
        <div className="text-[13px] font-semibold">{title}</div>
        <div className="text-[10px] text-faint">{subtitle}</div>
      </div>
      <span className="ml-1 rounded-full border border-line bg-panel-2 px-2 py-0.5 font-mono text-[10px] text-mute">{count}</span>
      {action ? <div className="ml-auto">{action}</div> : null}
    </div>
  );
}

function AgentLiveStrip({ label }: { label: string }) {
  return (
    <div className="mt-3 flex items-center gap-2 rounded-lg border border-brand/40 bg-brand/10 px-3 py-2 text-[10px] font-medium text-brand-2">
      <span className="dot-live h-1.5 w-1.5 rounded-full bg-brand" />
      Agent live - checking {label} in the PiP browser
    </div>
  );
}

export function DualTrackGrid({
  cmp,
  cart,
  onAdd,
  onVerifyScope,
  onVerifyOffer,
  agentRunning,
  agentScope,
  verifyDisabled,
  verifyTitle,
}: {
  cmp: DualTrackComparison;
  cart: Record<string, CartMode>;
  onAdd: (query: string, mode: CartMode) => void;
  onVerifyScope: (scope: AgentScope) => void;
  onVerifyOffer: (offer: Offer, accent: "generic" | "branded") => void;
  agentRunning: boolean;
  agentScope: AgentScope | null;
  verifyDisabled: boolean;
  verifyTitle: string;
}) {
  const { tr } = useLanguage();
  const allCount = cmp.subsidised_generic_online.length + cmp.branded_express_online.length;
  const liveLabel = agentScope && agentScope !== "all" ? AGENT_SCOPE_LABEL[agentScope] : "all medicine offers";
  const runDisabled = agentRunning || verifyDisabled || allCount === 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-line bg-panel px-3.5 py-2.5">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-2">
          <Bot className="h-3.5 w-3.5 text-brand-2" />
          {tr("Agent Run", "एजेंट चलाएँ")}
        </span>
        <span className="text-[10px] text-faint">
          {tr(
            "Verify every displayed medicine link in the live browser - generic + branded.",
            "लाइव ब्राउज़र में हर दवा की जाँच करें - जेनेरिक और ब्रांडेड।",
          )}
        </span>
        <button
          type="button"
          onClick={() => onVerifyScope("all")}
          disabled={runDisabled}
          className="ml-auto flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-[11px] font-semibold text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
          title={verifyTitle}
        >
          {agentRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bot className="h-3 w-3" />}
          {tr("Agent Run", "एजेंट चलाएँ")}
        </button>
      </div>

      {agentRunning ? (
        <div className="flex items-center gap-2 rounded-lg border border-brand/30 bg-brand/5 px-3 py-1.5 text-[10px] text-brand-2">
          <span className="dot-live h-1.5 w-1.5 rounded-full bg-brand" />
          Live agent is verifying {liveLabel}. Watch the browser in the bottom-right dock.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-line bg-panel p-5">
          <ColumnHeader
            icon={
              <span className="grid h-8 w-8 place-items-center rounded-lg border border-brand/40 bg-brand/10">
                <Pill className="h-4 w-4 text-brand-2" />
              </span>
            }
            title={tr("Subsidised generic - Track B", "सस्ती जेनेरिक - Track B")}
            subtitle={tr("Salt-matched - strength-guarded - NABL checked", "सॉल्ट से मिलान - सही स्ट्रेंथ - NABL जाँच")}
            count={cmp.subsidised_generic_online.length}
            action={
              <button
                type="button"
                onClick={() => onVerifyScope("generic")}
                disabled={runDisabled || cmp.subsidised_generic_online.length === 0}
                className="flex items-center gap-1.5 rounded-lg border border-line bg-panel-2 px-2.5 py-1.5 text-[10px] text-mute transition-colors hover:border-brand/40 hover:text-brand-2 disabled:opacity-50"
                title="Run the live browser agent on every generic listing"
              >
                {agentRunning && (agentScope === "all" || agentScope === "generic") ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Bot className="h-3 w-3" />
                )}
                {tr("Run generics", "जेनेरिक जाँचें")}
              </button>
            }
          />
          <div className="space-y-3">
            {cmp.subsidised_generic_online.length ? (
              cmp.subsidised_generic_online.map((offer) => (
                <OfferCard
                  key={`${offer.platform}-${offer.product_url ?? offer.product_name}`}
                  offer={offer}
                  accent="generic"
                  added={cart[cmp.query_brand] === "refill"}
                  generatedAt={cmp.generated_at}
                  onAdd={() => onAdd(cmp.query_brand, "refill")}
                  onVerify={() => onVerifyOffer(offer, "generic")}
                  verifyDisabled={runDisabled}
                />
              ))
            ) : (
              <p className="rounded-xl border border-dashed border-line-2 p-6 text-center text-[11px] text-faint">
                No generic listing passed the strength guard for this query.
              </p>
            )}
          </div>
          {agentRunning && (agentScope === "all" || agentScope === "generic") ? (
            <AgentLiveStrip label="subsidised generic listings" />
          ) : null}
        </section>

        <section className="rounded-2xl border border-line bg-panel p-5">
          <ColumnHeader
            icon={
              <span className="grid h-8 w-8 place-items-center rounded-lg border border-line-2 bg-panel-2">
                <ShoppingBag className="h-4 w-4 text-mute" />
              </span>
            }
            title={tr("Branded express - Track C", "ब्रांडेड एक्सप्रेस - Track C")}
            subtitle={tr("Original brands - ETA verified on demand", "असली ब्रांड - माँग पर डिलीवरी की जाँच")}
            count={cmp.branded_express_online.length}
            action={
              <button
                type="button"
                onClick={() => onVerifyScope("branded")}
                disabled={runDisabled || cmp.branded_express_online.length === 0}
                className="flex items-center gap-1.5 rounded-lg border border-line bg-panel-2 px-2.5 py-1.5 text-[10px] text-mute transition-colors hover:border-brand/40 hover:text-brand-2 disabled:opacity-50"
                title="Run the live browser agent on every branded express listing"
              >
                {agentRunning && (agentScope === "all" || agentScope === "branded") ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Bot className="h-3 w-3" />
                )}
                {tr("Run branded", "ब्रांडेड जाँचें")}
              </button>
            }
          />
          <div className="space-y-3">
            {cmp.branded_express_online.length ? (
              cmp.branded_express_online.map((offer) => (
                <OfferCard
                  key={`${offer.platform}-${offer.product_url ?? offer.product_name}`}
                  offer={offer}
                  accent="branded"
                  added={cart[cmp.query_brand] === "urgent"}
                  generatedAt={cmp.generated_at}
                  onAdd={() => onAdd(cmp.query_brand, "urgent")}
                  onVerify={() => onVerifyOffer(offer, "branded")}
                  verifyDisabled={runDisabled}
                />
              ))
            ) : (
              <p className="rounded-xl border border-dashed border-line-2 p-6 text-center text-[11px] text-faint">
                No branded listing matched this query.
              </p>
            )}
          </div>
          {agentRunning && (agentScope === "all" || agentScope === "branded") ? (
            <AgentLiveStrip label="branded express listings" />
          ) : null}
        </section>
      </div>
    </div>
  );
}
