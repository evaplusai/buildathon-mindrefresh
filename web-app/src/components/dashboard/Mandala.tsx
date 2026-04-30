/**
 * Mandala — animated 3-ring + core SVG.
 *
 * 200×200 viewbox. Three rings (r=86,64,42) with stroke-dasharray patterns.
 * One ring-core (r=14). State-keyed colour + animation duration per ADR-015
 * and design HTML lines 189–207, 808–815.
 *
 * Ring rotation durations per state:
 *   steady:     32s / 22s / 16s   (calm, slow)
 *   shifting:   24s / 24s / 24s   (all same — design HTML line 196)
 *   overloaded: 14s / 14s / 14s   (fast — line 198)
 *   drained:    48s / 48s / 48s   (very slow — line 200)
 */

import type { DashboardState } from '../../types/display';

interface MandalaProps {
  dashboardState: DashboardState;
  /** When true, replaces keyframe animations with discrete static opacity (prefers-reduced-motion). */
  reducedMotion?: boolean;
}

const STATE_COLORS: Record<DashboardState, string> = {
  steady: 'var(--state-steady)',
  shifting: 'var(--state-shifting)',
  overloaded: 'var(--state-overloaded)',
  drained: 'var(--state-drained)',
};

/** Ring stroke colour — steady uses the 3-rung palette; others use state colour. */
const RING_STROKES: Record<DashboardState, [string, string, string]> = {
  steady: ['#7FB13C', '#639922', '#3B6D11'],
  shifting: ['#C99B4F', '#C99B4F', '#C99B4F'],
  overloaded: ['#C97A6B', '#C97A6B', '#C97A6B'],
  drained: ['#6B7558', '#6B7558', '#6B7558'],
};

/** Animation durations per state [ring1, ring2, ring3, core]. */
const ANIM_DURATIONS: Record<DashboardState, [string, string, string, string]> = {
  steady: ['32s', '22s', '16s', '5s'],
  shifting: ['24s', '24s', '24s', '4s'],
  overloaded: ['14s', '14s', '14s', '2.4s'],
  drained: ['48s', '48s', '48s', '8s'],
};

export function Mandala({ dashboardState, reducedMotion = false }: MandalaProps) {
  const [r1, r2, r3] = RING_STROKES[dashboardState];
  const [d1, d2, d3, d4] = ANIM_DURATIONS[dashboardState];
  const coreColor = STATE_COLORS[dashboardState];

  const ringAnimation = (duration: string, reverse = false) =>
    reducedMotion
      ? undefined
      : `ring-rotate ${duration} linear infinite ${reverse ? 'reverse' : ''}`.trim();

  const coreAnimation = reducedMotion
    ? undefined
    : `ring-breathe ${d4} ease-in-out infinite`;

  return (
    <svg
      viewBox="0 0 200 200"
      aria-hidden="true"
      style={{ width: '100%', height: '100%', overflow: 'visible' }}
    >
      {/* Keyframe definitions — only injected once per render */}
      <defs>
        <style>{`
          @keyframes ring-rotate { to { transform: rotate(360deg); } }
          @keyframes ring-breathe {
            0%, 100% { transform: scale(1); opacity: 0.9; }
            50% { transform: scale(1.18); opacity: 1; }
          }
        `}</style>
      </defs>

      {/* Ring 1 — outermost */}
      <circle
        cx="100" cy="100" r="86"
        fill="none"
        stroke={r1}
        strokeWidth="1.5"
        strokeDasharray="2 6"
        style={{
          transformOrigin: '100px 100px',
          animation: ringAnimation(d1),
        }}
      />

      {/* Ring 2 — middle (reverses) */}
      <circle
        cx="100" cy="100" r="64"
        fill="none"
        stroke={r2}
        strokeWidth="1.5"
        strokeDasharray="3 4"
        style={{
          transformOrigin: '100px 100px',
          animation: ringAnimation(d2, true),
        }}
      />

      {/* Ring 3 — inner */}
      <circle
        cx="100" cy="100" r="42"
        fill="none"
        stroke={r3}
        strokeWidth="1.5"
        strokeDasharray="1 3"
        style={{
          transformOrigin: '100px 100px',
          animation: ringAnimation(d3),
        }}
      />

      {/* Core dot */}
      <circle
        cx="100" cy="100" r="14"
        fill={coreColor}
        style={{
          transformOrigin: '100px 100px',
          animation: coreAnimation,
          opacity: reducedMotion ? 1 : 0.9,
        }}
      />
    </svg>
  );
}

export default Mandala;
