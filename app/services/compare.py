"""Dual-track comparison: branded (by brand) vs subsidised generics (by salt)."""
from __future__ import annotations

import asyncio
import logging
import re
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from fastapi import HTTPException

from .. import demo_data
from ..domains import (
    BRANDED_DOMAINS,
    GENERIC_DOMAINS,
    NABL_DOMAINS,
    category_for,
    domain_of,
    platform_for,
)
from ..schemas import DualTrackComparisonResponse, GovtBenchmark, Offer
from ..state import bus, cache
from .container import Services
from .pricing import discount_pct, eta_text, normalize_name, parse_strengths, per_10_tabs, per_tab, savings_pct, strength_ok

log = logging.getLogger("medpulse.compare")


# ----------------------------------------------------------------- helpers
_NON_PRODUCT = ("/salt/", "/generic-salt/", "/category/", "/categories/", "/search")
_TRACKING = {"srsltid", "utm_source", "utm_medium", "utm_campaign", "gclid", "fbclid"}


def _clean_url(u: str) -> str:
    p = urlparse(u)
    q = [(k, v) for k, v in parse_qsl(p.query) if k.lower() not in _TRACKING]
    return urlunparse(p._replace(query=urlencode(q), fragment=""))


def _sid(sid: str | None, pincode: str) -> str:
    return sid or pincode


def _build_offer(*, med_brand_per10: float | None, **kw) -> Offer:
    pack = kw["pack_size"]
    price = kw["price_inr"]
    p10 = per_10_tabs(price, pack)
    return Offer(
        price_per_10_tabs_inr=p10,
        price_per_tab_inr=round(per_tab(price, pack), 2),
        discount_percent=discount_pct(kw.get("mrp_inr"), price),
        savings_vs_branded_percent=savings_pct(med_brand_per10, p10),
        **kw,
    )


def _split(offers: list[Offer]):
    generics = sorted((o for o in offers if o.category != "branded"), key=lambda o: o.price_per_10_tabs_inr)
    branded = sorted((o for o in offers if o.category == "branded"), key=lambda o: o.eta_minutes or 10**9)
    return generics, branded


# ------------------------------------------------------------------- demo
def compare_demo(query: str, pincode: str) -> DualTrackComparisonResponse:
    med = demo_data.find_medicine(query)
    if med is None:
        raise HTTPException(
            404,
            detail={
                "error": "unknown_medicine_in_demo_mode",
                "message": f"Demo mode only knows: {', '.join(m.brand for m in demo_data.MEDICINES.values())}. "
                "Add API keys to search any medicine live.",
            },
        )
    brand_per10 = per_10_tabs(med.branded_mrp, med.pack_size)
    short = med.salt
    offers: list[Offer] = []
    for v in demo_data.VENDORS:
        kind, factor = v["rule"]
        if kind == "ceil":
            price = round(med.pmbjp_ceiling_per10 * factor * med.pack_size / 10, 2)
        else:
            price = round(med.branded_mrp * factor, 2)
        mrp = price if v["mrp_mult"] is None else round(med.branded_mrp * v["mrp_mult"], 2)
        eta = v["eta"]
        offers.append(
            _build_offer(
                med_brand_per10=brand_per10,
                platform=v["platform"],
                category=v["category"],
                product_name=v["name"].format(salt=short, brand=med.brand),
                manufacturer=v["maker"].format(maker=med.manufacturer),
                badges=v["badges"],
                mrp_inr=mrp,
                price_inr=price,
                pack_size=med.pack_size,
                nabl_lab_report_verified=bool(v["nabl"]),
                nabl_batch_id=v["nabl_id"],
                equivalence_percent=v["eq"],
                delivery_eta=eta_text(eta) + (f" (to {pincode})" if eta <= 8 * 60 else ""),
                eta_minutes=eta,
                in_stock=True,
                stock_note=v["stock"],
                verified_by="demo-seed",
                product_url=f"https://www.{v['domain']}",
            )
        )
    generics, branded = _split(offers)
    kendras = demo_data.kendras_for(pincode, 1)
    return DualTrackComparisonResponse(
        query_brand=med.brand,
        active_salt=med.salt,
        user_pincode=pincode,
        govt_benchmark=GovtBenchmark(
            drug_code=med.drug_code,
            official_mrp_per_10_tabs_inr=med.pmbjp_ceiling_per10,
            bioequivalence_index_percent=98.9,
            nearest_walk_in_kendra=kendras[0] if kendras else None,
        ),
        subsidised_generic_online=generics,
        branded_express_online=branded,
        amrit_hospital_alert=demo_data.amrit_alert_for(med.brand, max(o.price_inr for o in offers)),
        branded_reference_mrp_inr=med.branded_mrp,
        branded_reference_per_10_tabs_inr=brand_per10,
        best_savings_percent=max((o.savings_vs_branded_percent for o in generics), default=0.0),
        data_source="demo",
        notes=["DEMO DATA: illustrative prices, not live quotes. Add API keys to .env for live results."],
    )


# ------------------------------------------------------------------- live
_BATCH_RE = re.compile(r"batch\s*(?:no\.?|number|#)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-/]{3,})", re.I)


async def _verify_nabl(svc: Services, report_url: str) -> tuple[bool, str | None]:
    """Fetch the lab report (HTML or PDF, TinyFetch extracts both) and confirm NABL is actually mentioned."""
    try:
        results, _ = await svc.tf.fetch([report_url], purpose="Verify NABL accreditation and batch number in a lab report")
    except Exception:
        return False, None
    if not results:
        return False, None
    text = results[0]["text"]
    if "nabl" not in text.lower():
        return False, None
    m = _BATCH_RE.search(text)
    return True, (m.group(1) if m else None)


async def compare_live(svc: Services, query: str, pincode: str, session: str) -> DualTrackComparisonResponse:
    emit = lambda m, lvl="info": bus.emit(session, m, lvl)  # noqa: E731
    local = demo_data.find_medicine(query)
    notes: list[str] = []

    # Stage 0: resolve brand/salt (local dictionary first, Gemini otherwise)
    strength_str = ""
    if local:
        brand, salt = local.brand, local.salt
        strength_str = " ".join(st for _, st in local.salt_components)
    else:
        await emit(f"Resolving salt for '{query}' via Gemini")
        r = await svc.gemini.resolve_salt(query)
        if not r.is_medicine or not r.active_salt:
            raise HTTPException(404, detail={"error": "not_a_medicine", "message": f"Could not resolve '{query}' to a medicine."})
        brand, salt = (r.brand_name or query), r.active_salt
        strength_str = " ".join(r.strengths or [])
    target = parse_strengths(strength_str + " " + salt)
    salt_q = salt if parse_strengths(salt) else f"{salt} {strength_str}".strip()
    await emit(f"Active salt: {salt_q}")

    # Stage 1: parallel search (brand -> branded portals, salt -> generic portals)
    await emit("TinySearch: branded + generic portals in parallel")
    b_res, g_res = await asyncio.gather(
        svc.tf.search(f"{brand} tablet price buy online", BRANDED_DOMAINS, f"Find product pages for {brand} to compare price"),
        svc.tf.search(f"{salt_q} tablet price buy online", GENERIC_DOMAINS, f"Find generic equivalents of {salt} to compare price"),
        return_exceptions=True,
    )
    urls: list[str] = []
    for label, res in (("branded", b_res), ("generic", g_res)):
        if isinstance(res, Exception):
            notes.append(f"{label} search failed: {res}")
            continue
        seen_dom: dict[str, int] = {}
        for item in res:
            d = domain_of(item["url"])
            if seen_dom.get(d, 0) >= 2:  # max 2 pages per portal keeps us under rate limits
                continue
            seen_dom[d] = seen_dom.get(d, 0) + 1
            cu = _clean_url(item["url"])
            if any(x in urlparse(cu).path.lower() for x in _NON_PRODUCT):
                continue  # listing/category page, not a product page: would waste a Gemini call
            if cu not in urls:
                urls.append(cu)
    urls = urls[:10]
    if not urls:
        raise HTTPException(502, detail={"error": "no_results", "message": "TinySearch returned no pharmacy pages.", "notes": notes})
    await emit(f"TinyFetch: rendering {len(urls)} pages (batch)")

    # Stage 2: batch fetch
    pages, errors = await svc.tf.fetch(urls, purpose=f"Extract price, pack size and stock of {brand} / {salt}")
    for e in errors:
        notes.append(f"fetch failed for {e['url']}: {e['error']}")

    # Stage 3: Gemini structured extraction (bounded concurrency; per-URL results cached 1h so retries are cheap)
    sem = asyncio.Semaphore(max(1, svc.settings.gemini_concurrency))
    failed: list[str] = []
    salt_key = normalize_name(f"{salt} {strength_str}")

    results: dict[str, list] = {}
    todo = []
    for pg in pages:
        hit = cache.get(f"ext:{salt_key}:{pg['url']}")
        if hit is not None:
            results[pg["url"]] = hit
        else:
            todo.append(pg)
    size = max(1, svc.settings.gemini_batch_size)
    batches = [todo[i : i + size] for i in range(0, len(todo), size)]

    async def run_batch(batch):
        async with sem:
            try:
                out = await svc.gemini.extract_offers_batch(batch, brand, salt)
                for i, pg in enumerate(batch, 1):
                    offers = out.get(i, [])
                    results[pg["url"]] = offers
                    cache.set(f"ext:{salt_key}:{pg['url']}", offers, ttl=3600)
            except Exception as e:
                for pg in batch:
                    failed.append(pg["url"])
                notes.append(f"extraction failed for {len(batch)} page(s): {type(e).__name__}: {str(e)[:220]}")

    await emit(f"Gemini: reading {len(todo)} page(s) in {len(batches)} request(s) ({len(pages) - len(todo)} cached)")
    await asyncio.gather(*(run_batch(b) for b in batches))
    extracted = [(pg["url"], results.get(pg["url"], [])) for pg in pages]
    if failed:
        quota = any("429" in n or "RESOURCE_EXHAUSTED" in n for n in notes if n.startswith("extraction failed"))
        notes.insert(0, f"Incomplete: {len(failed)} of {len(pages)} pages could not be read because Gemini was "
                        f"{'over its quota (wait for the reset or enable billing)' if quota else 'overloaded'}. "
                        "Results below may be missing listings. Try again shortly.")

    raw = []  # (url, ExtractedOffer)
    skipped = 0
    for url, offers in extracted:
        for o in offers:
            if not (o.is_target_product and o.price_inr and o.price_inr > 0):
                continue
            ok, why = strength_ok(target, f"{o.product_name or ''} {o.strength_text or ''}")
            if not ok:
                skipped += 1
                if skipped <= 4:
                    notes.append(f"skipped {platform_for(url)} '{o.product_name}': {why}")
                continue
            raw.append((url, o))
            break  # best matching listing per page

    # branded reference = highest branded MRP normalised per 10 tabs (or local dictionary)
    brand_ref_per10 = per_10_tabs(local.branded_mrp, local.pack_size) if local else None
    branded_p10 = [
        per_10_tabs(o.mrp_inr or o.price_inr, o.pack_size_units or 10)
        for u, o in raw
        if category_for(u) == "branded"
    ]
    if branded_p10:
        brand_ref_per10 = max(branded_p10 + ([brand_ref_per10] if brand_ref_per10 else []))

    # Stage 4: NABL verification (only where a report link was actually found)
    nabl: dict[str, tuple[bool, str | None]] = {}
    nabl_targets = [(u, o.nabl_report_url) for u, o in raw if o.nabl_report_url and domain_of(u) in NABL_DOMAINS]
    if nabl_targets:
        await emit(f"Reading {len(nabl_targets)} NABL lab report(s)")
        for (u, _), res in zip(nabl_targets, await asyncio.gather(*(_verify_nabl(svc, r) for _, r in nabl_targets))):
            nabl[u] = res

    offers: list[Offer] = []
    for url, o in raw:
        cat = category_for(url)
        pack = o.pack_size_units or 10
        ok, batch = nabl.get(url, (False, None))
        badges = ["NABL LAB VERIFIED"] if ok else (["PMBJP GOVT GENERIC"] if cat == "govt_generic" else [])
        offers.append(
            _build_offer(
                med_brand_per10=brand_ref_per10,
                platform=platform_for(url),
                category=cat,
                product_name=o.product_name or brand,
                manufacturer=o.manufacturer,
                badges=badges,
                mrp_inr=o.mrp_inr,
                price_inr=o.price_inr,
                pack_size=pack,
                nabl_lab_report_verified=ok,
                nabl_batch_id=batch,
                nabl_report_url=o.nabl_report_url if ok else None,
                delivery_eta="Enable Live Pincode Agent to verify",
                in_stock=o.in_stock,
                verified_by="TinyFetch+Gemini",
                product_url=url,
            )
        )
    if not offers:
        raise HTTPException(502, detail={"error": "no_offers_extracted", "message": "Pages fetched but no priced listings found.", "notes": notes})

    generics, branded = _split(offers)
    govt = [o for o in generics if o.category == "govt_generic"]
    if local:
        bench = GovtBenchmark(drug_code=local.drug_code, official_mrp_per_10_tabs_inr=local.pmbjp_ceiling_per10)
        notes.append("Govt benchmark uses the bundled PMBJP ceiling table; verify against janaushadhi.gov.in.")
    elif govt:
        bench = GovtBenchmark(official_mrp_per_10_tabs_inr=govt[0].price_per_10_tabs_inr)
    else:
        bench = None
    top_price = max((o.price_inr for o in offers), default=0)
    await emit(f"Done: {len(offers)} offers from {len(pages)} pages", "ok")
    return DualTrackComparisonResponse(
        query_brand=brand,
        active_salt=salt,
        user_pincode=pincode,
        govt_benchmark=bench,
        subsidised_generic_online=generics,
        branded_express_online=branded,
        amrit_hospital_alert=demo_data.amrit_alert_for(brand, top_price),
        branded_reference_mrp_inr=round(brand_ref_per10 * (local.pack_size if local else 10) / 10, 2) if brand_ref_per10 else None,
        branded_reference_per_10_tabs_inr=brand_ref_per10,
        best_savings_percent=max((o.savings_vs_branded_percent for o in generics), default=0.0),
        data_source="live",
        notes=notes,
    )


def _reason(e: Exception) -> str:
    if isinstance(e, HTTPException) and isinstance(e.detail, dict):
        bits = [str(e.detail.get("message") or e.detail.get("error"))]
        bits += [str(n) for n in (e.detail.get("notes") or [])[:2]]
        return " | ".join(bits)[:600]
    return f"{type(e).__name__}: {e}"[:600]


# ----------------------------------------------------------------- public
async def compare(svc: Services, query: str, pincode: str, session_id: str | None = None) -> DualTrackComparisonResponse:
    session = _sid(session_id, pincode)
    key = f"cmp:{'live' if svc.live else 'demo'}:{normalize_name(query)}:{pincode}"
    if (hit := cache.get(key)) is not None:
        return hit
    if not svc.live:
        await bus.emit(session, f"[demo] compare '{query}' for {pincode}")
        res = compare_demo(query, pincode)
    else:
        try:
            res = await compare_live(svc, query, pincode, session)
        except Exception as e:
            if isinstance(e, HTTPException) and e.status_code == 404:
                raise
            reason = _reason(e)
            await bus.emit(session, f"Live lookup failed: {reason}", "error")
            if svc.settings.medpulse_mode == "live":
                if isinstance(e, HTTPException):
                    raise
                raise HTTPException(502, detail={"error": "upstream_failure", "message": reason})
            log.warning("live compare failed (%s); trying demo fallback", reason)
            try:
                res = compare_demo(query, pincode)
            except HTTPException:
                # demo cannot serve this medicine: show the REAL live error, not a misleading demo message
                raise HTTPException(502, detail={"error": "live_lookup_failed", "message": f"Live lookup failed: {reason}"})
            res.notes.insert(0, f"Live lookup failed ({reason}); showing DEMO data.")
    if not any(n.startswith("Incomplete") for n in res.notes):
        cache.set(key, res)  # never cache a partial result
    return res
