"""Seeded data used in DEMO mode and as the local salt dictionary in live mode.

IMPORTANT: prices here are *illustrative* (Augmentin figures mirror the dashboard mock-up).
They are labelled data_source="demo" in every API response and must not be shown as real quotes.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from .schemas import AmritAlert, Kendra
from .services.pricing import normalize_name


@dataclass(frozen=True)
class Medicine:
    key: str
    brand: str
    manufacturer: str
    salt: str  # display
    salt_components: tuple[tuple[str, str], ...]
    pack_size: int
    branded_mrp: float  # per pack
    pmbjp_ceiling_per10: float
    drug_code: str
    aliases: tuple[str, ...] = field(default_factory=tuple)
    typical_frequency: str = "1-0-1"
    duration_days: int = 5


MEDICINES: dict[str, Medicine] = {
    m.key: m
    for m in [
        Medicine(
            "augmentin625", "Augmentin 625 Duo Tablet", "GlaxoSmithKline Pharmaceuticals Ltd.",
            "Amoxycillin (500mg) + Clavulanic Acid (125mg)",
            (("Amoxycillin", "500mg"), ("Clavulanic Acid", "125mg")),
            10, 204.35, 45.20, "342",
            ("augmentin", "augmentin 625", "augmentin 625 duo", "amoxycillin clavulanic acid", "amoxyclav 625",
             "amoxicillin clavulanate", "amoxicillin clavulanic acid 625", "amoxycillin pot clavulanate 625mg"),
            "1-0-1", 5,
        ),
        Medicine(
            "telmisartan40", "Telma 40 Tablet", "Glenmark Pharmaceuticals Ltd.",
            "Telmisartan (40mg)", (("Telmisartan", "40mg"),),
            15, 186.00, 14.50, "118",
            ("telmisartan", "telmisartan 40", "telmisartan 40mg", "telma 40", "telma"),
            "1-0-0", 30,
        ),
        Medicine(
            "metformin500sr", "Glycomet SR 500 Tablet", "USV Pvt Ltd.",
            "Metformin Hydrochloride SR (500mg)", (("Metformin Hydrochloride SR", "500mg"),),
            20, 36.50, 9.80, "207",
            ("metformin", "metformin 500", "metformin 500 sr", "metformin sr", "glycomet", "glycomet sr 500"),
            "1-0-1", 30,
        ),
        Medicine(
            "pantoprazole40", "Pan 40 Tablet", "Alkem Laboratories Ltd.",
            "Pantoprazole (40mg)", (("Pantoprazole", "40mg"),),
            15, 168.00, 13.20, "091",
            ("pantoprazole", "pantoprazole 40", "pantoprazole 40mg", "pan 40", "pantop 40"),
            "1-0-0", 14,
        ),
    ]
}

# (platform, category, label, price rule, eta_minutes, stock_note, badges, equivalence)
# price rules: ("ceil", factor) -> factor x PMBJP ceiling/10 tabs ; ("mrp", factor) -> factor x branded MRP per pack
VENDORS = [
    dict(platform="SayaCare Generics", category="online_generic", domain="sayacare.in",
         rule=("ceil", 1.1504), eta=4 * 60, mrp_mult=1.03, nabl=True, nabl_id="NABL-9821",
         badges=["NABL LAB VERIFIED"], stock="120+ packs at Mayur Vihar Depot", eq=99.2,
         name="{salt}", maker="WHO-GMP Plant IV"),
    dict(platform="JanAushadhi Kendra (PMBJP)", category="govt_generic", domain="janaushadhi.gov.in",
         rule=("ceil", 1.03), eta=24 * 60, mrp_mult=None, nabl=True, nabl_id="PMBJP-BATCH",
         badges=["PMBJP GOVT GENERIC"], stock="Tele-POS Verified: 84 packs in stock", eq=98.9,
         name="{salt} (Jan Aushadhi)", maker="Bureau of Pharma PSUs of India (BPPI)"),
    dict(platform="Zeelab Pharmacy", category="online_generic", domain="zeelabpharmacy.com",
         rule=("mrp", 0.313), eta=8 * 60, mrp_mult=0.98, nabl=False, nabl_id=None,
         badges=["WHO-GMP"], stock="In Stock", eq=99.1,
         name="{salt} Tablets (Zeelab)", maker="Zeelab Pharmacy India Ltd."),
    dict(platform="Tata 1mg", category="branded", domain="1mg.com",
         rule=("mrp", 0.84), eta=120, mrp_mult=1.0, nabl=False, nabl_id=None,
         badges=["EXPRESS 2-HR"], stock="14 units in local hub", eq=None,
         name="{brand}", maker="{maker}"),
    dict(platform="Apollo Pharmacy", category="branded", domain="apollopharmacy.in",
         rule=("mrp", 0.86), eta=45, mrp_mult=1.0, nabl=False, nabl_id=None,
         badges=["1-HR DELIVERY"], stock="15 strips at Nirman Vihar (2.1 km)", eq=None,
         name="{brand}", maker="Original formulation"),
    dict(platform="PharmEasy", category="branded", domain="pharmeasy.in",
         rule=("mrp", 0.705), eta=6 * 60, mrp_mult=0.94, nabl=False, nabl_id=None,
         badges=["6-HR DELIVERY"], stock="Standard dispatch today", eq=None,
         name="Equivalent brand: {salt}", maker="Alternate manufacturer"),
]

# Illustrative kendras keyed by pincode prefix. Placeholder data, NOT a real directory.
KENDRAS: list[dict] = [
    dict(kendra_id="DEL-0422", name="Jan Aushadhi Kendra (demo)", address="Near Shastri Park Metro, New Delhi",
         pincode="110053", distance_km=1.2, stock_note="84 packs in stock (demo)"),
    dict(kendra_id="DEL-0107", name="Jan Aushadhi Kendra (demo)", address="Jhandewalan Extension, New Delhi",
         pincode="110055", distance_km=6.8, stock_note="Stock unverified (demo)"),
    dict(kendra_id="NOI-0031", name="Jan Aushadhi Kendra (demo)", address="Sector 18, Noida",
         pincode="201301", distance_km=2.4, stock_note="Stock unverified (demo)"),
]

AMRIT_DEMO = [
    dict(kendra_id="AMRIT-AIIMS-DEL", name="AMRIT Pharmacy, AIIMS New Delhi (demo listing)",
         address="AIIMS, Ansari Nagar, New Delhi", pincode="110029", distance_km=None,
         stock_note="Up to 50% off MRP on listed critical-care drugs (per PRD)"),
]


def find_medicine(query: str) -> Medicine | None:
    q = normalize_name(query)
    if not q:
        return None
    for m in MEDICINES.values():
        names = {normalize_name(m.brand), m.key, *map(normalize_name, m.aliases)}
        if q in names:
            return m
    # token containment, longest alias wins
    best, best_len = None, 0
    for m in MEDICINES.values():
        for a in (m.brand, *m.aliases):
            na = normalize_name(a)
            if na and (na in q or q in na) and len(na) > best_len and len(q) >= 4:
                best, best_len = m, len(na)
    return best


def kendras_for(pincode: str, limit: int = 3) -> list[Kendra]:
    def score(k):
        common = 0
        for a, b in zip(k["pincode"], pincode):
            if a != b:
                break
            common += 1
        return (-common, k["distance_km"] or 99)

    out = []
    for k in sorted(KENDRAS, key=score)[:limit]:
        out.append(Kendra(phone=None, source_portal="demo seed (not live UMANG)", **k))
    return out


def amrit_demo() -> list[Kendra]:
    return [Kendra(phone=None, source_portal="demo seed (not live AMRIT directory)", **a) for a in AMRIT_DEMO]


def amrit_alert_for(med_name: str, price: float) -> AmritAlert | None:
    if price <= 1000:
        return None
    return AmritAlert(
        triggered_by=med_name,
        item_price_inr=price,
        message=f"{med_name} costs ₹{price:,.0f}. AMRIT hospital pharmacies may sell it at up to 50% off MRP — check offline.",
        outlets=amrit_demo(),
    )
