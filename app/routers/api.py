from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from fastapi.responses import StreamingResponse

from .. import demo_data
from ..schemas import (
    CartRequest, CartResponse, DualTrackComparisonResponse, DualTrackRequest, KendraRequest, KendraResponse,
    LivePincodeRequest, LivePincodeResponse, PrescriptionAnalysis,
)
from ..services import compare as compare_svc
from ..services import govt, optimizer, prescription
from ..services.container import Services, get_services
from ..state import bus

router = APIRouter()


@router.get("/api/health", tags=["meta"])
def health(svc: Services = Depends(get_services)):
    s = svc.settings
    return {
        "status": "ok",
        "mode": "live" if svc.live else "demo",
        "configured_mode": s.medpulse_mode,
        "tinyfish_key": s.has_tinyfish,
        "gemini_key": s.has_gemini,
        "default_pincode": s.default_pincode,
        "demo_medicines": [m.brand for m in demo_data.MEDICINES.values()],
    }


@router.get("/api/v2/medicines/suggest", tags=["meta"])
def suggest(q: str = Query("", max_length=60)):
    q = q.lower().strip()
    meds = demo_data.MEDICINES.values()
    hits = [m for m in meds if not q or q in m.brand.lower() or any(q in a for a in m.aliases)]
    return [{"brand": m.brand, "salt": m.salt} for m in hits][:8]


@router.post("/api/v2/prescription/analyze", response_model=PrescriptionAnalysis, tags=["v2"])
async def analyze_prescription(
    file: UploadFile | None = File(None),
    text: str | None = Form(None),
    session_id: str | None = Form(None),
    svc: Services = Depends(get_services),
):
    data = mime = None
    if file is not None:
        data = await file.read()
        mime = file.content_type
    return await prescription.analyze(svc, data=data, mime=mime, text=text, session=session_id or svc.settings.default_pincode)


@router.post("/api/v2/compare/dual-track", response_model=DualTrackComparisonResponse, tags=["v2"])
async def dual_track(req: DualTrackRequest, svc: Services = Depends(get_services)):
    return await compare_svc.compare(svc, req.query, req.pincode, req.session_id)


@router.post("/api/v2/verify/live-pincode", response_model=LivePincodeResponse, tags=["v2"])
async def live_pincode(req: LivePincodeRequest, svc: Services = Depends(get_services)):
    return await govt.verify_live_pincode(svc, req.pincode, req.product_urls, req.session_id or req.pincode)


@router.post("/api/v2/govt/nearest-kendra", response_model=KendraResponse, tags=["v2"])
async def nearest_kendra(req: KendraRequest, svc: Services = Depends(get_services)):
    return await govt.nearest_kendras(svc, req.pincode, req.include_amrit, req.session_id or req.pincode)


@router.post("/api/v2/cart/hybrid-optimize", response_model=CartResponse, tags=["v2"])
async def hybrid_cart(req: CartRequest, svc: Services = Depends(get_services)):
    return await optimizer.optimise(svc, req)


@router.get("/api/v2/agent/stream", tags=["v2"])
async def agent_stream(session_id: str = Query(..., min_length=1, max_length=64), after: int = 0, once: bool = False):
    """SSE feed for the TinyAgent drawer. `once=true` returns buffered logs and closes (handy for tests)."""

    async def gen():
        last = after
        while True:
            for e in bus.history(session_id, last):
                last = e["seq"]
                yield f"id: {e['seq']}\ndata: {json.dumps(e)}\n\n"
            if once:
                return
            await bus.wait(session_id, timeout=15)
            if not bus.history(session_id, last):
                yield ": keepalive\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
