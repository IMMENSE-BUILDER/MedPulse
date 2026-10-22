/**
 * Brand lockup — blister-grid badge + "MedPulse AI" wordmark (logo pick L51).
 * Text inherits the surrounding font (Geist) and colour (currentColor);
 * the accent follows the theme tokens.
 */
export function Logo({ className, label = "MedPulse AI" }: { className?: string; label?: string }) {
  return (
    <svg
      viewBox="0 0 320 96"
      role="img"
      aria-label={label}
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="18" y="18" width="60" height="60" rx="18" fill="#ffffff" />
      <circle cx="37" cy="37" r="8" fill="#ffffff" stroke="var(--color-brand, #0000ff)" strokeWidth="3.5" />
      <circle cx="59" cy="37" r="8" fill="var(--color-brand, #0000ff)" />
      <circle cx="37" cy="59" r="8" fill="#ffffff" stroke="var(--color-brand, #0000ff)" strokeWidth="3.5" />
      <circle cx="59" cy="59" r="8" fill="#ffffff" stroke="var(--color-brand-2, #0000ff)" strokeWidth="3.5" />
      <text x="96" y="60" fontSize="30" fontWeight="700" fill="currentColor">
        {"MedPulse "}
        <tspan fill="var(--color-brand, #0000ff)">AI</tspan>
      </text>
    </svg>
  );
}
