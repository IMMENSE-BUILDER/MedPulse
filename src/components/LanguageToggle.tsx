"use client";

import { Languages } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { lang, toggle } = useLanguage();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={lang === "hi" ? "Switch to English" : "हिंदी में देखें"}
      title={lang === "hi" ? "Switch to English" : "हिंदी में देखें"}
      className={`inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-panel-2 px-2.5 text-[11px] font-medium text-mute transition-colors hover:border-brand/40 hover:text-brand-2 ${className}`}
    >
      <Languages className="h-3.5 w-3.5" />
      {lang === "hi" ? "EN" : "हिं"}
    </button>
  );
}
