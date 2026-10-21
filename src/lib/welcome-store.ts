/**
 * Local-only history store for the welcome page.
 *
 * There is no backend and no real authentication: the "session" is a
 * localStorage flag so the history panel stays gated behind an explicit
 * sign-in and can be cleared with one click. No password is ever stored.
 *
 * Keys use the same `medpulse:` prefix as the engine, so a future account
 * layer can read them without a migration.
 */

export const KEYS = {
  profile: "medpulse:profile:v1",
  session: "medpulse:demo-session",
  history: "medpulse:history:v1",
} as const;

export const MAX_HISTORY = 30;

export type HistoryKind = "medicine" | "lab" | "rx" | "note";

export type Profile = {
  name: string;
  email: string;
  created_at: string;
};

export type HistoryEntry = {
  id: string;
  kind: HistoryKind;
  label: string;
  meta: string;
  at: string;
};

const KINDS = new Set<HistoryKind>(["medicine", "lab", "rx", "note"]);

/* ---- safe storage primitives -------------------------------------------- */

function read(key: string): unknown {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function drop(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* private mode */
  }
}

export function storageAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const probe = "__medpulse_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/* ---- helpers ------------------------------------------------------------- */

function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalize(value: string): string {
  return cleanText(value, 200).toLowerCase();
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

function makeId(): string {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
}

function isKind(value: unknown): value is HistoryKind {
  return typeof value === "string" && KINDS.has(value as HistoryKind);
}

/* ---- profile / session --------------------------------------------------- */

export function getProfile(): Profile | null {
  const raw = read(KEYS.profile);
  if (!raw || typeof raw !== "object") return null;

  const candidate = raw as Record<string, unknown>;
  const email = cleanText(candidate.email, 120);
  const name = cleanText(candidate.name, 60) || (email ? email.split("@")[0] : "");
  const createdAt =
    typeof candidate.created_at === "string" && !Number.isNaN(Date.parse(candidate.created_at))
      ? candidate.created_at
      : new Date().toISOString();

  return { name, email, created_at: createdAt };
}

export function isSignedIn(): boolean {
  const session = read(KEYS.session) as { at?: unknown } | null;
  return Boolean(session && session.at) && Boolean(getProfile());
}

/** Mock sign-in: validates locally, saves a display profile + demo session. */
export function signIn({ name, email }: { name?: string; email?: string } = {}): Profile | null {
  const safeEmail = cleanText(email, 120).toLowerCase();
  if (!validEmail(safeEmail)) return null;

  const profile: Profile = {
    name: cleanText(name, 60) || safeEmail.split("@")[0],
    email: safeEmail,
    created_at: new Date().toISOString(),
  };

  const savedProfile = write(KEYS.profile, profile);
  const savedSession = write(KEYS.session, { at: profile.created_at, demo: true });
  if (!savedProfile || !savedSession) {
    if (savedProfile) drop(KEYS.profile);
    if (savedSession) drop(KEYS.session);
    return null;
  }

  return profile;
}

export function signOut(): void {
  // Keep the profile + history on the device; only close the demo session.
  drop(KEYS.session);
}

/* ---- history ------------------------------------------------------------- */

function validEntry(entry: unknown): entry is HistoryEntry {
  if (!entry || typeof entry !== "object") return false;
  const e = entry as Record<string, unknown>;
  return (
    typeof e.id === "string" &&
    typeof e.label === "string" &&
    e.label.length > 0 &&
    typeof e.at === "string" &&
    !Number.isNaN(Date.parse(e.at))
  );
}

/** Newest first, capped, shape-checked. */
export function getHistory(): HistoryEntry[] {
  const raw = read(KEYS.history);
  if (!Array.isArray(raw)) return [];

  return raw
    .filter(validEntry)
    .map((entry) => ({
      id: entry.id,
      kind: isKind(entry.kind) ? entry.kind : "note",
      label: cleanText(entry.label, 120),
      meta: cleanText(entry.meta, 80),
      at: entry.at,
    }))
    .filter((entry) => entry.label.length > 0)
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .slice(0, MAX_HISTORY);
}

/** Add or refresh an entry, deduped by case-insensitive label. */
export function addHistory({
  label,
  kind = "medicine",
  meta = "",
}: {
  label: string;
  kind?: string;
  meta?: string;
}): HistoryEntry | null {
  const safeLabel = cleanText(label, 120);
  if (!safeLabel) return null;

  const entry: HistoryEntry = {
    id: makeId(),
    kind: isKind(kind) ? kind : "note",
    label: safeLabel,
    meta: cleanText(meta, 80),
    at: new Date().toISOString(),
  };

  const key = normalize(safeLabel);
  const rest = getHistory().filter((item) => normalize(item.label) !== key);
  const ok = write(KEYS.history, [entry, ...rest].slice(0, MAX_HISTORY));
  return ok ? entry : null;
}

export function removeHistory(id: string): boolean {
  if (!id) return false;
  return write(
    KEYS.history,
    getHistory().filter((entry) => entry.id !== id)
  );
}

export function clearHistory(): boolean {
  return write(KEYS.history, []);
}

/* ---- presentation helper ------------------------------------------------- */

/** "just now", "12m ago", "3h ago", "5d ago", then a short date. */
export function timeAgo(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";

  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 45) return "just now";
  if (seconds < 3600) return Math.round(seconds / 60) + "m ago";
  if (seconds < 86400) return Math.round(seconds / 3600) + "h ago";
  if (seconds < 86400 * 7) return Math.round(seconds / 86400) + "d ago";

  return new Date(then).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
