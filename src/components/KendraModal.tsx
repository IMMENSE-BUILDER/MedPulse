"use client";

import { useState } from "react";
import { Building2, Download, ExternalLink, Loader2, MapPin, Phone, RefreshCw, X } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { downloadKendraPdf } from "@/lib/kendra-pdf";
import type { Kendra } from "@/lib/schemas";

export function KendraModal({
  open,
  kendras,
  pincode,
  running,
  error,
  onClose,
  onRetry,
}: {
  open: boolean;
  kendras: Kendra[] | null;
  pincode: string;
  running: boolean;
  error: string | null;
  onClose: () => void;
  onRetry: () => void;
}) {
  const { tr } = useLanguage();
  const [downloading, setDownloading] = useState(false);
  if (!open) return null;

  const onDownload = async () => {
    if (!kendras?.length) return;
    setDownloading(true);
    try {
      await downloadKendraPdf(kendras, pincode);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[75] grid place-items-center bg-black/60 p-4"
      role="presentation"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="kendra-title"
        className="flex max-h-[86vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-pop"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-line p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-brand/40 bg-brand/10">
            <Building2 className="h-4 w-4 text-brand-2" />
          </span>
          <div className="min-w-0">
            <h2 id="kendra-title" className="text-sm font-semibold">
              {tr("Jan Aushadhi Kendras near", "जन औषधि केंद्र यहाँ के पास")} {pincode}
            </h2>
            <p className="mt-0.5 text-[11px] text-faint">
              {running
                ? tr("Live browser is searching the official locator…", "लाइव ब्राउज़र सरकारी लोकेटर पर खोज रहा है…")
                : tr(
                    `${kendras?.length ?? 0} locations found from janaushadhi.gov.in`,
                    `janaushadhi.gov.in से ${kendras?.length ?? 0} जगह मिलीं`,
                  )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={tr("Close Jan Aushadhi results", "जन औषधि नतीजे बंद करें")}
            className="ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-lg text-faint transition-colors hover:bg-panel-2 hover:text-ink-2"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {error ? (
            <div className="mb-2 rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-[10.5px] leading-relaxed text-warn">
              {tr("Live agent could not finish:", "लाइव एजेंट पूरा नहीं कर सका:")} {error}
            </div>
          ) : null}
          {running && !kendras?.length ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-brand" />
              <p className="text-[12px] font-medium text-ink-2">
                {tr("Searching every page of the Jan Aushadhi locator", "जन औषधि लोकेटर के हर पेज पर खोज रहे हैं")}
              </p>
              <p className="max-w-xs text-[10px] leading-relaxed text-faint">
                {tr(
                  "The live browser is entering your pincode, scrolling results and clicking Next until all kendras are collected.",
                  "लाइव ब्राउज़र आपका पिनकोड डालकर, नतीजे स्क्रॉल करके और Next दबाकर सभी केंद्र इकट्ठा कर रहा है।",
                )}
              </p>
            </div>
          ) : kendras?.length ? (
            <ul className="space-y-2">
              {kendras.map((kendra) => (
                <li key={kendra.kendra_id} className="rounded-xl border border-line bg-inset p-3">
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-2" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[12px] font-medium text-ink-2">{kendra.name}</span>
                        {kendra.distance_km != null ? (
                          <span className="rounded-full border border-brand/30 bg-brand/10 px-1.5 py-0.5 text-[9px] font-medium text-brand-2">
                            {kendra.distance_km} km
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[10.5px] leading-relaxed text-mute">{kendra.address}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[9px] text-faint">
                        {kendra.kendra_code ? <span>Code {kendra.kendra_code}</span> : null}
                        {kendra.owner_name ? <span>Owner {kendra.owner_name}</span> : null}
                        {kendra.state || kendra.district ? (
                          <span>{[kendra.district, kendra.state].filter(Boolean).join(", ")}</span>
                        ) : null}
                        {kendra.pincode ? <span>{kendra.pincode}</span> : null}
                      </div>
                      {kendra.phone ? (
                        <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-faint">
                          <Phone className="h-2.5 w-2.5" />
                          {kendra.phone}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-10 text-center">
              <p className="text-[12px] font-medium text-ink-2">
                {tr("No Jan Aushadhi Kendra found for this pincode.", "इस पिनकोड के लिए कोई जन औषधि केंद्र नहीं मिला।")}
              </p>
              <p className="mt-1 text-[10px] text-faint">
                {tr("Try another pincode or run the live search again.", "दूसरा पिनकोड डालें या लाइव खोज दोबारा चलाएँ।")}
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-line p-3">
          <a
            href="https://janaushadhi.gov.in/near-by-kendra"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-panel-2 px-2.5 text-[10px] text-mute transition-colors hover:border-brand/40 hover:text-brand-2"
          >
            {tr("Official locator", "सरकारी लोकेटर")}
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
          <button
            type="button"
            onClick={() => void onDownload()}
            disabled={!kendras?.length || downloading}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-danger px-3 text-[10px] font-semibold text-white transition-colors hover:bg-danger/85 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {downloading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
            {tr("Download PDF", "PDF डाउनलोड करें")}
          </button>
          <button
            type="button"
            onClick={onRetry}
            disabled={running}
            className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-[10px] font-semibold text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
          >
            {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            {tr("Run live again", "लाइव दोबारा चलाएँ")}
          </button>
        </div>
      </div>
    </div>
  );
}
