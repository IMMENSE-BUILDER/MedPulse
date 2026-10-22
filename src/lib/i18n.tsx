"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Language = "en" | "hi";

type LanguageContextValue = {
  lang: Language;
  setLang: (lang: Language) => void;
  toggle: () => void;
  tr: (en: string, hi: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);
const STORAGE_KEY = "medpulse:lang";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Language>("en");

  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "hi") setLang("hi");
    } catch {
      /* storage unavailable */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* storage unavailable */
    }
  }, [lang]);

  const toggle = useCallback(() => {
    setLang((current) => (current === "hi" ? "en" : "hi"));
  }, []);

  const tr = useCallback(
    (en: string, hi: string) => (lang === "hi" ? hi : en),
    [lang],
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggle, tr }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("useLanguage must be used inside LanguageProvider");
  return value;
}
