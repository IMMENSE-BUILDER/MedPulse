"use client";

import { Check, Link2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Copies the current comparison URL (the dashboard keeps `?q=&pin=&type=`
 * in sync with the address bar). Falls back to a prompt when the clipboard
 * API is unavailable (older browsers / non-secure contexts).
 */
export function ShareLinkButton({ className = "" }: { className?: string }) {
  const [state, setState] = useState<"idle" | "ok" | "fail">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const onCopy = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setState("ok");
    } catch {
      window.prompt("Copy this comparison link", url);
      setState("fail");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2200);
  };

  return (
    <button
      type="button"
      onClick={() => void onCopy()}
      title="Copy a link to this comparison"
      className={`inline-flex items-center gap-1.5 rounded-full border border-line bg-panel-2 px-2.5 py-1 text-[10px] text-mute transition-colors hover:border-brand/40 hover:text-brand-2 ${className}`}
    >
      {state === "ok" ? <Check className="h-3 w-3 text-brand-2" /> : <Link2 className="h-3 w-3" />}
      {state === "ok" ? "Link copied" : state === "fail" ? "Copy manually" : "Copy link"}
    </button>
  );
}
