import { suggestAll } from "@/lib/demo-seed";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return Response.json({ suggestions: suggestAll(q) });
}
