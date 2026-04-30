/**
 * StateLadder — the 4-rung visual showing which state is currently active.
 *
 * Per design HTML lines 169–188, 800–806.
 * Active rung gets state-keyed background + coloured bullet. Inactive rungs
 * are muted. All styling via Tailwind + CSS custom-property fallback.
 */

import type { DashboardState } from '../../types/display';

interface StateLadderProps {
  dashboardState: DashboardState;
}

const RUNGS: { key: DashboardState; label: string }[] = [
  { key: 'steady',    label: 'Steady' },
  { key: 'shifting',  label: 'Shifting' },
  { key: 'overloaded',label: 'Overloaded' },
  { key: 'drained',   label: 'Drained' },
];

/** Active rung styling per state — bg + text + bullet. */
const ACTIVE_STYLES: Record<DashboardState, { bg: string; text: string; bullet: string; shadow: string }> = {
  steady: {
    bg: 'bg-[#EAF3DE]',
    text: 'text-[#173404]',
    bullet: 'bg-[#4F8418]',
    shadow: 'shadow-[0_0_0_4px_rgba(99,153,34,0.18)]',
  },
  shifting: {
    bg: 'bg-[#C99B4F]/14',
    text: 'text-[#C99B4F]',
    bullet: 'bg-[#C99B4F]',
    shadow: 'shadow-[0_0_0_4px_rgba(201,155,79,0.22)]',
  },
  overloaded: {
    bg: 'bg-[#C97A6B]/14',
    text: 'text-[#C97A6B]',
    bullet: 'bg-[#C97A6B]',
    shadow: 'shadow-[0_0_0_4px_rgba(201,122,107,0.22)]',
  },
  drained: {
    bg: 'bg-[#6B7558]/14',
    text: 'text-[#6B7558]',
    bullet: 'bg-[#6B7558]',
    shadow: 'shadow-[0_0_0_4px_rgba(107,117,88,0.22)]',
  },
};

export function StateLadder({ dashboardState }: StateLadderProps) {
  return (
    <div className="flex flex-col gap-1.5 mt-2">
      {RUNGS.map(({ key, label }) => {
        const isActive = key === dashboardState;
        const activeStyle = ACTIVE_STYLES[dashboardState];

        return (
          <div
            key={key}
            className={[
              'flex items-center gap-3 px-3 py-2 rounded-lg',
              'font-mono text-[11px] tracking-[1px] uppercase',
              'transition-all duration-500',
              isActive
                ? `${activeStyle.bg} ${activeStyle.text} font-semibold`
                : 'text-[#6B7558]',
            ].join(' ')}
            aria-current={isActive ? 'true' : undefined}
          >
            <span
              className={[
                'w-2 h-2 rounded-full flex-shrink-0 transition-all duration-400',
                isActive
                  ? `${activeStyle.bullet} ${activeStyle.shadow}`
                  : 'bg-[rgba(39,80,10,0.18)]',
              ].join(' ')}
              aria-hidden="true"
            />
            <span>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default StateLadder;
