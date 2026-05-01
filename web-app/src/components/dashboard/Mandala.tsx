/**
 * Mandala — descending-spiral state gauge.
 *
 * 200×200 viewBox. A single dashed spiral runs from a wide loop at the top
 * to a tight loop at the bottom. A coloured ball travels along the spiral
 * path: top = steady (wide, open), bottom = drained (tight, collapsed).
 *
 * State changes animate the ball along the actual path (path-sampled
 * requestAnimationFrame loop) so the motion follows the spiral curve
 * instead of cutting a chord. Stroke + ball colour transition with state.
 *
 * Replaces the previous 3-ring + core mandala (Sprint A) per visual-redesign
 * request: "show spiraling instead circle, ball moves down to show states".
 */

import { useEffect, useRef } from 'react';
import type { DashboardState } from '../../types/display';

interface MandalaProps {
  dashboardState: DashboardState;
  /** When true, replaces keyframe / RAF animations with discrete static
   *  positioning (prefers-reduced-motion). */
  reducedMotion?: boolean;
}

/** Fractional position along the spiral [0..1] for each state.
 *  Steady = 0.05 (near top loop), drained = 0.95 (near tight inner). */
const STATE_T: Record<DashboardState, number> = {
  steady: 0.05,
  shifting: 0.36,
  overloaded: 0.66,
  drained: 0.95,
};

/** Ball fill colour per state. */
const BALL_COLOR: Record<DashboardState, string> = {
  steady: '#4F8418',
  shifting: '#C99B4F',
  overloaded: '#C97A6B',
  drained: '#6B7558',
};

/** Spiral stroke colour per state. */
const STROKE_COLOR: Record<DashboardState, string> = {
  steady: '#7FB13C',
  shifting: '#C99B4F',
  overloaded: '#C97A6B',
  drained: '#6B7558',
};

/** Pre-compute the spiral path — true 2D Archimedean spiral.
 *
 *   Centred at (100, 100). Radius shrinks linearly from 82 (outer loop)
 *   to 8 (centre) over 3 full turns, so each loop circles around fully.
 *   Ball at t=0 sits on the outer edge; t=1 collapses into the centre.
 */
function spiralPoint(t: number): [number, number] {
  const TURNS = 3;
  const angle = t * TURNS * 2 * Math.PI - Math.PI / 2;
  const radius = 82 - 74 * t;
  const x = 100 + radius * Math.cos(angle);
  const y = 100 + radius * Math.sin(angle);
  return [x, y];
}

const SPIRAL_POINTS: [number, number][] = (() => {
  const N = 200;
  const pts: [number, number][] = [];
  for (let i = 0; i <= N; i++) {
    pts.push(spiralPoint(i / N));
  }
  return pts;
})();

const SPIRAL_POLYLINE = SPIRAL_POINTS.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');

export function Mandala({ dashboardState, reducedMotion = false }: MandalaProps) {
  const polylineRef = useRef<SVGPolylineElement>(null);
  const ballRef = useRef<SVGCircleElement>(null);
  const currentTRef = useRef<number>(STATE_T[dashboardState]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const polyline = polylineRef.current;
    const ball = ballRef.current;
    if (!polyline || !ball) return;

    const totalLength = polyline.getTotalLength();
    const fromT = currentTRef.current;
    const toT = STATE_T[dashboardState];

    if (reducedMotion || fromT === toT) {
      const p = polyline.getPointAtLength(toT * totalLength);
      ball.setAttribute('cx', `${p.x}`);
      ball.setAttribute('cy', `${p.y}`);
      currentTRef.current = toT;
      return;
    }

    const startTime = performance.now();
    const duration = 1100;

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic — fast start, gentle settle.
      const eased = 1 - Math.pow(1 - progress, 3);
      const t = fromT + (toT - fromT) * eased;
      const p = polyline!.getPointAtLength(t * totalLength);
      ball!.setAttribute('cx', `${p.x}`);
      ball!.setAttribute('cy', `${p.y}`);
      currentTRef.current = t;
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [dashboardState, reducedMotion]);

  // SSR-friendly initial ball position: closest precomputed point.
  const initialIdx = Math.round(STATE_T[dashboardState] * (SPIRAL_POINTS.length - 1));
  const [initX, initY] = SPIRAL_POINTS[initialIdx];

  const ballColor = BALL_COLOR[dashboardState];
  const strokeColor = STROKE_COLOR[dashboardState];

  return (
    <svg
      viewBox="0 0 200 200"
      aria-hidden="true"
      style={{ width: '100%', height: '100%', overflow: 'visible' }}
    >
      <defs>
        <style>{`
          @keyframes ball-pulse {
            0%, 100% { r: 9; }
            50% { r: 11; }
          }
        `}</style>
      </defs>

      {/* The spiral track */}
      <polyline
        ref={polylineRef}
        points={SPIRAL_POLYLINE}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.4}
        strokeDasharray="2 4"
        strokeLinecap="round"
        style={{
          transition: 'stroke 700ms ease',
          opacity: 0.7,
        }}
      />

      {/* The travelling ball */}
      <circle
        ref={ballRef}
        cx={initX}
        cy={initY}
        r={9}
        fill={ballColor}
        style={{
          transition: 'fill 700ms ease',
          animation: reducedMotion ? undefined : 'ball-pulse 3.2s ease-in-out infinite',
          filter: `drop-shadow(0 0 4px ${ballColor})`,
        }}
      />
    </svg>
  );
}

export default Mandala;
