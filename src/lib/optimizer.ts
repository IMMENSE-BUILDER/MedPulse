/**
 * Split-cart optimizer — Wave 1 deliverable (PRD §6).
 * Picks an express (branded, fast) line and a refill (generic) line per item and
 * totals the realistic monthly saving against the branded baseline.
 */
import { compareMedicines } from "./compare";
import { round } from "./pricing";
import type { CartLine, CartRequest, CartResponse, CartMode, DualTrackComparison, Offer } from "./schemas";

export type CompareFn = (opts: { query: string; pincode: string; sessionId?: string }) => Promise<DualTrackComparison>;

function inStock(o: Offer): boolean {
  return o.in_stock !== false;
}

function cheaperFirst(a: Offer, b: Offer): number {
  return a.price_per_10_tabs_inr - b.price_per_10_tabs_inr || a.price_inr - b.price_inr;
}

function fastestFirst(a: Offer, b: Offer): number {
  return (a.eta_minutes ?? Number.POSITIVE_INFINITY) - (b.eta_minutes ?? Number.POSITIVE_INFINITY) || cheaperFirst(a, b);
}

export function pickOffer(cmp: DualTrackComparison, mode: CartMode): { offer: Offer; reason: string } | null {
  const all = [...cmp.subsidised_generic_online, ...cmp.branded_express_online].filter(inStock);
  if (all.length === 0) return null;

  if (mode === "urgent") {
    const fast = all.filter((o) => o.eta_minutes != null && o.eta_minutes <= 120).sort(cheaperFirst);
    if (fast.length) {
      return { offer: fast[0], reason: `Fastest verified option (≤2 hrs) at the lowest price — ${fast[0].platform}.` };
    }
    const sorted = [...all].sort(fastestFirst);
    return { offer: sorted[0], reason: `No ≤2 hr option found; fastest in-stock option — ${sorted[0].platform}.` };
  }

  const generics = all.filter((o) => o.category !== "branded").sort(cheaperFirst);
  if (generics.length) {
    const cheapest = generics[0];
    const nablClose = generics.filter(
      (o) => o.nabl_lab_report_verified && o.price_per_10_tabs_inr <= cheapest.price_per_10_tabs_inr * 1.1,
    );
    const chosen = nablClose.length ? nablClose.sort(cheaperFirst)[0] : cheapest;
    const why = chosen.nabl_lab_report_verified
      ? `NABL batch-report verified and within 10% of the cheapest generic — ${chosen.platform}.`
      : `Cheapest subsidised generic — ${chosen.platform}.`;
    return { offer: chosen, reason: why };
  }
  const branded = [...all].sort(cheaperFirst);
  return { offer: branded[0], reason: `No generic listing priced; cheapest branded refill — ${branded[0].platform}.` };
}

function tablets(o: Offer, quantityStrips: number): number {
  return o.pack_size * quantityStrips;
}

export async function optimiseCart(req: CartRequest, compareFn: CompareFn = compareMedicines): Promise<CartResponse> {
  const express: CartLine[] = [];
  const generic: CartLine[] = [];
  const checkoutLinks: Record<string, string[]> = {};
  const unresolved: string[] = [];
  let baselineTotal = 0;
  let optimizedTotal = 0;
  let sawDemo = false;

  for (const item of req.items) {
    let cmp: DualTrackComparison;
    try {
      cmp = await compareFn({ query: item.query, pincode: req.pincode, sessionId: req.session_id });
    } catch {
      unresolved.push(item.query);
      continue;
    }
    if (cmp.data_source === "demo") sawDemo = true;
    const picked = pickOffer(cmp, item.mode);
    if (!picked) {
      unresolved.push(item.query);
      continue;
    }
    const { offer, reason } = picked;
    const tabs = tablets(offer, item.quantity_strips);
    const refPer10 = cmp.branded_reference_per_10_tabs_inr;
    const baseline =
      refPer10 != null && refPer10 > 0
        ? round((refPer10 * tabs) / 10, 2)
        : round((offer.mrp_inr ?? offer.price_inr) * item.quantity_strips, 2);
    const lineTotal = round(offer.price_inr * item.quantity_strips, 2);
    const line: CartLine = {
      query: cmp.query_brand,
      mode: item.mode,
      quantity_strips: item.quantity_strips,
      chosen: offer,
      baseline_price_inr: baseline,
      line_total_inr: lineTotal,
      line_savings_inr: round(Math.max(0, baseline - lineTotal), 2),
      reason,
    };
    baselineTotal += baseline;
    optimizedTotal += lineTotal;
    if (item.mode === "urgent") express.push(line);
    else generic.push(line);
    if (offer.product_url) {
      const existing = checkoutLinks[offer.platform] ?? [];
      if (!existing.includes(offer.product_url)) existing.push(offer.product_url);
      checkoutLinks[offer.platform] = existing;
    }
  }

  const netSavings = round(Math.max(0, baselineTotal - optimizedTotal), 2);
  return {
    pincode: req.pincode,
    express_cart: express,
    generic_cart: generic,
    baseline_total_inr: round(baselineTotal, 2),
    optimized_total_inr: round(optimizedTotal, 2),
    net_savings_inr: netSavings,
    net_savings_percent: baselineTotal > 0 ? round((netSavings / baselineTotal) * 100, 1) : 0,
    checkout_links: checkoutLinks,
    unresolved,
    data_source: sawDemo ? "demo" : "live",
  };
}
