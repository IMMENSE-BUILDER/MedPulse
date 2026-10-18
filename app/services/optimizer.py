"""Hybrid split-cart optimiser: urgent -> fast, refill -> cheapest (NABL-preferred on near-ties)."""
from __future__ import annotations

from fastapi import HTTPException

from ..schemas import CartLine, CartMode, CartRequest, CartResponse, DualTrackComparisonResponse, Offer
from .compare import compare
from .container import Services

URGENT_WINDOW_MIN = 120
NABL_TIE_PCT = 10.0  # prefer NABL-verified generic if within 10% of the cheapest


def pick_offer(cmp: DualTrackComparisonResponse, mode: CartMode) -> tuple[Offer, str]:
    pool = [o for o in (*cmp.subsidised_generic_online, *cmp.branded_express_online) if o.in_stock is not False]
    if not pool:
        raise ValueError("no in-stock offers")
    if mode == "urgent":
        fast = [o for o in pool if o.eta_minutes is not None and o.eta_minutes <= URGENT_WINDOW_MIN]
        if fast:
            best = min(fast, key=lambda o: (o.price_per_10_tabs_inr, o.eta_minutes))
            return best, f"Cheapest option deliverable within {URGENT_WINDOW_MIN // 60} hrs"
        timed = [o for o in pool if o.eta_minutes is not None]
        best = min(timed or pool, key=lambda o: (o.eta_minutes if o.eta_minutes is not None else 10**9, o.price_per_10_tabs_inr))
        return best, "Nothing arrives within 2 hrs; this is the fastest available"
    generics = [o for o in pool if o.category != "branded"] or pool
    cheapest = min(generics, key=lambda o: o.price_per_10_tabs_inr)
    near = [
        o for o in generics
        if o.nabl_lab_report_verified and o.price_per_10_tabs_inr <= cheapest.price_per_10_tabs_inr * (1 + NABL_TIE_PCT / 100)
    ]
    if near and not cheapest.nabl_lab_report_verified:
        best = min(near, key=lambda o: o.price_per_10_tabs_inr)
        return best, f"NABL-verified generic within {NABL_TIE_PCT:.0f}% of the lowest price"
    return cheapest, "Lowest price per tablet among generics"


async def optimise(svc: Services, req: CartRequest) -> CartResponse:
    urgent, refill, unresolved = [], [], []
    for item in req.items:
        try:
            cmp = await compare(svc, item.query, req.pincode, req.session_id)
        except HTTPException as e:
            if e.status_code == 404:
                unresolved.append(item.query)
                continue
            raise
        try:
            offer, reason = pick_offer(cmp, item.mode)
        except ValueError:
            unresolved.append(item.query)
            continue
        ref_per10 = cmp.branded_reference_per_10_tabs_inr or offer.price_per_10_tabs_inr
        ref_per_tab = ref_per10 / 10
        tablets = offer.pack_size * item.quantity_strips
        baseline = round(ref_per_tab * tablets, 2)
        total = round(offer.price_inr * item.quantity_strips, 2)
        line = CartLine(
            query=cmp.query_brand, mode=item.mode, quantity_strips=item.quantity_strips, chosen=offer,
            baseline_price_inr=baseline, line_total_inr=total, line_savings_inr=round(baseline - total, 2), reason=reason,
        )
        (urgent if item.mode == "urgent" else refill).append(line)

    lines = urgent + refill
    base = round(sum(l.baseline_price_inr for l in lines), 2)
    tot = round(sum(l.line_total_inr for l in lines), 2)
    links: dict[str, list[str]] = {}
    for l in lines:
        if l.chosen.product_url:
            links.setdefault(l.chosen.platform, []).append(l.chosen.product_url)
    return CartResponse(
        pincode=req.pincode, urgent_cart=urgent, refill_cart=refill,
        baseline_total_inr=base, optimized_total_inr=tot, net_savings_inr=round(base - tot, 2),
        net_savings_percent=round((base - tot) / base * 100, 1) if base else 0.0,
        checkout_links=links, unresolved=unresolved,
        data_source="live" if svc.live and all(l.chosen.verified_by != "demo-seed" for l in lines) else "demo",
    )

