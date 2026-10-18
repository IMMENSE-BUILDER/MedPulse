"""Exercises the LIVE code path with fake TinyFish/Gemini clients (no network)."""
import asyncio

import pytest

from app.config import Settings
from app.schemas import CartRequest
from app.services import compare as cmp
from app.services.container import Services
from app.services.gemini import ExtractedOffer, PageOffers
from app.services.optimizer import optimise
from app.state import cache


class FakeTF:
    def __init__(self, fail_search=False):
        self.fail_search = fail_search

    async def search(self, query, domains, purpose):
        if self.fail_search:
            raise RuntimeError("rate limited")
        if "1mg.com" in domains:
            return [{"url": "https://www.1mg.com/drugs/augmentin-625", "title": "", "snippet": "", "site": "1mg.com"},
                    {"url": "https://www.1mg.com/drugs/other", "title": "", "snippet": "", "site": "1mg.com"}]
        return [{"url": "https://sayacare.in/p/amox-clav", "title": "", "snippet": "", "site": "sayacare.in"},
                {"url": "https://janaushadhistore.in/p/amoxyclav", "title": "", "snippet": "", "site": "x"}]

    async def fetch(self, urls, purpose, ttl=3600):
        res = [{"url": u, "title": "", "text": f"PAGE {u}"} for u in urls if "janaushadhistore" not in u and not u.endswith(".pdf")]
        errs = [{"url": u, "error": "timeout"} for u in urls if "janaushadhistore" in u]
        res += [{"url": u, "title": "", "text": "NABL accredited lab. Batch No: AC2301X"} for u in urls if u.endswith(".pdf")]
        return res, errs


class FakeGemini:
    batch_calls = 0

    async def extract_offers_batch(self, pages, target, salt):
        type(self).batch_calls += 1
        return {i: (await self.extract_offers(p["text"], target, salt, p["url"])).offers for i, p in enumerate(pages, 1)}

    async def extract_offers(self, text, target, salt, url):
        if "1mg" in url:
            return PageOffers(offers=[ExtractedOffer(is_target_product=True, product_name="Augmentin 625 Duo", mrp_inr=223.0, price_inr=178.4, pack_size_units=10, strength_text="500mg + 125mg", in_stock=True)])
        if "sayacare" in url:  # 15-tab strip -> must normalise
            return PageOffers(offers=[ExtractedOffer(is_target_product=True, product_name="Amox+Clav 625", mrp_inr=120.0, price_inr=87.0, pack_size_units=15, strength_text="500mg + 125mg", nabl_report_url="https://sayacare.in/lab/9821.pdf")])
        return PageOffers(offers=[ExtractedOffer(is_target_product=False, price_inr=5)])


def svc(tf=None):
    return Services(Settings(medpulse_mode="live", tinyfish_api_key="x", gemini_api_key="y"), tf or FakeTF(), FakeGemini())


def run(coro):
    return asyncio.run(coro)


def test_live_compare_normalises_and_verifies():
    cache.clear()
    d = run(cmp.compare(svc(), "Augmentin 625 Duo", "110053"))
    assert d.data_source == "live"
    saya = d.subsidised_generic_online[0]
    assert saya.price_per_10_tabs_inr == 58.0  # 87 / 15 * 10
    assert saya.nabl_lab_report_verified and saya.nabl_batch_id == "AC2301X"
    assert saya.savings_vs_branded_percent == round((223 - 58) / 223 * 100, 1)  # reference = highest branded MRP seen
    assert d.branded_express_online[0].price_inr == 178.4
    assert any("janaushadhistore" in n for n in d.notes)  # failed URL isolated, reported


def test_live_never_marks_nabl_without_report():
    cache.clear()

    class G(FakeGemini):
        async def extract_offers(self, *a):
            return PageOffers(offers=[ExtractedOffer(is_target_product=True, price_inr=50, pack_size_units=10, mrp_inr=60, strength_text="500mg + 125mg")])

    s = svc(); s.gemini = G()
    d = run(cmp.compare(s, "Augmentin 625 Duo", "110053"))
    assert not any(o.nabl_lab_report_verified for o in d.subsidised_generic_online)


def test_auto_mode_falls_back_to_demo_but_live_mode_raises():
    cache.clear()
    s = svc(FakeTF(fail_search=True)); s.settings = Settings(medpulse_mode="auto", tinyfish_api_key="x", gemini_api_key="y")
    d = run(cmp.compare(s, "Augmentin 625 Duo", "110053"))
    assert d.data_source == "demo" and "Live lookup failed" in d.notes[0]
    cache.clear()
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as e:
        run(cmp.compare(svc(FakeTF(fail_search=True)), "Augmentin 625 Duo", "110053"))
    assert e.value.status_code == 502


def test_live_cart():
    cache.clear()
    req = CartRequest(pincode="110053", items=[{"query": "Augmentin 625 Duo", "mode": "refill", "quantity_strips": 2}])
    d = run(optimise(svc(), req))
    assert d.refill_cart[0].chosen.category != "branded" and d.net_savings_inr > 0


def test_auto_mode_shows_real_error_when_demo_cannot_help():
    cache.clear()
    from fastapi import HTTPException

    class BadGemini(FakeGemini):
        async def resolve_salt(self, q):
            raise RuntimeError("404 model no longer available")

    s = svc(); s.gemini = BadGemini()
    s.settings = Settings(medpulse_mode="auto", tinyfish_api_key="x", gemini_api_key="y")
    with pytest.raises(HTTPException) as e:
        run(cmp.compare(s, "Dolo 650", "110053"))
    assert e.value.status_code == 502 and "model no longer available" in e.value.detail["message"]
    assert "Demo mode" not in e.value.detail["message"]


def test_wrong_strength_listing_is_rejected():
    cache.clear()

    class G(FakeGemini):
        async def extract_offers(self, text, target, salt, url):
            if "sayacare" in url:  # a 250/125 product must not be shown for a 500/125 search
                return PageOffers(offers=[ExtractedOffer(is_target_product=True, product_name="Amox-Clav 375", price_inr=40, pack_size_units=10, strength_text="250mg + 125mg")])
            return await super().extract_offers(text, target, salt, url)

    s = svc(); s.gemini = G()
    d = run(cmp.compare(s, "Augmentin 625 Duo", "110053"))
    assert not any("375" in o.product_name for o in d.subsidised_generic_online)
    assert any("does not match" in n for n in d.notes)


def test_partial_gemini_failure_is_flagged_and_not_cached():
    cache.clear()
    calls = {"n": 0}

    class Flaky(FakeGemini):
        async def extract_offers(self, text, target, salt, url):
            calls["n"] += 1
            if "sayacare" in url:
                raise RuntimeError("503 UNAVAILABLE high demand")
            return await super().extract_offers(text, target, salt, url)

    s = svc(); s.gemini = Flaky(); s.settings.gemini_batch_size = 1
    d1 = run(cmp.compare(s, "Augmentin 625 Duo", "110053"))
    assert d1.notes[0].startswith("Incomplete: 1 of") and "overloaded" in d1.notes[0]
    assert d1.branded_express_online  # the pages that worked are still shown
    n1 = calls["n"]
    run(cmp.compare(s, "Augmentin 625 Duo", "110053"))
    # not cached as a whole, and the pages that already succeeded are NOT sent to Gemini again
    assert calls["n"] == n1 + 1


def test_quota_message_and_category_pages_skipped():
    cache.clear()

    class Quota(FakeGemini):
        async def extract_offers(self, *a):
            raise RuntimeError("429 RESOURCE_EXHAUSTED")

    s = svc(); s.gemini = Quota()
    d = None
    try:
        d = run(cmp.compare(s, "Augmentin 625 Duo", "110053"))
    except Exception as e:  # all pages failed -> 502 with notes
        assert "no_offers_extracted" in str(e.detail)
        assert any("over its quota" in n for n in e.detail["notes"][:1])
    cache.clear()
    tf = FakeTF()
    orig = tf.search

    async def search(q, domains, purpose):
        r = await orig(q, domains, purpose)
        return r + [{"url": "https://www.apollopharmacy.in/salt/Azithromycin", "title": "", "snippet": "", "site": "x"}]

    tf.search = search
    s2 = svc(tf)
    d2 = run(cmp.compare(s2, "Augmentin 625 Duo", "110053"))
    assert all("/salt/" not in (o.product_url or "") for o in d2.branded_express_online + d2.subsidised_generic_online)


def test_pages_are_batched_into_few_gemini_requests():
    cache.clear()
    FakeGemini.batch_calls = 0
    run(cmp.compare(svc(), "Augmentin 625 Duo", "110053"))
    assert 1 <= FakeGemini.batch_calls <= 2  # all pages in 1-2 requests, not one per page
