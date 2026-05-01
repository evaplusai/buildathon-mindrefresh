/**
 * StateDial — hero card with state name, description, 4-rung ladder, and Mandala SVG.
 *
 * Per design HTML lines 132–207, 786–818.
 * - State name rendered in large serif, coloured per dashboardState.
 * - Window pill ("8 min before peak" / "Peak detected · reset queued") is
 *   visible only when windowOpenMinutes is provided and state is shifting/overloaded.
 * - Embeds StateLadder and Mandala as sub-components.
 * - `state-${dashboardState}` className enables CSS-variable scoping for
 *   future global CSS overrides if desired.
 */

import type { DashboardState } from '../../types/display';
import type { State } from '../../types/state';
import { Mandala } from './Mandala';
import { StateLadder } from './StateLadder';

export interface StateDiagProps {
  dashboardState: DashboardState;
  /** Raw 3-state worker classification (unused visually but useful for a11y). */
  internalState: State;
  /** Observational description per state (from STATES dict in design HTML). */
  description: string;
  /**
   * Minutes remaining in the pre-peak intervention window.
   * When provided for shifting/overloaded states, the window pill is shown.
   */
  windowOpenMinutes?: number;
}

const STATE_NAME: Record<DashboardState, string> = {
  steady: 'Steady',
  shifting: 'Shifting',
  overloaded: 'Overloaded',
  drained: 'Drained',
};

/** Text colour for the state name per design HTML lines 165–167. */
const STATE_NAME_CLASS: Record<DashboardState, string> = {
  steady: 'text-marketing-green-900',
  shifting: 'text-[#C99B4F]',
  overloaded: 'text-[#C97A6B]',
  drained: 'text-[#6B7558]',
};

/**
 * Radial gradient for the card ::before layer — state-keyed per design
 * HTML lines 142–144. Applied inline since pseudo-elements aren't Tailwind-able.
 */
const STATE_BG_GRADIENT: Record<DashboardState, string> = {
  steady:     'radial-gradient(circle at 70% 30%, rgba(99,153,34,0.08), transparent 60%)',
  shifting:   'radial-gradient(circle at 70% 30%, rgba(201,155,79,0.12), transparent 60%)',
  overloaded: 'radial-gradient(circle at 70% 30%, rgba(201,122,107,0.15), transparent 60%)',
  drained:    'radial-gradient(circle at 70% 30%, rgba(107,117,88,0.12), transparent 60%)',
};

/**
 * Pill content for every state — the pill is now always rendered so its
 * appearance/disappearance can't reflow the card layout.
 *  steady    → calm baseline note
 *  shifting  → pre-peak window with minute count
 *  overloaded → peak callout
 *  drained   → post-peak recovery note
 */
function pillContent(state: DashboardState, minutes?: number): { icon: string; text: string } {
  switch (state) {
    case 'steady':
      return { icon: '·', text: 'Holding baseline stable' };
    case 'shifting':
      return {
        icon: '↗',
        text:
          minutes != null
            ? `Caught ${minutes} min before peak`
            : 'Caught before peak',
      };
    case 'overloaded':
      return { icon: '▲', text: 'Peak detected · reset queued' };
    case 'drained':
      return { icon: '↘', text: 'After the peak · recovering' };
  }
}

export function StateDial(props: StateDiagProps) {
  const { dashboardState, description, windowOpenMinutes } = props;
  // internalState is part of the public API surface (passed by Dashboard.tsx)
  // but the dial doesn't need to render it directly — kept for future use.
  void props.internalState;
  const pill = pillContent(dashboardState, windowOpenMinutes);

  return (
    <div
      className={[
        'relative overflow-hidden',
        'bg-marketing-warmWhite border border-marketing-line',
        'rounded-[22px] p-9',
        'transition-all duration-[600ms] ease-in-out',
        `state-${dashboardState}`,
      ].join(' ')}
      role="region"
      aria-label={`Current nervous system state: ${STATE_NAME[dashboardState]}`}
    >
      {/* Radial background gradient layer */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none z-0 transition-[background] duration-[1000ms] ease-in-out"
        style={{ background: STATE_BG_GRADIENT[dashboardState] }}
      />

      <div className="relative z-[1]">
        {/* Top row: just the section label — fixed position so the optional
            window pill at the bottom doesn't shift the title text. */}
        <div className="font-mono text-[10px] tracking-[1.8px] text-marketing-inkMuted uppercase font-semibold mb-7">
          Current state · live
        </div>

        {/* State name + description (full inner width) */}
        <div
          className={[
            'font-serif text-[48px] leading-none tracking-[-1.6px] font-medium mb-3.5',
            'transition-colors duration-[600ms] ease-in-out',
            STATE_NAME_CLASS[dashboardState],
          ].join(' ')}
          aria-live="polite"
        >
          {STATE_NAME[dashboardState]}
        </div>

        <p className="text-[15px] text-marketing-inkSoft leading-[1.55] mb-5">
          {description}
        </p>

        {/* Window pill — placed BEFORE the spiral, always present
            (text varies per state) so its content can swap without
            reflowing the layout. */}
        <div
          className="inline-flex items-center gap-2 px-3.5 py-2 mb-6 bg-marketing-green-900 text-marketing-cream rounded-full font-mono text-[11px] tracking-[1px] font-semibold"
          role="status"
          aria-live="polite"
        >
          <span aria-hidden="true">{pill.icon}</span>
          <span>{pill.text}</span>
        </div>

        {/* Mandala (left, sized to label column height) + StateLadder (right) */}
        <div className="flex items-center gap-5">
          <div
            className="w-[140px] h-[140px] flex-shrink-0 flex items-center justify-center"
            aria-hidden="true"
          >
            <Mandala dashboardState={dashboardState} />
          </div>
          <div className="flex-1 min-w-0">
            <StateLadder dashboardState={dashboardState} />
          </div>
        </div>
      </div>

      {/* Slide-in keyframe — inlined here so it doesn't pollute global CSS */}
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

export default StateDial;
