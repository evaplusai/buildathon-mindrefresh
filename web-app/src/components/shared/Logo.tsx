interface LogoProps {
  size?: number;
}

/**
 * Logo — the 3-circle MindRefresh brand mark.
 *
 * SVG sourced verbatim from docs/03_designs/MindRefreshStudio v2.html
 * lines 358–362. Used by both marketing AND dashboard surfaces — this
 * file lives in `components/shared/` so the ESLint isolation rules on
 * the marketing/dashboard split don't tag it as a boundary crossing.
 *
 * Default size: 28×28. Pass `size` prop to override.
 * Stroke colour: #27500A (--green-800). Inner circle fill: #27500A.
 */
export default function Logo({ size = 28 }: LogoProps) {
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
