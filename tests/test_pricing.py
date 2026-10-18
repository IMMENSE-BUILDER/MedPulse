from app.services.pricing import trim_page, parse_strengths, strength_ok, parse_pack_size, per_10_tabs, savings_pct, discount_pct, eta_text
from app.services.prescription import build_schedule


def test_math():
    assert per_10_tabs(150, 15) == 100.0
    assert savings_pct(204.35, 45.20) == 77.9
    assert savings_pct(None, 10) == 0.0
    assert discount_pct(210, 52) == 75.2 and discount_pct(None, 5) == 0.0


def test_pack_parse():
    assert parse_pack_size("Strip of 15 tablets") == 15
    assert parse_pack_size("20 Tablets") == 20
    assert parse_pack_size("bottle of 60 capsules") == 60
    assert parse_pack_size("no size here") == 10
    assert parse_pack_size("Strip of 9999 tablets") == 10


def test_eta_and_schedule():
    assert eta_text(45) == "~45 mins" and eta_text(240) == "4 hrs" and eta_text(1440) == "1 day"
    en, hi = build_schedule("1-0-1", "after food")
    assert en == "Morning (1), Night (1) — after food" and hi.endswith("खाने के बाद")
    assert build_schedule("bad", None) == (None, None) and build_schedule("0-0-0", None) == (None, None)


def test_strength_guard():
    t = parse_strengths("650 mg")
    assert t == {650.0} and parse_strengths("0.5 g") == {500.0} and parse_strengths("500mg + 125 mg") == {500.0, 125.0}
    assert strength_ok(t, "Dolo 650 Tablet 650mg")[0]
    ok, why = strength_ok(t, "Paracetamol 500 mg 10 Tablet")
    assert not ok and "500mg" in why
    assert strength_ok(t, "Dolo 650 Tablet")[0]  # bare number in name, no unit
    assert not strength_ok(t, "Paracetamol Tablet")[0]  # unverifiable -> rejected
    combo = parse_strengths("Amoxycillin 500mg + Clavulanic Acid 125mg")
    assert strength_ok(combo, "Amoxyclav 625 (500mg + 125mg)")[0] and strength_ok(combo, "Augmentin 625mg")[0]
    assert not strength_ok(combo, "Amoxyclav 375 (250mg + 125mg)")[0]
    assert strength_ok(frozenset(), "anything")[0]


def test_trim_page_keeps_price_drops_boilerplate():
    junk = "menu link about us careers blog " * 400
    page = "Dolo 650 Tablet\n15 tablets\n" + junk + "MRP ₹32.28 price ₹30.00 strip of 15 tablets" + junk
    out = trim_page(page)
    assert len(out) <= 3600 and "₹30.00" in out and "Dolo 650" in out and len(out) < len(page) / 5
    assert trim_page("short page") == "short page"
