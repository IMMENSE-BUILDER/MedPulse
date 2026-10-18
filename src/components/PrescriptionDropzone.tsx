"use client";

import { Camera, CheckCircle2, Loader2, Pill, Sparkles } from "lucide-react";
import { useRef } from "react";
import type { OcrResponse } from "@/lib/schemas";

const SEVERITY_STYLE: Record<string, string> = {
  major: "border-danger/40 bg-danger/10 text-danger",
  moderate: "border-warn/40 bg-warn/10 text-warn",
  minor: "border-line bg-panel-2 text-mute",
};

export function PrescriptionDropzone({
  rx,
  busy,
  error,
  onFile,
  onSample,
  onPickMedicine,
}: {
  rx: OcrResponse | null;
  busy: boolean;
  error: string | null;
  onFile: (file: File) => void;
  onSample: () => void;
  onPickMedicine: (name: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <section className="flex flex-col rounded-2xl border border-line bg-panel p-5">
      <div className="flex items-center gap-2">
        <Pill className="h-4 w-4 text-brand" />
        <h2 className="text-sm font-semibold">Prescription scan</h2>
        <span className="ml-auto rounded-full border border-line bg-panel-2 px-2 py-0.5 font-mono text-[9px] text-faint">
          vision + clinical AI
        </span>
      </div>

      <label
        htmlFor="rx-file"
        className="mt-4 grid cursor-pointer place-items-center rounded-xl border border-dashed border-line-2 bg-inset px-4 py-6 text-center transition-colors hover:border-brand/50"
      >
        {busy ? (
          <span className="flex items-center gap-2 text-[12px] text-mute">
            <Loader2 className="h-4 w-4 animate-spin text-brand" />
            Reading prescription…
          </span>
        ) : (
          <>
            <Camera className="h-5 w-5 text-faint" />
            <span className="mt-2 text-[12px] font-medium text-ink-2">Upload or snap a prescription</span>
            <span className="mt-0.5 text-[10px] text-faint">JPG / PNG · assisted extraction, verified by you</span>
          </>
        )}
        <input
          ref={inputRef}
          id="rx-file"
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = "";
          }}
        />
      </label>

      <div className="mt-2 flex items-center justify-between">
        <button
          type="button"
          onClick={onSample}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] text-mute transition-colors hover:text-brand-2"
        >
          <Sparkles className="h-3 w-3" />
          Try a sample prescription
        </button>
        {rx ? (
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] ${
              rx.data_source === "live" ? "border-brand/40 bg-brand/10 text-brand-2" : "border-warn/40 bg-warn/10 text-warn"
            }`}
          >
            {rx.data_source === "live" ? "LIVE OCR" : "DEMO SAMPLE"}
          </span>
        ) : null}
      </div>

      {error ? <p className="mt-2 text-[11px] text-danger">{error}</p> : null}

      {rx ? (
        <div className="mt-3 space-y-3 border-t border-line pt-3">
          {rx.medicines.length ? (
            <div className="flex flex-wrap gap-1.5">
              {rx.medicines.map((m) => (
                <button
                  key={m.brand_name}
                  type="button"
                  onClick={() => onPickMedicine(m.brand_name)}
                  className="rounded-full border border-brand/40 bg-brand/10 px-3 py-1 text-[11px] font-medium text-brand-2 transition-colors hover:bg-brand/20"
                  title={`Compare prices for ${m.brand_name}`}
                >
                  {m.brand_name}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-faint">No medicines could be read from this prescription.</p>
          )}

          <div className="space-y-1.5">
            {rx.medicines
              .filter((m) => m.schedule_en)
              .map((m) => (
                <div key={m.brand_name} className="rounded-lg border border-line bg-inset px-3 py-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-ink-2">
                    <CheckCircle2 className="h-3 w-3 text-brand" />
                    {m.brand_name}
                    {m.duration_days ? <span className="text-faint">· {m.duration_days} days</span> : null}
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] text-mute">{m.schedule_en}</div>
                  <div className="font-mono text-[10px] text-faint">{m.schedule_hi}</div>
                </div>
              ))}
          </div>

          {rx.interactions.length ? (
            <div className="space-y-1.5">
              {rx.interactions.map((it, i) => (
                <div
                  key={i}
                  className={`rounded-lg border px-3 py-2 text-[11px] ${SEVERITY_STYLE[it.severity] ?? SEVERITY_STYLE.minor}`}
                >
                  <span className="font-semibold uppercase">{it.severity}</span> · {it.between.join(" + ")} — {it.note}
                </div>
              ))}
            </div>
          ) : rx.data_source === "live" ? (
            <p className="text-[10px] text-faint">No established interaction found between the listed salts.</p>
          ) : null}

          {rx.extracted_text ? (
            <details className="text-[11px] text-mute">
              <summary className="cursor-pointer select-none text-faint hover:text-mute">Raw transcription</summary>
              <pre className="mt-1.5 max-h-36 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-inset p-2 font-mono text-[10px] text-mute">
                {rx.extracted_text}
              </pre>
            </details>
          ) : null}

          <p className="text-[10px] leading-relaxed text-faint">{rx.disclaimer}</p>
        </div>
      ) : (
        <ul className="mt-3 space-y-1 border-t border-line pt-3 text-[11px] text-faint">
          <li>• Extracts brand name + active salt</li>
          <li>• Builds an English + हिन्दी dosing schedule</li>
          <li>• Flags established drug-drug interactions</li>
        </ul>
      )}
    </section>
  );
}
