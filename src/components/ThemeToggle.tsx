"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Light/dark theme toggle (navbar top-right corner).
 * The actual theme is a `light` class on <html>; the initial value is applied
 * before first paint by an inline script in the root layout (no flash).
 */
export function ThemeToggle() {
  const [light, setLight] = useState(false);

  useEffect(() => {
    setLight(document.documentElement.classList.contains("light"));
  }, []);

  const toggle = () => {
    const next = !document.documentElement.classList.contains("light");
    document.documentElement.classList.toggle("light", next);
    try {
      localStorage.setItem("medpulse:theme", next ? "light" : "dark");
    } catch {
      /* storage unavailable — theme still applies for this session */
    }
    // Keep the mobile browser chrome in step with the app theme.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", next ? "#f4f6f5" : "#050607");
    // The welcome page's Three.js scene listens for this to retune lighting.
    window.dispatchEvent(new CustomEvent("medpulse:theme", { detail: { light: next } }));
    setLight(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={light ? "Switch to dark mode" : "Switch to light mode"}
      title={light ? "Switch to dark mode" : "Switch to light mode"}
      className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-inset text-mute transition-colors hover:border-brand/40 hover:text-brand-2"
    >
      {light ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
    </button>
  );
}
