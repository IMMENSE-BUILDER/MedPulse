/**
 * Deterministic English/Hindi dosing schedule from an M-A-N pattern like "1-0-1".
 * No medical advice is invented — only what is written on the prescription is translated.
 */

const SLOTS_EN = ["Morning", "Afternoon", "Night"] as const;
const SLOTS_HI = ["सुबह", "दोपहर", "रात"] as const;

const INSTR_HI: Record<string, string> = {
  "after food": "खाने के बाद",
  "before food": "खाने से पहले",
  "empty stomach": "खाली पेट",
  "with food": "खाने के साथ",
  "after meals": "खाने के बाद",
  "before meals": "खाने से पहले",
};

export type Schedule = { en: string; hi: string };

export function buildSchedule(frequency: string | null | undefined, instructions: string | null | undefined): Schedule | null {
  if (!frequency) return null;
  const parts = frequency.match(/\d+(?:\.\d+)?/g);
  if (!parts || parts.length !== 3) return null;
  const idx = parts.map((p, i) => ({ i, v: p })).filter((x) => Number(x.v) > 0);
  if (idx.length === 0) return null;

  let en = idx.map(({ i, v }) => `${SLOTS_EN[i]} (${v})`).join(", ");
  let hi = idx.map(({ i, v }) => `${SLOTS_HI[i]} (${v})`).join(", ");

  if (instructions && instructions.trim()) {
    const cleaned = instructions.trim();
    en += ` — ${cleaned}`;
    const hiInstr = INSTR_HI[cleaned.toLowerCase()];
    if (hiInstr) hi += ` — ${hiInstr}`;
  }
  return { en, hi };
}
