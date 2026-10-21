/**
 * POST /api/compare-stream — SSE flavour of /api/compare.
 *
 * Emits the REAL pipeline stages as they happen (resolve → search → fetch →
 * extract → guard, with live counts), then the final result. Nothing here is
 * simulated: every STAGE frame is fired from inside the actual pipeline.
 */
import { compareMedicines } from "@/lib/compare";
import { ApiError, describeError, validationResponse } from "@/lib/errors";
import { compareLabs } from "@/lib/labs";
import { guard } from "@/lib/rate-limit";
import { CompareRequestSchema, type CompareStage, type CompareStreamEvent } from "@/lib/schemas";
import { jsonSseResponse } from "@/lib/sse";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  const limited = guard(req, "compare");
  if (limited) return limited;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return validationResponse("Request body must be JSON.");
  }
  const parsed = CompareRequestSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return validationResponse(issue ? `${issue.path.join(".") || "body"}: ${issue.message}` : "Invalid request.");
  }
  const { query, pincode, type, session_id } = parsed.data;

  return jsonSseResponse<CompareStreamEvent>({
    external: req.signal,
    onError: (e, send) => {
      send({
        type: "ERROR",
        code: e instanceof ApiError ? e.payload.error : "internal_error",
        message: describeError(e),
      });
    },
    run: async (send) => {
      const onProgress = (stage: CompareStage) => send({ type: "STAGE", stage });
      const result =
        type === "lab"
          ? await compareLabs({ query, pincode, onProgress })
          : await compareMedicines({ query, pincode, sessionId: session_id, onProgress });
      send({ type: "RESULT", result, data_source: result.data_source });
    },
  });
}
