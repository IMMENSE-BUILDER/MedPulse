/**
 * POST /api/ocr — prescription image → structured medicines + interactions.
 * Vision runs on the vision model, structuring on the text model (env-configured).
 */
import { apiErrorResponse, validationResponse } from "@/lib/errors";
import { analyzePrescription } from "@/lib/prescription";
import { guard } from "@/lib/rate-limit";
import { OcrRequestSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  const limited = guard(req, "ocr");
  if (limited) return limited;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return validationResponse("Request body must be JSON.");
  }
  const parsed = OcrRequestSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return validationResponse(issue ? issue.message : "Invalid request.");
  }
  try {
    const result = await analyzePrescription({
      imageBase64: parsed.data.image_base64,
      mimeType: parsed.data.mime_type,
      text: parsed.data.text,
    });
    return Response.json(result);
  } catch (e) {
    return apiErrorResponse(e);
  }
}
