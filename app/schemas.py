"""Pydantic models. Field names follow the PRD's DualTrackComparisonResponse."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field, field_validator

Category = Literal["govt_generic", "online_generic", "branded"]
DataSource = Literal["live", "demo"]
CartMode = Literal["urgent", "refill"]


def _pin(v: str) -> str:
    v = (v or "").strip()
    if not (v.isdigit() and len(v) == 6):
        raise ValueError("pincode must be exactly 6 digits")
    return v


class Offer(BaseModel):
    platform: str
    category: Category
    product_name: str
    manufacturer: str | None = None
    badges: list[str] = Field(default_factory=list)
    mrp_inr: float | None = None
    price_inr: float
    pack_size: int = 10
    price_per_10_tabs_inr: float
    price_per_tab_inr: float
    discount_percent: float = 0.0  # vs this vendor's own MRP
    savings_vs_branded_percent: float = 0.0  # vs leading branded MRP, normalized per 10 tabs
    nabl_lab_report_verified: bool = False
    nabl_batch_id: str | None = None
    nabl_report_url: str | None = None
    equivalence_percent: float | None = None
    delivery_eta: str
    eta_minutes: int | None = None
    in_stock: bool | None = None
    stock_note: str | None = None
    verified_by: str = "TinyFetch"
    product_url: str | None = None


class Kendra(BaseModel):
    kendra_id: str
    name: str
    address: str
    pincode: str | None = None
    distance_km: float | None = None
    phone: str | None = None
    stock_note: str | None = None
    source_portal: str


class GovtBenchmark(BaseModel):
    scheme: str = "PMBJP Jan Aushadhi Official Benchmark"
    drug_code: str | None = None
    official_mrp_per_10_tabs_inr: float
    bioequivalence_index_percent: float | None = None
    certification: str | None = "WHO-GMP Certified"
    nearest_walk_in_kendra: Kendra | None = None


class AmritAlert(BaseModel):
    triggered_by: str
    item_price_inr: float
    message: str
    outlets: list[Kendra]


class DualTrackComparisonResponse(BaseModel):
    query_brand: str
    active_salt: str
    user_pincode: str
    govt_benchmark: GovtBenchmark | None = None
    subsidised_generic_online: list[Offer] = Field(default_factory=list)
    branded_express_online: list[Offer] = Field(default_factory=list)
    amrit_hospital_alert: AmritAlert | None = None
    branded_reference_mrp_inr: float | None = None
    branded_reference_per_10_tabs_inr: float | None = None
    best_savings_percent: float = 0.0
    data_source: DataSource = "demo"
    notes: list[str] = Field(default_factory=list)
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DualTrackRequest(BaseModel):
    query: str = Field(min_length=2, max_length=120, description="Brand or salt, e.g. 'Augmentin 625 Duo'")
    pincode: str = "110053"
    session_id: str | None = None

    _v = field_validator("pincode")(_pin)


# ---- prescription ------------------------------------------------------
class SaltComponent(BaseModel):
    name: str
    strength: str | None = None


class PrescribedMedicine(BaseModel):
    brand_name: str
    dosage: str | None = None
    pack_size: int | None = None
    salts: list[SaltComponent]
    active_salt: str
    frequency: str | None = None  # e.g. "1-0-1" (morning-afternoon-night)
    instructions: str | None = None  # as written on the Rx, e.g. "after food"
    duration_days: int | None = None
    schedule_en: str | None = None
    schedule_hi: str | None = None


class Interaction(BaseModel):
    between: list[str]
    severity: Literal["minor", "moderate", "major"]
    note: str


class PrescriptionAnalysis(BaseModel):
    medicines: list[PrescribedMedicine]
    interactions: list[Interaction] = Field(default_factory=list)
    data_source: DataSource = "demo"
    disclaimer: str = (
        "Informational only. Confirm every substitution with your doctor or pharmacist before switching."
    )


class PrescriptionTextRequest(BaseModel):
    text: str = Field(min_length=2, max_length=2000)


# ---- live pincode ------------------------------------------------------
class LivePincodeRequest(BaseModel):
    pincode: str
    product_urls: list[str] = Field(min_length=1, max_length=5)
    session_id: str | None = None

    _v = field_validator("pincode")(_pin)


class StockCheck(BaseModel):
    product_url: str
    platform: str | None = None
    in_stock_at_pincode: bool | None = None
    delivery_eta: str | None = None
    price_inr: float | None = None
    error: str | None = None
    verified_by: str
    streaming_url: str | None = None


class LivePincodeResponse(BaseModel):
    pincode: str
    checks: list[StockCheck]
    data_source: DataSource
    session_id: str


# ---- nearest kendra ----------------------------------------------------
class KendraRequest(BaseModel):
    pincode: str
    session_id: str | None = None
    include_amrit: bool = False

    _v = field_validator("pincode")(_pin)


class KendraResponse(BaseModel):
    pincode: str
    kendras: list[Kendra]
    amrit_outlets: list[Kendra] = Field(default_factory=list)
    data_source: DataSource


# ---- hybrid cart -------------------------------------------------------
class CartItemIn(BaseModel):
    query: str = Field(min_length=2, max_length=120)
    quantity_strips: int = Field(default=1, ge=1, le=24)
    mode: CartMode = "refill"


class CartRequest(BaseModel):
    items: list[CartItemIn] = Field(min_length=1, max_length=12)
    pincode: str = "110053"
    session_id: str | None = None

    _v = field_validator("pincode")(_pin)


class CartLine(BaseModel):
    query: str
    mode: CartMode
    quantity_strips: int
    chosen: Offer
    baseline_price_inr: float  # leading branded MRP x qty
    line_total_inr: float
    line_savings_inr: float
    reason: str


class CartResponse(BaseModel):
    pincode: str
    urgent_cart: list[CartLine]
    refill_cart: list[CartLine]
    baseline_total_inr: float
    optimized_total_inr: float
    net_savings_inr: float
    net_savings_percent: float
    checkout_links: dict[str, list[str]]
    unresolved: list[str] = Field(default_factory=list)
    data_source: DataSource
