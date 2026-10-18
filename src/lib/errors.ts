/** Shared error + HTTP helpers for route handlers. */

export type ErrorPayload = { error: string; message: string; notes?: string[] };

export class ApiError extends Error {
  readonly status: number;
  readonly payload: ErrorPayload;

  constructor(status: number, payload: ErrorPayload) {
    super(payload.message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

export function describeError(e: unknown): string {
  if (e instanceof ApiError) {
    const bits = [e.payload.message, ...(e.payload.notes ?? []).slice(0, 2)];
    return bits.join(" | ").slice(0, 600);
  }
  if (e instanceof Error) return `${e.name}: ${e.message}`.slice(0, 600);
  return String(e).slice(0, 600);
}

export function jsonError(status: number, payload: ErrorPayload): Response {
  return Response.json({ detail: payload }, { status });
}

export function apiErrorResponse(e: unknown): Response {
  if (e instanceof ApiError) return jsonError(e.status, e.payload);
  return jsonError(500, { error: "internal_error", message: describeError(e) });
}

export function validationResponse(message: string): Response {
  return jsonError(422, { error: "validation_error", message });
}

export function assertLiveConfig(needs: Array<"tinyfish" | "gateway">, has: { tinyfish: boolean; gateway: boolean }): void {
  const missing = needs.filter((n) => !has[n]).map((n) => (n === "tinyfish" ? "TINYFISH_API_KEY" : "AI_GATEWAY_API_KEY"));
  if (missing.length) {
    throw new ApiError(503, {
      error: "config_error",
      message: `MEDPULSE_MODE=live but ${missing.join(", ")} is empty. Add it to .env.local (or set MEDPULSE_MODE=auto for labelled demo data).`,
    });
  }
}
