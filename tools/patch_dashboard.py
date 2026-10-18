"""One-off: turn the teammate's static code.html into static/index.html (ids + containers for app.js)."""
import sys
from bs4 import BeautifulSoup

src, dst = sys.argv[1], sys.argv[2]
soup = BeautifulSoup(open(src, encoding="utf-8").read(), "html.parser")

def must(x, what):
    assert x is not None, f"not found: {what}"
    return x

# comparison columns: keep header, replace static cards with containers
grid = must(soup.select_one("div.grid.lg\\:grid-cols-2"), "comparison grid")
cols = grid.find_all("section", recursive=False)
assert len(cols) == 2
for sec, cid in zip(cols, ("genericList", "brandedList")):
    kids = [c for c in sec.find_all(recursive=False)]
    for c in kids[1:]:
        c.decompose()
    box = soup.new_tag("div", id=cid)
    box["class"] = "space-y-3"
    sec.append(box)

# banner: becomes a render target (innerHTML rebuilt by JS)
banner = must(soup.find("section", class_=lambda c: c and "p-4" in c and "rounded-lg" in c and "bg-[#0a0a0a]" in c and "flex-col" not in c), "banner")
banner["id"] = "benchmarkBanner"
for c in list(banner.children):
    c.extract()

# title / strip
h1 = must(soup.find("h1"), "h1"); h1["id"] = "pageTitle"
strip = h1.parent.find("div"); strip["id"] = "stripLabel"
idx = must(soup.find(string=lambda t: t and "Index:" in t), "index chip").parent.parent
idx["id"] = "indexChip"

# search
inp = must(soup.find("input", placeholder=lambda p: p and p.startswith("Search medicines")), "search input"); inp["id"] = "searchInput"; inp["autocomplete"] = "off"
sbtn = must(inp.parent.find("button"), "search button"); sbtn["id"] = "searchBtn"
for b in soup.find_all("button"):
    if b.get_text(strip=True) in ("Telmisartan 40mg", "Metformin 500 SR", "Pantoprazole 40", "Augmentin 625 Duo"):
        b["data-q"] = b.get_text(strip=True); b["class"] = b.get("class", []) + ["trend-chip"]

# OCR
drop = must(soup.find("div", class_=lambda c: c and "border-dashed" in c), "dropzone"); drop["id"] = "dropzone"
rx = must(soup.find(string=lambda t: t and "DrMehta_Prescription_Scan.pdf" in t), "rx name").parent
rxbox = rx.parent.parent.parent
rxbox["id"] = "rxStatus"
rxbox.parent["class"] = rxbox.parent.get("class", [])  # keep
for c in list(rxbox.children):
    c.extract()
rxbox["class"] = "hidden"
hint = must(soup.find(string=lambda t: t and "HIPAA" in t), "hipaa line").parent
hint.string = "Prescription is sent to Gemini for parsing only · not stored"
fi = soup.new_tag("input", type="file", id="rxFile", accept="image/jpeg,image/png,image/webp,application/pdf"); fi["class"] = "hidden"
drop.append(fi)

# header chips
pin = must(soup.find("span", string="110053"), "pin"); 
pin_input = soup.new_tag("input", id="pinInput", value="110053", maxlength="6", inputmode="numeric")
pin_input["class"] = "w-[3.4rem] bg-transparent border-0 p-0 focus:ring-0 font-mono font-medium text-[#fafafa] text-xs"
pin.replace_with(pin_input)
for s in soup.find_all("span"):
    t = s.get_text(strip=True)
    if t == "Radar Active": s["id"] = "modeLabel"
    if t == "• Delhi": s["id"] = "cityLabel"
mode_pill = must(soup.find(id="modeLabel"), "mode label").parent; mode_pill["id"] = "modePill"
stock = must(soup.find("input", type="checkbox"), "stock toggle"); stock["id"] = "stockAgent"; del stock["checked"]

# agent drawer
log = must(soup.find(id="agentLogContent"), "log"); 
for c in list(log.children): c.extract()
h5 = must(soup.find("h5"), "h5"); h5.find("span")["id"] = "agentPin"
for s in soup.find_all("span"):
    if s.get_text(strip=True).startswith("6 Endpoints"): s["id"] = "agentFoot"
for b in soup.find_all("button"):
    if b.get_text(strip=True) == "Re-scan" and b.parent.get("class") and "justify-between" in b.parent["class"]:
        b["id"] = "agentRescan"
active = must(soup.find("span", string=lambda t: t and t.strip() == "Active"), "active chip"); active["id"] = "agentState"

# sticky cart footer
foot = must(soup.find("footer"), "footer")
p = must(foot.find("p", class_=lambda c: c and "truncate" in c), "cart summary"); p["id"] = "cartSummary"
for s in foot.find_all("span"):
    t = s.get_text(strip=True)
    if t == "Split-Cart Ready": s["id"] = "cartTitle"
    if t == "Optimal Route": s["id"] = "cartBadge"
    if t.startswith("₹306"): s["id"] = "netSavings"
ob = must(foot.find("button", string=None, class_=lambda c: c and "font-semibold" in c and "bg-[#ffffff]" in c), "optimize btn"); ob["id"] = "optimizeBtn"
spans = ob.find_all("span"); spans[-1]["id"] = "optimizeSave"

# app script
soup.body.append(soup.new_tag("script", src="/static/app.js"))
open(dst, "w", encoding="utf-8").write(str(soup))
print("patched ->", dst)
