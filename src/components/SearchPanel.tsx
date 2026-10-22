"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, FlaskConical, Loader2, Pill, Search } from "lucide-react";
import { searchCatalog } from "@/lib/catalog";
import { useLanguage } from "@/lib/i18n";

export function SearchPanel({
  track,
  onTrack,
  query,
  onQuery,
  busy,
  onSearch,
  quickMeds,
  quickLabs,
  error,
}: {
  track: "medicine" | "lab";
  onTrack: (t: "medicine" | "lab") => void;
  query: string;
  onQuery: (q: string) => void;
  busy: boolean;
  onSearch: (q?: string) => void;
  quickMeds: string[];
  quickLabs: string[];
  error: string | null;
}) {
  const quick = track === "medicine" ? quickMeds : quickLabs;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const { tr } = useLanguage();

  const suggestions = useMemo(() => searchCatalog(query, track, 9), [query, track]);
  const trimmed = query.trim();
  const canSearchAnyway = trimmed.length >= 2;
  const rowCount = (suggestions.length ? suggestions.length : 0) + (canSearchAnyway ? 1 : 0);
  const showList = open && trimmed.length >= 1 && rowCount > 0;

  const close = () => {
    setOpen(false);
    setActive(-1);
  };

  const choose = (index: number) => {
    const pick = index < suggestions.length ? suggestions[index].name : trimmed;
    onQuery(pick);
    onSearch(pick);
    close();
  };

  return (
    <section className="rounded-2xl border border-line bg-panel p-5">
      <div className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-inset p-1">
        <button
          type="button"
          onClick={() => {
            onTrack("medicine");
            close();
          }}
          className={`flex items-center justify-center gap-2 rounded-lg py-2 text-[13px] font-medium transition-colors ${
            track === "medicine" ? "bg-brand text-white hover:bg-brand-hover" : "text-mute hover:text-ink-2"
          }`}
        >
          <Pill className="h-3.5 w-3.5" />
          {tr("Medicines", "दवाइयाँ")}
        </button>
        <button
          type="button"
          onClick={() => {
            onTrack("lab");
            close();
          }}
          className={`flex items-center justify-center gap-2 rounded-lg py-2 text-[13px] font-medium transition-colors ${
            track === "lab" ? "bg-brand text-white hover:bg-brand-hover" : "text-mute hover:text-ink-2"
          }`}
        >
          <FlaskConical className="h-3.5 w-3.5" />
          {tr("Lab tests", "लैब टेस्ट")}
        </button>
      </div>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          close();
          onSearch();
        }}
      >
        <div
          className="relative flex-1"
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) close();
          }}
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => {
              onQuery(e.target.value);
              setOpen(true);
              setActive(-1);
            }}
            onFocus={() => {
              if (trimmed.length >= 1) setOpen(true);
            }}
            onKeyDown={(e) => {
              if (!showList) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => (a + 1) % rowCount);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => (a - 1 + rowCount) % rowCount);
              } else if (e.key === "Escape") {
                close();
              } else if (e.key === "Enter" && active >= 0 && active < rowCount) {
                e.preventDefault();
                choose(active);
              }
            }}
            placeholder={track === "medicine" ? "Augmentin 625 Duo, Dolo 650, Telma 40 …" : "HbA1c, Full Body Checkup …"}
            className="h-11 w-full rounded-xl border border-line bg-inset pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-faint focus:border-brand/60"
            autoComplete="off"
            spellCheck={false}
            role="combobox"
            aria-expanded={showList}
            aria-autocomplete="list"
          />

          {showList ? (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-line bg-panel shadow-pop">
              <div className="border-b border-line bg-inset px-3 py-1.5 text-[9px] uppercase tracking-[0.14em] text-faint">
                {suggestions.length ? `Suggestions · ${track === "medicine" ? "medicines" : "lab tests"}` : "No catalog match"}
              </div>
              {suggestions.length ? (
                <ul className="max-h-72 overflow-y-auto">
                  {suggestions.map((s, i) => (
                    <li key={s.name}>
                      <button
                        type="button"
                        tabIndex={-1}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          choose(i);
                        }}
                        onMouseEnter={() => setActive(i)}
                        className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
                          i === active ? "bg-inset" : "hover:bg-inset/60"
                        }`}
                      >
                        {s.kind === "lab" ? (
                          <FlaskConical className="h-3.5 w-3.5 shrink-0 text-brand-2/70" />
                        ) : (
                          <Pill className="h-3.5 w-3.5 shrink-0 text-brand-2/70" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] text-ink-2">{s.name}</span>
                          <span className="block truncate text-[10px] text-faint">{s.hint}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {canSearchAnyway ? (
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(suggestions.length);
                  }}
                  onMouseEnter={() => setActive(suggestions.length)}
                  className={`flex w-full items-center gap-2.5 border-t border-line px-3 py-2.5 text-left transition-colors ${
                    active === suggestions.length ? "bg-inset" : "hover:bg-inset/60"
                  }`}
                >
                  <Search className="h-3.5 w-3.5 shrink-0 text-brand-2" />
                  <span className="min-w-0 truncate text-[12px] text-ink-2">
                    Search <span className="font-medium text-brand-2">“{trimmed}”</span> in live prices anyway
                  </span>
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        <button
          type="submit"
          disabled={busy || query.trim().length < 2}
          className="flex h-11 items-center gap-2 rounded-xl bg-brand px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {tr("Compare", "तुलना करें")}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[11px] text-faint">{tr("Try:", "आज़माएँ:")}</span>
        {quick.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => {
              onQuery(q);
              onSearch(q);
            }}
            className="rounded-full border border-line bg-panel-2 px-2.5 py-1 text-[11px] text-mute transition-colors hover:border-brand/40 hover:text-brand-2"
          >
            {q}
          </button>
        ))}
      </div>

      {error ? (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-[12px] text-danger">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-3 text-[10px] text-faint">
        <span>Track A · PMBJP benchmark</span>
        <span>Track B · subsidised generics</span>
        <span>Track C · branded express</span>
        <span>Track D · lab tests</span>
      </div>
    </section>
  );
}
