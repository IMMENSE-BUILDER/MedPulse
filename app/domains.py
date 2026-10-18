"""Portal registry from PRD section 2."""

GOVT_PORTALS = {
    "pmbi_master": "janaushadhi.gov.in",
    "umang": "web.umang.gov.in",
    "amrit": "lifecarehll.com",
}

# Searched by chemical salt + dosage
GENERIC_DOMAINS = [
    "sayacare.in",
    "janaushadhionline.com",
    "janaushadhistore.in",
    "apijanaushadhi.in",
    "zeelabpharmacy.com",
    "davaindia.com",
    "truemeds.in",
]

# Searched by brand name
BRANDED_DOMAINS = ["1mg.com", "pharmeasy.in", "apollopharmacy.in", "netmeds.com"]

LAB_DOMAINS = ["redcliffelabs.com", "lalpathlabs.com", "orangehealth.in", "healthians.com"]

# Domains where the PRD says batch NABL lab-test PDFs are published
NABL_DOMAINS = {"sayacare.in", "janaushadhi.gov.in"}

PLATFORM_NAMES = {
    "sayacare.in": "SayaCare Generics",
    "janaushadhionline.com": "JanAushadhi Online",
    "janaushadhistore.in": "Janaushadhi Store Online",
    "apijanaushadhi.in": "API Janaushadhi",
    "zeelabpharmacy.com": "Zeelab Pharmacy",
    "davaindia.com": "DavaIndia",
    "truemeds.in": "Truemeds",
    "1mg.com": "Tata 1mg",
    "pharmeasy.in": "PharmEasy",
    "apollopharmacy.in": "Apollo Pharmacy",
    "netmeds.com": "Netmeds",
}


def domain_of(url: str) -> str:
    from urllib.parse import urlparse

    host = (urlparse(url).hostname or "").lower()
    return host[4:] if host.startswith("www.") else host


def platform_for(url: str) -> str:
    d = domain_of(url)
    for key, name in PLATFORM_NAMES.items():
        if d == key or d.endswith("." + key):
            return name
    return d or "Unknown"


def category_for(url: str):
    d = domain_of(url)
    if any(d == x or d.endswith("." + x) for x in BRANDED_DOMAINS):
        return "branded"
    if "janaushadhi" in d:
        return "govt_generic" if d.endswith("gov.in") else "online_generic"
    return "online_generic"
