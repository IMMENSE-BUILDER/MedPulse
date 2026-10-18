import json


def test_health_demo(client):
    r = client.get("/api/health").json()
    assert r["mode"] == "demo" and "Augmentin 625 Duo Tablet" in r["demo_medicines"]


def test_dual_track_augmentin(client):
    r = client.post("/api/v2/compare/dual-track", json={"query": "Augmentin 625 Duo", "pincode": "110053"})
    assert r.status_code == 200
    d = r.json()
    assert d["data_source"] == "demo" and any("DEMO" in n for n in d["notes"])
    g, b = d["subsidised_generic_online"], d["branded_express_online"]
    assert len(g) == 3 and len(b) == 3
    assert [o["price_per_10_tabs_inr"] for o in g] == sorted(o["price_per_10_tabs_inr"] for o in g)
    assert [o["eta_minutes"] for o in b] == sorted(o["eta_minutes"] for o in b)
    assert d["govt_benchmark"]["official_mrp_per_10_tabs_inr"] == 45.20
    assert 70 < d["best_savings_percent"] < 85
    sc = next(o for o in g if o["platform"] == "SayaCare Generics")
    assert sc["price_inr"] == 52.0 and sc["nabl_lab_report_verified"]


def test_alias_and_pack_normalisation(client):
    d = client.post("/api/v2/compare/dual-track", json={"query": "telmisartan 40mg"}).json()
    assert d["query_brand"] == "Telma 40 Tablet"
    o = d["branded_express_online"][0]
    assert o["pack_size"] == 15 and abs(o["price_per_10_tabs_inr"] - o["price_inr"] / 15 * 10) < 0.02


def test_unknown_medicine_404(client):
    r = client.post("/api/v2/compare/dual-track", json={"query": "zzzxyz"})
    assert r.status_code == 404 and r.json()["detail"]["error"] == "unknown_medicine_in_demo_mode"


def test_bad_pincode_422(client):
    r = client.post("/api/v2/compare/dual-track", json={"query": "augmentin", "pincode": "12"})
    assert r.status_code == 422 and "pincode" in r.json()["detail"]["message"]


def test_cart_split(client):
    body = {"pincode": "110053", "items": [
        {"query": "Augmentin 625 Duo", "quantity_strips": 1, "mode": "urgent"},
        {"query": "Telmisartan 40", "quantity_strips": 2, "mode": "refill"},
        {"query": "Metformin 500 SR", "quantity_strips": 3, "mode": "refill"},
        {"query": "nonsense-drug", "mode": "refill"},
    ]}
    d = client.post("/api/v2/cart/hybrid-optimize", json=body).json()
    assert d["unresolved"] == ["nonsense-drug"]
    assert len(d["urgent_cart"]) == 1 and len(d["refill_cart"]) == 2
    assert d["urgent_cart"][0]["chosen"]["eta_minutes"] <= 120
    assert all(l["chosen"]["category"] != "branded" for l in d["refill_cart"])
    assert d["net_savings_inr"] > 0
    assert abs(d["net_savings_inr"] - (d["baseline_total_inr"] - d["optimized_total_inr"])) < 0.02
    assert d["checkout_links"]


def test_prescription_text_and_upload(client):
    d = client.post("/api/v2/prescription/analyze", data={"text": "Augmentin 625 1-0-1, Pan 40"}).json()
    names = [m["brand_name"] for m in d["medicines"]]
    assert "Augmentin 625 Duo Tablet" in names and "Pan 40 Tablet" in names
    aug = next(m for m in d["medicines"] if m["brand_name"].startswith("Augmentin"))
    assert aug["frequency"] == "1-0-1" and "सुबह" in aug["schedule_hi"] and "रात" in aug["schedule_hi"]
    r = client.post("/api/v2/prescription/analyze", files={"file": ("x.gif", b"GIF89a", "image/gif")})
    assert r.status_code == 415
    r = client.post("/api/v2/prescription/analyze", files={"file": ("rx.png", b"\x89PNG", "image/png")})
    assert r.status_code == 200 and r.json()["data_source"] == "demo"
    assert client.post("/api/v2/prescription/analyze").status_code == 422


def test_kendra_and_live_pincode_demo(client):
    d = client.post("/api/v2/govt/nearest-kendra", json={"pincode": "110053", "include_amrit": True}).json()
    assert d["kendras"][0]["pincode"] == "110053" and d["amrit_outlets"] and d["data_source"] == "demo"
    d = client.post("/api/v2/verify/live-pincode", json={"pincode": "110053", "product_urls": ["https://www.1mg.com/x"]}).json()
    c = d["checks"][0]
    assert c["in_stock_at_pincode"] is None and c["verified_by"] == "demo-simulated"  # never fakes stock


def test_agent_stream_sse(client):
    client.post("/api/v2/compare/dual-track", json={"query": "augmentin", "session_id": "sess1"})
    r = client.get("/api/v2/agent/stream", params={"session_id": "sess1", "once": "true"})
    ev = [json.loads(l[6:]) for l in r.text.splitlines() if l.startswith("data: ")]
    assert ev and "demo" in ev[0]["message"]


def test_live_without_keys_gives_clear_error(client, monkeypatch):
    from app.config import get_settings
    from app.services.container import reset_services

    monkeypatch.setenv("MEDPULSE_MODE", "live")
    get_settings.cache_clear(); reset_services()
    try:
        r = client.get("/api/health")
        assert r.status_code == 503 and r.json()["detail"]["error"] == "config_error"
        assert "TINYFISH_API_KEY" in r.json()["detail"]["message"]
    finally:
        monkeypatch.setenv("MEDPULSE_MODE", "demo")
        get_settings.cache_clear(); reset_services()
