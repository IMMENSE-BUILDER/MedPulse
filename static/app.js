/* MedPulse AI dashboard glue: renders API results into the existing design. */
(() => {
  const API = new URLSearchParams(location.search).get("api") || "";
  const SESSION = "s" + Math.random().toString(36).slice(2, 10);
  const $ = (id) => document.getElementById(id);
  const state = { query: "Augmentin 625 Duo", pincode: "110053", data: null, cart: new Map(), mode: "demo", busy: 0 };

  // ---------- helpers ----------
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : "#");
  const inr = (n) => "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const SYM = (n, cls = "") => `<span class="material-symbols-outlined text-[14px] ${cls}">${n}</span>`;
  const EMERALD = "text-[#34d399] bg-[rgba(16,185,129,0.1)] border border-[rgba(16,185,129,0.25)]";
  const NEUTRAL = "text-[#a1a1aa] bg-[#18181b] border border-[#27272a]";

  async function api(path, body, opts = {}) {
    const res = await fetch(API + path, {
      method: body || opts.form ? "POST" : "GET",
      headers: body && !opts.form ? { "Content-Type": "application/json" } : undefined,
      body: opts.form ? opts.form : body ? JSON.stringify(body) : undefined,
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      const d = j.detail || {};
      const err = new Error(d.message || d.error || res.statusText);
      err.status = res.status;
      throw err;
    }
    return j;
  }

  // ---------- agent log drawer ----------
  function logLine(e) {
    const box = $("agentLogContent");
    const color = e.level === "ok" ? "text-[#34d399]" : e.level === "error" ? "text-[#fafafa]" : e.level === "stream" ? "text-[#fafafa]" : "";
    const d = document.createElement("div");
    d.className = "flex items-start gap-1.5 " + color;
    d.innerHTML = `<span class="text-[#71717a] shrink-0">${esc(e.ts)}</span><span class="break-all">${esc(e.message)}</span>`;
    box.appendChild(d);
    while (box.children.length > 80) box.removeChild(box.firstChild);
    box.scrollTop = box.scrollHeight;
  }
  function startStream() {
    try {
      const es = new EventSource(`${API}/api/v2/agent/stream?session_id=${SESSION}`);
      es.onmessage = (m) => logLine(JSON.parse(m.data));
      es.onerror = () => { $("agentState").textContent = "Reconnecting"; };
      es.onopen = () => { $("agentState").textContent = "Active"; };
    } catch (_) { /* SSE unavailable: drawer simply stays empty */ }
  }

  // ---------- rendering ----------
  function offerCard(o, i, mode) {
    const first = i === 0;
    const inCart = state.cart.get(state.data.query_brand) === mode;
    const badge0 = o.badges[0];
    const badgeCls = o.nabl_lab_report_verified ? EMERALD : NEUTRAL;
    const idTxt = o.nabl_batch_id ? `#${o.nabl_batch_id}` : "";
    const disc = o.discount_percent > 0 ? `<span class="inline-block mt-0.5 text-[10px] font-mono font-medium ${o.discount_percent >= 50 ? EMERALD : NEUTRAL} px-1 rounded">${Math.round(o.discount_percent)}% OFF</span>` : "";
    const strike = o.mrp_inr && o.mrp_inr > o.price_inr ? `<div class="text-xs text-[#71717a] line-through font-mono">${inr(o.mrp_inr)}</div>` : "";
    const stock = o.in_stock === true ? `<span class="text-[10px] font-mono text-[#10b981]">In Stock</span>` : o.in_stock === false ? `<span class="text-[10px] font-mono text-[#71717a]">Out of stock</span>` : "";
    const left = o.nabl_lab_report_verified && !o.nabl_report_url
      ? `<span class="text-[11px] text-[#a1a1aa] flex items-center gap-1">${SYM("verified", "text-[#10b981]")}Batch lab-tested</span>`
      : o.nabl_lab_report_verified
      ? `<a class="text-xs text-[#a1a1aa] hover:text-[#fafafa] flex items-center gap-1 transition-colors" href="${esc(safeUrl(o.nabl_report_url))}" target="_blank" rel="noopener noreferrer">${SYM("verified")}NABL Certificate</a>`
      : o.equivalence_percent
      ? `<span class="text-[11px] text-[#a1a1aa] font-mono">Equivalence: ${o.equivalence_percent}%</span>`
      : `<a class="text-[11px] text-[#a1a1aa] hover:text-[#fafafa]" href="${esc(safeUrl(o.product_url))}" target="_blank" rel="noopener noreferrer">View on ${esc(o.platform)}</a>`;
    const label = inCart ? "Added" : mode === "refill" ? (first ? "Add Generic" : "Add to Cart") : first ? "Add Branded (Express)" : "Quick Buy";
    const icon = inCart ? "check" : mode === "urgent" && first ? "bolt" : "add";
    const btnCls = first && !inCart ? "bg-[#ffffff] hover:bg-[#e4e4e7] text-[#000000] font-semibold" : "bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] text-[#fafafa] font-medium";
    return `
    <div class="bg-[#0a0a0a] border border-[#27272a] hover:border-[#3f3f46] rounded-lg p-4 transition-colors">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex items-center gap-1.5 mb-1 flex-wrap">
            ${badge0 ? `<span class="inline-flex items-center gap-1 text-[10px] font-mono font-medium ${badgeCls} px-1.5 py-0.5 rounded">${esc(badge0)}</span>` : ""}
            ${idTxt ? `<span class="text-[10px] font-mono text-[#71717a]">${esc(idTxt)}</span>` : ""}
          </div>
          <h4 class="text-sm font-semibold text-[#fafafa]">${esc(o.product_name)}</h4>
          <p class="text-xs text-[#a1a1aa]">${esc(o.platform)}${o.manufacturer ? " • " + esc(o.manufacturer) : ""}</p>
        </div>
        <div class="text-right shrink-0">
          <div class="text-xl font-mono font-semibold text-[#fafafa]">${inr(o.price_inr)}</div>${strike}${disc}
        </div>
      </div>
      <div class="mt-3 p-2 bg-[#0f0f12] rounded border border-[#27272a] text-xs space-y-1">
        <div class="flex items-center justify-between text-[#fafafa]">
          <span class="text-[11px] font-medium flex items-center gap-1">${SYM("schedule", "text-[#a1a1aa]")}${esc(o.delivery_eta)}</span>${stock}
        </div>
        <div class="flex items-center justify-between text-[11px] text-[#a1a1aa]">
          <span>${esc(o.stock_note || "Strip of " + o.pack_size)}</span>
          <span class="font-mono text-[10px]">₹${o.price_per_tab_inr.toFixed(2)} / tab</span>
        </div>
      </div>
      <div class="mt-3 flex items-center justify-between pt-1">
        ${left}
        <button data-cart="${mode}" class="px-3 py-1.5 rounded ${btnCls} text-xs transition-colors flex items-center gap-1">${SYM(icon)}${label}</button>
      </div>
    </div>`;
  }

  function emptyCard(msg) {
    return `<div class="bg-[#0a0a0a] border border-[#27272a] rounded-lg p-4 text-xs text-[#a1a1aa]">${esc(msg)}</div>`;
  }

  function renderBanner(d) {
    const g = d.govt_benchmark;
    const best = d.subsidised_generic_online[0];
    const ref = d.branded_reference_per_10_tabs_inr;
    $("benchmarkBanner").innerHTML = `
    <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div class="space-y-2">
        <div class="flex flex-wrap items-center gap-2">
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#18181b] border border-[#27272a] text-[#fafafa] text-[11px] font-mono font-medium uppercase tracking-wider">${SYM("science", "text-[13px]")}Active Salt</span>
          <span class="text-sm sm:text-base font-semibold text-[#fafafa] tracking-tight">${esc(d.active_salt)}</span>
        </div>
        <div class="flex flex-wrap items-center gap-3 text-xs">
          ${g ? `<div class="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#121215] border border-[#27272a] text-[#fafafa]"><span class="text-[#71717a] font-mono text-[11px]">PMBJP Ceiling:</span><span class="font-mono font-semibold">${inr(g.official_mrp_per_10_tabs_inr)} / 10 tabs</span></div>` : ""}
          ${best && best.savings_vs_branded_percent > 0 ? `<div class="flex items-center gap-1.5 px-2.5 py-1 rounded ${EMERALD} text-xs font-medium"><span class="font-semibold">Save ${Math.round(best.savings_vs_branded_percent)}%</span><span class="text-[#34d399]/80 text-[11px]">vs branded${ref ? " (" + inr(ref) + " / 10 tabs)" : ""}</span></div>` : ""}
        </div>
        ${g && g.bioequivalence_index_percent ? `<div class="flex items-center gap-1.5 text-[11px] text-[#a1a1aa]">${SYM("verified", "text-[#10b981]")}<span>${esc(g.certification || "")} • Bioequivalent Therapeutic Index ${g.bioequivalence_index_percent}%</span></div>` : ""}
        ${g && g.nearest_walk_in_kendra ? `<div class="flex items-center gap-1.5 text-[11px] text-[#a1a1aa]">${SYM("store")}<span>Nearest Kendra: ${esc(g.nearest_walk_in_kendra.address)}${g.nearest_walk_in_kendra.distance_km ? " (" + g.nearest_walk_in_kendra.distance_km + " km)" : ""}</span></div>` : ""}
        ${d.amrit_hospital_alert ? `<div class="text-[11px] text-[#fafafa] bg-[#18181b] border border-[#3f3f46] rounded px-2 py-1">${SYM("local_hospital")} ${esc(d.amrit_hospital_alert.message)}</div>` : ""}
        ${d.notes.length ? `<details class="text-[11px] text-[#71717a] font-mono"><summary class="cursor-pointer">${esc(d.notes[0])}${d.notes.length > 1 ? ` (+${d.notes.length - 1} more)` : ""}</summary><ul class="mt-1 space-y-0.5 list-disc pl-4">${d.notes.slice(1).map((n) => `<li>${esc(n)}</li>`).join("")}</ul></details>` : ""}
      </div>
    </div>`;
  }

  function emptyReason(d, kind) {
    const skipped = d.notes.filter((n) => n.startsWith("skipped"));
    const failed = d.notes.filter((n) => n.startsWith("Incomplete") || n.startsWith("extraction failed") || n.startsWith("fetch failed") || n.includes("search failed"));
    let msg = `No ${kind} listings found.`;
    if (skipped.length) msg += ` ${skipped.length} listing(s) were rejected because the strength did not match, e.g. ${skipped[0].replace(/^skipped /, "")}`;
    else if (failed.length) msg += ` Some lookups failed: ${failed[0]}`;
    else msg += " The pharmacy sites returned nothing matching this medicine and strength.";
    return msg;
  }

  function render(d) {
    state.data = d;
    $("pageTitle").textContent = `${d.query_brand} Equivalence & Jan Aushadhi Optimizer`;
    $("genericList").innerHTML = d.subsidised_generic_online.length ? d.subsidised_generic_online.map((o, i) => offerCard(o, i, "refill")).join("") : emptyCard(emptyReason(d, "generic"));
    $("brandedList").innerHTML = d.branded_express_online.length ? d.branded_express_online.map((o, i) => offerCard(o, i, "urgent")).join("") : emptyCard("No branded listings found.");
    renderBanner(d);
    setMode(d.data_source);
    $("agentFoot").textContent = `${d.subsidised_generic_online.length + d.branded_express_online.length} offers · ${d.data_source}`;
  }

  function setMode(src) {
    state.mode = src;
    const demo = src === "demo";
    $("modeLabel").textContent = demo ? "Demo Data" : "Live Radar";
    $("modePill").title = demo ? "Seeded illustrative prices, not live quotes" : "Prices fetched live via TinyFish + Gemini";
  }

  // ---------- cart ----------
  let cartTimer;
  function updateCart() {
    clearTimeout(cartTimer);
    cartTimer = setTimeout(async () => {
      const items = [...state.cart].map(([q, mode]) => ({ query: q, mode, quantity_strips: 1 }));
      if (!items.length) {
        $("cartTitle").textContent = "Cart empty";
        $("cartSummary").textContent = "Add a medicine to build a split cart";
        $("netSavings").textContent = "₹0.00";
        $("optimizeSave").textContent = "Save ₹0";
        $("cartBadge").style.display = "none";
        return;
      }
      try {
        const r = await api("/api/v2/cart/hybrid-optimize", { items, pincode: state.pincode, session_id: SESSION });
        state.cartResult = r;
        $("cartTitle").textContent = "Split-Cart Ready";
        $("cartBadge").style.display = "";
        $("cartSummary").innerHTML = `${r.urgent_cart.length}x Urgent + <span class="text-[#fafafa] font-medium">${r.refill_cart.length}x Maintenance</span>`;
        $("netSavings").textContent = inr(r.net_savings_inr);
        $("optimizeSave").textContent = "Save ₹" + Math.round(r.net_savings_inr);
      } catch (e) {
        $("cartSummary").textContent = "Cart error: " + e.message;
      }
    }, 150);
  }

  function showCartModal() {
    const r = state.cartResult;
    if (!r) return;
    const line = (l) => `<tr class="border-b border-[#27272a]"><td class="py-2 pr-3"><div class="text-[#fafafa] text-xs font-medium">${esc(l.query)}</div><div class="text-[10px] text-[#71717a]">${esc(l.chosen.platform)} · ${esc(l.reason)}</div></td><td class="py-2 text-right font-mono text-xs text-[#fafafa] whitespace-nowrap">${inr(l.line_total_inr)}</td><td class="py-2 pl-3 text-right font-mono text-xs text-[#34d399] whitespace-nowrap">−${inr(l.line_savings_inr)}</td></tr>`;
    const section = (t, ls) => (ls.length ? `<div class="mt-4 text-[10px] font-mono uppercase tracking-wider text-[#71717a]">${t}</div><table class="w-full mt-1">${ls.map(line).join("")}</table>` : "");
    const links = Object.entries(r.checkout_links).map(([p, us]) => us.map((u) => `<a class="px-2.5 py-1 rounded bg-[#18181b] border border-[#27272a] hover:border-[#3f3f46] text-xs text-[#fafafa]" href="${esc(safeUrl(u))}" target="_blank" rel="noopener noreferrer">${esc(p)} ↗</a>`).join("")).join("");
    const el = document.createElement("div");
    el.className = "fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4";
    el.innerHTML = `<div class="w-full max-w-lg bg-[#18181b] border border-[#3f3f46] rounded-xl p-5 max-h-[85vh] overflow-y-auto">
      <div class="flex items-center justify-between"><h3 class="text-sm font-semibold text-[#fafafa]">Optimized split cart</h3><button id="closeModal" class="text-[#a1a1aa] hover:text-[#fafafa]">${SYM("close", "text-[18px]")}</button></div>
      ${section("Urgent · need today", r.urgent_cart)}${section("Refill · save money", r.refill_cart)}
      <div class="mt-4 flex items-baseline justify-between"><span class="text-xs text-[#a1a1aa]">Branded baseline ${inr(r.baseline_total_inr)}</span><span class="font-mono text-[#34d399] text-base font-semibold">Save ${inr(r.net_savings_inr)} (${r.net_savings_percent}%)</span></div>
      ${r.unresolved.length ? `<div class="mt-2 text-[11px] text-[#71717a]">Not found: ${esc(r.unresolved.join(", "))}</div>` : ""}
      ${r.data_source === "demo" ? `<div class="mt-2 text-[11px] text-[#71717a] font-mono">Demo data: links go to pharmacy home pages.</div>` : ""}
      <div class="mt-4 flex flex-wrap gap-2">${links}</div></div>`;
    el.addEventListener("click", (e) => { if (e.target === el || e.target.closest("#closeModal")) el.remove(); });
    document.body.appendChild(el);
  }

  // ---------- search ----------
  async function search(q) {
    q = (q || $("searchInput").value).trim();
    if (q.length < 2) return;
    state.query = q;
    $("searchInput").value = q;
    $("genericList").innerHTML = $("brandedList").innerHTML = emptyCard("Searching…");
    try {
      const d = await api("/api/v2/compare/dual-track", { query: q, pincode: state.pincode, session_id: SESSION });
      render(d);
      if ($("stockAgent").checked) verifyLive();
    } catch (e) {
      let hint = "";
      if (e.status === 404) {
        const s = await api("/api/v2/medicines/suggest?q=").catch(() => []);
        hint = s.length ? " Try: " + s.map((x) => x.brand).join(", ") : "";
      }
      $("genericList").innerHTML = emptyCard(e.message + hint);
      $("brandedList").innerHTML = emptyCard("—");
    }
  }

  async function verifyLive() {
    const d = state.data;
    if (!d) return;
    const urls = d.branded_express_online.map((o) => o.product_url).filter((u) => /^https?:\/\//.test(u || "")).slice(0, 3);
    if (!urls.length) return;
    try {
      const r = await api("/api/v2/verify/live-pincode", { pincode: state.pincode, product_urls: urls, session_id: SESSION });
      r.checks.forEach((c) => {
        const o = d.branded_express_online.find((x) => x.product_url === c.product_url);
        if (o && c.in_stock_at_pincode !== null) {
          o.in_stock = c.in_stock_at_pincode;
          if (c.delivery_eta) o.delivery_eta = c.delivery_eta;
          o.verified_by = c.verified_by;
        }
      });
      render(d);
    } catch (e) { logLine({ ts: new Date().toTimeString().slice(0, 8), level: "error", message: "live verify: " + e.message }); }
  }

  // ---------- prescription ----------
  async function uploadRx(file) {
    const box = $("rxStatus");
    box.className = "bg-[#0f0f12] border border-[#27272a] rounded p-2 text-xs text-[#a1a1aa]";
    box.textContent = "Reading prescription…";
    const form = new FormData();
    form.append("file", file);
    form.append("session_id", SESSION);
    try {
      const r = await api("/api/v2/prescription/analyze", null, { form });
      box.innerHTML = `<div class="flex items-center justify-between gap-2"><div class="min-w-0"><div class="text-xs font-medium text-[#fafafa] truncate">${esc(file.name)}</div>
        <div class="flex flex-wrap gap-1 mt-1">${r.medicines.map((m) => `<button data-q="${esc(m.brand_name)}" class="rx-chip text-[10px] bg-[#18181b] hover:bg-[#27272a] text-[#fafafa] font-mono px-1.5 py-0.5 rounded border border-[#27272a]">${esc(m.brand_name)}</button>`).join("")}</div></div>
        ${r.data_source === "demo" ? `<span class="text-[9px] font-mono text-[#71717a] shrink-0">DEMO SAMPLE</span>` : ""}</div>
        ${r.interactions.length ? `<div class="mt-2 text-[11px] text-[#fafafa]">⚠ ${r.interactions.map((i) => esc(i.between.join(" + ") + ": " + i.note)).join(" · ")}</div>` : ""}
        <div class="mt-1 text-[10px] text-[#71717a]">${esc(r.disclaimer)}</div>`;
    } catch (e) { box.textContent = "Could not read prescription: " + e.message; }
  }

  // ---------- wiring ----------
  document.addEventListener("click", (e) => {
    const cartBtn = e.target.closest("button[data-cart]");
    if (cartBtn && state.data) {
      const q = state.data.query_brand, mode = cartBtn.dataset.cart;
      state.cart.get(q) === mode ? state.cart.delete(q) : state.cart.set(q, mode);
      render(state.data);
      updateCart();
      return;
    }
    const chip = e.target.closest(".trend-chip, .rx-chip");
    if (chip) { e.stopPropagation(); search(chip.dataset.q); }
  });
  $("searchBtn").addEventListener("click", () => search());
  $("searchInput").addEventListener("keydown", (e) => e.key === "Enter" && search());
  document.addEventListener("keydown", (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); $("searchInput").focus(); } });
  $("optimizeBtn").addEventListener("click", showCartModal);
  $("agentRescan").addEventListener("click", verifyLive);
  $("stockAgent").addEventListener("change", (e) => e.target.checked && verifyLive());
  $("pinInput").addEventListener("change", (e) => {
    const v = e.target.value.trim();
    if (!/^\d{6}$/.test(v)) { e.target.value = state.pincode; return; }
    state.pincode = v;
    $("agentPin").textContent = v;
    $("cityLabel").textContent = "";
    search(state.query);
    updateCart();
  });
  const drop = $("dropzone"), fileInput = $("rxFile");
  drop.addEventListener("click", () => fileInput.click());
  drop.addEventListener("dragover", (e) => e.preventDefault());
  drop.addEventListener("drop", (e) => { e.preventDefault(); if (e.dataTransfer.files[0]) uploadRx(e.dataTransfer.files[0]); });
  fileInput.addEventListener("click", (e) => e.stopPropagation());
  fileInput.addEventListener("change", () => fileInput.files[0] && uploadRx(fileInput.files[0]));

  // ---------- boot ----------
  (async () => {
    startStream();
    try {
      const h = await api("/api/health");
      state.pincode = h.default_pincode;
      $("pinInput").value = state.pincode;
      $("agentPin").textContent = state.pincode;
      setMode(h.mode);
    } catch (_) { /* API unreachable: search() will show the error */ }
    updateCart();
    search(state.query);
  })();
})();
