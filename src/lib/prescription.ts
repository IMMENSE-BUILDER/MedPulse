/**
 * Prescription intelligence (PRD §7):
 *   the vision model reads the image (vision-only duty);
 *   the text model structures it, resolves salts,
 *   translates the schedule to Hindi and lists established interactions.
 * (Model IDs are env-configured — see src/lib/env.ts. Never shown in the UI.)
 */
import { structureRx as aiStructureRx, visionExtractRx } from "./ai-router";
import { env, hasGateway, hasTinyFish } from "./env";
import { ApiError, assertLiveConfig, describeError } from "./errors";
import { buildSchedule } from "./schedule";
import type { AiRx, OcrResponse, RxInteraction, RxMedicine } from "./schemas";

export const OCR_DISCLAIMER =
  "Assistive tool only — not a medical device. Verify every medicine, strength and dose with your doctor or pharmacist. " +
  "यह सहायक टूल है — हर दवा और खुराक डॉक्टर या फार्मासिस्ट से जाँचें।";

export async function analyzePrescription(input: {
  imageBase64?: string;
  mimeType?: string;
  text?: string;
}): Promise<OcrResponse> {
  if (env.mode() === "live") {
    assertLiveConfig(["gateway"], { tinyfish: hasTinyFish(), gateway: hasGateway() });
  }
  const live = env.mode() !== "demo" && hasGateway();
  if (!live) return demoOcr(input);

  try {
    let extractedText = (input.text ?? "").trim();
    let visionJson: Awaited<ReturnType<typeof visionExtractRx>> | null = null;
    if (input.imageBase64) {
      visionJson = await visionExtractRx({
        base64: stripDataUrl(input.imageBase64),
        mimeType: input.mimeType ?? "image/jpeg",
      });
      extractedText = visionJson.extracted_text || extractedText;
    }
    const structured = await aiStructureRx(visionJson ? { vision: visionJson } : { text: extractedText });
    return {
      extracted_text: extractedText,
      medicines: structured.medicines.map(toRxMedicine),
      interactions: structured.interactions,
      data_source: "live",
      disclaimer: OCR_DISCLAIMER,
    };
  } catch (e) {
    const reason = describeError(e);
    if (env.mode() === "live") {
      throw e instanceof ApiError ? e : new ApiError(502, { error: "ai_extraction_failed", message: reason });
    }
    const demo = demoOcr(input);
    demo.disclaimer = `Live extraction failed (${reason}) — showing the demo sample. ${OCR_DISCLAIMER}`;
    return demo;
  }
}

function stripDataUrl(b64: string): string {
  const comma = b64.indexOf(",");
  return b64.startsWith("data:") && comma >= 0 ? b64.slice(comma + 1) : b64;
}

function toRxMedicine(m: AiRx["medicines"][number]): RxMedicine {
  const activeSalt = m.salts.map((s) => (s.strength ? `${s.name} (${s.strength})` : s.name)).join(" + ");
  const schedule = buildSchedule(m.frequency, m.instructions);
  return {
    brand_name: m.brand_name,
    dosage: m.dosage,
    pack_size: m.pack_size,
    salts: m.salts,
    active_salt: activeSalt,
    frequency: m.frequency,
    instructions: m.instructions,
    duration_days: m.duration_days,
    schedule_en: schedule?.en ?? null,
    schedule_hi: schedule?.hi ?? null,
  };
}

function demoOcr(input: { imageBase64?: string; text?: string }): OcrResponse {
  const augmentin = toRxMedicine({
    brand_name: "Augmentin 625 Duo Tablet",
    dosage: "625mg",
    pack_size: 10,
    salts: [
      { name: "Amoxycillin", strength: "500mg" },
      { name: "Clavulanic Acid", strength: "125mg" },
    ],
    frequency: "1-0-1",
    instructions: "after food",
    duration_days: 5,
  });
  const dolo = toRxMedicine({
    brand_name: "Dolo 650 Tablet",
    dosage: "650mg",
    pack_size: 15,
    salts: [{ name: "Paracetamol", strength: "650mg" }],
    frequency: "1-0-1",
    instructions: null,
    duration_days: 3,
  });
  const interactions: RxInteraction[] = [];
  return {
    extracted_text:
      "DEMO SAMPLE (no image processed)\nDr. A. Sharma, MBBS\nRx:\n1. Augmentin 625 Duo — 1-0-1 after food × 5 days\n2. Dolo 650 — 1-0-1 × 3 days",
    medicines: [augmentin, dolo],
    interactions,
    data_source: "demo",
    disclaimer:
      (input.imageBase64 ? "Demo sample shown — " : "") + "DEMO sample output. " + OCR_DISCLAIMER,
  };
}
