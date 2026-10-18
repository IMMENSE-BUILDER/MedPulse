/**
 * Seeded data used in DEMO mode and as the local salt dictionary in live mode.
 *
 * IMPORTANT: prices here are illustrative, not live quotes. Every response that
 * uses them is stamped data_source:"demo" and carries a demonstrable note.
 */
import type {
  AmritAlert,
  DualTrackComparison,
  Kendra,
  LabComparison,
  LabOffer,
  Offer,
  SafetyTip,
} from "./schemas";
import { discountPct, etaText, normalizeName, per10Tabs, perTab, savingsPct } from "./pricing";

/* ------------------------------------------------------------ medicines */
export type Medicine = {
  key: string;
  brand: string;
  manufacturer: string;
  salt: string;
  salt_components: [string, string][];
  pack_size: number;
  branded_mrp: number;
  pmbjp_ceiling_per10: number;
  drug_code: string;
  aliases: string[];
  typical_frequency: string;
  duration_days: number;
  safety_tip: SafetyTip;
};

export const MEDICINES: Medicine[] = [
  {
    key: "augmentin625",
    brand: "Augmentin 625 Duo Tablet",
    manufacturer: "GlaxoSmithKline Pharmaceuticals Ltd.",
    salt: "Amoxycillin (500mg) + Clavulanic Acid (125mg)",
    salt_components: [
      ["Amoxycillin", "500mg"],
      ["Clavulanic Acid", "125mg"],
    ],
    pack_size: 10,
    branded_mrp: 204.35,
    pmbjp_ceiling_per10: 45.2,
    drug_code: "342",
    aliases: [
      "augmentin",
      "augmentin 625",
      "augmentin 625 duo",
      "amoxycillin clavulanic acid",
      "amoxyclav 625",
      "amoxicillin clavulanate",
      "amoxicillin clavulanic acid 625",
    ],
    typical_frequency: "1-0-1",
    duration_days: 5,
    safety_tip: {
      en: "Complete the full antibiotic course as prescribed; take after food.",
      hi: "एंटीबायोटिक का पूरा कोर्स करें; भोजन के बाद लें।",
    },
  },
  {
    key: "dolo650",
    brand: "Dolo 650 Tablet",
    manufacturer: "Micro Labs Ltd.",
    salt: "Paracetamol (650mg)",
    salt_components: [["Paracetamol", "650mg"]],
    pack_size: 15,
    branded_mrp: 32.28,
    pmbjp_ceiling_per10: 6.25,
    drug_code: "088",
    aliases: ["dolo", "dolo 650", "dolo 650 tablet", "paracetamol", "paracetamol 650", "crocin 650"],
    typical_frequency: "1-0-1",
    duration_days: 3,
    safety_tip: {
      en: "Do not exceed the prescribed dose; check other medicines for paracetamol to avoid doubling up.",
      hi: "निर्धारित मात्रा से अधिक न लें; दूसरी दवाओं में पैरासिटामोल की जाँच करें।",
    },
  },
  {
    key: "telmisartan40",
    brand: "Telma 40 Tablet",
    manufacturer: "Glenmark Pharmaceuticals Ltd.",
    salt: "Telmisartan (40mg)",
    salt_components: [["Telmisartan", "40mg"]],
    pack_size: 15,
    branded_mrp: 186.0,
    pmbjp_ceiling_per10: 14.5,
    drug_code: "118",
    aliases: ["telmisartan", "telmisartan 40", "telmisartan 40mg", "telma 40", "telma"],
    typical_frequency: "1-0-0",
    duration_days: 30,
    safety_tip: {
      en: "Take at the same time every day; do not stop without your doctor's advice.",
      hi: "हर दिन एक ही समय पर लें; डॉक्टर की सलाह के बिना बंद न करें।",
    },
  },
  {
    key: "metformin500sr",
    brand: "Glycomet SR 500 Tablet",
    manufacturer: "USV Pvt Ltd.",
    salt: "Metformin Hydrochloride SR (500mg)",
    salt_components: [["Metformin Hydrochloride SR", "500mg"]],
    pack_size: 20,
    branded_mrp: 36.5,
    pmbjp_ceiling_per10: 9.8,
    drug_code: "207",
    aliases: ["metformin", "metformin 500", "metformin 500 sr", "metformin sr", "glycomet", "glycomet sr 500"],
    typical_frequency: "1-0-1",
    duration_days: 30,
    safety_tip: {
      en: "Swallow whole with food; tell your doctor about persistent stomach upset.",
      hi: "भोजन के साथ पूरी गोली निगलें; लगातार पेट की तकलीफ हो तो डॉक्टर को बताएं।",
    },
  },
  {
    key: "pantoprazole40",
    brand: "Pan 40 Tablet",
    manufacturer: "Alkem Laboratories Ltd.",
    salt: "Pantoprazole (40mg)",
    salt_components: [["Pantoprazole", "40mg"]],
    pack_size: 15,
    branded_mrp: 168.0,
    pmbjp_ceiling_per10: 13.2,
    drug_code: "091",
    aliases: ["pantoprazole", "pantoprazole 40", "pantoprazole 40mg", "pan 40", "pantop 40", "pan d"],
    typical_frequency: "1-0-0",
    duration_days: 14,
    safety_tip: {
      en: "Best taken before breakfast on an empty stomach.",
      hi: "नाश्ते से पहले खाली पेट लेना सबसे अच्छा है।",
    },
  },
];

export function findMedicine(query: string): Medicine | null {
  const q = normalizeName(query);
  if (!q) return null;
  for (const m of MEDICINES) {
    const names = new Set([normalizeName(m.brand), m.key, ...m.aliases.map(normalizeName)]);
    if (names.has(q)) return m;
  }
  let best: Medicine | null = null;
  let bestLen = 0;
  for (const m of MEDICINES) {
    for (const a of [m.brand, ...m.aliases]) {
      const na = normalizeName(a);
      if (na && (na.includes(q) || q.includes(na)) && na.length > bestLen && q.length >= 4) {
        best = m;
        bestLen = na.length;
      }
    }
  }
  return best;
}

export function medicineNames(): string[] {
  return MEDICINES.map((m) => m.brand);
}

/* -------------------------------------------------------------- vendors */
type Vendor = {
  platform: string;
  category: Offer["category"];
  domain: string;
  rule: ["ceil", number] | ["mrp", number];
  eta: number;
  mrp_mult: number | null;
  nabl: boolean;
  nabl_id: string | null;
  badges: string[];
  stock: string;
  eq: number | null;
  name: string;
  maker: string;
};

const VENDORS: Vendor[] = [
  {
    platform: "SayaCare Generics",
    category: "online_generic",
    domain: "sayacare.in",
    rule: ["ceil", 1.1504],
    eta: 4 * 60,
    mrp_mult: 1.03,
    nabl: true,
    nabl_id: "NABL-9821",
    badges: ["NABL LAB VERIFIED"],
    stock: "120+ packs at Mayur Vihar Depot",
    eq: 99.2,
    name: "{salt}",
    maker: "WHO-GMP Plant IV",
  },
  {
    platform: "JanAushadhi Kendra (PMBJP)",
    category: "govt_generic",
    domain: "janaushadhi.gov.in",
    rule: ["ceil", 1.03],
    eta: 24 * 60,
    mrp_mult: null,
    nabl: true,
    nabl_id: "PMBJP-BATCH",
    badges: ["PMBJP GOVT GENERIC"],
    stock: "Tele-POS Verified: 84 packs in stock",
    eq: 98.9,
    name: "{salt} (Jan Aushadhi)",
    maker: "Bureau of Pharma PSUs of India (BPPI)",
  },
  {
    platform: "Zeelab Pharmacy",
    category: "online_generic",
    domain: "zeelabpharmacy.com",
    rule: ["mrp", 0.313],
    eta: 8 * 60,
    mrp_mult: 0.98,
    nabl: false,
    nabl_id: null,
    badges: ["WHO-GMP"],
    stock: "In Stock",
    eq: 99.1,
    name: "{salt} Tablets (Zeelab)",
    maker: "Zeelab Pharmacy India Ltd.",
  },
  {
    platform: "Tata 1mg",
    category: "branded",
    domain: "1mg.com",
    rule: ["mrp", 0.84],
    eta: 120,
    mrp_mult: 1.0,
    nabl: false,
    nabl_id: null,
    badges: ["EXPRESS 2-HR"],
    stock: "14 units in local hub",
    eq: null,
    name: "{brand}",
    maker: "{maker}",
  },
  {
    platform: "Apollo Pharmacy",
    category: "branded",
    domain: "apollopharmacy.in",
    rule: ["mrp", 0.86],
    eta: 45,
    mrp_mult: 1.0,
    nabl: false,
    nabl_id: null,
    badges: ["1-HR DELIVERY"],
    stock: "15 strips at Nirman Vihar (2.1 km)",
    eq: null,
    name: "{brand}",
    maker: "Original formulation",
  },
  {
    platform: "PharmEasy",
    category: "branded",
    domain: "pharmeasy.in",
    rule: ["mrp", 0.705],
    eta: 6 * 60,
    mrp_mult: 0.94,
    nabl: false,
    nabl_id: null,
    badges: ["6-HR DELIVERY"],
    stock: "Standard dispatch today",
    eq: null,
    name: "Equivalent brand: {salt}",
    maker: "Alternate manufacturer",
  },
];

/* -------------------------------------------------------------- kendras */
export const KENDRAS: Array<Record<string, unknown>> = [
  {
    kendra_id: "DEL-0422",
    name: "Jan Aushadhi Kendra (demo)",
    address: "Near Shastri Park Metro, New Delhi",
    pincode: "110053",
    distance_km: 1.2,
    stock_note: "84 packs in stock (demo)",
  },
  {
    kendra_id: "DEL-0107",
    name: "Jan Aushadhi Kendra (demo)",
    address: "Jhandewalan Extension, New Delhi",
    pincode: "110055",
    distance_km: 6.8,
    stock_note: "Stock unverified (demo)",
  },
  {
    kendra_id: "NOI-0031",
    name: "Jan Aushadhi Kendra (demo)",
    address: "Sector 18, Noida",
    pincode: "201301",
    distance_km: 2.4,
    stock_note: "Stock unverified (demo)",
  },
];

const AMRIT_DEMO = [
  {
    kendra_id: "AMRIT-AIIMS-DEL",
    name: "AMRIT Pharmacy, AIIMS New Delhi (demo listing)",
    address: "AIIMS, Ansari Nagar, New Delhi",
    pincode: "110029",
    distance_km: null,
    stock_note: "Up to 50% off MRP on listed critical-care drugs (per PRD)",
  },
];

function commonPrefix(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

export function kendrasFor(pincode: string, limit = 3): Kendra[] {
  const sorted = [...KENDRAS].sort((a, b) => {
    const ca = commonPrefix(String(a.pincode), pincode);
    const cb = commonPrefix(String(b.pincode), pincode);
    if (ca !== cb) return cb - ca;
    return (Number(a.distance_km) || 99) - (Number(b.distance_km) || 99);
  });
  return sorted.slice(0, limit).map((k) => ({
    kendra_id: String(k.kendra_id),
    name: String(k.name),
    address: String(k.address),
    pincode: String(k.pincode),
    distance_km: k.distance_km == null ? null : Number(k.distance_km),
    phone: null,
    stock_note: k.stock_note == null ? null : String(k.stock_note),
    source_portal: "demo seed (not live UMANG)",
  }));
}

export function amritDemo(): Kendra[] {
  return AMRIT_DEMO.map((a) => ({
    kendra_id: String(a.kendra_id),
    name: String(a.name),
    address: String(a.address),
    pincode: String(a.pincode),
    distance_km: a.distance_km == null ? null : Number(a.distance_km),
    phone: null,
    stock_note: String(a.stock_note),
    source_portal: "demo seed (not live AMRIT directory)",
  }));
}

export function amritAlertFor(medName: string, price: number): AmritAlert | null {
  if (price <= 1000) return null;
  return {
    triggered_by: medName,
    item_price_inr: price,
    message: `${medName} costs ₹${price.toLocaleString("en-IN")}. AMRIT hospital pharmacies may sell it at up to 50% off MRP — check offline.`,
    outlets: amritDemo(),
  };
}

/* --------------------------------------------------------- demo compare */
function buildDemoOffer(args: {
  platform: string;
  category: Offer["category"];
  product_name: string;
  manufacturer: string | null;
  badges: string[];
  mrp_inr: number | null;
  price_inr: number;
  pack_size: number;
  nabl: boolean;
  nabl_id: string | null;
  equivalence: number | null;
  eta: number;
  pincode: string;
  stock: string;
  product_url: string;
  brandRefPer10: number;
}): Offer {
  const p10 = per10Tabs(args.price_inr, args.pack_size);
  return {
    platform: args.platform,
    category: args.category,
    product_name: args.product_name,
    manufacturer: args.manufacturer,
    badges: args.badges,
    mrp_inr: args.mrp_inr,
    price_inr: round2(args.price_inr),
    pack_size: args.pack_size,
    price_per_10_tabs_inr: p10,
    price_per_tab_inr: perTab(args.price_inr, args.pack_size),
    discount_percent: discountPct(args.mrp_inr, args.price_inr),
    savings_vs_branded_percent: savingsPct(args.brandRefPer10, p10),
    nabl_lab_report_verified: args.nabl,
    nabl_batch_id: args.nabl_id,
    nabl_report_url: null,
    equivalence_percent: args.equivalence,
    delivery_eta: etaText(args.eta) + (args.eta <= 8 * 60 ? ` (to ${args.pincode})` : ""),
    eta_minutes: args.eta,
    in_stock: true,
    stock_note: args.stock,
    verified_by: "demo-seed",
    product_url: args.product_url,
  };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function compareDemo(query: string, pincode: string): DualTrackComparison | null {
  const med = findMedicine(query);
  if (!med) return null;
  const brandRefPer10 = per10Tabs(med.branded_mrp, med.pack_size);
  const offers: Offer[] = VENDORS.map((v) => {
    const [kind, factor] = v.rule;
    const price =
      kind === "ceil"
        ? round2(((med.pmbjp_ceiling_per10 * factor * med.pack_size) / 10) * 1)
        : round2(med.branded_mrp * factor);
    const mrp = v.mrp_mult === null ? price : round2(med.branded_mrp * v.mrp_mult);
    return buildDemoOffer({
      platform: v.platform,
      category: v.category,
      product_name: v.name.replace("{salt}", med.salt).replace("{brand}", med.brand),
      manufacturer: v.maker.replace("{maker}", med.manufacturer),
      badges: v.badges,
      mrp_inr: mrp,
      price_inr: price,
      pack_size: med.pack_size,
      nabl: v.nabl,
      nabl_id: v.nabl_id,
      equivalence: v.eq,
      eta: v.eta,
      pincode,
      stock: v.stock,
      product_url: `https://www.${v.domain}`,
      brandRefPer10,
    });
  });
  const generics = offers
    .filter((o) => o.category !== "branded")
    .sort((a, b) => a.price_per_10_tabs_inr - b.price_per_10_tabs_inr);
  const branded = offers
    .filter((o) => o.category === "branded")
    .sort((a, b) => (a.eta_minutes ?? 1e9) - (b.eta_minutes ?? 1e9));
  const kendras = kendrasFor(pincode, 1);
  return {
    query_brand: med.brand,
    active_salt: med.salt,
    user_pincode: pincode,
    govt_benchmark: {
      scheme: "PMBJP Jan Aushadhi Official Benchmark",
      drug_code: med.drug_code,
      official_mrp_per_10_tabs_inr: med.pmbjp_ceiling_per10,
      bioequivalence_index_percent: 98.9,
      certification: "WHO-GMP Certified",
      nearest_walk_in_kendra: kendras[0] ?? null,
    },
    subsidised_generic_online: generics,
    branded_express_online: branded,
    amrit_hospital_alert: amritAlertFor(med.brand, Math.max(...offers.map((o) => o.price_inr))),
    branded_reference_mrp_inr: med.branded_mrp,
    branded_reference_per_10_tabs_inr: brandRefPer10,
    best_savings_percent: Math.max(0, ...generics.map((o) => o.savings_vs_branded_percent)),
    safety_tip: med.safety_tip,
    data_source: "demo",
    notes: ["DEMO DATA: illustrative prices, not live quotes. Add API keys to .env.local for live results."],
    generated_at: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------- labs (D) */
type LabTest = { key: string; test: string; aliases: string[] };

export const LAB_TESTS: LabTest[] = [
  {
    key: "hba1c",
    test: "HbA1c (Glycated Hemoglobin)",
    aliases: ["hba1c", "a1c", "glycated hemoglobin", "glycated haemoglobin", "diabetes test", "sugar test"],
  },
  {
    key: "fullbody",
    test: "Full Body Checkup",
    aliases: ["full body checkup", "full body", "master health checkup", "full body test", "complete health checkup"],
  },
];

function labOffer(args: {
  lab: string;
  test_name: string;
  price: number;
  mrp: number;
  parameters: number | null;
  turnaround: string;
  slot: string;
  url: string;
}): LabOffer {
  return {
    platform: args.lab,
    lab: args.lab,
    test_name: args.test_name,
    price_inr: args.price,
    mrp_inr: args.mrp,
    discount_percent: discountPct(args.mrp, args.price),
    parameters: args.parameters,
    turnaround: args.turnaround,
    earliest_slot: args.slot,
    home_collection: true,
    product_url: args.url,
    verified_by: "demo-seed",
  };
}

const LAB_SEED: Record<string, LabOffer[]> = {
  hba1c: [
    labOffer({ lab: "Redcliffe Labs", test_name: "HbA1c (Glycated Hemoglobin)", price: 299, mrp: 549, parameters: 1, turnaround: "Same day", slot: "Tomorrow, 7:00 AM", url: "https://redcliffelabs.com" }),
    labOffer({ lab: "Healthians", test_name: "HbA1c — Diabetes Screening", price: 319, mrp: 599, parameters: 1, turnaround: "Same day", slot: "Tomorrow, 7:30 AM", url: "https://healthians.com" }),
    labOffer({ lab: "Orange Health", test_name: "HbA1c", price: 349, mrp: 600, parameters: 1, turnaround: "6 hours", slot: "Tomorrow, 6:30 AM", url: "https://orangehealth.in" }),
    labOffer({ lab: "Dr Lal PathLabs", test_name: "HbA1c (Glycosylated Hemoglobin)", price: 399, mrp: 630, parameters: 1, turnaround: "24 hours", slot: "Tomorrow, 8:00 AM", url: "https://lalpathlabs.com" }),
  ],
  fullbody: [
    labOffer({ lab: "Healthians", test_name: "Full Body Checkup — Advance", price: 1699, mrp: 4499, parameters: 78, turnaround: "36 hours", slot: "Tomorrow, 7:00 AM", url: "https://healthians.com" }),
    labOffer({ lab: "Orange Health", test_name: "Full Body Checkup — Master", price: 1799, mrp: 4200, parameters: 72, turnaround: "48 hours", slot: "Tomorrow, 6:30 AM", url: "https://orangehealth.in" }),
    labOffer({ lab: "Redcliffe Labs", test_name: "Full Body Checkup — Comprehensive", price: 1829, mrp: 4999, parameters: 85, turnaround: "48 hours", slot: "Tomorrow, 7:00 AM", url: "https://redcliffelabs.com" }),
    labOffer({ lab: "Dr Lal PathLabs", test_name: "Full Body Checkup — SwasthPlus", price: 1999, mrp: 4800, parameters: 80, turnaround: "48 hours", slot: "Tomorrow, 8:00 AM", url: "https://lalpathlabs.com" }),
  ],
};

export function findLabTest(query: string): LabTest | null {
  const q = normalizeName(query);
  if (!q) return null;
  for (const t of LAB_TESTS) {
    if (normalizeName(t.test) === q || t.key === q) return t;
    if (t.aliases.some((a) => normalizeName(a) === q)) return t;
  }
  let best: LabTest | null = null;
  let bestLen = 0;
  for (const t of LAB_TESTS) {
    for (const a of [t.test, ...t.aliases]) {
      const na = normalizeName(a);
      if (na && (na.includes(q) || q.includes(na)) && na.length > bestLen && q.length >= 4) {
        best = t;
        bestLen = na.length;
      }
    }
  }
  return best;
}

export function labNames(): string[] {
  return LAB_TESTS.map((t) => t.test);
}

export function labsDemo(query: string, pincode: string): LabComparison | null {
  const test = findLabTest(query);
  if (!test) return null;
  const offers = [...(LAB_SEED[test.key] ?? [])].sort((a, b) => a.price_inr - b.price_inr);
  const best = offers[0]?.price_inr ?? null;
  const highest = offers.length ? Math.max(...offers.map((o) => o.price_inr)) : null;
  return {
    query: test.test,
    pincode,
    offers,
    best_price_inr: best,
    highest_price_inr: highest,
    best_savings_percent: best && highest && highest > 0 ? Math.round(((highest - best) / highest) * 1000) / 10 : 0,
    data_source: "demo",
    notes: ["DEMO DATA: illustrative lab prices, not live quotes. Add API keys to .env.local for live results."],
    generated_at: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------ suggest */
export type Suggestion = { kind: "medicine" | "lab"; label: string; detail: string };

export function suggestAll(q: string): Suggestion[] {
  const query = normalizeName(q);
  const meds: Suggestion[] = MEDICINES.filter(
    (m) => !query || normalizeName(m.brand).includes(query) || m.aliases.some((a) => normalizeName(a).includes(query)),
  )
    .slice(0, 6)
    .map((m) => ({ kind: "medicine", label: m.brand, detail: m.salt }));
  const labs: Suggestion[] = LAB_TESTS.filter(
    (t) => !query || normalizeName(t.test).includes(query) || t.aliases.some((a) => normalizeName(a).includes(query)),
  )
    .slice(0, 3)
    .map((t) => ({ kind: "lab", label: t.test, detail: "Lab test — compare prices" }));
  return [...labs, ...meds].slice(0, 8);
}
