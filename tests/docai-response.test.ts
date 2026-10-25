import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/docai/route";
import { resetRateLimits } from "@/lib/rate-limit";
import { DocAiResponseSchema } from "@/lib/schemas";

function request(body: unknown, ip = "11.11.11.11"): Request {
  return new Request("https://example.test/api/docai", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = { messages: [{ role: "user", content: "What is Dolo 650 used for?" }] };

beforeEach(() => {
  resetRateLimits();
  vi.stubEnv("MEDPULSE_MODE", "demo");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/docai", () => {
  it("answers in demo mode with a labelled reply and no model ID", async () => {
    const res = await POST(request(VALID_BODY));
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.data_source).toBe("demo");
    expect(typeof json.reply).toBe("string");
    expect((json.reply as string).length).toBeGreaterThan(10);
    // AGENTS.md §3/§7.12 — model IDs must never be surfaced in API responses.
    expect(json).not.toHaveProperty("model");
    expect(Object.keys(json).sort()).toEqual(["data_source", "reply"]);
  });

  it("rejects an empty message list before any model call", async () => {
    const res = await POST(request({ messages: [] }, "12.12.12.12"));
    expect(res.status).toBe(422);
  });

  it("DocAI response schema carries no model field", () => {
    const parsed = DocAiResponseSchema.parse({
      reply: "General information only.",
      model: "secret/model-id",
      data_source: "live",
    });
    expect(parsed).not.toHaveProperty("model");
    expect(parsed.data_source).toBe("live");
  });
});
