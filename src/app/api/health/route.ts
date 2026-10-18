import { labNames, medicineNames } from "@/lib/demo-seed";
import { healthSummary } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    ...healthSummary(),
    demo_medicines: medicineNames(),
    demo_labs: labNames(),
    endpoints: [
      "/api/health",
      "/api/compare",
      "/api/compare-stream",
      "/api/locate",
      "/api/docai",
      "/api/ocr",
      "/api/agent-stream",
      "/api/optimize-cart",
      "/api/suggest",
    ],
  });
}
