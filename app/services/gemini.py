"""Gemini 2.5 Flash wrapper: structured extraction only (never free-form prices)."""
from __future__ import annotations

from typing import TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


# ---- structured output schemas (kept flat/simple for Gemini's schema subset) ----
class ExtractedOffer(BaseModel):
    is_target_product: bool  # false if page is another drug / not a product page
    product_name: str | None = None
    manufacturer: str | None = None
    mrp_inr: float | None = None
    price_inr: float | None = None
    pack_size_units: int | None = None
    strength_text: str | None = None  # strength printed for THIS listing, e.g. '650mg'
    in_stock: bool | None = None
    nabl_report_url: str | None = None


class PageOffers(BaseModel):
    offers: list[ExtractedOffer]


class PageResult(BaseModel):
    page_number: int
    offers: list[ExtractedOffer]


class BatchOffers(BaseModel):
    pages: list[PageResult]


class SaltResolution(BaseModel):
    is_medicine: bool
    brand_name: str | None = None
    manufacturer: str | None = None
    active_salt: str | None = None  # e.g. "Amoxycillin (500mg) + Clavulanic Acid (125mg)"
    salts: list[str] = []
    strengths: list[str] = []
    typical_pack_size: int | None = None


class RxSalt(BaseModel):
    name: str
    strength: str | None = None


class RxMedicine(BaseModel):
    brand_name: str
    dosage: str | None = None
    pack_size: int | None = None
    salts: list[RxSalt]
    frequency: str | None = None  # "1-0-1" morning-afternoon-night
    instructions: str | None = None
    duration_days: int | None = None


class RxInteraction(BaseModel):
    between: list[str]
    severity: str  # minor | moderate | major
    note: str


class RxResult(BaseModel):
    medicines: list[RxMedicine]
    interactions: list[RxInteraction] = []


class GeminiService:
    def __init__(self, api_key: str, model: str, fallback_model: str = ""):
        from google import genai
        from google.genai import types

        self._genai = genai
        # Retry transient errors (503 overloaded, 429 rate limit, 5xx) with exponential backoff + jitter.
        self._client = genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(
                retry_options=types.HttpRetryOptions(
                    attempts=5, initial_delay=1.5, max_delay=20.0, exp_base=2.0, jitter=1.0,
                    http_status_codes=[408, 429, 500, 502, 503, 504],
                )
            ),
        )
        self.model = model
        self.fallback_model = fallback_model

    async def generate(self, contents: list, schema: type[T]) -> T:
        from google.genai import types

        async def call(model: str):
            return await self._client.aio.models.generate_content(
                model=model,
                contents=contents,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json", response_schema=schema, temperature=0.0
                ),
            )

        try:
            resp = await call(self.model)
        except Exception:
            if not self.fallback_model:
                raise
            resp = await call(self.fallback_model)  # primary exhausted its retries: try the backup model
        parsed = getattr(resp, "parsed", None)
        if isinstance(parsed, schema):
            return parsed
        return schema.model_validate_json(resp.text)

    # -- tasks -----------------------------------------------------------
    async def extract_offers(self, page_markdown: str, target: str, salt: str, url: str) -> PageOffers:
        prompt = (
            "You extract pharmacy listing data from a web page's markdown.\n"
            f"Target: {target} (active salt: {salt}).\n"
            f"Page URL: {url}\n"
            "Rules: only report values literally present on the page; never guess a price. "
            "Return prices in INR as numbers. pack_size_units is tablets/capsules in ONE pack as sold "
            "(e.g. 'strip of 15 tablets' -> 15). Set is_target_product=false if the listing is not the target "
            "salt/strength. strength_text = the strength(s) printed for that exact listing (e.g. '650mg' or '500mg + 125mg'); null if not shown. nabl_report_url only if a lab-report/CoA link is shown. Max 3 offers.\n\n"
            "PAGE:\n" + page_markdown[:14000]
        )
        return await self.generate([prompt], PageOffers)

    async def extract_offers_batch(self, pages: list[dict], target: str, salt: str) -> dict[int, list[ExtractedOffer]]:
        """ONE request for several pages. pages: [{'url','text'}]. Returns {1-based page number: offers}."""
        from .pricing import trim_page

        blocks = "\n\n".join(
            f"=== PAGE {i} | URL: {p['url']} ===\n{trim_page(p['text'])}" for i, p in enumerate(pages, 1)
        )
        prompt = (
            "You extract pharmacy listing data from several web pages (markdown excerpts).\n"
            f"Target: {target} (active salt: {salt}).\n"
            "For EACH page return an entry with its page_number and up to 3 offers. Rules: only report values "
            "literally present on that page; never guess a price. Prices are INR numbers. pack_size_units is "
            "tablets/capsules in ONE pack as sold (e.g. 'strip of 15 tablets' -> 15). is_target_product=false if the "
            "listing is not the target salt/strength. strength_text = the strength(s) printed for that exact listing "
            "(e.g. '650mg' or '500mg + 125mg'); null if not shown. nabl_report_url only if a lab-report/CoA link is "
            "shown. If a page has no usable listing return an empty offers list for it.\n\n" + blocks
        )
        out = await self.generate([prompt], BatchOffers)
        return {r.page_number: r.offers for r in out.pages}

    async def resolve_salt(self, query: str) -> SaltResolution:
        prompt = (
            "You are a pharmaceutical reference. For the Indian market, resolve this medicine query to its "
            "active salt(s) and strengths. If it is a brand, give the brand name and manufacturer. If it is not a "
            f"medicine, set is_medicine=false.\nQuery: {query}"
        )
        return await self.generate([prompt], SaltResolution)

    async def analyze_prescription(self, *, data: bytes | None, mime: str | None, text: str | None) -> RxResult:
        from google.genai import types

        prompt = (
            "Read this Indian prescription. For every prescribed medicine return: brand_name as written, dosage, "
            "pack_size (only if written), salts (exact active chemical names + strengths, WHO/INN naming), "
            "frequency as morning-afternoon-night digits like 1-0-1 (only if written), instructions such as "
            "'after food' (only if written), duration_days (only if written). Do not invent anything that is not "
            "on the document; leave unknown fields null. Handwriting may be messy: if a drug name is illegible "
            "skip it. In `interactions` list only well-established drug-drug interactions between the listed salts "
            "(severity minor/moderate/major); if unsure return an empty list."
        )
        parts: list = []
        if data and mime:
            parts.append(types.Part.from_bytes(data=data, mime_type=mime))
        if text:
            parts.append(f"Prescription text:\n{text}")
        parts.append(prompt)
        return await self.generate(parts, RxResult)
