/**
 * MedPulse AI — shared schemas (Zod) and types.
 * Field names follow the PRD v5.0 contract (§9) and the DualTrackComparison schema.
 */
import { z } from "zod";

/* ------------------------------------------------------------------ core */
export const CategorySchema = z.enum(["govt_generic", "online_generic", "branded"]);
export type Category = z.infer<typeof CategorySchema>;

export const DataSourceSchema = z.enum(["live", "demo"]);
export type DataSource = z.infer<typeof DataSourceSchema>;

export const CartModeSchema = z.enum(["urgent", "refill"]);
export type CartMode = z.infer<typeof CartModeSchema>;

export const SafetyTipSchema = z.object({ en: z.string(), hi: z.string() });
export type SafetyTip = z.infer<typeof SafetyTipSchema>;

export const PincodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "pincode must be exactly 6 digits");

/* ----------------------------------------------------------------- offer */
export const OfferSchema = z.object({
  platform: z.string(),
  category: CategorySchema,
  product_name: z.string(),
  manufacturer: z.string().nullable(),
  badges: z.array(z.string()),
  mrp_inr: z.number().nullable(),
  price_inr: z.number(),
  pack_size: z.number().int(),
  price_per_10_tabs_inr: z.number(),
  price_per_tab_inr: z.number(),
  discount_percent: z.number(),
  savings_vs_branded_percent: z.number(),
  nabl_lab_report_verified: z.boolean(),
  nabl_batch_id: z.string().nullable(),
  nabl_report_url: z.string().nullable(),
  equivalence_percent: z.number().nullable(),
  delivery_eta: z.string(),
  eta_minutes: z.number().nullable(),
  in_stock: z.boolean().nullable(),
  stock_note: z.string().nullable(),
  verified_by: z.string(),
  product_url: z.string().nullable(),
});
export type Offer = z.infer<typeof OfferSchema>;

/* ----------------------------------------------------------------- kendra */
export const KendraSchema = z.object({
  kendra_id: z.string(),
  name: z.string(),
  address: z.string(),
  pincode: z.string().nullable(),
  distance_km: z.number().nullable(),
  phone: z.string().nullable(),
  stock_note: z.string().nullable(),
  source_portal: z.string(),
});
export type Kendra = z.infer<typeof KendraSchema>;

export const GovtBenchmarkSchema = z.object({
  scheme: z.string(),
  drug_code: z.string().nullable(),
  official_mrp_per_10_tabs_inr: z.number(),
  bioequivalence_index_percent: z.number().nullable(),
  certification: z.string().nullable(),
  nearest_walk_in_kendra: KendraSchema.nullable(),
});
export type GovtBenchmark = z.infer<typeof GovtBenchmarkSchema>;

export const AmritAlertSchema = z.object({
  triggered_by: z.string(),
  item_price_inr: z.number(),
  message: z.string(),
  outlets: z.array(KendraSchema),
});
export type AmritAlert = z.infer<typeof AmritAlertSchema>;

/* ------------------------------------------------------------ comparison */
export const AlternativeSuggestionSchema = z.object({
  name: z.string(),
  reason: z.string().nullable(),
});
export type AlternativeSuggestion = z.infer<typeof AlternativeSuggestionSchema>;

export const DualTrackComparisonSchema = z.object({
  query_brand: z.string(),
  active_salt: z.string(),
  user_pincode: z.string(),
  govt_benchmark: GovtBenchmarkSchema.nullable(),
  subsidised_generic_online: z.array(OfferSchema),
  branded_express_online: z.array(OfferSchema),
  amrit_hospital_alert: AmritAlertSchema.nullable(),
  branded_reference_mrp_inr: z.number().nullable(),
  branded_reference_per_10_tabs_inr: z.number().nullable(),
  best_savings_percent: z.number(),
  safety_tip: SafetyTipSchema.nullable(),
  data_source: DataSourceSchema,
  notes: z.array(z.string()),
  generated_at: z.string(),
  /** "unresolved" = the query did not decode to a salt; see `suggestions`. */
  status: z.enum(["ok", "unresolved"]).optional(),
  suggestions: z.array(AlternativeSuggestionSchema).optional(),
});
export type DualTrackComparison = z.infer<typeof DualTrackComparisonSchema>;

export const CompareRequestSchema = z.object({
  query: z.string().trim().min(2).max(120),
  pincode: PincodeSchema.default("110053"),
  type: z.enum(["medicine", "lab"]).default("medicine"),
  session_id: z.string().max(64).optional(),
});
export type CompareRequest = z.infer<typeof CompareRequestSchema>;

/* ------------------------------------------ live pipeline progress (SSE) */
export const CompareStageSchema = z.object({
  step: z.string(),
  label: z.string(),
  status: z.enum(["start", "done"]),
  detail: z.string().optional(),
});
export type CompareStage = z.infer<typeof CompareStageSchema>;

export const CompareStreamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("STAGE"), stage: CompareStageSchema }),
  z.object({ type: z.literal("RESULT"), result: z.unknown(), data_source: DataSourceSchema }),
  z.object({ type: z.literal("ERROR"), code: z.string(), message: z.string() }),
]);
export type CompareStreamEvent = z.infer<typeof CompareStreamEventSchema>;

/* --------------------------------------------------------------- cart */
export const CartItemInSchema = z.object({
  query: z.string().trim().min(2).max(120),
  quantity_strips: z.number().int().min(1).max(24).default(1),
  mode: CartModeSchema.default("refill"),
});

export const CartRequestSchema = z.object({
  items: z.array(CartItemInSchema).min(1).max(12),
  pincode: PincodeSchema.default("110053"),
  session_id: z.string().max(64).optional(),
});
export type CartRequest = z.infer<typeof CartRequestSchema>;

export const CartLineSchema = z.object({
  query: z.string(),
  mode: CartModeSchema,
  quantity_strips: z.number().int(),
  chosen: OfferSchema,
  baseline_price_inr: z.number(),
  line_total_inr: z.number(),
  line_savings_inr: z.number(),
  reason: z.string(),
});
export type CartLine = z.infer<typeof CartLineSchema>;

export const CartResponseSchema = z.object({
  pincode: z.string(),
  express_cart: z.array(CartLineSchema),
  generic_cart: z.array(CartLineSchema),
  baseline_total_inr: z.number(),
  optimized_total_inr: z.number(),
  net_savings_inr: z.number(),
  net_savings_percent: z.number(),
  checkout_links: z.record(z.string(), z.array(z.string())),
  unresolved: z.array(z.string()),
  data_source: DataSourceSchema,
});
export type CartResponse = z.infer<typeof CartResponseSchema>;

/* --------------------------------------------------------------- labs */
export const LabOfferSchema = z.object({
  platform: z.string(),
  lab: z.string(),
  test_name: z.string(),
  price_inr: z.number(),
  mrp_inr: z.number().nullable(),
  discount_percent: z.number(),
  parameters: z.number().int().nullable(),
  turnaround: z.string().nullable(),
  earliest_slot: z.string().nullable(),
  home_collection: z.boolean().nullable(),
  product_url: z.string().nullable(),
  verified_by: z.string(),
});
export type LabOffer = z.infer<typeof LabOfferSchema>;

export const LabComparisonSchema = z.object({
  query: z.string(),
  pincode: z.string(),
  offers: z.array(LabOfferSchema),
  best_price_inr: z.number().nullable(),
  highest_price_inr: z.number().nullable(),
  best_savings_percent: z.number(),
  data_source: DataSourceSchema,
  notes: z.array(z.string()),
  generated_at: z.string(),
});
export type LabComparison = z.infer<typeof LabComparisonSchema>;

/* ------------------------------------------------------- agent (Wave 2) */
export const AgentStreamRequestSchema = z
  .object({
    kind: z.enum(["stock", "lab", "kendra"]).default("stock"),
    pincode: PincodeSchema,
    product_urls: z.array(z.string().url()).max(10).optional(),
    session_id: z.string().max(64).optional(),
  })
  .refine((v) => v.kind === "kendra" || (v.product_urls && v.product_urls.length > 0), {
    message: "product_urls (1-10) required for stock or lab checks",
    path: ["product_urls"],
  });
export type AgentStreamRequest = z.infer<typeof AgentStreamRequestSchema>;

export const StockCheckSchema = z.object({
  product_url: z.string(),
  platform: z.string().nullable(),
  in_stock_at_pincode: z.boolean().nullable(),
  delivery_eta: z.string().nullable(),
  price_inr: z.number().nullable(),
  error: z.string().nullable(),
  verified_by: z.string(),
  streaming_url: z.string().nullable(),
});
export type StockCheck = z.infer<typeof StockCheckSchema>;

/** Typed SSE contract from the PRD §9 / AGENTS.md §4. */
export const AgentEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("STARTED"), run_id: z.string(), goal: z.string() }),
  z.object({ type: z.literal("STREAMING_URL"), streaming_url: z.string() }),
  z.object({ type: z.literal("PROGRESS"), purpose: z.string() }),
  z.object({
    type: z.literal("COMPLETE"),
    ok: z.boolean(),
    result: z.unknown().nullable(),
    error: z.string().nullable(),
    video_url: z.string().nullable(),
  }),
]);
export type AgentEvent = z.infer<typeof AgentEventSchema>;

/* ---------------------------------------------------------- DocAI chat */
export const DocAiMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(2000),
});
export type DocAiMessage = z.infer<typeof DocAiMessageSchema>;

export const DocAiRequestSchema = z.object({
  messages: z.array(DocAiMessageSchema).min(1).max(16),
});
export type DocAiRequest = z.infer<typeof DocAiRequestSchema>;

export const DocAiResponseSchema = z.object({
  reply: z.string(),
  model: z.string().nullable(),
  data_source: z.enum(["live", "demo"]),
});
export type DocAiResponse = z.infer<typeof DocAiResponseSchema>;

/* ---------------------------------------------------------------- OCR */
export const OcrRequestSchema = z
  .object({
    image_base64: z.string().max(24_000_000).optional(),
    mime_type: z.string().optional(),
    text: z.string().max(4000).optional(),
    session_id: z.string().max(64).optional(),
  })
  .refine((v) => v.image_base64 || (v.text && v.text.trim().length >= 2), {
    message: "Provide a prescription image (base64) or text.",
  });
export type OcrRequest = z.infer<typeof OcrRequestSchema>;

export const RxSaltSchema = z.object({ name: z.string(), strength: z.string().nullable() });
export type RxSalt = z.infer<typeof RxSaltSchema>;

export const RxMedicineSchema = z.object({
  brand_name: z.string(),
  dosage: z.string().nullable(),
  pack_size: z.number().int().nullable(),
  salts: z.array(RxSaltSchema),
  active_salt: z.string(),
  frequency: z.string().nullable(),
  instructions: z.string().nullable(),
  duration_days: z.number().int().nullable(),
  schedule_en: z.string().nullable(),
  schedule_hi: z.string().nullable(),
});
export type RxMedicine = z.infer<typeof RxMedicineSchema>;

export const RxInteractionSchema = z.object({
  between: z.array(z.string()),
  severity: z.enum(["minor", "moderate", "major"]),
  note: z.string(),
});
export type RxInteraction = z.infer<typeof RxInteractionSchema>;

export const OcrResponseSchema = z.object({
  extracted_text: z.string(),
  medicines: z.array(RxMedicineSchema),
  interactions: z.array(RxInteractionSchema),
  data_source: DataSourceSchema,
  disclaimer: z.string(),
});
export type OcrResponse = z.infer<typeof OcrResponseSchema>;

/* ------------------------------------------------- AI structured output */
export const AiOfferSchema = z.object({
  is_target_product: z.boolean(),
  product_name: z.string().nullable(),
  manufacturer: z.string().nullable(),
  mrp_inr: z.number().nullable(),
  price_inr: z.number().nullable(),
  pack_size_units: z.number().int().nullable(),
  strength_text: z.string().nullable(),
  in_stock: z.boolean().nullable(),
  nabl_report_url: z.string().nullable(),
});
export type AiOffer = z.infer<typeof AiOfferSchema>;

export const AiBatchSchema = z.object({
  pages: z.array(z.object({ page_number: z.number().int(), offers: z.array(AiOfferSchema) })),
});
export type AiBatch = z.infer<typeof AiBatchSchema>;

export const AiLabSchema = z.object({
  is_target_test: z.boolean(),
  test_name: z.string().nullable(),
  price_inr: z.number().nullable(),
  mrp_inr: z.number().nullable(),
  parameters: z.number().int().nullable(),
  turnaround: z.string().nullable(),
  earliest_slot: z.string().nullable(),
  home_collection: z.boolean().nullable(),
});
export type AiLab = z.infer<typeof AiLabSchema>;

export const AiLabBatchSchema = z.object({
  pages: z.array(z.object({ page_number: z.number().int(), labs: z.array(AiLabSchema) })),
});
export type AiLabBatch = z.infer<typeof AiLabBatchSchema>;

export const SaltResolutionSchema = z.object({
  is_medicine: z.boolean(),
  brand_name: z.string().nullable(),
  manufacturer: z.string().nullable(),
  active_salt: z.string().nullable(),
  salts: z.array(z.string()),
  strengths: z.array(z.string()),
  typical_pack_size: z.number().int().nullable(),
});
export type SaltResolution = z.infer<typeof SaltResolutionSchema>;

/** Model output for "query didn't resolve" → plausible similar products. */
export const AiSuggestionsSchema = z.object({
  is_medicine: z.boolean(),
  suggestions: z.array(z.object({ name: z.string(), reason: z.string().nullable() })),
});
export type AiSuggestions = z.infer<typeof AiSuggestionsSchema>;

export const AiVisionRxSchema = z.object({
  extracted_text: z.string(),
  medicines: z.array(
    z.object({
      raw_name: z.string(),
      strength_text: z.string().nullable(),
      frequency: z.string().nullable(),
      instructions: z.string().nullable(),
      duration_days: z.number().int().nullable(),
    }),
  ),
});
export type AiVisionRx = z.infer<typeof AiVisionRxSchema>;

export const AiRxSchema = z.object({
  medicines: z.array(
    z.object({
      brand_name: z.string(),
      dosage: z.string().nullable(),
      pack_size: z.number().int().nullable(),
      salts: z.array(z.object({ name: z.string(), strength: z.string().nullable() })),
      frequency: z.string().nullable(),
      instructions: z.string().nullable(),
      duration_days: z.number().int().nullable(),
    }),
  ),
  interactions: z.array(
    z.object({
      between: z.array(z.string()),
      severity: z.enum(["minor", "moderate", "major"]),
      note: z.string(),
    }),
  ),
});
export type AiRx = z.infer<typeof AiRxSchema>;

/* ------------------------------------------------------------- helpers */
export const ROUNDING = { per10: 2, perTab: 4, pct: 1 } as const;
