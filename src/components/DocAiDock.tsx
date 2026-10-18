"use client";

import { Send, Sparkles, Stethoscope, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type ChatMessage = { role: "user" | "assistant"; content: string; demo?: boolean };

const QUICK_PROMPTS = [
  "What is Telma 40 used for?",
  "Fever and headache — what should I do?",
  "Can I take Dolo 650 with other medicines?",
];

export function DocAiDock({
  open,
  onClose,
  raised = false,
}: {
  open: boolean;
  onClose: () => void;
  raised?: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const bottom = raised ? "bottom-20" : "bottom-4";

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy, open]);

  if (!open) return null;

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;
    const next: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setDraft("");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/docai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: next.slice(-12).map(({ role, content: c }) => ({ role, content: c })),
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { reply?: string; data_source?: string; detail?: { message?: string } }
        | null;
      if (!res.ok) throw new Error(data?.detail?.message ?? `DocAI failed (${res.status}).`);
      if (!data?.reply) throw new Error("DocAI returned an empty reply.");
      setMessages([...next, { role: "assistant", content: data.reply, demo: data.data_source === "demo" }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside
      className={`fixed ${bottom} right-4 z-50 flex w-[min(92vw,420px)] flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-pop`}
    >
      <div className="flex h-11 items-center gap-2 border-b border-line px-3">
        <Stethoscope className="h-4 w-4 text-brand" />
        <span className="text-[11px] font-medium text-ink-2">DocAI — general help &amp; consulting</span>
        <span className="ml-1 rounded-full border border-line bg-panel-2 px-2 py-0.5 font-mono text-[9px] text-mute">
          AI
        </span>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto grid h-7 w-7 place-items-center rounded-lg text-faint transition-colors hover:bg-panel-2 hover:text-danger"
          title="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div ref={listRef} className="max-h-[46vh] min-h-36 space-y-3 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-[11px] leading-relaxed text-mute">
              Ask me anything general about medicines or symptoms — what something is used for, side effects,
              what to do about common problems, and when to see a doctor. General information only — not a doctor.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_PROMPTS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => void send(q)}
                  className="rounded-full border border-line bg-panel-2 px-2.5 py-1 text-[10px] text-mute transition-colors hover:border-brand/40 hover:text-brand-2"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[11.5px] leading-relaxed ${
                m.role === "user" ? "border border-brand/30 bg-brand/10 text-ink-2" : "border border-line bg-panel-2 text-ink-2"
              }`}
            >
              {m.content}
              {m.demo ? (
                <div className="mt-1.5 text-[9.5px] text-warn">labelled demo reply — no AI key configured</div>
              ) : null}
            </div>
          </div>
        ))}

        {busy ? (
          <div className="flex items-center gap-2 text-[10.5px] text-faint">
            <Sparkles className="h-3 w-3 animate-pulse text-brand" /> thinking…
          </div>
        ) : null}
        {error ? <div className="text-[10px] leading-relaxed text-danger">{error}</div> : null}
      </div>

      <div className="border-t border-line p-2">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(draft);
              }
            }}
            rows={1}
            placeholder="Ask about a medicine or symptom…"
            className="max-h-24 min-h-9 flex-1 resize-none rounded-xl border border-line bg-inset px-3 py-2 text-[12px] text-ink-2 outline-none placeholder:text-faint focus:border-brand/40"
          />
          <button
            type="button"
            onClick={() => void send(draft)}
            disabled={busy || !draft.trim()}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand text-[#03150f] transition-colors hover:bg-brand-2 disabled:cursor-not-allowed disabled:opacity-40"
            title="Send"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="mt-1.5 px-1 text-[9.5px] leading-relaxed text-faint">
          General information only — not a doctor, no diagnosis. Emergencies: call 108 / 112. For anything
          prescribed, confirm with your doctor or pharmacist.
        </p>
      </div>
    </aside>
  );
}
