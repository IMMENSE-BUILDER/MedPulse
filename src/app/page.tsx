"use client";

import { ShoppingBag } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ClinicalSaltBanner } from "@/components/ClinicalSaltBanner";
import { CompareProgress } from "@/components/CompareProgress";
import { DocAiDock } from "@/components/DocAiDock";
import { DualTrackGrid } from "@/components/DualTrackGrid";
import { LabGrid } from "@/components/LabGrid";
import { LiveAgentPipDock } from "@/components/LiveAgentPipDock";
import { Logo } from "@/components/Logo";
import { NavbarPincode } from "@/components/NavbarPincode";
import { PrescriptionDropzone } from "@/components/PrescriptionDropzone";
import { SearchPanel } from "@/components/SearchPanel";
import { SplitCartDrawer } from "@/components/SplitCartDrawer";
import { UnresolvedPanel } from "@/components/UnresolvedPanel";
import { useAgentStream } from "@/hooks/useAgentStream";
import { streamCompare } from "@/lib/compare-client";
import { inr0 } from "@/lib/format";
import { per10Tabs, perTab } from "@/lib/pricing";
import type {
  CartMode,
  CartResponse,
  CompareStage,
  DualTrackComparison,
  Kendra,
  LabComparison,
  OcrResponse,
  Offer,
  StockCheck,
} from "@/lib/schemas";

type Track = "medicine" | "lab";

type Health = {
  mode: "live" | "demo";
  tinyfish_key: boolean;
  gateway_key: boolean;
  default_pincode: string;
  demo_medicines: string[];
  demo_labs: string[];
};

const FALLBACK_QUICK_MEDS = ["Augmentin 625 Duo", "Dolo 650", "Telma 40", "Glycomet SR 500", "Pan 40"];
const FALLBACK_QUICK_LABS = ["HbA1c", "Full Body Checkup"];

const PIN_KEY = "medpulse:pincode";
const GEO_KEY = "medpulse:geo-attempted";

function urlKey(url: string): string {
  try {
    const u = new URL(url);
    return (u.host.replace(/^www\./, "") + u.pathname.replace(/\/+$/, "")).toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export default function Home() {
  const [health, setHealth] = useState<Health | null>(null);
  const [track, setTrack] = useState<Track>("medicine");
  const [query, setQuery] = useState("Augmentin 625 Duo");
  const [pincode, setPincode] = useState("110053");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cmp, setCmp] = useState<DualTrackComparison | null>(null);
  const [labs, setLabs] = useState<LabComparison | null>(null);
  const [cart, setCart] = useState<Record<string, CartMode>>({});
  const [cartRes, setCartRes] = useState<CartResponse | null>(null);
  const [cartBusy, setCartBusy] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [autoVerify, setAutoVerify] = useState(false);
  const [rx, setRx] = useState<OcrResponse | null>(null);
  const [rxBusy, setRxBusy] = useState(false);
  const [rxError, setRxError] = useState<string | null>(null);
  const [kendras, setKendras] = useState<Kendra[] | null>(null);
  const [docaiOpen, setDocaiOpen] = useState(false);
  const [stages, setStages] = useState<CompareStage[]>([]);
  const [locating, setLocating] = useState(false);
  const [locateMsg, setLocateMsg] = useState<string | null>(null);
  const agent = useAgentStream();
  const autoRef = useRef<string | null>(null);
  const bootRef = useRef(false);
  const prevPin = useRef(pincode);

  /* ---------------------------------------------------------- location */

  const applyPincode = useCallback((pin: string) => {
    setPincode(pin);
    try {
      window.localStorage.setItem(PIN_KEY, pin);
    } catch {
      /* storage unavailable — pincode still applies for this session */
    }
  }, []);

  const locateMe = useCallback(
    async (manual: boolean) => {
      if (!("geolocation" in navigator)) {
        if (manual) setLocateMsg("This browser can't share your location — type the pincode instead.");
        return;
      }
      setLocating(true);
      if (manual) setLocateMsg(null);
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const res = await fetch("/api/locate", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            });
            const json = (await res.json().catch(() => null)) as
              | { pincode?: string; city?: string; detail?: { message?: string } }
              | null;
            if (res.ok && json?.pincode) {
              applyPincode(json.pincode);
              setLocateMsg(`Pincode set from your location${json.city ? ` · ${json.city}` : ""}`);
            } else if (manual) {
              setLocateMsg(json?.detail?.message ?? "Couldn't detect a pincode — enter it manually.");
            }
          } catch {
            if (manual) setLocateMsg("Location lookup failed — enter your pincode manually.");
          } finally {
            setLocating(false);
          }
        },
        (err) => {
          setLocating(false);
          if (manual) {
            setLocateMsg(
              err.code === err.PERMISSION_DENIED
                ? "Location permission denied — you can always type the pincode."
                : "Couldn't read your location — type the pincode instead.",
            );
          }
        },
        { timeout: 10_000, maximumAge: 600_000 },
      );
    },
    [applyPincode],
  );

  const maybeAutoLocate = useCallback(
    (hadStoredPincode: string | null) => {
      if (hadStoredPincode) return;
      try {
        if (window.localStorage.getItem(GEO_KEY)) return;
        window.localStorage.setItem(GEO_KEY, "1");
      } catch {
        /* private mode — attempt once per session below */
      }
      if (!("geolocation" in navigator)) return;
      navigator.permissions
        ?.query({ name: "geolocation" })
        .then((p) => {
          if (p.state !== "denied") void locateMe(false);
        })
        .catch(() => {
          void locateMe(false);
        });
    },
    [locateMe],
  );

  useEffect(() => {
    if (!locateMsg) return;
    const t = setTimeout(() => setLocateMsg(null), 7000);
    return () => clearTimeout(t);
  }, [locateMsg]);

  /* ------------------------------------------------------------- compare */

  const runCompare = useCallback(
    async (t: Track, q: string, pin?: string) => {
      const search = q.trim();
      if (search.length < 2) return;
      setBusy(true);
      setError(null);
      setStages([]);
      const outcome: { result: DualTrackComparison | LabComparison | null; failure: string | null } = {
        result: null,
        failure: null,
      };
      try {
        await streamCompare({ query: search, pincode: pin ?? pincode, type: t }, (event) => {
          if (event.type === "STAGE") {
            setStages((prev) => {
              const idx = prev.findIndex((s) => s.step === event.stage.step);
              if (idx < 0) return [...prev, event.stage];
              const next = [...prev];
              next[idx] = event.stage;
              return next;
            });
          } else if (event.type === "RESULT") {
            outcome.result = event.result as DualTrackComparison | LabComparison;
          } else {
            outcome.failure = event.message;
          }
        });
        if (outcome.failure) {
          setError(outcome.failure);
          return;
        }
        if (!outcome.result) {
          setError("Comparison finished without a result.");
          return;
        }
        if (t === "lab") {
          setLabs(outcome.result as LabComparison);
          setCmp(null);
        } else {
          setCmp(outcome.result as DualTrackComparison);
          setLabs(null);
          setKendras(null);
          autoRef.current = null;
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Network error.");
      } finally {
        setBusy(false);
      }
    },
    [pincode],
  );

  /* ---------------------------------------------------------------- boot */

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/health");
        if (!res.ok) return;
        const data = (await res.json()) as Health;
        if (cancelled) return;
        setHealth(data);
        let stored: string | null = null;
        try {
          stored = window.localStorage.getItem(PIN_KEY);
        } catch {
          /* storage unavailable */
        }
        const pin = stored && /^\d{6}$/.test(stored) ? stored : data.default_pincode || "110053";
        setPincode(pin);
        prevPin.current = pin;
        maybeAutoLocate(stored);
        if (data.mode === "demo" && !bootRef.current) {
          bootRef.current = true;
          void runCompare("medicine", "Augmentin 625 Duo", pin);
        }
      } catch {
        /* health is best-effort */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ----------------------------------------------- pincode re-resolve */

  useEffect(() => {
    if (prevPin.current === pincode) return;
    prevPin.current = pincode;
    if (track === "medicine" && cmp) void runCompare("medicine", cmp.query_brand, pincode);
    if (track === "lab" && labs) void runCompare("lab", labs.query, pincode);
  }, [pincode, track, cmp, labs, runCompare]);

  /* ----------------------------------------------------------------- cart */

  useEffect(() => {
    const entries = Object.entries(cart);
    if (entries.length === 0) {
      setCartRes(null);
      return;
    }
    const handle = setTimeout(async () => {
      setCartBusy(true);
      try {
        const res = await fetch("/api/optimize-cart", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            items: entries.map(([q, mode]) => ({ query: q, quantity_strips: 1, mode })),
            pincode,
          }),
        });
        if (res.ok) setCartRes((await res.json()) as CartResponse);
      } catch {
        /* keep previous cart result */
      } finally {
        setCartBusy(false);
      }
    }, 180);
    return () => clearTimeout(handle);
  }, [cart, pincode]);

  const toggleCart = useCallback((q: string, mode: CartMode) => {
    setCart((prev) => {
      const next = { ...prev };
      if (next[q] === mode) delete next[q];
      else next[q] = mode;
      return next;
    });
  }, []);

  const removeFromCart = useCallback((q: string, mode: CartMode) => {
    setCart((prev) => {
      if (prev[q] !== mode) return prev;
      const next = { ...prev };
      delete next[q];
      return next;
    });
  }, []);

  /* ------------------------------------------------------------------ Rx */

  const runOcr = useCallback(async (body: { image_base64?: string; mime_type?: string; text?: string }) => {
    setRxBusy(true);
    setRxError(null);
    try {
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as Record<string, unknown> & { detail?: { message?: string } };
      if (!res.ok) {
        setRxError(json.detail?.message ?? "Could not read the prescription.");
        return;
      }
      setRx(json as unknown as OcrResponse);
    } catch (e) {
      setRxError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setRxBusy(false);
    }
  }, []);

  const onRxFile = useCallback(
    async (file: File) => {
      if (file.type === "application/pdf") {
        setRxError("PDF prescriptions aren't supported yet — take a photo or upload a JPG/PNG screenshot.");
        return;
      }
      if (file.size > 12 * 1024 * 1024) {
        setRxError("Image too large — keep it under 12 MB.");
        return;
      }
      const base64 = toBase64(await file.arrayBuffer());
      await runOcr({ image_base64: base64, mime_type: file.type || "image/jpeg" });
    },
    [runOcr],
  );

  const onPickMedicine = useCallback(
    (name: string) => {
      setQuery(name);
      setTrack("medicine");
      void runCompare("medicine", name);
    },
    [runCompare],
  );

  /* ---------------------------------------------------------------- agent */

  const applyStockChecks = useCallback((result: unknown) => {
    const r = result as { kind?: string; checks?: StockCheck[] } | null;
    if (!r?.checks?.length) return;
    const byKey = new Map(r.checks.map((c) => [urlKey(c.product_url), c]));
    const patch = (offer: Offer): Offer => {
      const check = byKey.get(urlKey(offer.product_url ?? ""));
      if (!check) return offer;
      const price = check.price_inr ?? offer.price_inr;
      return {
        ...offer,
        in_stock: check.in_stock_at_pincode,
        delivery_eta:
          check.delivery_eta ??
          (check.in_stock_at_pincode === true ? "Available for this pincode" : check.in_stock_at_pincode === false ? "Not deliverable" : offer.delivery_eta),
        price_inr: price,
        price_per_10_tabs_inr: per10Tabs(price, offer.pack_size),
        price_per_tab_inr: perTab(price, offer.pack_size),
        stock_note: check.error
          ? `Agent: ${check.error}`
          : check.in_stock_at_pincode === true
            ? "Verified available for this pincode"
            : check.in_stock_at_pincode === false
              ? "Verified unavailable for this pincode"
              : offer.stock_note,
        verified_by: check.verified_by,
      };
    };
    setCmp((prev) =>
      prev
        ? {
            ...prev,
            subsidised_generic_online: prev.subsidised_generic_online.map(patch),
            branded_express_online: prev.branded_express_online.map(patch),
          }
        : prev,
    );
  }, []);

  const verifyStock = useCallback(() => {
    if (!cmp || cmp.data_source !== "live") return;
    const urls = Array.from(
      new Set(cmp.branded_express_online.map((o) => o.product_url).filter((u): u is string => Boolean(u))),
    ).slice(0, 5);
    if (!urls.length) return;
    void agent.run({ kind: "stock", pincode: cmp.user_pincode, product_urls: urls }, `Stock verify · ${cmp.query_brand}`, (result) =>
      applyStockChecks(result),
    );
  }, [cmp, agent, applyStockChecks]);

  useEffect(() => {
    if (!autoVerify || !cmp || cmp.data_source !== "live" || !health?.tinyfish_key) return;
    const sig = `${cmp.query_brand}|${cmp.user_pincode}`;
    if (autoRef.current === sig) return;
    autoRef.current = sig;
    verifyStock();
  }, [autoVerify, cmp, health, verifyStock]);

  const findKendra = useCallback(() => {
    const pin = cmp?.user_pincode ?? pincode;
    void agent.run({ kind: "kendra", pincode: pin }, `Jan Aushadhi finder · ${pin}`, (result) => {
      const r = result as { kind?: string; kendras?: Kendra[] } | null;
      if (r?.kendras?.length) setKendras(r.kendras);
    });
  }, [cmp, pincode, agent]);

  /* ---------------------------------------------------------------- view */

  const cartCount = Object.keys(cart).length;
  const expressCount = Object.values(cart).filter((m) => m === "urgent").length;
  const quickMeds = health?.demo_medicines?.filter((m) => "Augmentin 625 Duo Dolo 650 Telma 40 Glycomet SR 500 Pan 40".includes(m)).slice(0, 5) ?? FALLBACK_QUICK_MEDS;
  const showEmpty = !cmp && !labs && !busy;

  return (
    <div className="min-h-dvh pb-28">
      <NavbarPincode
        mode={health?.mode ?? null}
        keys={health ? { tinyfish: health.tinyfish_key, gateway: health.gateway_key } : null}
        pincode={pincode}
        onPincode={applyPincode}
        autoVerify={autoVerify}
        onAutoVerify={setAutoVerify}
        onOpenAgent={() => agent.setOpen(true)}
        onOpenDocAi={() => setDocaiOpen(true)}
        onLocate={() => void locateMe(true)}
        locating={locating}
        locateMsg={locateMsg}
        agentRunning={agent.state.running}
      />

      <main className="mx-auto max-w-[1400px] space-y-4 px-4 py-5 lg:px-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr]">
          <SearchPanel
            track={track}
            onTrack={setTrack}
            query={query}
            onQuery={setQuery}
            busy={busy}
            onSearch={(q) => void runCompare(track, q ?? query)}
            quickMeds={quickMeds}
            quickLabs={health?.demo_labs ?? FALLBACK_QUICK_LABS}
            error={error}
          />
          <PrescriptionDropzone
            rx={rx}
            busy={rxBusy}
            error={rxError}
            onFile={(f) => void onRxFile(f)}
            onSample={() => void runOcr({ text: "Augmentin 625 Duo — 1-0-1 after food × 5 days; Dolo 650 — 1-0-1 × 3 days" })}
            onPickMedicine={onPickMedicine}
          />
        </div>

        {busy ? <CompareProgress stages={stages} live={busy} /> : null}

        {cmp?.status === "unresolved" && !busy ? (
          <UnresolvedPanel
            cmp={cmp}
            onPick={(name) => {
              setQuery(name);
              void runCompare("medicine", name);
            }}
          />
        ) : null}

        {track === "medicine" && cmp && cmp.status !== "unresolved" ? (
          <>
            <ClinicalSaltBanner cmp={cmp} kendras={kendras} onFindKendra={findKendra} agentRunning={agent.state.running} />
            <DualTrackGrid
              cmp={cmp}
              cart={cart}
              onAdd={toggleCart}
              onVerifyStock={verifyStock}
              agentRunning={agent.state.running}
              verifyDisabled={cmp.data_source !== "live"}
              verifyTitle={
                cmp.data_source === "live"
                  ? `Verify stock for pincode ${cmp.user_pincode} with the live browser agent`
                  : "Live stock verification needs live listings — add both API keys in .env.local"
              }
            />
          </>
        ) : null}

        {track === "lab" && labs ? <LabGrid labs={labs} /> : null}

        {showEmpty ? (
          <section className="rounded-2xl border border-line bg-panel p-10 text-center">
            <div className="text-sm font-medium text-ink-2">Search a brand — or scan a prescription</div>
            <p className="mx-auto mt-2 max-w-lg text-[11px] leading-relaxed text-faint">
              One search prices it three ways at once: the government PMBJP benchmark, subsidised generic listings
              matched by active salt, and branded express e-pharmacies for your pincode. Track D compares lab test
              packages the same way.
            </p>
          </section>
        ) : null}

        <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 text-[10px] text-faint">
          <Logo className="h-7 w-auto text-ink-2" />
          <span>Track A PMBJP · Track B generics · Track C branded · Track D labs</span>
          <span>
            {health?.mode === "live"
              ? "Live data from tracked portals — confirm final price at checkout."
              : "Demo data — add API keys in .env.local to go live."}
          </span>
          <span>By Satyam and Sujal ❤️</span>
        </footer>
      </main>

      {cartCount > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-panel/95 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 lg:px-6">
            <ShoppingBag className="h-4 w-4 text-brand" />
            <span className="text-[12px] text-mute">
              {cartCount} item{cartCount === 1 ? "" : "s"} · {expressCount} express · {cartCount - expressCount} refill
            </span>
            {cartRes ? (
              <span className="rounded-full border border-brand/40 bg-brand/10 px-2.5 py-1 text-[11px] font-medium text-brand-2">
                net save {inr0(cartRes.net_savings_inr)}
              </span>
            ) : null}
            {cartBusy ? <span className="text-[10px] text-faint">optimising…</span> : null}
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="ml-auto h-10 rounded-xl bg-brand px-5 text-[12px] font-semibold text-[#03150f] transition-colors hover:bg-brand-2"
            >
              Open split cart
            </button>
          </div>
        </div>
      ) : null}

      <SplitCartDrawer
        open={cartOpen}
        cart={cartRes}
        busy={cartBusy}
        pincode={pincode}
        onClose={() => setCartOpen(false)}
        onRemove={removeFromCart}
        onClear={() => setCart({})}
      />

      <LiveAgentPipDock state={agent.state} onClose={agent.close} raised={cartCount > 0} />
      <DocAiDock open={docaiOpen} onClose={() => setDocaiOpen(false)} raised={cartCount > 0} />
    </div>
  );
}
