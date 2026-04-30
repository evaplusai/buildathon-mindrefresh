interface MarketingLogoProps {
  size?: number;
}

/**
 * MarketingLogo — the 3-circle logo mark.
 *
 * SVG sourced verbatim from docs/03_designs/MindRefreshStudio v2.html
 * lines 358–362 (nav logo-mark). Used in: nav, final-CTA, footer.
 * Per ADR-014: single source to avoid drift.
 *
 * Default size: 28×28. Pass `size` prop to override both width and height.
 * Stroke colour: #27500A (--green-800). Inner circle fill: #27500A.
 */
export default function MarketingLogo({ size = 28 }: MarketingLogoProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      width={size}
      height={size}
      aria-hidden="true"
    >
      <circle cx="16" cy="16" r="14" stroke="#27500A" strokeWidth="1.2" />
      <circle cx="16" cy="16" r="9" stroke="#27500A" strokeWidth="1" opacity="0.5" />
      <circle cx="16" cy="16" r="3.5" fill="#27500A" />
    </svg>
  );
}
