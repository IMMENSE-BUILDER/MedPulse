/**
 * DOM wiring for the welcome page's sign-in + local history panel.
 *
 * Kept as a small imperative module so the validated standalone interactions
 * port over without duplicating the panel state in React. All listeners share
 * one AbortController, which is aborted on unmount (important for StrictMode).
 */

import {
  addHistory,
  clearHistory,
  getHistory,
  getProfile,
  isSignedIn,
  removeHistory,
  signIn,
  signOut,
  storageAvailable,
  timeAgo,
  type HistoryEntry,
  type HistoryKind,
} from "@/lib/welcome-store";

const KIND_LABEL: Record<HistoryKind, string> = {
  medicine: "Med",
  lab: "Lab",
  rx: "Rx",
  note: "Note",
};

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Same pincode pass-through contract as the engine's share URLs. */
function targetUrl(query?: string): string {
  const params = new URLSearchParams();
  const trimmed = typeof query === "string" ? query.trim() : "";
  if (trimmed) params.set("q", trimmed);

  let pin = "";
  try {
    pin = window.localStorage.getItem("medpulse:pincode") || "";
  } catch {
    pin = "";
  }
  if (/^\d{6}$/.test(pin)) params.set("pin", pin);

  const search = params.toString();
  return search ? `/engine?${search}` : "/engine";
}

export function initWelcomeAuth(root: HTMLElement): () => void {
  const must = <T extends Element>(selector: string): T => {
    const node = root.querySelector<T>(selector);
    if (!node) throw new Error(`Welcome markup is missing ${selector}`);
    return node;
  };

  const els = {
    panel: must<HTMLElement>("#panel"),
    panelTitle: must<HTMLElement>("#panel-title"),
    panelChip: must<HTMLElement>("#panel-chip"),
    authView: must<HTMLElement>("#auth-view"),
    historyView: must<HTMLElement>("#history-view"),
    authForm: must<HTMLFormElement>("#auth-form"),
    authName: must<HTMLInputElement>("#auth-name"),
    authEmail: must<HTMLInputElement>("#auth-email"),
    authPass: must<HTMLInputElement>("#auth-pass"),
    passToggle: must<HTMLButtonElement>("#pass-toggle"),
    authError: must<HTMLElement>("#auth-error"),
    authSubmit: must<HTMLButtonElement>("#auth-submit"),
    guestBtn: must<HTMLButtonElement>("#guest-btn"),
    demoFill: must<HTMLButtonElement>("#demo-fill"),
    signoutBtn: must<HTMLButtonElement>("#signout-btn"),
    whoInitial: must<HTMLElement>("#who-initial"),
    whoName: must<HTMLElement>("#who-name"),
    whoMail: must<HTMLElement>("#who-mail"),
    addForm: must<HTMLFormElement>("#add-form"),
    addLabel: must<HTMLInputElement>("#add-label"),
    addKind: must<HTMLSelectElement>("#add-kind"),
    histCount: must<HTMLElement>("#hist-count"),
    historyList: must<HTMLUListElement>("#history-list"),
    clearBtn: must<HTMLButtonElement>("#clear-btn"),
    navSignin: must<HTMLButtonElement>("#nav-signin"),
    toast: must<HTMLElement>("#toast"),
  };

  const controller = new AbortController();
  const { signal } = controller;
  let toastTimer: number | undefined;
  let signInTimer: number | undefined;
  let focusTimer: number | undefined;
  let signingIn = false;

  function toast(message: string, duration = 2600): void {
    els.toast.textContent = message;
    els.toast.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => els.toast.classList.remove("show"), duration);
  }

  function go(query?: string): void {
    window.location.assign(targetUrl(query));
  }

  function historyRow(entry: HistoryEntry): string {
    const kindLabel = KIND_LABEL[entry.kind] || "Note";
    const meta = entry.meta ? `${esc(entry.meta)} &middot; ` : "";

    return `
      <li class="hist-row">
        <span class="hist-kind" data-kind="${esc(entry.kind)}">${kindLabel}</span>
        <span class="hist-main">
          <span class="hist-label" title="${esc(entry.label)}">${esc(entry.label)}</span>
          <span class="hist-meta">${meta}${esc(timeAgo(entry.at))}</span>
        </span>
        <button
          class="hist-go"
          type="button"
          data-compare="${esc(entry.label)}"
          data-kind="${esc(entry.kind)}"
          title="Compare again"
          aria-label="Compare ${esc(entry.label)} again"
        >&nearr;</button>
        <button
          class="hist-del"
          type="button"
          data-del="${esc(entry.id)}"
          title="Remove"
          aria-label="Remove ${esc(entry.label)}"
        >&times;</button>
      </li>`;
  }

  function renderHistory(): void {
    const entries = getHistory();

    els.histCount.textContent = `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`;
    els.historyList.innerHTML = entries.length
      ? entries.map(historyRow).join("")
      : `<li class="hist-empty">Nothing saved yet. Compare a medicine, or add a note above &mdash; it stays in this browser.</li>`;
  }

  function render(): void {
    const signedIn = isSignedIn();
    const profile = signedIn ? getProfile() : null;

    els.authView.hidden = signedIn;
    els.historyView.hidden = !signedIn;
    els.panelTitle.textContent = signedIn ? "Your history" : "Sign in";
    els.panelChip.textContent = signedIn ? "demo session" : "local only";
    els.navSignin.textContent = signedIn ? "Your history" : "Sign in";

    if (!signedIn) {
      els.historyList.innerHTML = "";
      return;
    }

    const name = profile ? profile.name : "Guest";
    const email = profile && profile.email ? profile.email : "stored in this browser";

    els.whoName.textContent = name;
    els.whoMail.textContent = email;
    els.whoInitial.textContent = (name || "M").trim().charAt(0) || "M";
    renderHistory();
  }

  function clearError(): void {
    els.authError.textContent = "";
  }

  function fail(message: string, field?: HTMLElement): void {
    els.authError.textContent = message;
    field?.focus({ preventScroll: true });
  }

  els.authForm.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      if (signingIn) return;

      const name = els.authName.value.trim();
      const email = els.authEmail.value.trim();
      const password = els.authPass.value;

      if (!email) return fail("Enter an email address — it is only used as a local label.", els.authEmail);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        return fail("That email does not look right. Check it and try again.", els.authEmail);
      }
      if (password.length < 6) {
        return fail("Password needs at least 6 characters (any password works in this demo).", els.authPass);
      }
      if (!storageAvailable()) {
        return fail("This browser is blocking local storage. Try a normal window instead of private mode.");
      }

      clearError();
      signingIn = true;
      els.authSubmit.disabled = true;
      els.authSubmit.textContent = "Signing in…";

      // Brief pause so the state change is visible, not to fake a network call.
      signInTimer = window.setTimeout(() => {
        const profile = signIn({ name, email });
        signingIn = false;
        els.authSubmit.disabled = false;
        els.authSubmit.textContent = "Sign in";

        if (!profile) {
          return fail("Could not save the demo session in this browser.");
        }

        els.authPass.value = "";
        render();
        toast(`Welcome, ${profile.name}. History stays in this browser.`);
      }, 450);
    },
    { signal }
  );

  els.passToggle.addEventListener(
    "click",
    () => {
      const show = els.authPass.type === "password";
      els.authPass.type = show ? "text" : "password";
      els.passToggle.textContent = show ? "Hide" : "Show";
      els.passToggle.setAttribute("aria-pressed", String(show));
      els.passToggle.setAttribute("aria-label", show ? "Hide password" : "Show password");
      els.authPass.focus({ preventScroll: true });
    },
    { signal }
  );

  els.demoFill.addEventListener(
    "click",
    () => {
      els.authName.value = "Demo Reviewer";
      els.authEmail.value = "demo@medpulse.local";
      els.authPass.value = "medpulse-demo";
      clearError();
      toast("Demo details filled — press Sign in.");
    },
    { signal }
  );

  els.guestBtn.addEventListener("click", () => go(), { signal });

  els.signoutBtn.addEventListener(
    "click",
    () => {
      signOut();
      render();
      toast("Signed out — history is hidden until you sign in again.");
    },
    { signal }
  );

  els.addForm.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      const label = els.addLabel.value.trim();
      if (!label) {
        els.addLabel.focus({ preventScroll: true });
        return;
      }

      const entry = addHistory({ label, kind: els.addKind.value });
      if (!entry) {
        toast("Could not save that entry in this browser.");
        return;
      }

      els.addLabel.value = "";
      renderHistory();
      toast("Added to your local history.");
    },
    { signal }
  );

  els.historyList.addEventListener(
    "click",
    (event) => {
      const target = event.target as Element | null;
      const removeButton = target?.closest<HTMLElement>("[data-del]");
      if (removeButton) {
        const id = removeButton.getAttribute("data-del");
        if (id) {
          removeHistory(id);
          renderHistory();
          toast("Entry removed.");
        }
        return;
      }

      const againButton = target?.closest<HTMLElement>("[data-compare]");
      if (againButton) {
        const label = againButton.getAttribute("data-compare") || "";
        if (!label) return;
        addHistory({ label, kind: againButton.getAttribute("data-kind") || "medicine" });
        go(label);
      }
    },
    { signal }
  );

  els.clearBtn.addEventListener(
    "click",
    () => {
      if (!getHistory().length) {
        toast("History is already empty.");
        return;
      }
      if (!window.confirm("Clear all locally saved history? This cannot be undone.")) return;

      clearHistory();
      renderHistory();
      toast("Local history cleared.");
    },
    { signal }
  );

  root.querySelectorAll<HTMLAnchorElement>("[data-go]").forEach((link) => {
    link.href = targetUrl();
    link.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        go();
      },
      { signal }
    );
  });

  root.querySelectorAll<HTMLButtonElement>("[data-quick]").forEach((button) => {
    button.addEventListener(
      "click",
      () => {
        const label = button.getAttribute("data-quick") || "";
        if (!label) return;
        // Only signed-in searches are kept; guests go straight to the engine.
        if (isSignedIn()) addHistory({ label, kind: button.getAttribute("data-kind") || "medicine" });
        go(label);
      },
      { signal }
    );
  });

  els.navSignin.addEventListener(
    "click",
    () => {
      const account = root.querySelector<HTMLElement>("#account") || els.panel;
      account.scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "start",
      });
      if (isSignedIn()) {
        toast("Your history is below.");
        return;
      }
      window.clearTimeout(focusTimer);
      focusTimer = window.setTimeout(() => els.authEmail.focus({ preventScroll: true }), 320);
    },
    { signal }
  );

  const onStorage = (event: StorageEvent): void => {
    if (!event.key || !event.key.startsWith("medpulse:")) return;
    render();
  };
  window.addEventListener("storage", onStorage, { signal });

  render();

  return () => {
    controller.abort();
    window.clearTimeout(toastTimer);
    window.clearTimeout(signInTimer);
    window.clearTimeout(focusTimer);
  };
}
