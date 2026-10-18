"use client";

import { ExternalLink, Loader2, ShoppingBag, Trash2, X } from "lucide-react";
import { inr0 } from "@/lib/format";
import type { CartLine, CartMode, CartResponse } from "@/lib/schemas";

function Line({ line, onRemove }: { line: CartLine; onRemove: (query: string, mode: CartMode) => void }) {
  return (
    <div className="rounded-xl border border-line bg-inset p-3">
      <div className="flex items-center gap-2">
        <span className="truncate text-[12px] font-medium">{line.query}</span>
        <span className="rounded-full border border-line bg-panel-2 px-2 py-0.5 text-[9px] text-mute">
          {line.mode === "urgent" ? "express" : "refill"} · ×{line.quantity_strips}
        </span>
        <button
          type="button"
          onClick={() => onRemove(line.query, line.mode)}
          className="ml-auto grid h-6 w-6 place-items-center rounded-md text-faint transition-colors hover:text-danger"
          title="Remove"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-mute">
        <span className="text-ink-2">{line.chosen.platform}</span>
        <span className="font-mono">{inr0(line.chosen.price_inr)} / pack</span>
        {line.line_savings_inr > 0 ? (
          <span className="font-medium text-brand-2">+{inr0(line.line_savings_inr)} saved</span>
        ) : null}
      </div>
      <p className="mt-1 text-[10px] leading-relaxed text-faint">{line.reason}</p>
    </div>
  );
}

export function SplitCartDrawer({
  open,
  cart,
  busy,
  pincode,
  onClose,
  onRemove,
  onClear,
}: {
  open: boolean;
  cart: CartResponse | null;
  busy: boolean;
  pincode: string;
  onClose: () => void;
  onRemove: (query: string, mode: CartMode) => void;
  onClear: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-line bg-panel">
        <div className="flex h-14 items-center gap-2 border-b border-line px-4">
          <ShoppingBag className="h-4 w-4 text-brand" />
          <span className="text-sm font-semibold">Split cart</span>
          <span className="rounded-full border border-line bg-panel-2 px-2 py-0.5 font-mono text-[10px] text-mute">
            {pincode}
          </span>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" /> : null}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-faint transition-colors hover:bg-panel-2 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          {cart ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-line bg-inset p-3">
                  <div className="text-[10px] text-faint">Branded baseline</div>
                  <div className="mt-1 font-mono text-lg font-semibold text-mute line-through decoration-danger/60">
                    {inr0(cart.baseline_total_inr)}
                  </div>
                </div>
                <div className="rounded-xl border border-brand/40 bg-brand/10 p-3">
                  <div className="text-[10px] text-brand-2">Optimised total</div>
                  <div className="mt-1 font-mono text-lg font-semibold text-brand-2">{inr0(cart.optimized_total_inr)}</div>
                </div>
              </div>
              <div className="rounded-xl border border-brand/40 bg-brand/10 px-3 py-2.5 text-center">
                <span className="text-[12px] text-brand-2">
                  Net saving <span className="font-mono text-[15px] font-bold">{inr0(cart.net_savings_inr)}</span> (
                  {cart.net_savings_percent}%)
                </span>
              </div>

              {cart.express_cart.length ? (
                <div>
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-faint">Express · need it now</div>
                  <div className="space-y-2">
                    {cart.express_cart.map((l) => (
                      <Line key={`e-${l.query}`} line={l} onRemove={onRemove} />
                    ))}
                  </div>
                </div>
              ) : null}

              {cart.generic_cart.length ? (
                <div>
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-faint">Refill · same salt, cheaper</div>
                  <div className="space-y-2">
                    {cart.generic_cart.map((l) => (
                      <Line key={`g-${l.query}`} line={l} onRemove={onRemove} />
                    ))}
                  </div>
                </div>
              ) : null}

              {cart.unresolved.length ? (
                <div className="rounded-xl border border-warn/40 bg-warn/10 p-3 text-[11px] text-warn">
                  Could not price: {cart.unresolved.join(", ")} — check the spelling or add live keys.
                </div>
              ) : null}

              {Object.keys(cart.checkout_links).length ? (
                <div>
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-faint">Checkout links</div>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(cart.checkout_links).map(([platform, urls]) => (
                      <a
                        key={platform}
                        href={urls[0]}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 rounded-full border border-line bg-panel-2 px-3 py-1.5 text-[11px] text-mute transition-colors hover:border-brand/40 hover:text-brand-2"
                      >
                        {platform}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}

              <p className="text-[10px] leading-relaxed text-faint">
                {cart.data_source === "demo"
                  ? "DEMO pricing — add API keys in .env.local for live quotes before treating these totals as real."
                  : "Live pricing from tracked portals. Prices change — confirm the final amount at checkout."}
              </p>
            </>
          ) : (
            <p className="text-[12px] text-faint">Add medicines from the comparison columns to see the split cart.</p>
          )}
        </div>

        <div className="flex gap-2 border-t border-line p-4">
          <button
            type="button"
            onClick={onClear}
            className="h-10 flex-1 rounded-xl border border-line text-[12px] text-mute transition-colors hover:border-danger/40 hover:text-danger"
          >
            Clear cart
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-10 flex-1 rounded-xl bg-brand text-[12px] font-semibold text-[#03150f] transition-colors hover:bg-brand-2"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
