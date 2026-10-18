from __future__ import annotations

import re

from fastapi import HTTPException

from .. import demo_data
from ..schemas import Interaction, PrescribedMedicine, PrescriptionAnalysis, SaltComponent
from ..state import bus
from .container import Services

MAX_BYTES = 25 * 1024 * 1024
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "application/pdf"}

_SLOTS_EN = ("Morning", "Afternoon", "Night")
_SLOTS_HI = ("सुबह", "दोपहर", "रात")
_INSTR_HI = {"after food": "खाने के बाद", "before food": "खाने से पहले", "empty stomach": "खाली पेट", "with food": "खाने के साथ"}


def build_schedule(frequency: str | None, instructions: str | None) -> tuple[str | None, str | None]:
    """Deterministic EN/HI dosing line from an M-A-N pattern like '1-0-1'. No medical advice is invented."""
    if not frequency:
        return None, None
    parts = re.findall(r"\d+(?:\.\d+)?", frequency)
    if len(parts) != 3:
        return None, None
    idx = [i for i, p in enumerate(parts) if float(p) > 0]
    if not idx:
        return None, None
    en = ", ".join(f"{_SLOTS_EN[i]} ({parts[i]})" for i in idx)
    hi = ", ".join(f"{_SLOTS_HI[i]} ({parts[i]})" for i in idx)
    if instructions:
        en += f" — {instructions}"
        hi_i = _INSTR_HI.get(instructions.strip().lower())
        if hi_i:
            hi += f" — {hi_i}"
    return en, hi


def _from_catalog(med: demo_data.Medicine) -> PrescribedMedicine:
    en, hi = build_schedule(med.typical_frequency, None)
    return PrescribedMedicine(
        brand_name=med.brand, dosage=None, pack_size=med.pack_size,
        salts=[SaltComponent(name=n, strength=s) for n, s in med.salt_components],
        active_salt=med.salt, frequency=None, schedule_en=None, schedule_hi=None,
    )


def _from_text_demo(text: str) -> list[PrescribedMedicine]:
    out, seen = [], set()
    for seg in re.split(r"[\n,;+]|\band\b", text, flags=re.I):
        m = demo_data.find_medicine(seg.strip())
        if m and m.key not in seen:
            seen.add(m.key)
            pm = _from_catalog(m)
            f = re.search(r"\b([01]-[01]-[01])\b", seg)
            if f:
                pm.frequency = f.group(1)
                pm.schedule_en, pm.schedule_hi = build_schedule(pm.frequency, None)
            out.append(pm)
    return out


async def analyze(svc: Services, *, data: bytes | None, mime: str | None, text: str | None, session: str) -> PrescriptionAnalysis:
    if not data and not (text and text.strip()):
        raise HTTPException(422, "Provide a prescription file or text.")
    if data is not None:
        if len(data) > MAX_BYTES:
            raise HTTPException(413, "File exceeds 25MB.")
        if mime not in ALLOWED_MIME:
            raise HTTPException(415, f"Unsupported type {mime}; use JPG, PNG, WEBP or PDF.")

    if not svc.live:
        await bus.emit(session, "[demo] prescription parse")
        if data and not text:
            # Demo mode cannot OCR; return a clearly-labelled sample so the UI flow is testable.
            meds = [_from_catalog(demo_data.MEDICINES["augmentin625"]), _from_catalog(demo_data.MEDICINES["pantoprazole40"])]
            meds[0].frequency, meds[1].frequency = "1-0-1", "1-0-0"
            for m in meds:
                m.schedule_en, m.schedule_hi = build_schedule(m.frequency, None)
            return PrescriptionAnalysis(medicines=meds, data_source="demo")
        meds = _from_text_demo(text or "")
        if not meds:
            raise HTTPException(404, detail={"error": "no_medicines_found", "message": "Demo mode recognises a few medicines only; add a Gemini key for full OCR."})
        return PrescriptionAnalysis(medicines=meds, data_source="demo")

    await bus.emit(session, "Gemini: reading prescription")
    try:
        rx = await svc.gemini.analyze_prescription(data=data, mime=mime, text=text)
    except Exception as e:
        raise HTTPException(502, detail={"error": "gemini_failure", "message": f"{type(e).__name__}: {e}"})
    meds = []
    for m in rx.medicines:
        salts = [SaltComponent(name=s.name, strength=s.strength) for s in m.salts]
        active = " + ".join(f"{s.name} ({s.strength})" if s.strength else s.name for s in salts) or m.brand_name
        en, hi = build_schedule(m.frequency, m.instructions)
        meds.append(PrescribedMedicine(
            brand_name=m.brand_name, dosage=m.dosage, pack_size=m.pack_size, salts=salts, active_salt=active,
            frequency=m.frequency, instructions=m.instructions, duration_days=m.duration_days, schedule_en=en, schedule_hi=hi,
        ))
    sev_ok = {"minor", "moderate", "major"}
    inter = [Interaction(between=i.between, severity=i.severity.lower(), note=i.note) for i in rx.interactions if i.severity.lower() in sev_ok]
    await bus.emit(session, f"Parsed {len(meds)} medicine(s)", "ok")
    return PrescriptionAnalysis(medicines=meds, interactions=inter, data_source="live")
