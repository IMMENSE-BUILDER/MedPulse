import { describe, expect, it } from "vitest";
import { CATALOG, searchCatalog } from "@/lib/catalog";

describe("catalog typeahead search", () => {
  it("returns nothing for an empty query", () => {
    expect(searchCatalog("", "medicine")).toEqual([]);
    expect(searchCatalog("   ", "medicine")).toEqual([]);
  });

  it("ranks exact and prefix name matches first", () => {
    expect(searchCatalog("dolo", "medicine")[0].name).toBe("Dolo 650");
    expect(searchCatalog("Dolo 650", "medicine")[0].name).toBe("Dolo 650");
    expect(searchCatalog("pan 40", "medicine")[0].name).toBe("Pan 40");
    expect(searchCatalog("tel 40", "medicine")[0].name).toBe("Telma 40");
  });

  it("matches multi-token queries in any order across name + strength", () => {
    const names = searchCatalog("625 augmentin", "medicine").map((i) => i.name);
    expect(names[0]).toBe("Augmentin 625 Duo");
  });

  it("finds medicines by their salt hint", () => {
    const names = searchCatalog("cholecalciferol", "medicine").map((i) => i.name);
    expect(names).toContain("Calcirol 60K");
    expect(names).toContain("Uprise-D3 60K");
    const t = searchCatalog("telmisartan", "medicine").map((i) => i.name);
    expect(t).toContain("Telma 40");
    expect(t).toContain("Telmisartan 40 mg");
  });

  it("filters strictly by track kind", () => {
    const lab = searchCatalog("thyroid", "lab").map((i) => i.name);
    expect(lab).toContain("Thyroid Profile (T3, T4, TSH)");
    const med = searchCatalog("thyroid", "medicine").map((i) => i.name);
    expect(med).not.toContain("Thyroid Profile (T3, T4, TSH)");
    expect(searchCatalog("cbc", "lab")[0].name).toBe("Complete Blood Count (CBC)");
    expect(searchCatalog("hb", "lab").map((i) => i.name)).toContain("HbA1c");
  });

  it("ignores punctuation/case and returns nothing for an unknown token", () => {
    expect(searchCatalog("AUGMENTIN-625", "medicine")[0].name).toBe("Augmentin 625 Duo");
    expect(searchCatalog("zzzqqq", "medicine")).toEqual([]);
  });

  it("respects the result limit and catalog is well-formed", () => {
    expect(searchCatalog("a", "medicine", 3).length).toBeLessThanOrEqual(3);
    expect(CATALOG.length).toBeGreaterThan(200);
    for (const item of CATALOG) {
      expect(item.name.trim().length).toBeGreaterThan(1);
      expect(item.hint.trim().length).toBeGreaterThan(1);
      expect(["medicine", "lab"]).toContain(item.kind);
    }
  });
});
