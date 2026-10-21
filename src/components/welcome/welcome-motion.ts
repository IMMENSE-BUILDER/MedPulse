/**
 * Scroll choreography for the welcome page.
 *
 * Writes `--hero-p` / `--hero-fade` on the welcome root for the CSS parallax,
 * forwards progress to the Three.js scene via `medpulse:scroll`, and reveals
 * sections with a staggered IntersectionObserver.
 *
 * Reduced motion opts out entirely: the page is fully visible and static.
 */

export function initWelcomeMotion(root: HTMLElement): () => void {
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const hero = root.querySelector<HTMLElement>(".hero");
  const revealItems = Array.from(root.querySelectorAll<HTMLElement>(".reveal"));

  if (!hero) return () => {};

  let disposed = false;
  let raf = 0;
  let heroHeight = hero.offsetHeight;
  let lastProgress = -1;
  let observer: IntersectionObserver | null = null;

  const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

  const revealAll = (): void => {
    for (const item of revealItems) item.classList.add("is-visible");
  };

  const measureHero = (): void => {
    heroHeight = hero.offsetHeight;
  };

  const update = (): void => {
    raf = 0;
    if (disposed || motionQuery.matches) return;

    const progress = clamp(-hero.getBoundingClientRect().top / (heroHeight || 1), 0, 1);
    const fade = clamp((progress - 0.35) / 0.6, 0, 1);

    root.style.setProperty("--hero-p", progress.toFixed(3));
    root.style.setProperty("--hero-fade", fade.toFixed(3));

    if (Math.abs(progress - lastProgress) > 0.001) {
      lastProgress = progress;
      window.dispatchEvent(new CustomEvent("medpulse:scroll", { detail: { progress } }));
    }
  };

  const schedule = (): void => {
    if (raf || disposed) return;
    raf = window.requestAnimationFrame(update);
  };

  const onResize = (): void => {
    measureHero();
    schedule();
  };

  const onMotionChange = (): void => {
    if (motionQuery.matches) {
      root.classList.remove("motion-on");
      revealAll();
    } else {
      root.classList.add("motion-on");
    }
    measureHero();
    schedule();
  };

  const controller = new AbortController();
  const { signal } = controller;

  if (motionQuery.matches || !("IntersectionObserver" in window)) {
    revealAll();
    return () => {};
  }

  root.classList.add("motion-on");

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        observer?.unobserve(entry.target);
      }
    },
    { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
  );

  for (const item of revealItems) observer.observe(item);

  measureHero();
  update();

  window.addEventListener("scroll", schedule, { passive: true, signal });
  window.addEventListener("resize", onResize, { signal });
  window.addEventListener("load", onResize, { signal });
  window.addEventListener("pageshow", onResize, { signal });
  motionQuery.addEventListener("change", onMotionChange);

  // Webfonts can change the hero height after first paint.
  document.fonts?.ready
    .then(() => {
      if (disposed) return;
      measureHero();
      schedule();
    })
    .catch(() => {
      /* font loading is best-effort */
    });

  return () => {
    disposed = true;
    controller.abort();
    observer?.disconnect();
    window.cancelAnimationFrame(raf);
    motionQuery.removeEventListener("change", onMotionChange);
    root.classList.remove("motion-on");
    root.style.removeProperty("--hero-p");
    root.style.removeProperty("--hero-fade");
  };
}
