/**
 * Fixed ambient mesh behind the whole app.
 * Pure CSS (no client JS): the six blobs drift and pulse on long cycles.
 */
export function SiteAmbient() {
  return (
    <div className="site-ambient" aria-hidden="true">
      <span className="site-blob site-blob-1" />
      <span className="site-blob site-blob-2" />
      <span className="site-blob site-blob-3" />
      <span className="site-blob site-blob-4" />
      <span className="site-blob site-blob-5" />
      <span className="site-blob site-blob-6" />
      <span className="site-ambient-veil" />
      <span className="site-ambient-grain" />
    </div>
  );
}
