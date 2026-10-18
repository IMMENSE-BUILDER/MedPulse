import { describe, expect, it } from "vitest";
import { compareMedicines } from "@/lib/compare";
import { compareDemo, findMedicine, labsDemo, suggestAll } from "@/lib/demo-seed";

describe("demo seed lookups", () => {
  it("resolves brands and generic salts", () => {
    expect(findMedicine("augmentin 625")?.key).toBe("augmentin625");
    expect(findMedicine("telmisartan")?.key).toBe("telmisartan40");
    expect(findMedicine("dolo")?.key).toBe("dolo650");
    expect(findMedicine("metformin 500 sr")?.key).toBe("metformin500sr");
    expect(findMedicine("who knows")).toBeNull();
  });

  it("suggests medicines and labs", () => {
    const s = suggestAll("dolo");
    expect(s.some((x) => x.kind === "medicine" && x.label.includes("Dolo"))).toBe(true);
    const l = suggestAll("hba1c");
    expect(l.some((x) => x.kind === "lab")).toBe(true);
  });
});

describe("compareDemo", () => {
  it("builds a dual-track comparison with sorted generics and express branded", () => {
    const cmp = compareDemo("Augmentin 625 Duo", "110053");
    expect(cmp).not.toBeNull();
    if (!cmp) return;
    expect(cmp.data_source).toBe("demo");
    expect(cmp.subsidised_generic_online).toHaveLength(3);
    expect(cmp.branded_express_online).toHaveLength(3);
    const generics = cmp.subsidised_generic_online;
    expect(generics[0].price_per_10_tabs_inr).toBeLessThanOrEqual(generics[1].price_per_10_tabs_inr);
    expect(generics[1].price_per_10_tabs_inr).toBeLessThanOrEqual(generics[2].price_per_10_tabs_inr);
    expect(cmp.branded_express_online[0].platform).toBe("Apollo Pharmacy");
    expect(cmp.best_savings_percent).toBeGreaterThan(60);
    expect(cmp.best_savings_percent).toBeLessThan(90);
    expect(cmp.govt_benchmark?.official_mrp_per_10_tabs_inr).toBe(45.2);
  });

  it("returns null for unknown medicines", () => {
    expect(compareDemo("exotic drug zzz", "110053")).toBeNull();
  });
});

describe("compareMedicines (no keys => labelled demo)", () => {
  it("serves demo data with a visible label", async () => {
    const cmp = await compareMedicines({ query: "Metformin 500mg", pincode: "110053" });
    expect(cmp.data_source).toBe("demo");
    expect(cmp.query_brand).toContain("Glycomet");
    expect(cmp.notes.some((n) => n.includes("DEMO"))).toBe(true);
  });

  it("404s cleanly for unknown medicines in demo mode", async () => {
    await expect(compareMedicines({ query: "unobtainium tablet", pincode: "110053" })).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe("labsDemo", () => {
  it("compares HbA1c packages across labs", () => {
    const labs = labsDemo("hba1c", "110053");
    expect(labs).not.toBeNull();
    if (!labs) return;
    expect(labs.offers).toHaveLength(4);
    expect(labs.offers[0].price_inr).toBe(299);
    expect(labs.offers[0].lab).toBe("Redcliffe Labs");
    expect(labs.best_savings_percent).toBeGreaterThan(10);
    expect(labs.data_source).toBe("demo");
  });

  it("returns null for unknown tests", () => {
    expect(labsDemo("full genome sequencing", "110053")).toBeNull();
  });
});
