"use client";

import { Check, Crown, Sparkles, X } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { PREMIUM_PRICE_INR } from "@/lib/premium";

const FEATURES: Array<[string, string]> = [
  ["Parallel live browser agents", "एक साथ कई लाइव ब्राउज़र एजेंट"],
  ["Bulk stock checks across every listing", "हर दवा का स्टॉक एक साथ जाँचें"],
  ["Medicine + lab verification", "दवा और लैब की जाँच"],
  ["One-click Auto-verify scopes", "एक क्लिक में अपने आप जाँच"],
];

export function PremiumModal({
  open,
  active,
  onClose,
  onUnlock,
}: {
  open: boolean;
  active: boolean;
  onClose: () => void;
  onUnlock: () => void;
}) {
  const { tr } = useLanguage();
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-black/70 p-4"
      role="presentation"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="premium-title"
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-warn/30 bg-panel shadow-pop"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="relative border-b border-line bg-gradient-to-br from-warn/15 via-panel to-panel p-5">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close premium panel"
            className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-lg text-faint transition-colors hover:bg-panel-2 hover:text-ink-2"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-warn/40 bg-warn/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-warn">
            <Crown className="h-3 w-3" />
            {tr("Premium", "प्रीमियम")}
          </span>
          <h2 id="premium-title" className="mt-3 text-lg font-semibold tracking-tight">
            {tr("Unlock the live agent", "लाइव एजेंट खोलें")}
          </h2>
          <div className="mt-1 flex items-end gap-1.5">
            <span className="font-mono text-2xl font-semibold">₹{PREMIUM_PRICE_INR}</span>
            <span className="pb-0.5 text-[11px] text-faint">{tr("/ month", "/ महीना")}</span>
            {active ? (
              <span className="mb-0.5 ml-auto rounded-full border border-brand/40 bg-brand/10 px-2 py-0.5 text-[9px] font-medium text-brand-2">
                Preview active
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-mute">
            {tr(
              "Agent mode is a premium demo feature: parallel browser screens, bulk stock checks and Auto-verify across every listing.",
              "एजेंट मोड प्रीमियम डेमो फीचर है: एक साथ कई ब्राउज़र स्क्रीन, सभी दवाओं का स्टॉक और ऑटो-वेरिफाई।",
            )}
          </p>
        </div>

        <div className="space-y-2 p-5">
          {FEATURES.map(([en, hi]) => (
            <div key={en} className="flex items-center gap-2 text-[11.5px] text-mute">
              <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full border border-warn/40 bg-warn/10">
                <Check className="h-2.5 w-2.5 text-warn" />
              </span>
              {tr(en, hi)}
            </div>
          ))}

          <button
            type="button"
            onClick={onUnlock}
            className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-brand text-[12px] font-semibold text-white transition-colors hover:bg-brand-hover"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {active ? tr("Continue with premium", "प्रीमियम के साथ जारी रखें") : tr("Unlock preview - no payment", "प्रीव्यू खोलें - कोई भुगतान नहीं")}
          </button>
          <p className="text-center text-[9.5px] leading-relaxed text-faint">
            {tr(
              "Mock checkout only. No card, no payment and no real subscription.",
              "सिर्फ डेमो चेकआउट। कोई कार्ड, भुगतान या असली सब्सक्रिप्शन नहीं।",
            )}
          </p>
          {!active ? (
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl px-3 py-1.5 text-[10px] text-faint transition-colors hover:text-mute"
            >
              {tr("Not now", "अभी नहीं")}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
