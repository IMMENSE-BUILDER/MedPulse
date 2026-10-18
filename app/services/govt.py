"""Live pincode stock verification + nearest Jan Aushadhi / AMRIT lookup (TinyAgent)."""
from __future__ import annotations

import asyncio

from fastapi import HTTPException

from .. import demo_data
from ..domains import platform_for
from ..schemas import Kendra, KendraResponse, LivePincodeResponse, StockCheck
from ..state import bus
from .container import Services

STOCK_SCHEMA = {
    "type": "object",
    "properties": {
        "in_stock": {"type": "boolean"},
        "delivery_eta": {"type": "string"},
        "price_inr": {"type": "number"},
    },
    "required": ["in_stock"],
}
KENDRA_SCHEMA = {
    "type": "object",
    "properties": {
        "kendras": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "kendra_id": {"type": "string"},
                    "name": {"type": "string"},
                    "address": {"type": "string"},
                    "distance_km": {"type": "number"},
                    "phone": {"type": "string"},
                },
                "required": ["name", "address"],
            },
        }
    },
    "required": ["kendras"],
}
UMANG_URL = "https://web.umang.gov.in/"
AGENT_CONCURRENCY = 3  # each agent step costs money; keep it bounded


async def verify_live_pincode(svc: Services, pincode: str, urls: list[str], session: str) -> LivePincodeResponse:
    if not svc.live:
        await bus.emit(session, f"[demo] simulated stock check for {pincode}")
        checks = []
        for u in urls:
            await bus.emit(session, f"[demo] {platform_for(u)}: simulated, not a real stock check")
            checks.append(StockCheck(product_url=u, platform=platform_for(u), in_stock_at_pincode=None,
                                     delivery_eta=None, verified_by="demo-simulated",
                                     error="Live agent disabled (demo mode): no real stock information"))
        return LivePincodeResponse(pincode=pincode, checks=checks, data_source="demo", session_id=session)

    sem = asyncio.Semaphore(AGENT_CONCURRENCY)

    async def one(url: str) -> StockCheck:
        plat = platform_for(url)
        async with sem:
            await bus.emit(session, f"TinyAgent → {plat}: opening product page")
            goal = (
                f"On this pharmacy product page, set the delivery location / pincode to {pincode} "
                "(find the pincode or location field and submit it). Then report whether the product is "
                "available for delivery to that pincode, the delivery ETA text shown, and the selling price in INR. "
                "Do not add anything to cart or log in."
            )
            out = await svc.tf.run_agent(
                goal, url, STOCK_SCHEMA,
                on_progress=lambda m: bus.emit(session, f"{plat}: {m}"),
                on_stream_url=lambda s: bus.emit(session, f"{plat}: live view {s}", "stream"),
            )
        if out["error"] or not out["result"]:
            await bus.emit(session, f"{plat}: failed ({out['error']})", "error")
            return StockCheck(product_url=url, platform=plat, error=out["error"] or "empty result",
                              verified_by="TinyAgent", streaming_url=out["streaming_url"])
        r = out["result"]
        await bus.emit(session, f"{plat}: {'in stock' if r.get('in_stock') else 'out of stock'} @ {pincode}", "ok")
        return StockCheck(product_url=url, platform=plat, in_stock_at_pincode=r.get("in_stock"),
                          delivery_eta=r.get("delivery_eta"), price_inr=r.get("price_inr"),
                          verified_by="TinyAgent Stealth", streaming_url=out["streaming_url"])

    checks = await asyncio.gather(*(one(u) for u in urls))
    return LivePincodeResponse(pincode=pincode, checks=list(checks), data_source="live", session_id=session)


async def nearest_kendras(svc: Services, pincode: str, include_amrit: bool, session: str) -> KendraResponse:
    amrit = demo_data.amrit_demo() if include_amrit else []
    if not svc.live:
        await bus.emit(session, f"[demo] nearest Kendra lookup for {pincode}")
        return KendraResponse(pincode=pincode, kendras=demo_data.kendras_for(pincode), amrit_outlets=amrit, data_source="demo")

    await bus.emit(session, "TinyAgent → UMANG Jan Aushadhi Sugam: nearby store search")
    goal = (
        f"Open the Jan Aushadhi Sugam / Jan Aushadhi Kendra locator, search by pincode {pincode}, and return up to "
        "3 nearest Kendras with id, name, address, distance in km and phone if shown."
    )
    out = await svc.tf.run_agent(
        goal, UMANG_URL, KENDRA_SCHEMA,
        on_progress=lambda m: bus.emit(session, f"UMANG: {m}"),
        on_stream_url=lambda s: bus.emit(session, f"UMANG live view {s}", "stream"),
    )
    if out["error"] or not out["result"]:
        if svc.settings.medpulse_mode == "live":
            raise HTTPException(502, detail={"error": "kendra_lookup_failed", "message": out["error"] or "empty result"})
        await bus.emit(session, f"UMANG failed ({out['error']}); using demo seed", "error")
        return KendraResponse(pincode=pincode, kendras=demo_data.kendras_for(pincode), amrit_outlets=amrit, data_source="demo")
    kendras = [
        Kendra(kendra_id=str(k.get("kendra_id") or f"UMANG-{i}"), name=k["name"], address=k["address"], pincode=pincode,
               distance_km=k.get("distance_km"), phone=k.get("phone"), source_portal="web.umang.gov.in (Jan Aushadhi Sugam)")
        for i, k in enumerate(out["result"].get("kendras", [])[:3])
    ]
    await bus.emit(session, f"Found {len(kendras)} Kendra(s)", "ok")
    return KendraResponse(pincode=pincode, kendras=kendras, amrit_outlets=amrit, data_source="live")
