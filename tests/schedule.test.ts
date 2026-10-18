import { describe, expect, it } from "vitest";
import { buildSchedule } from "@/lib/schedule";

describe("buildSchedule", () => {
  it("builds an EN/HI schedule from an M-A-N pattern", () => {
    const s = buildSchedule("1-0-1", "after food");
    expect(s).not.toBeNull();
    expect(s?.en).toBe("Morning (1), Night (1) — after food");
    expect(s?.hi).toBe("सुबह (1), रात (1) — खाने के बाद");
  });

  it("handles a full-day pattern without instructions", () => {
    const s = buildSchedule("1-1-1", null);
    expect(s?.en).toBe("Morning (1), Afternoon (1), Night (1)");
    expect(s?.hi).toBe("सुबह (1), दोपहर (1), रात (1)");
  });

  it("keeps unknown instructions in English only", () => {
    const s = buildSchedule("1-0-0", "with milk");
    expect(s?.en).toBe("Morning (1) — with milk");
    expect(s?.hi).toBe("सुबह (1)");
  });

  it("returns null for anything unparseable", () => {
    expect(buildSchedule("SOS", null)).toBeNull();
    expect(buildSchedule("0-0-0", null)).toBeNull();
    expect(buildSchedule(null, "after food")).toBeNull();
    expect(buildSchedule("once daily", null)).toBeNull();
  });
});
