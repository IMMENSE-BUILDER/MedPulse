/**
 * Dual-model AI routing — ALL LLM calls go through the Vercel AI Gateway
 * (PRD §2 / AGENTS.md §3):
 *
 *   vision model (VISION_MODEL) → vision / prescription OCR only
 *   text model   (TEXT_MODEL)   → salt mapping, extraction, interactions, JSON
 *
 * Model IDs live in env (`src/lib/env.ts` defaults, overridable via .env.local)
 * and are never surfaced in the UI or API responses. Never mix the roles up.
 *
 * Structured-output note: the current text-model provider does not advertise
 * the "structured-output" capability, so schema-constrained generation
 * (generateObject / Output.object) is rejected with a 400 for that model —
 * and `generateObject` is deprecated in
 * AI SDK v7 anyway. We therefore embed the schema's JSON Schema in the prompt,
 * parse the reply tolerantly and zod-validate it, retrying once with the
 * validation error. Every value entering the app is still schema-validated.
 */
import { generateText, gateway } from "ai";
import type { ModelMessage } from "ai";
import { z } from "zod";
import {
  AiBatchSchema,
  AiLabBatchSchema,
  AiRxSchema,
  AiSuggestionsSchema,
  AiVisionRxSchema,
  SaltResolutionSchema,
  type AiLab,
  type AiOffer,
  type AiRx,
  type AiSuggestions,
  type AiVisionRx,
  type DocAiMessage,
  type SaltResolution,
} from "./schemas";
import { env } from "./env";
import { trimPage } from "./pricing";
import type { FetchPage } from "./tinyfish";

function textModel() {
  return gateway(env.textModel());
}

function visionModel() {
  return gateway(env.visionModel());
}

type GenModel = ReturnType<typeof textModel>;

/* --------------------------------------------- validated JSON generation */

/** JSON Schema + instructions appended to every prompt. */
function jsonInstruction(schema: z.ZodType): string {
  const jsonSchema = JSON.stringify(z.toJSONSchema(schema));
  return (
    "Reply with ONLY one valid JSON object conforming to this JSON Schema — " +
    "no markdown fences, no commentary, no text after it:\n" +
    jsonSchema
  );
}

/** Tolerantly pull the outermost JSON object out of a model reply. */
function extractJson(text: string): string | null {
  const cleaned = text.replace(/```[a-z]*/gi, " ").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return cleaned.slice(start, end + 1);
}

function validateReply<T>(
  text: string,
  schema: z.ZodType<T>,
): { ok: true; value: T } | { ok: false; issue: string } {
  const json = extractJson(text);
  if (json === null) return { ok: false, issue: "no JSON object found in the reply" };
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { ok: false, issue: "the reply was not parseable JSON" };
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const issue = parsed.error.issues
      .slice(0, 4)
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    return { ok: false, issue };
  }
  return { ok: true, value: parsed.data };
}

/** Append the JSON instructions to the last user message (or add a new one). */
function withInstruction(messages: ModelMessage[], instruction: string): ModelMessage[] {
  const out = messages.map((m) => ({ ...m }));
  const last = out[out.length - 1];
  if (last && last.role === "user") {
    if (typeof last.content === "string") {
      last.content = `${last.content}\n\n${instruction}`;
    } else {
      last.content = [...last.content, { type: "text", text: instruction }];
    }
    return out;
  }
  out.push({ role: "user", content: instruction });
  return out;
}

/**
 * One model call + tolerant parse + zod validation, with a single repair retry.
 * Throws after a second invalid reply so callers can fall back / surface an error.
 */
async function generateValidated<T>(opts: {
  model: GenModel;
  schema: z.ZodType<T>;
  prompt?: string;
  messages?: ModelMessage[];
  /**
   * OCR path only: switch off the model's hidden reasoning tokens. They add
   * several seconds per call without changing the transcription or the
   * structured result, so both visionExtractRx and structureRx pass "none".
   * Other text/JSON tasks leave this undefined.
   */
  reasoning?: "none";
}): Promise<T> {
  const instruction = jsonInstruction(opts.schema);

  const first = opts.messages
    ? await generateText({
        model: opts.model,
        temperature: 0,
        reasoning: opts.reasoning,
        messages: withInstruction(opts.messages, instruction),
      })
    : await generateText({
        model: opts.model,
        temperature: 0,
        reasoning: opts.reasoning,
        prompt: `${opts.prompt ?? ""}\n\n${instruction}`,
      });

  const firstCheck = validateReply(first.text, opts.schema);
  if (firstCheck.ok) return firstCheck.value;

  const repair =
    `Your previous reply began with "${first.text.slice(0, 300)}" and was rejected because: ` +
    `${firstCheck.issue}. Reply with ONLY the corrected JSON object; nothing else.`;

  const second = opts.messages
    ? await generateText({
        model: opts.model,
        temperature: 0,
        reasoning: opts.reasoning,
        messages: [
          ...withInstruction(opts.messages, instruction),
          { role: "assistant", content: first.text.slice(0, 2000) },
          { role: "user", content: repair },
        ],
      })
    : await generateText({
        model: opts.model,
        temperature: 0,
        reasoning: opts.reasoning,
        prompt: `${opts.prompt ?? ""}\n\n${instruction}\n\n${repair}`,
      });

  const secondCheck = validateReply(second.text, opts.schema);
  if (secondCheck.ok) return secondCheck.value;
  throw new Error(`AI reply failed schema validation twice (${secondCheck.issue})`);
}

/* ------------------------------------------------------------ salt decode */
export async function resolveSalt(query: string): Promise<SaltResolution> {
  return generateValidated({
    model: textModel(),
    schema: SaltResolutionSchema,
    prompt:
      "You are a pharmaceutical reference for the Indian market. Resolve this medicine query to its " +
      "active salt(s) and strengths. If it is a brand, give the brand name and manufacturer. If it is not a " +
      `medicine, set is_medicine=false.\nQuery: ${query}`,
  });
}

/* ------------------------------------------ unresolved-query suggestions */
/**
 * When a query cannot be decoded to a salt, pick the most likely real products
 * from live search results. The model may only select/rephrase names that
 * appear in the provided results — it must never invent products.
 */
export async function suggestFromSearchResults(opts: {
  query: string;
  candidates: { title: string; snippet: string; site: string }[];
}): Promise<AiSuggestions> {
  const block = opts.candidates
    .slice(0, 16)
    .map((c, i) => `${i + 1}. [${c.site}] ${c.title} :: ${c.snippet}`)
    .join("\n");
  return generateValidated({
    model: textModel(),
    schema: AiSuggestionsSchema,
    prompt:
      `A user searched MedPulse AI for "${opts.query}" but it could not be decoded to an active salt. ` +
      "Below are real search results from tracked Indian pharmacy portals for that query. Decide whether a " +
      "medicine is plausibly being referred to (it may be a brand, a common misspelling, or a vitamin/mineral " +
      "product). If yes, list up to 4 DISTINCT medicine product names taken from these results that the user " +
      "most likely meant — prefer the best-known brands and the closest matches. `name` must be a clean " +
      "product/brand name suitable for a new search; `reason` one short line. Never invent names that do not " +
      "appear in the results. If the query is clearly not a medicine (lab test, food, person, gibberish), set " +
      `is_medicine=false and return an empty list.\n\nSearch results:\n${block}`,
  });
}

/* ------------------------------------------------- listing JSON extraction */
export async function extractOffersBatch(pages: FetchPage[], target: string, salt: string): Promise<Map<number, AiOffer[]>> {
  const blocks = pages
    .map((p, i) => `=== PAGE ${i + 1} | URL: ${p.url} ===\n${trimPage(p.text)}`)
    .join("\n\n");
  const object = await generateValidated({
    model: textModel(),
    schema: AiBatchSchema,
    prompt:
      "You extract pharmacy listing data from several web pages (markdown excerpts).\n" +
      `Target: ${target} (active salt: ${salt}).\n` +
      "For EACH page return an entry with its page_number and up to 3 offers. Rules: only report values " +
      "literally present on that page; never guess a price. Prices are INR numbers. pack_size_units is " +
      "tablets/capsules in ONE pack as sold (e.g. 'strip of 15 tablets' -> 15). is_target_product=false if the " +
      "listing is not the target salt/strength. strength_text = the strength(s) printed for that exact listing " +
      "(e.g. '650mg' or '500mg + 125mg'); null if not shown. nabl_report_url only if a lab-report/CoA link is " +
      "shown. If a page has no usable listing return an empty offers list for it.\n\n" +
      blocks,
  });
  return new Map(object.pages.map((p) => [p.page_number, p.offers]));
}

/* -------------------------------------------------- lab test extraction */
export async function extractLabsBatch(pages: FetchPage[], target: string): Promise<Map<number, AiLab[]>> {
  const blocks = pages
    .map((p, i) => `=== PAGE ${i + 1} | URL: ${p.url} ===\n${trimPage(p.text)}`)
    .join("\n\n");
  const object = await generateValidated({
    model: textModel(),
    schema: AiLabBatchSchema,
    prompt:
      "You extract diagnostic lab test listing data from several web pages (markdown excerpts).\n" +
      `Target test/package: ${target}.\n` +
      "For EACH page return an entry with its page_number and up to 3 offers. Rules: only report values " +
      "literally present on that page; never guess a price. price_inr is the discounted selling price in INR " +
      "for the package; mrp_inr the struck-through price if shown. parameters = number of tests/parameters " +
      "included if listed. earliest_slot = the earliest home-collection slot text if shown (e.g. 'Tomorrow, " +
      "7:00 AM'). is_target_test=false if the listing is not the target test/package. If a page has no usable " +
      "listing return an empty list.\n\n" +
      blocks,
  });
  return new Map(object.pages.map((p) => [p.page_number, p.labs]));
}

/* ------------------------------------------- vision Rx OCR (vision model) */
export async function visionExtractRx(input: { base64: string; mimeType: string }): Promise<AiVisionRx> {
  return generateValidated({
    model: visionModel(),
    schema: AiVisionRxSchema,
    reasoning: "none",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "Read this Indian doctor's prescription image. Transcribe the raw text, then list every " +
              "medicine you can read: raw_name exactly as written, strength_text if printed, frequency as " +
              "morning-afternoon-night digits (e.g. '1-0-1') only if written, instructions such as 'after food' " +
              "only if written, duration_days only if written. Do not invent anything. Handwriting may be " +
              "messy: skip words you cannot read.",
          },
          { type: "file", mediaType: input.mimeType, data: { type: "data", data: input.base64 } },
        ],
      },
    ],
  });
}

/* ------------------------------ structuring + interactions (ling) */
export async function structureRx(input: { text?: string; vision?: AiVisionRx }): Promise<AiRx> {
  const source = input.vision
    ? "Raw transcription JSON from the vision model:\n" + JSON.stringify(input.vision)
    : "Prescription text:\n" + (input.text ?? "");
  return generateValidated({
    model: textModel(),
    schema: AiRxSchema,
    reasoning: "none",
    prompt:
      "You structure Indian prescription data into clinical JSON. For every prescribed medicine return: " +
      "brand_name as written, dosage, pack_size (only if written), salts (exact active chemical names + " +
      "strengths, WHO/INN naming), frequency as morning-afternoon-night digits like 1-0-1 (only if written), " +
      "instructions such as 'after food' (only if written), duration_days (only if written). Do not invent " +
      "anything that is not in the source; leave unknown fields null. In `interactions` list only " +
      "well-established drug-drug interactions between the listed salts (severity minor/moderate/major); if " +
      "unsure return an empty list.\n\n" +
      source,
  });
}

/* -------------------------------------------------- DocAI (general help) */

const DOCAI_SYSTEM_PROMPT = [
  "You are DocAI — the general medical help assistant inside MedPulse AI (India).",
  "You give careful general health information; you never give a definitive diagnosis and you are not a substitute for a real doctor.",
  "How to answer:",
  "- Reply in the language the user writes in (English / Hindi / Hinglish).",
  "- Be concise and practical: short paragraphs or bullets, ideally under ~180 words.",
  "- Ask at most one or two brief clarifying questions when the answer truly depends on them (age, duration, other medicines).",
  "- For symptoms: give common causes, safe general self-care, and clear signs of when to see a doctor.",
  "- For medicines: explain what it is generally used for, common side effects and key cautions.",
  "- NEVER invent or state specific prices. You may mention that generics usually cost less and that this app can compare prices.",
  "- NEVER tell a user to change, skip or stop a prescribed dose — always refer them to their doctor or pharmacist.",
  "- Do not recommend antibiotics, opioids or other prescription-only medicines directly; say a doctor must decide.",
  "Safety, always:",
  "- If the message suggests an emergency (chest pain, difficulty breathing, stroke signs such as face droop or slurred speech, heavy bleeding, fainting, suicidal thoughts, serious injury, pregnancy complications, or fever in a baby under 3 months), start the reply by telling the user to seek emergency care NOW — call 108 or 112 or go to the nearest hospital.",
  "- End health-sensitive answers with one short line reminding the user to confirm with a doctor or pharmacist.",
].join("\n");

/**
 * Free-form general medical help & consulting chat (DocAI dock).
 * Same text model as every other text task; the safety
 * rules live in the system prompt, not in per-call instructions.
 */
export async function docaiChat(messages: DocAiMessage[]): Promise<string> {
  const res = await generateText({
    model: textModel(),
    system: DOCAI_SYSTEM_PROMPT,
    temperature: 0.3,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });
  return res.text.trim();
}
