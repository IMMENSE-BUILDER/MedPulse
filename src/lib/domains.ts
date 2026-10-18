/**
 * Portal registry (PRD §3). Four tracks: govt benchmarks, subsidised generics,
 * branded e-pharmacies and diagnostic labs.
 */
import type { Category } from "./schemas";

export const GOVT_PORTALS = {
  pmbi_master: "janaushadhi.gov.in",
  umang: "web.umang.gov.in",
  amrit: "lifecarehll.com",
} as const;

/** Track B — searched by chemical salt + dosage. */
export const GENERIC_DOMAINS = [
  "sayacare.in",
  "janaushadhionline.com",
  "janaushadhistore.in",
  "apijanaushadhi.in",
  "zeelabpharmacy.com",
  "davaindia.com",
  "truemeds.in",
] as const;

/** Track C — searched by brand name. */
export const BRANDED_DOMAINS = ["1mg.com", "pharmeasy.in", "apollopharmacy.in", "netmeds.com"] as const;

/** Track D — diagnostic & pathology labs, searched by test/package name. */
export const LAB_DOMAINS = ["redcliffelabs.com", "lalpathlabs.com", "orangehealth.in", "healthians.com"] as const;

/** Domains where batch NABL lab-test PDFs are published. */
export const NABL_DOMAINS = new Set(["sayacare.in", "janaushadhi.gov.in"]);

export const PLATFORM_NAMES: Record<string, string> = {
  "sayacare.in": "SayaCare Generics",
  "janaushadhionline.com": "JanAushadhi Online",
  "janaushadhistore.in": "Janaushadhi Store Online",
  "apijanaushadhi.in": "API Janaushadhi",
  "zeelabpharmacy.com": "Zeelab Pharmacy",
  "davaindia.com": "DavaIndia",
  "truemeds.in": "Truemeds",
  "1mg.com": "Tata 1mg",
  "pharmeasy.in": "PharmEasy",
  "apollopharmacy.in": "Apollo Pharmacy",
  "netmeds.com": "Netmeds",
};

export const LAB_PLATFORM_NAMES: Record<string, string> = {
  "redcliffelabs.com": "Redcliffe Labs",
  "lalpathlabs.com": "Dr Lal PathLabs",
  "orangehealth.in": "Orange Health",
  "healthians.com": "Healthians",
};

export function domainOf(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return "";
  }
}

function matchDomain(d: string, list: readonly string[]): boolean {
  return list.some((x) => d === x || d.endsWith("." + x));
}

export function platformFor(url: string): string {
  const d = domainOf(url);
  for (const [key, name] of Object.entries(PLATFORM_NAMES)) {
    if (d === key || d.endsWith("." + key)) return name;
  }
  for (const [key, name] of Object.entries(LAB_PLATFORM_NAMES)) {
    if (d === key || d.endsWith("." + key)) return name;
  }
  return d || "Unknown";
}

export function categoryFor(url: string): Category {
  const d = domainOf(url);
  if (matchDomain(d, BRANDED_DOMAINS)) return "branded";
  if (d.includes("janaushadhi")) return d.endsWith("gov.in") ? "govt_generic" : "online_generic";
  return "online_generic";
}

export function isLabDomain(url: string): boolean {
  return matchDomain(domainOf(url), LAB_DOMAINS);
}
