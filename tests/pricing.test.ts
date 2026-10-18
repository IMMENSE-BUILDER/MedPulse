import { describe, expect, it } from "vitest";
import {
  discountPct,
  etaText,
  normalizeName,
  parsePackSize,
  parseStrengths,
  per10Tabs,
  perTab,
  savingsPct,
  strengthOk,
  trimPage,
} from "@/lib/pricing";

describe("per-tab normalisation", () => {
  it("converts a pack price to per-10-tab and per-tab prices", () => {
    expect(per10Tabs(150, 15)).toBe(100);
    expect(per10Tabs(90.4, 10)).toBe(90.4);
    expect(perTab(52, 10)).toBe(5.2);
    expect(per10Tabs(52, 10)).toBe(52);
  });

  it("never divides by zero", () => {
    expect(perTab(100, 0)).toBe(100);
    expect(per10Tabs(100, 0)).toBe(1000);
  });
});

describe("savings + discounts", () => {
  it("computes savings against a branded reference", () => {
    expect(savingsPct(204.35, 45.2)).toBe(77.9);
    expect(savingsPct(null, 10)).toBe(0);
    expect(savingsPct(100, 120)).toBe(0);
  });

  it("computes MRP discount, guarding bad MRP data", () => {
    expect(discountPct(204.35, 52)).toBe(74.6);
    expect(discountPct(50, 60)).toBe(0);
    expect(discountPct(null, 60)).toBe(0);
  });
});

describe("etaText", () => {
  it("formats minutes, hours and days", () => {
    expect(etaText(45)).toBe("~45 mins");
    expect(etaText(120)).toBe("2 hrs");
    expect(etaText(1440)).toBe("1 day");
    expect(etaText(2880)).toBe("2 days");
    expect(etaText(null)).toBe("ETA unknown");
  });
});

describe("pack size parsing", () => {
  it("reads common Indian listing formats", () => {
    expect(parsePackSize("Strip of 15 tablets")).toBe(15);
    expect(parsePackSize("strip of 10")).toBe(10);
    expect(parsePackSize("Bottle of 100 Tablets")).toBe(100);
    expect(parsePackSize("30 capsules")).toBe(30);
    expect(parsePackSize("no size here")).toBe(10);
    expect(parsePackSize(null)).toBe(10);
  });
});

describe("strength guard", () => {
  it("parses strengths normalised to mg", () => {
    expect([...parseStrengths("Amoxycillin 500mg + Clavulanic Acid 125mg")].sort((a, b) => a - b)).toEqual([125, 500]);
    expect([...parseStrengths("0.5 g")]).toEqual([500]);
  });

  it("accepts exact matches, combo sums and unqualified numbers", () => {
    expect(strengthOk(new Set([625]), "Augmentin 625 Duo 625mg").ok).toBe(true);
    expect(strengthOk(new Set([500, 125]), "500mg + 125mg").ok).toBe(true);
    expect(strengthOk(new Set([500, 125]), "co-amoxiclav 625 mg").ok).toBe(true);
    expect(strengthOk(new Set([650]), "Dolo 650 Tablet").ok).toBe(true);
    expect(strengthOk(new Set(), "anything at all").ok).toBe(true);
  });

  it("rejects wrong strengths", () => {
    expect(strengthOk(new Set([650]), "Paracetamol 500mg").ok).toBe(false);
    expect(strengthOk(new Set([500, 125]), "Amoxycillin 250mg + Clavulanic Acid 125mg").ok).toBe(false);
  });

  it("handles Vitamin D3 60K formats (thousands separators and K shorthand)", () => {
    expect([...parseStrengths("Cholecalciferol 60,000 IU")]).toEqual([60000]);
    expect([...parseStrengths("Uprise-D3 60K Capsule")]).toEqual([60000]);
    expect(strengthOk(new Set([60000]), "60,000 IU").ok).toBe(true);
    expect(strengthOk(new Set([60000]), "Uprise-D3 60K").ok).toBe(true);
    expect(strengthOk(new Set([60000]), "Cholecalciferol 60K sachet").ok).toBe(true);
  });
});

describe("trimPage", () => {
  it("never exceeds the budget and keeps price-bearing windows", () => {
    const filler = "review text ".repeat(2000);
    const text = `Head info\n${filler}\nMRP ₹ 204.35 per strip of 10 tablets\n${filler}\nNABL report linked`;
    const out = trimPage(text, 3500);
    expect(out.length).toBeLessThanOrEqual(3500);
    expect(out).toContain("204.35");
    expect(out).toContain("NABL");
  });
});

describe("normalizeName", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalizeName("Augmentin 625 Duo!")).toBe("augmentin 625 duo");
    expect(normalizeName("  Telma-40  ")).toBe("telma 40");
  });
});
