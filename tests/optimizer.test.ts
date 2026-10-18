import { describe, expect, it } from "vitest";
import { compareDemo } from "@/lib/demo-seed";
import { optimiseCart, pickOffer } from "@/lib/optimizer";

describe("pickOffer", () => {
  const cmp = compareDemo("Dolo 650", "110053");

  it("prefers a ≤2 hr option for urgent mode", () => {
    if (!cmp) throw new Error("demo comparison missing");
    const picked = pickOffer(cmp, "urgent");
    expect(picked).not.toBeNull();
    expect(picked?.offer.eta_minutes ?? 999).toBeLessThanOrEqual(120);
  });

  it("prefers a subsidised generic for refill mode", () => {
    if (!cmp) throw new Error("demo comparison missing");
    const picked = pickOffer(cmp, "refill");
    expect(picked).not.toBeNull();
    expect(picked?.offer.category).not.toBe("branded");
  });
});

describe("optimiseCart", () => {
  it("splits express and refill lines and reports net savings", async () => {
    const res = await optimiseCart({
      items: [
        { query: "Augmentin 625 Duo", quantity_strips: 1, mode: "urgent" },
        { query: "Telma 40", quantity_strips: 2, mode: "refill" },
        { query: "Nonexistent Medicine", quantity_strips: 1, mode: "refill" },
      ],
      pincode: "110053",
    });
    expect(res.express_cart).toHaveLength(1);
    expect(res.generic_cart).toHaveLength(1);
    expect(res.unresolved).toEqual(["Nonexistent Medicine"]);
    expect(res.express_cart[0].chosen.eta_minutes ?? 999).toBeLessThanOrEqual(120);
    expect(res.generic_cart[0].chosen.category).not.toBe("branded");
    expect(res.generic_cart[0].quantity_strips).toBe(2);
    expect(res.net_savings_inr).toBeGreaterThan(0);
    expect(res.net_savings_percent).toBeGreaterThan(0);
    expect(res.baseline_total_inr).toBeGreaterThan(res.optimized_total_inr);
    expect(res.data_source).toBe("demo");
    expect(Object.keys(res.checkout_links).length).toBeGreaterThan(0);
  });
});
