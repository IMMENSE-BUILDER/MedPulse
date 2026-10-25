"use client";

import { useEffect, useRef } from "react";
import {
  ArrowUpRight,
  BadgeCheck,
  ChevronDown,
  FlaskConical,
  Landmark,
  LockKeyhole,
  Pill,
  ReceiptText,
  ScanLine,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLanguage } from "@/lib/i18n";
import { initWelcomeAuth } from "./welcome-auth";
import { initWelcomeMotion } from "./welcome-motion";
import { WelcomeScene } from "./WelcomeScene";

const SOURCES = [
  "PMBJP",
  "Jan Aushadhi",
  "AMRIT",
  "Tata 1mg",
  "PharmEasy",
  "Apollo",
  "Netmeds",
  "SayaCare",
  "Truemeds",
  "Zeelab",
  "Redcliffe Labs",
  "Lal PathLabs",
  "Orange Health",
];

const TRACKS = [
  {
    mark: "A",
    tag: "Track A · Government",
    title: "PMBJP benchmark",
    body: "The official Jan Aushadhi ceiling price per 10 tablets, plus the nearest walk-in Kendra for the salt you searched.",
    meta: "Jan Aushadhi · per 10 tabs",
    icon: <Landmark size={17} strokeWidth={1.6} aria-hidden="true" />,
  },
  {
    mark: "B",
    tag: "Track B · Generics",
    title: "Subsidised generics",
    body: "Listings matched by active salt and exact strength, with a NABL batch report shown wherever the portal publishes one.",
    meta: "Salt + strength matched",
    icon: <Pill size={17} strokeWidth={1.6} aria-hidden="true" />,
  },
  {
    mark: "C",
    tag: "Track C · Branded",
    title: "Branded express",
    body: "The original brands you were prescribed, with pincode stock and delivery ETA verified on demand by a live browser agent.",
    meta: "Pincode stock · live agent",
    icon: <Store size={17} strokeWidth={1.6} aria-hidden="true" />,
  },
  {
    mark: "D",
    tag: "Track D · Labs",
    title: "Diagnostic labs",
    body: "Package prices, included parameters and the earliest home-collection slot across tracked NABL-accredited labs.",
    meta: "NABL labs · home collection",
    icon: <FlaskConical size={17} strokeWidth={1.6} aria-hidden="true" />,
  },
];

const STEPS = [
  {
    number: "01",
    title: "Search the label",
    body: "Type the brand you were prescribed, the salt name, or a lab test. No account and no upload required to start.",
    meta: "brand · salt · lab test",
    icon: <Search size={18} strokeWidth={1.6} aria-hidden="true" />,
  },
  {
    number: "02",
    title: "Decode the exact salt",
    body: "MedPulse maps the brand to its active salt and strength before it compares anything. A 500 mg listing cannot stand in for a 650 mg query.",
    meta: "active salt · exact strength",
    icon: <ScanLine size={18} strokeWidth={1.6} aria-hidden="true" />,
  },
  {
    number: "03",
    title: "Read the receipt",
    body: "Four tracks, one normalised per-10-tablet answer. Every offer carries its source host, verification state and an as-of timestamp.",
    meta: "4 tracks · visible provenance",
    icon: <ReceiptText size={18} strokeWidth={1.6} aria-hidden="true" />,
  },
];

const RECEIPT_ROWS = [
  { code: "A", name: "PMBJP ceiling", width: "36%", tag: "benchmark" },
  { code: "B", name: "Subsidised generic", width: "48%", tag: "strength match" },
  { code: "C", name: "Branded express", width: "94%", tag: "source + time" },
  { code: "D", name: "Diagnostic lab", width: "61%", tag: "NABL package" },
];

const FAQS = [
  {
    question: "Are these live prices?",
    answer:
      "The engine labels every result as live or demo. Live results carry the source host and the time they were read; demo fixtures are never dressed up as live. This page is an illustration of the comparison structure.",
  },
  {
    question: "What does the strength guard actually do?",
    answer:
      "It checks the active salt and the exact strength before an offer can appear. A 500 mg strip is not allowed to stand in for a 650 mg search, even when the pack looks cheaper.",
  },
  {
    question: "Do I need an account?",
    answer:
      "No. You can open the price engine and compare without signing in. The account on this page is a local demo that keeps a short history in this browser only - there is no password, server or real login.",
  },
  {
    question: "Does MedPulse sell medicine or lab tests?",
    answer:
      "No. MedPulse compares published prices and links out to the source. It does not take payments, add items to a cart or provide medical advice. Confirm the final amount at checkout and with a pharmacist or doctor.",
  },
];

function AccountPanel() {
  return (
    <section className="panel reveal" id="panel" aria-labelledby="panel-title">
      <div className="panel-head">
        <h2 id="panel-title">Sign in</h2>
        <span className="panel-chip" id="panel-chip">
          local only
        </span>
      </div>

      <div id="auth-view">
        <p className="panel-sub">
          Keep the medicines, lab tests and prescriptions you check &mdash; saved in this browser, never on a server.
        </p>

        <form id="auth-form" noValidate>
          <div className="field">
            <label htmlFor="auth-name">
              Your name <span className="opt">optional</span>
            </label>
            <input id="auth-name" name="name" type="text" autoComplete="name" maxLength={60} placeholder="Satyam" />
          </div>
          <div className="field">
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              name="email"
              type="email"
              autoComplete="email"
              maxLength={120}
              placeholder="you@example.com"
            />
          </div>
          <div className="field">
            <label htmlFor="auth-pass">Password</label>
            <div className="pass-wrap">
              <input
                id="auth-pass"
                name="password"
                type="password"
                autoComplete="current-password"
                minLength={6}
                placeholder="At least 6 characters"
              />
              <button
                type="button"
                id="pass-toggle"
                className="pass-toggle"
                aria-label="Show password"
                aria-pressed="false"
              >
                Show
              </button>
            </div>
          </div>
          <p className="form-error" id="auth-error" role="alert" />
          <button className="btn primary block" id="auth-submit" type="submit">
            Sign in
          </button>
        </form>

        <div className="panel-alt">
          <button className="link" type="button" id="guest-btn">
            Continue without an account →
          </button>
          <button className="link" type="button" id="demo-fill">
            Use demo details
          </button>
        </div>

        <p className="micro">
          Demo sign-in &mdash; no account is created, no password is stored, and nothing leaves this browser.
        </p>
      </div>

      <div id="history-view" hidden>
        <div className="who">
          <span className="avatar" id="who-initial">
            M
          </span>
          <span className="who-text">
            <span className="who-name" id="who-name">
              Your history
            </span>
            <span className="who-mail" id="who-mail">
              stored in this browser
            </span>
          </span>
          <button className="link" type="button" id="signout-btn">
            Sign out
          </button>
        </div>

        <form id="add-form" className="add-form">
          <input id="add-label" maxLength={120} placeholder="Add a medicine, test or note" aria-label="History entry" />
          <select id="add-kind" aria-label="Entry type" defaultValue="medicine">
            <option value="medicine">Medicine</option>
            <option value="lab">Lab</option>
            <option value="rx">Rx</option>
            <option value="note">Note</option>
          </select>
          <button type="submit" className="btn ghost sm">
            Add
          </button>
        </form>

        <div className="hist-head">
          <span>Recent</span>
          <span className="mono" id="hist-count">
            0 entries
          </span>
        </div>
        <ul className="hist" id="history-list" />

        <div className="hist-foot">
          <a className="btn primary block" data-go href="/engine">
            Open the price engine <span aria-hidden="true">→</span>
          </a>
          <button className="link danger" type="button" id="clear-btn">
            Clear history
          </button>
        </div>
        <p className="micro">Stored only in this browser (localStorage). Nothing is uploaded &mdash; avoid using this on a shared device.</p>
      </div>
    </section>
  );
}

/**
 * The public welcome page. Marketing content + the procedural 3D hero + the
 * local-only history panel. The price engine lives at /engine; every CTA hands
 * off there with the same ?q=&pin= contract the engine already hydrates.
 */
export function WelcomePage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const { tr } = useLanguage();

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    // WelcomeScene's effect runs first (child), so it is already listening for
    // the scroll/theme events these modules dispatch.
    const cleanupMotion = initWelcomeMotion(root);
    let cleanupAuth: (() => void) | undefined;

    try {
      cleanupAuth = initWelcomeAuth(root);
    } catch (error) {
      // The panel markup is static; if wiring fails the form is still visible.
      console.warn("[welcome] history panel wiring failed:", error);
    }

    return () => {
      cleanupMotion();
      cleanupAuth?.();
    };
  }, []);

  return (
    <div className="welcome-root" ref={rootRef}>
      <a className="skip" href="#main">
        {tr("Skip to content", "मुख्य भाग पर जाएँ")}
      </a>

        <header className="nav">
          <div className="wrap nav-inner">
            <a className="brand" href="#top" aria-label="MedPulse AI home">
              <Logo className="welcome-brand" />
            </a>
            <span className="nav-pill" aria-hidden="true">
              <i /> 4 tracks
            </span>

            <nav className="nav-links" aria-label="Sections">
              <a href="#tracks">{tr("Tracks", "ट्रैक")}</a>
              <a href="#how">{tr("How it works", "यह कैसे काम करता है")}</a>
              <a href="#fair">{tr("Why it’s fair", "यह क्यों सही है")}</a>
              <a href="#engine">{tr("Price engine", "कीमत इंजन")}</a>
            </nav>

            <div className="nav-actions">
              <LanguageToggle />
              <button id="nav-signin" className="btn ghost sm" type="button">
                {tr("Sign in", "साइन इन")}
              </button>
            </div>
          </div>
        </header>

        <main id="main">
          <section className="hero" id="top">
            <div className="hero-ambient" aria-hidden="true">
              <span className="hero-blob hero-blob-1" />
              <span className="hero-blob hero-blob-2" />
              <span className="hero-blob hero-blob-3" />
              <span className="hero-ambient-scrim" />
            </div>

            <div className="hero-grid wrap">
              <div className="hero-copy">
                <p className="eyebrow">
                  <span className="eyebrow-long">Track A PMBJP · B Generics · C Branded · D Labs</span>
                  <span className="eyebrow-short">PMBJP · Generics · Branded · Labs</span>
                </p>
                <h1>
                  {tr("One search prices your medicine", "एक खोज में आपकी दवा की कीमत")}{" "}
                  <em>{tr("four ways.", "चार तरह से।")}</em>
                </h1>
                <p className="lede">
                  {tr(
                    "MedPulse decodes a brand to its active salt, checks the government PMBJP benchmark, matches subsidised generics and branded express listings by exact strength, and prices diagnostic lab packages — every figure normalised per 10 tablets so pack sizes can’t hide the real cost.",
                    "MedPulse आपकी दवा के ब्रांड को उसके सॉल्ट में बदलता है, सरकारी PMBJP कीमत देखता है, सही स्ट्रेंथ वाली सस्ती जेनेरिक और ब्रांडेड दवाइयाँ ढूँढता है, और लैब टेस्ट के पैकेज भी तुलना करता है — हर कीमत 10 गोली के हिसाब से, ताकि पैक साइज़ से असली कीमत न छिपे।",
                  )}
                </p>

                <ul className="proof">
                  <li>
                    <span className="dot" />
                    {tr("Per-10-tab pricing", "10 गोली की कीमत")}
                  </li>
                  <li>
                    <span className="dot" />
                    {tr("Strength guard", "सही स्ट्रेंथ की जाँच")}
                  </li>
                  <li>
                    <span className="dot" />
                    {tr("Visible provenance", "हर कीमत का स्रोत")}
                  </li>
                </ul>

                <div className="cta-row">
                  <a className="btn primary" data-go href="/engine">
                    {tr("Enter price engine", "कीमत इंजन खोलें")} <ArrowUpRight size={15} strokeWidth={2} aria-hidden="true" />
                  </a>
                  <a className="btn ghost" href="#how">
                    {tr("See how it works", "यह कैसे काम करता है")}
                  </a>
                </div>
                <p className="micro">
                  {tr(
                    "Indicative prices — confirm the final amount at checkout and with a pharmacist.",
                    "कीमतें सिर्फ जानकारी के लिए हैं — खरीदने से पहले और फार्मासिस्ट से अंतिम कीमत ज़रूर पुष्टि करें।",
                  )}
                </p>
              </div>

              <div className="hero-visual">
                <WelcomeScene />

                <span className="scene-label scene-label-a" aria-hidden="true">
                  <b>A</b> PMBJP
                </span>
                <span className="scene-label scene-label-b" aria-hidden="true">
                  <b>B</b> Generic
                </span>
                <span className="scene-label scene-label-c" aria-hidden="true">
                  <b>C</b> Branded
                </span>
                <span className="scene-label scene-label-d" aria-hidden="true">
                  <b>D</b> Labs
                </span>

                <div className="scene-hud scene-hud-tl" aria-hidden="true">
                  <span>SPECIMEN 01</span>
                  <span>ORAL SOLID</span>
                </div>
                <div className="scene-hud scene-hud-br" aria-hidden="true">
                  <span>4 TRACKS</span>
                  <span>1 ANSWER</span>
                </div>
                <span className="stage-scan" aria-hidden="true" />

                <div className="scene-legend" aria-hidden="true">
                  <span><b>A</b> PMBJP</span>
                  <span><b>B</b> Generic</span>
                  <span><b>C</b> Branded</span>
                  <span><b>D</b> Labs</span>
                </div>
              </div>
            </div>

            <div className="hero-foot wrap">
              <div className="quick">
                <span className="quick-label">{tr("Try a search", "खोज करें")}</span>
                <button className="chip" type="button" data-quick="Augmentin 625 Duo" data-kind="medicine">
                  Augmentin 625 Duo
                </button>
                <button className="chip" type="button" data-quick="Dolo 650" data-kind="medicine">
                  Dolo 650
                </button>
                <button className="chip" type="button" data-quick="HbA1c" data-kind="lab">
                  HbA1c
                </button>
                <button className="chip" type="button" data-quick="Full Body Checkup" data-kind="lab">
                  Full body checkup
                </button>
              </div>
              <div className="scroll-cue" aria-hidden="true">
                <span />
              </div>
            </div>
          </section>

          <section
            className="portal-strip"
            aria-label="MedPulse checks PMBJP, Jan Aushadhi, AMRIT and tracked pharmacy and lab portals. No affiliation is implied."
          >
            <div className="wrap portal-strip-inner">
              <span className="portal-strip-label">Checks across</span>
              <div className="portal-rail" aria-hidden="true">
                <div className="portal-track">
                  {[...SOURCES, ...SOURCES].map((source, index) => (
                    <span key={`${source}-${index}`}>{source}</span>
                  ))}
                </div>
              </div>
              <span className="portal-strip-note">not a partnership</span>
            </div>
          </section>

          <section className="wrap section" id="tracks">
            <div className="section-head reveal">
              <p className="eyebrow">01 / Four tracks, one answer</p>
              <h2>What a single search actually checks</h2>
              <p className="section-sub">
                One query opens four independent price paths, then brings them back to the same per-10-tablet unit.
              </p>
            </div>
            <div className="tracks">
              {TRACKS.map((track) => (
                <article className="card track-card reveal" key={track.mark}>
                  <div className="track-top">
                    <span className="track-mark" aria-hidden="true">
                      {track.mark}
                    </span>
                    <span className="card-tag">{track.tag}</span>
                    <span className="track-icon">{track.icon}</span>
                  </div>
                  <h3>{track.title}</h3>
                  <p>{track.body}</p>
                  <span className="track-foot">{track.meta}</span>
                </article>
              ))}
            </div>
          </section>

          <section className="wrap section" id="how">
            <div className="section-head reveal">
              <p className="eyebrow">02 / The path</p>
              <h2>From a brand name to a receipt.</h2>
              <p className="section-sub">
                The comparison happens in public: decode the salt, guard the strength, then show every source.
              </p>
            </div>
            <ol className="steps">
              {STEPS.map((step) => (
                <li className="step reveal" key={step.number}>
                  <span className="step-num" aria-hidden="true">
                    {step.number}
                  </span>
                  <span className="step-icon">{step.icon}</span>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                  <span className="step-meta">{step.meta}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="wrap section" id="fair">
            <div className="proof-grid">
              <div className="proof-copy reveal">
                <p className="eyebrow">03 / The receipt</p>
                <h2>The answer is a receipt, not a vibe.</h2>
                <p className="section-sub">
                  Every comparison ends with a normalised price, a strength match, a source host and an as-of
                  timestamp. No mystery numbers. Demo data is always labelled.
                </p>

                <ul className="proof-points">
                  <li>
                    <span className="point-icon">
                      <ReceiptText size={17} strokeWidth={1.6} aria-hidden="true" />
                    </span>
                    <div>
                      <strong>Fair by the tablet.</strong>
                      <span>Strips of 10, 15 or 20 are normalised to the same per-10-tablet unit.</span>
                    </div>
                  </li>
                  <li>
                    <span className="point-icon">
                      <ShieldCheck size={17} strokeWidth={1.6} aria-hidden="true" />
                    </span>
                    <div>
                      <strong>Strength-guarded.</strong>
                      <span>Salt and exact strength are checked before a price can appear.</span>
                    </div>
                  </li>
                  <li>
                    <span className="point-icon">
                      <BadgeCheck size={17} strokeWidth={1.6} aria-hidden="true" />
                    </span>
                    <div>
                      <strong>Provenance on every card.</strong>
                      <span>Source host, verification state, NABL batch when published, and a timestamp.</span>
                    </div>
                  </li>
                </ul>

                <a className="btn ghost proof-cta" href="#engine">
                  See it on a real query <ArrowUpRight size={15} strokeWidth={2} aria-hidden="true" />
                </a>
              </div>

              <figure className="receipt reveal">
                <div className="receipt-head">
                  <span>MEDPULSE / COMPARISON</span>
                  <span className="receipt-live">
                    <i /> 4 tracks
                  </span>
                </div>

                <div className="receipt-title">
                  <div>
                    <span className="receipt-query">Dolo 650</span>
                    <span className="receipt-sub">example query · demo structure</span>
                  </div>
                  <span className="receipt-unit">per 10 tablets</span>
                </div>

                <div className="receipt-rows">
                  {RECEIPT_ROWS.map((row) => (
                    <div className="receipt-row" key={row.code}>
                      <span className="receipt-code">{row.code}</span>
                      <span className="receipt-name">{row.name}</span>
                      <span className="receipt-bar" aria-hidden="true">
                        <i style={{ width: row.width }} />
                      </span>
                      <span className="receipt-tag">{row.tag}</span>
                    </div>
                  ))}
                </div>

                <div className="receipt-meta">
                  <span>Salt + strength checked</span>
                  <span>Source · as of</span>
                </div>
                <div className="receipt-foot">
                  <span>ILLUSTRATIVE LAYOUT</span>
                  <span>OPEN ENGINE →</span>
                </div>
                <figcaption>
                  Structure only, not a live quote. The engine shows live or labelled demo prices with provenance.
                </figcaption>
              </figure>
            </div>
          </section>

          <section className="wrap account section" id="account">
            <div className="account-grid">
              <div className="account-copy reveal">
                <p className="eyebrow">04 / Local account</p>
                <h2>
                  Keep every check. <em>Not your data.</em>
                </h2>
                <p className="section-sub">
                  An account here is a small convenience, not a database. Your short history is stored in this browser
                  and is always yours to clear.
                </p>
                <ul className="account-points">
                  <li>
                    <LockKeyhole size={15} strokeWidth={1.7} aria-hidden="true" /> No password is ever stored
                  </li>
                  <li>
                    <ShieldCheck size={15} strokeWidth={1.7} aria-hidden="true" /> Nothing leaves this browser
                  </li>
                  <li>
                    <Sparkles size={15} strokeWidth={1.7} aria-hidden="true" /> Any demo details work
                  </li>
                </ul>
                <p className="micro account-note">
                  Sign-in is a local demo. It does not create an account, call a server or unlock paid features.
                </p>
              </div>

              <AccountPanel />
            </div>
          </section>

          <section className="wrap section" id="faq">
            <div className="faq-grid">
              <div className="section-head reveal">
                <p className="eyebrow">05 / Straight answers</p>
                <h2>Before you trust a number.</h2>
                <p className="section-sub">
                  The short version of how MedPulse stays useful without pretending to be a pharmacy or a doctor.
                </p>
              </div>
              <div className="faq-list reveal">
                {FAQS.map((item) => (
                  <details className="faq-item" key={item.question}>
                    <summary>
                      <span>{item.question}</span>
                      <ChevronDown size={16} strokeWidth={1.8} aria-hidden="true" />
                    </summary>
                    <p>{item.answer}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>

          <section className="wrap" id="engine">
            <div className="cta-band reveal">
              <div className="cta-copy">
                <p className="eyebrow">
                  <Sparkles size={12} strokeWidth={1.8} aria-hidden="true" /> The live app
                </p>
                <h2>One search. Four tracks. A receipt.</h2>
                <p>No account needed to compare. Open the engine and see the normalised answer for yourself.</p>
              </div>
              <div className="cta-actions">
                <a className="btn primary" data-go href="/engine">
                  Open the price engine <ArrowUpRight size={15} strokeWidth={2} aria-hidden="true" />
                </a>
                <span className="cta-note">Indicative prices · confirm at checkout</span>
              </div>
            </div>
          </section>
        </main>

        <footer className="footer">
          <div className="wrap footer-inner">
            <div className="footer-top">
              <div className="footer-brand">
                <Logo className="welcome-footer-brand" label="MedPulse AI" />
              </div>
              <nav className="footer-links" aria-label="Footer">
                <a href="#tracks">Tracks</a>
                <a href="#how">How it works</a>
                <a href="#fair">Receipt</a>
                <a href="#engine">Price engine</a>
              </nav>
            </div>
            <p className="footer-note">
              Informational tool, not medical advice. Prices are indicative and change often &mdash; confirm at
              checkout and with a doctor or pharmacist. Emergencies: 108 / 112.
            </p>
            <p className="footer-meta">MedPulse AI &middot; By Satyam Kumar</p>
          </div>
        </footer>

        <div className="toast" id="toast" role="status" aria-live="polite" />

        <noscript>
          <p className="wrap noscript">
            This page uses JavaScript for the 3D scene and the local history panel. The price engine links above still
            work.
          </p>
        </noscript>
    </div>
  );
}
