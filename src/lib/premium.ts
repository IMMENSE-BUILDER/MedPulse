/** Mock premium preview. No payment, no backend, no subscription. */
export const PREMIUM_PRICE_INR = 299;
export const PREMIUM_STORAGE_KEY = "medpulse:premium-preview:v1";

export function hasPremiumPreview(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(PREMIUM_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function unlockPremiumPreview(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREMIUM_STORAGE_KEY, "1");
  } catch {
    /* private mode - the in-memory state still unlocks for this session */
  }
}
