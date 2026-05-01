/**
 * ResetCard — state-keyed reset prompt with "Begin reset →" CTA.
 *
 * Per design HTML lines 950–959, 1131–1148.
 * Only visible when dashboardState !== 'steady'.
 * State-keyed copy (from STATES dict in design HTML lines 1131–1148),
 * with italic emphasis preserved in JSX.
 *
 * Has a "Begin reset →" button that calls onBeginReset to open BreathingModal.
 */

import type { DashboardState } from '../../types/display';

export interface ResetCardProps {
  dashboardState: DashboardState;
  /** Called when the user clicks "Begin reset →". */
  onBeginReset: () => void;
  /** Minutes until predicted peak — shown in the rc-tag for shifting state. */
  windowOpenMinutes?: number;
  /** When true, render without panel chrome (bg, border, rounded, padding,
   *  left accent) so this can sit inside a parent panel. */
  nested?: boolean;
}

interface StateContent {
  tag: React.ReactNode;
  title: React.ReactNode;
  protocol: React.ReactNode;
  /** CSS class for the left accent border and tag colour. */
  accentClass: string;
}

function buildContent(
  dashboardState: Exclude<DashboardState, 'steady'>,
  windowOpenMinutes?: number,
): StateContent {
  switch (dashboardState) {
    case 'shifting':
      return {
        accentClass: 'text-[#C99B4F]',
        tag: <>&#9888; Caught · {windowOpenMinutes ?? 8} min before peak</>,
        title: (
          <>
            Your breath shortened over the last four minutes.{' '}
            <em className="italic text-marketing-green-600">Shoulders haven't moved.</em>
          </>
        ),
        protocol: (
          <>
            <strong className="font-semibold text-marketing-green-900">
              Sixty-second physiological sigh.
            </strong>{' '}
            Two short inhales through the nose, one long exhale through the mouth. Five rounds.
          </>
        ),
      };

    case 'overloaded':
      return {
        accentClass: 'text-[#C97A6B]',
        tag: <>&#9888; Overloaded · reset ready</>,
        title: (
          <>
            Your nervous system is at peak activation.{' '}
            <em className="italic text-marketing-green-600">Time to interrupt.</em>
          </>
        ),
        protocol: (
          <>
            <strong className="font-semibold text-marketing-green-900">
              Sixty-second physiological sigh.
            </strong>{' '}
            The fastest evidence-based way to drop activation in under a minute.
          </>
        ),
      };

    case 'drained':
      return {
        accentClass: 'text-[#6B7558]',
        tag: <>&loz; Drained · gentle re-engagement</>,
        title: (
          <>
            Your system has flattened.{' '}
            <em className="italic text-marketing-green-600">
              It needs activation, not more rest.
            </em>
          </>
        ),
        protocol: (
          <>
            <strong className="font-semibold text-marketing-green-900">
              Sixty-second box breath with movement.
            </strong>{' '}
            Equal-length inhale, hold, exhale, hold — paired with a slow stand and reach.
          </>
        ),
      };
  }
}

const BORDER_COLOR: Record<Exclude<DashboardState, 'steady'>, string> = {
  shifting: '#C99B4F',
  overloaded: '#C97A6B',
  drained: '#6B7558',
};

export function ResetCard({ dashboardState, onBeginReset, windowOpenMinutes, nested = false }: ResetCardProps) {
  if (dashboardState === 'steady') return null;

  const content = buildContent(dashboardState, windowOpenMinutes);

  return (
    <div
      className={
        nested
          ? 'relative'
          : 'relative overflow-hidden bg-marketing-warmWhite border border-marketing-line rounded-[22px] px-9 py-8 h-full'
      }
      role="complementary"
      aria-label="Reset recommendation"
    >
      {/* Left accent border — only rendered when standalone (the parent
          panel owns the visual frame in nested mode). */}
      {!nested && (
        <div
          aria-hidden="true"
          className="absolute left-0 top-0 bottom-0 w-[3px] transition-colors duration-[600ms]"
          style={{ background: BORDER_COLOR[dashboardState] }}
        />
      )}

      <div className="flex flex-col gap-5">
        {/* Tag */}
        <div
          className={`inline-flex items-center gap-2 font-mono text-[10px] tracking-[1.5px] uppercase font-bold ${content.accentClass}`}
        >
          {content.tag}
        </div>

        {/* Title */}
        <h3 className="font-serif text-[26px] leading-[1.2] text-marketing-green-900 font-medium tracking-[-0.4px]">
          {content.title}
        </h3>

        {/* Protocol */}
        <p className="text-[14px] text-marketing-inkSoft leading-[1.6]">
          {content.protocol}
        </p>

        {/* CTA — stacked below the protocol text instead of beside it */}
        <button
          onClick={onBeginReset}
          id="begin-reset"
          className={[
            'self-start inline-flex items-center gap-2.5 mt-1',
            'bg-marketing-green-800 text-marketing-cream',
            'px-7 py-4 rounded-full',
            'text-[15px] font-semibold',
            'shadow-[0_8px_20px_-8px_rgba(23,52,4,0.4)]',
            'transition-all duration-200',
            'hover:bg-marketing-green-900 hover:-translate-y-px',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marketing-green-400',
          ].join(' ')}
          aria-label={`Begin breathing reset for ${dashboardState} state`}
        >
          Begin reset <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
}

export default ResetCard;
