"use client";

import { CheckCircle2, Clock, ExternalLink, Loader2, Pill, ShieldCheck, ShoppingBag, Bot, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { inr0, hostOf } from "@/lib/format";
import type { CartMode, DualTrackComparison, Offer } from "@/lib/schemas";

function StockLine({ offer }: { offer: Offer }) {
  if (offer.in_stock === true) {
    return (
      <span className="inline-flex items-center gap-1 text-brand-2">
        <CheckCircle2 className="h-3 w-3" />
        In stock{offer.verified_by.includes("Agent") ? " · agent-verified" : ""}
      </span>
    );
  }
  if (offer.in_stock === false) {
    return (
      <span className="inline-flex items-center gap-1 text-danger">
        <XCircle className="h-3 w-3" />
        Out of stock at pincode
      </span>
    );
  }
  return <span className="text-faint">Stock unverified — run agent</span>;
}

function OfferCard({
  offer,
  accent,
  added,
  onAdd,
}: {
  offer: Offer;
  accent: "generic" | "branded";
  added: boolean;
  onAdd: () => void;
}) {
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
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3 text-faint" />
          {offer.delivery_eta}
        </span>
        <StockLine offer={offer} />
        {offer.equivalence_percent ? <span className="text-faint">equivalence {offer.equivalence_percent}%</span> : null}
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
                ? "bg-brand text-[#03150f] hover:bg-brand-2"
                : "border border-line-2 bg-panel-2 text-ink-2 hover:border-brand/50 hover:text-ink"
          }`}
        >
          <ShoppingBag className="h-3 w-3" />
          {added ? "In cart" : accent === "generic" ? "Add refill" : "Add express"}
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

export function DualTrackGrid({
  cmp,
  cart,
  onAdd,
  onVerifyStock,
  agentRunning,
  verifyDisabled,
  verifyTitle,
}: {
  cmp: DualTrackComparison;
  cart: Record<string, CartMode>;
  onAdd: (query: string, mode: CartMode) => void;
  onVerifyStock: () => void;
  agentRunning: boolean;
  verifyDisabled: boolean;
  verifyTitle: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <section className="rounded-2xl border border-line bg-panel p-5">
        <ColumnHeader
          icon={
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-brand/40 bg-brand/10">
              <Pill className="h-4 w-4 text-brand-2" />
            </span>
          }
          title="Subsidised generic · Track B"
          subtitle="Salt-matched · strength-guarded · NABL checked"
          count={cmp.subsidised_generic_online.length}
        />
        <div className="space-y-3">
          {cmp.subsidised_generic_online.length ? (
            cmp.subsidised_generic_online.map((offer) => (
              <OfferCard
                key={`${offer.platform}-${offer.product_url ?? offer.product_name}`}
                offer={offer}
                accent="generic"
                added={cart[cmp.query_brand] === "refill"}
                onAdd={() => onAdd(cmp.query_brand, "refill")}
              />
            ))
          ) : (
            <p className="rounded-xl border border-dashed border-line-2 p-6 text-center text-[11px] text-faint">
              No generic listing passed the strength guard for this query.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-panel p-5">
        <ColumnHeader
          icon={
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-line-2 bg-panel-2">
              <ShoppingBag className="h-4 w-4 text-mute" />
            </span>
          }
          title="Branded express · Track C"
          subtitle="Original brands · ETA verified on demand"
          count={cmp.branded_express_online.length}
          action={
            <button
              type="button"
              onClick={onVerifyStock}
              disabled={agentRunning || verifyDisabled}
              className="flex items-center gap-1.5 rounded-lg border border-line bg-panel-2 px-2.5 py-1.5 text-[10px] text-mute transition-colors hover:border-brand/40 hover:text-brand-2 disabled:opacity-50"
              title={verifyTitle}
            >
              {agentRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bot className="h-3 w-3" />}
              Verify {cmp.user_pincode}
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
                onAdd={() => onAdd(cmp.query_brand, "urgent")}
              />
            ))
          ) : (
            <p className="rounded-xl border border-dashed border-line-2 p-6 text-center text-[11px] text-faint">
              No branded listing matched this query.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
