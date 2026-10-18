/**
 * POST /api/compare — dual-track medicine comparison (Track A/B/C)
 * or Track D lab comparison when `type:"lab"`.
 */
import { compareMedicines } from "@/lib/compare";
import { apiErrorResponse, validationResponse } from "@/lib/errors";
import { compareLabs } from "@/lib/labs";
import { CompareRequestSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
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
  try {
    if (type === "lab") {
      return Response.json(await compareLabs({ query, pincode }));
    }
    return Response.json(await compareMedicines({ query, pincode, sessionId: session_id }));
  } catch (e) {
    return apiErrorResponse(e);
  }
}
