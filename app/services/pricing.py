"""Price normalisation: different vendors sell different strip sizes."""
from __future__ import annotations

import re


def per_tab(price: float, pack_size: int) -> float:
    return round(price / max(pack_size, 1), 4)


def per_10_tabs(price: float, pack_size: int) -> float:
    return round(per_tab(price, pack_size) * 10, 2)


def savings_pct(branded_per10: float | None, price_per10: float) -> float:
    if not branded_per10 or branded_per10 <= 0:
        return 0.0
    return round(max(0.0, (branded_per10 - price_per10) / branded_per10 * 100), 1)


def discount_pct(mrp: float | None, price: float) -> float:
    if not mrp or mrp <= 0 or price >= mrp:
        return 0.0
    return round((mrp - price) / mrp * 100, 1)


_PACK_RE = re.compile(
    r"(?:strip|pack|bottle|box)?\s*of\s*(\d{1,3})\s*(?:tablets?|tabs?|capsules?|caps?)?"
    r"|(\d{1,3})\s*(?:tablets?|tabs?|capsules?|caps?)\b",
    re.I,
)


def parse_pack_size(text: str | None, default: int = 10) -> int:
    """Best-effort pack size from strings like 'Strip of 10 tablets' or '15 Tablets'."""
    if not text:
        return default
    m = _PACK_RE.search(text)
    if not m:
        return default
    n = int(m.group(1) or m.group(2))
    return n if 1 <= n <= 200 else default


def eta_text(minutes: int | None) -> str:
    if minutes is None:
        return "ETA unknown"
    if minutes < 60:
        return f"~{minutes} mins"
    if minutes < 24 * 60:
        h = round(minutes / 60)
        return f"{h} hrs"
    d = round(minutes / (24 * 60))
    return f"{d} day{'s' if d != 1 else ''}"


def normalize_name(s: str) -> str:
    return " ".join(re.sub(r"[^a-z0-9+ ]", " ", s.lower()).split())


_STRENGTH_RE = re.compile(r"(\d+(?:\.\d+)?)\s*(mg|mcg|µg|ug|g|iu)\b", re.I)
_TO_MG = {"mg": 1.0, "g": 1000.0, "mcg": 0.001, "µg": 0.001, "ug": 0.001, "iu": 1.0}


def parse_strengths(text: str | None) -> frozenset[float]:
    """All strengths in text, normalised to mg (e.g. '500mg + 125 mg' -> {500, 125}; '0.5 g' -> {500})."""
    out = set()
    for num, unit in _STRENGTH_RE.findall(text or ""):
        out.add(round(float(num) * _TO_MG[unit.lower()], 4))
    return frozenset(out)


def _fmt(vals) -> str:
    return " + ".join(f"{v:g}mg" for v in sorted(vals, reverse=True)) or "none"


def strength_ok(target: frozenset[float], listing_text: str | None) -> tuple[bool, str]:
    """Hard guard against wrong-strength matches (e.g. 500 mg shown for a 650 mg search)."""
    if not target:
        return True, ""
    got = parse_strengths(listing_text)
    if got:
        if got == target or (len(target) > 1 and got == frozenset({round(sum(target), 4)})):
            return True, ""
        return False, f"strength {_fmt(got)} does not match {_fmt(target)}"
    bare = {float(x) for x in re.findall(r"(?<![\d.])\d+(?:\.\d+)?(?![\d.])", listing_text or "")}
    if bare and target <= bare:
        return True, ""
    return False, f"strength not stated (need {_fmt(target)})"


_KEY_RE = re.compile(r"(₹|\bRs\.?\s*\d|\bINR\b|\bMRP\b|\bprice\b|\bstrip\b|\bpack\b|\btablets?\b|\bcapsules?\b|\bcomposition\b|\bsalt\b|\bmg\b|\bstock\b|\bNABL\b)", re.I)


def trim_page(text: str | None, max_chars: int = 3500, head: int = 900, window: int = 220) -> str:
    """Keep the page head plus windows around price/pack/composition words; drops menus, footers, reviews."""
    text = text or ""
    if len(text) <= max_chars:
        return text
    spans = [(0, min(head, len(text)))]
    for m in _KEY_RE.finditer(text):
        spans.append((max(0, m.start() - window), min(len(text), m.end() + window)))
    spans.sort()
    merged = [list(spans[0])]
    for a, b in spans[1:]:
        if a <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], b)
        else:
            merged.append([a, b])
    out, used = [], 0
    for a, b in merged:
        chunk = text[a:b]
        if used + len(chunk) > max_chars:
            chunk = chunk[: max_chars - used]
        if chunk:
            out.append(chunk)
            used += len(chunk)
        if used >= max_chars:
            break
    return "\n…\n".join(out)
