/**
 * POST /api/locate — reverse-geocode browser coordinates into an Indian
 * pincode (used by the "use my location" navbar button, with permission).
 *
 * Free providers only, no keys: BigDataCloud reverse-geocode-client first,
 * OpenStreetMap Nominatim as fallback. Results cached in-memory 24 h.
 */
import { cacheGet, cacheSet } from "@/lib/cache";
import { ApiError, apiErrorResponse, validationResponse } from "@/lib/errors";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 30;

const LocateSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

type Located = {
  pincode: string;
  area: string | null;
  city: string | null;
  state: string | null;
  source: string;
};

async function bigDataCloud(lat: number, lng: number): Promise<Located | null> {
  const url =
    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  const j = (await res.json()) as {
    postcode?: string;
    locality?: string;
    city?: string;
    principalSubdivision?: string;
  };
  const pin = (j.postcode ?? "").replace(/\D/g, "");
  if (!/^\d{6}$/.test(pin)) return null;
  return {
    pincode: pin,
    area: j.locality ?? null,
    city: j.city ?? null,
    state: j.principalSubdivision ?? null,
    source: "bigdatacloud",
  };
}

async function nominatim(lat: number, lng: number): Promise<Located | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1&zoom=16`;
  const res = await fetch(url, {
    headers: { "user-agent": "MedPulseAI/1.0 (medicine price comparison; contact: app owner)" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { address?: Record<string, string> };
  const a = j.address ?? {};
  const pin = (a.postcode ?? "").replace(/\D/g, "");
  if (!/^\d{6}$/.test(pin)) return null;
  return {
    pincode: pin,
    area: a.suburb ?? a.neighbourhood ?? a.village ?? null,
    city: a.city ?? a.town ?? a.state_district ?? null,
    state: a.state ?? null,
    source: "nominatim",
  };
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return validationResponse("Request body must be JSON.");
  }
  const parsed = LocateSchema.safeParse(body);
  if (!parsed.success) return validationResponse("lat/lng must be valid numbers.");
  const { lat, lng } = parsed.data;

  const key = `geo:${lat.toFixed(2)},${lng.toFixed(2)}`;
  const hit = cacheGet<Located>(key);
  if (hit) return Response.json(hit);

  try {
    const found = (await bigDataCloud(lat, lng)) ?? (await nominatim(lat, lng));
    if (!found) {
      throw new ApiError(404, {
        error: "pincode_not_found",
        message: "Couldn't determine an Indian pincode for your coordinates — please enter it manually.",
        notes: ["The free reverse-geocoding providers had no 6-digit postal code for this point."],
      });
    }
    cacheSet(key, found, 86_400);
    return Response.json(found);
  } catch (e) {
    return apiErrorResponse(e);
  }
}
