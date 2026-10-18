/**
 * POST /api/docai — DocAI, the general medical help & consulting chat.
 *
 * The only model involved is the text model (via ai-router, env-configured).
 * Without a gateway key (or in demo mode) it returns a clearly labelled demo
 * reply — never a fake "live" answer.
 */
import { docaiChat } from "@/lib/ai-router";
import { apiErrorResponse, assertLiveConfig, validationResponse } from "@/lib/errors";
import { env, gatewayAuthMode } from "@/lib/env";
import { DocAiRequestSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEMO_REPLY =
  "DocAI is in demo mode — no AI key is configured, so I can't answer real questions yet. " +
  "Add AI_GATEWAY_API_KEY (Vercel AI Gateway) and DocAI goes live. " +
  "Meanwhile MedPulse can still compare prices for Augmentin 625 Duo, Dolo 650, Telma 40, " +
  "Glycomet SR 500 and Pan 40.";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return validationResponse("Request body must be JSON.");
  }
  const parsed = DocAiRequestSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return validationResponse(issue ? `${issue.path.join(".") || "body"}: ${issue.message}` : "Invalid request.");
  }

  if (env.mode() === "live") {
    try {
      assertLiveConfig(["gateway"], { tinyfish: true, gateway: gatewayAuthMode() !== "none" });
    } catch (e) {
      return apiErrorResponse(e);
    }
  }
  if (env.mode() === "demo" || gatewayAuthMode() === "none") {
    return Response.json({ reply: DEMO_REPLY, model: null, data_source: "demo" });
  }

  try {
    const reply = await docaiChat(parsed.data.messages);
    return Response.json({ reply, model: env.textModel(), data_source: "live" });
  } catch (e) {
    return apiErrorResponse(e);
  }
}
