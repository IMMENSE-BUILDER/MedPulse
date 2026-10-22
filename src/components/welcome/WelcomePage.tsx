"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Logo } from "@/components/Logo";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLanguage } from "@/lib/i18n";
import { initWelcomeAuth } from "./welcome-auth";
import { initWelcomeMotion } from "./welcome-motion";
import { WelcomeScene } from "./WelcomeScene";

/**
 * The public welcome page. Marketing content + the procedural 3D hero + the
 * local-only history panel. The price engine lives at /engine; every CTA hands
 * off there with the same ?q=&pin= contract the engine already hydrates.
 */
export function WelcomePage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [introPhase, setIntroPhase] = useState<"intro" | "out" | "done">("intro");
  const { tr } = useLanguage();

  const finishIntro = useCallback((immediate = false) => {
    setIntroPhase((current) => {
      if (current !== "intro") return current;
      return immediate ? "done" : "out";
    });
  }, []);

  useEffect(() => {
    if (introPhase !== "out") return;
    const timer = window.setTimeout(() => setIntroPhase("done"), 1600);
    return () => window.clearTimeout(timer);
  }, [introPhase]);

  useEffect(() => {
    if (introPhase !== "intro") return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      videoRef.current?.pause();
      finishIntro(true);
      return;
    }

    const video = videoRef.current;
    if (video?.ended) {
      finishIntro();
      return;
    }

    // If autoplay is blocked, the video errors, or the end event is missed,
    // reveal the hero rather than trapping the page behind the intro.
    const fallback = window.setTimeout(() => finishIntro(), 11000);
    const attempt = video?.play();
    if (attempt && typeof attempt.catch === "function") {
      attempt.catch(() => finishIntro());
    }

    return () => window.clearTimeout(fallback);
  }, [finishIntro, introPhase]);

  useEffect(() => {
    if (introPhase !== "intro") return;
    const html = document.documentElement;
    const previous = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = previous;
    };
  }, [introPhase]);

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
    <div className={`welcome-root${introPhase === "intro" ? " intro-on" : ""}`} ref={rootRef}>
      {introPhase !== "done" ? (
        <div className={`welcome-intro${introPhase === "out" ? " is-out" : ""}`}>
          <div className="welcome-video-frame">
            <video
              ref={videoRef}
              src="/hero-intro.mp4"
              autoPlay
              muted
              playsInline
              preload="auto"
              aria-hidden="true"
              onEnded={() => finishIntro()}
              onError={() => finishIntro()}
            />
          </div>
          <button type="button" className="intro-skip" onClick={() => finishIntro()}>
            {tr("Skip intro", "इंट्रो छोड़ें")}
          </button>
        </div>
      ) : null}

      <div className="welcome-content">
        <a className="skip" href="#main">
          {tr("Skip to content", "मुख्य भाग पर जाएँ")}
        </a>

      <header className="nav">
        <div className="wrap nav-inner">
          <a className="brand" href="#top" aria-label="MedPulse AI home">
            <Logo className="welcome-brand" />
          </a>

          <nav className="nav-links" aria-label="Sections">
            <a href="#tracks">{tr("Tracks", "ट्रैक")}</a>
            <a href="#fair">{tr("Why it’s fair", "यह क्यों सही है")}</a>
            <a href="/engine">{tr("Price engine", "कीमत इंजन")}</a>
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

          <div className="hero-copy wrap">
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
                {tr("Enter price engine", "कीमत इंजन खोलें")} <span aria-hidden="true">→</span>
              </a>
              <a className="btn ghost" href="#fair">
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

          <WelcomeScene />

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

        <section className="wrap account section" id="account">
          <div className="section-head center reveal">
            <p className="eyebrow">Your account</p>
            <h2>Keep every check in one place.</h2>
            <p className="section-sub">A local demo &mdash; your history stays in this browser.</p>
          </div>

          <section className="panel reveal" id="panel" aria-labelledby="panel-title">
            <div className="panel-head">
              <h2 id="panel-title">Sign in</h2>
              <span className="panel-chip" id="panel-chip">
                local only
              </span>
            </div>

            <div id="auth-view">
              <p className="panel-sub">
                Keep the medicines, lab tests and prescriptions you check &mdash; saved in this browser, never on a
                server.
              </p>

              <form id="auth-form" noValidate>
                <div className="field">
                  <label htmlFor="auth-name">
                    Your name <span className="opt">optional</span>
                  </label>
                  <input
                    id="auth-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    maxLength={60}
                    placeholder="Satyam"
                  />
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
                <input
                  id="add-label"
                  maxLength={120}
                  placeholder="Add a medicine, test or note"
                  aria-label="History entry"
                />
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
              <p className="micro">
                Stored only in this browser (localStorage). Nothing is uploaded &mdash; avoid using this on a shared
                device.
              </p>
            </div>
          </section>
        </section>

        <section className="wrap section" id="tracks">
          <div className="section-head reveal">
            <p className="eyebrow">Four tracks, one answer</p>
            <h2>What a single search actually checks</h2>
          </div>
          <div className="tracks">
            <article className="card reveal">
              <span className="card-tag">Track A</span>
              <h3>PMBJP benchmark</h3>
              <p>
                The official Jan Aushadhi ceiling price per 10 tablets, plus the nearest walk-in Kendra for the salt
                you searched.
              </p>
            </article>
            <article className="card reveal">
              <span className="card-tag">Track B</span>
              <h3>Subsidised generics</h3>
              <p>
                Listings matched by active salt and exact strength, with a NABL batch report shown wherever the portal
                publishes one.
              </p>
            </article>
            <article className="card reveal">
              <span className="card-tag">Track C</span>
              <h3>Branded express</h3>
              <p>
                The original brands you were prescribed, with pincode stock and delivery ETA verified on demand by a
                live browser agent.
              </p>
            </article>
            <article className="card reveal">
              <span className="card-tag">Track D</span>
              <h3>Diagnostic labs</h3>
              <p>
                Package prices, included parameters and the earliest home-collection slot across tracked
                NABL-accredited labs.
              </p>
            </article>
          </div>
        </section>

        <section className="wrap section" id="fair">
          <div className="section-head reveal">
            <p className="eyebrow">No magic numbers</p>
            <h2>Why the comparison holds up</h2>
          </div>
          <div className="fair">
            <article className="card reveal">
              <h3>Fair by the tablet</h3>
              <p>
                Strips of 10, 15 or 20 are all normalised to a price per 10 tablets and per tablet, so a cheap-looking
                pack can&rsquo;t win on size alone.
              </p>
            </article>
            <article className="card reveal">
              <h3>Strength-guarded</h3>
              <p>
                A 500&nbsp;mg listing can never stand in for a 650&nbsp;mg search &mdash; salt and strength are checked
                before an offer is shown.
              </p>
            </article>
            <article className="card reveal">
              <h3>Provenance on every card</h3>
              <p>
                Source host, how the price was verified, the NABL batch when published and an &ldquo;as of&rdquo;
                timestamp &mdash; demo data is always labelled as demo.
              </p>
            </article>
          </div>
        </section>

        <section className="wrap" id="engine">
          <div className="cta-band reveal">
            <div>
              <h2>Ready when you are.</h2>
              <p>The price engine is the live app &mdash; no account needed to compare.</p>
            </div>
            <a className="btn primary" data-go href="/engine">
              Open the price engine <span aria-hidden="true">→</span>
            </a>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="wrap footer-inner">
          <div className="footer-brand">
            <Logo className="welcome-footer-brand" label="MedPulse AI" />
          </div>
          <p className="footer-note">
            Informational tool, not medical advice. Prices are indicative and change often &mdash; confirm at checkout
            and with a doctor or pharmacist. Emergencies: 108 / 112.
          </p>
          <p className="footer-meta">MedPulse AI &middot; By Satyam and Sujal</p>
        </div>
      </footer>

      <div className="toast" id="toast" role="status" aria-live="polite" />

      <noscript>
        <style>{`.welcome-intro{display:none!important}.welcome-root.intro-on .welcome-content{opacity:1!important;pointer-events:auto!important}`}</style>
        <p className="wrap noscript">
          This page uses JavaScript for the 3D scene and the local history panel. The price engine links above still
          work.
        </p>
      </noscript>
      </div>
    </div>
  );
}
