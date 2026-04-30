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

function windowPillText(state: DashboardState, minutes?: number): string | null {
  if (minutes == null) return null;
  if (state === 'shifting') return `Caught ${minutes} min before peak`;
  if (state === 'overloaded') return 'Peak detected · reset queued';
  return null;
}

export function StateDial(props: StateDiagProps) {
  const { dashboardState, description, windowOpenMinutes } = props;
  // internalState is part of the public API surface (passed by Dashboard.tsx)
  // but the dial doesn't need to render it directly — kept for future use.
  void props.internalState;
  const pillText = windowPillText(dashboardState, windowOpenMinutes);

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
        {/* Top row: label + window pill */}
        <div className="flex justify-between items-start mb-7">
          <div className="font-mono text-[10px] tracking-[1.8px] text-marketing-inkMuted uppercase font-semibold">
            Current state · live
          </div>

          {pillText && (
            <div
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-marketing-green-900 text-marketing-cream rounded-full font-mono text-[11px] tracking-[1px] font-semibold animate-[slideIn_0.5s_ease]"
              role="status"
              aria-live="polite"
            >
              <span aria-hidden="true">↗</span>
              <span>{pillText}</span>
            </div>
          )}
        </div>

        {/* State name + description + ladder / mandala grid */}
        <div className="grid gap-9 items-center" style={{ gridTemplateColumns: '1fr 200px' }}>
          <div>
            <div
              className={[
                'font-serif text-[56px] leading-none tracking-[-2px] font-medium mb-3.5',
                'transition-colors duration-[600ms] ease-in-out',
                STATE_NAME_CLASS[dashboardState],
              ].join(' ')}
              aria-live="polite"
            >
              {STATE_NAME[dashboardState]}
            </div>

            <p className="text-[16px] text-marketing-inkSoft leading-[1.55] max-w-[420px] mb-6">
              {description}
            </p>

            <StateLadder dashboardState={dashboardState} />
          </div>

          {/* Mandala SVG */}
          <div
            className="w-[200px] h-[200px] flex items-center justify-center ml-auto"
            aria-hidden="true"
          >
            <Mandala dashboardState={dashboardState} />
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
