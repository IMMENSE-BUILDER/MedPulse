/**
 * POST /api/optimize-cart — split-cart optimizer (PRD §6/§9).
 * Returns express_cart (branded, ≤2 hr where possible) + generic_cart (refill).
 */
import { apiErrorResponse, validationResponse } from "@/lib/errors";
import { optimiseCart } from "@/lib/optimizer";
import { CartRequestSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return validationResponse("Request body must be JSON.");
  }
  const parsed = CartRequestSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return validationResponse(issue ? issue.message : "Invalid request.");
  }
  try {
    return Response.json(await optimiseCart(parsed.data));
  } catch (e) {
    return apiErrorResponse(e);
  }
}
