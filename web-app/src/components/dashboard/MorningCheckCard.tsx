// MorningCheckCard — the 3-panel comparison surface for the `morning_check`
// trigger. Per Intervention DDD invariant 6, the morning_check trigger MUST
// render this card, never the plain AffirmationCard.
//
// Panels (per docs/02_research/05_canonical_build_plan.md §5):
//   1. Yesterday        — count of activated entries + last event time
//   2. This morning     — today's first-presence breath baseline vs.
//                         the user's regulated baseline
//   3. One affirmation  — the affirmation chosen for the trigger
//
// V2 styling: full-width on the dashboard grid, cream/green marketing
// palette matching StateDial / ReflectCard / ResetCard.

import type { Affirmation } from '../../types/intervention';
import type { MorningCheckPayload } from '../../types/state';

export interface MorningCheckCardProps {
  payload: MorningCheckPayload;
  affirmation: Affirmation;
  onTalk?: () => void;
}

function formatRelativeTime(ts: number, now: number = Date.now()): string {
  if (!Number.isFinite(ts) || ts <= 0) return 'recently';
  const date = new Date(ts);
  const sameDay =
    date.getFullYear() === new Date(now).getFullYear() &&
    date.getMonth() === new Date(now).getMonth() &&
    date.getDate() === new Date(now).getDate();
  const time = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
  return sameDay ? time : `yesterday at ${time}`;
}

export function MorningCheckCard({
  payload,
  affirmation,
  onTalk,
}: MorningCheckCardProps) {
  const { yesterdayCount, lastEventTs, todayBaseline, regulatedBaseline } = payload;

  return (
    <section
      className="relative overflow-hidden bg-marketing-warmWhite border border-marketing-line rounded-[22px] p-9"
      aria-label="Morning check comparison"
    >
      {/* Left accent bar — matches ReflectCard's visual cue */}
      <div
        aria-hidden="true"
        className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-marketing-green-600 to-marketing-green-300"
      />

      <header className="mb-6 flex items-center gap-3">
        <span className="font-mono text-[11px] tracking-[2px] text-marketing-green-700 uppercase font-semibold">
          Morning check
        </span>
        <span className="h-px flex-1 bg-marketing-lineSoft" />
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Panel title="Yesterday">
          <p className="text-[15px] text-marketing-inkSoft leading-[1.55]">
            You went into{' '}
            <strong className="text-[#C99B4F] font-semibold">activated</strong>{' '}
            <strong className="text-marketing-green-900 font-semibold">{yesterdayCount}</strong>{' '}
            {yesterdayCount === 1 ? 'time' : 'times'} yesterday — last one at{' '}
            <span className="text-marketing-green-900 font-medium">
              {formatRelativeTime(lastEventTs)}
            </span>
            .
          </p>
        </Panel>
        <Panel title="This morning">
          <p className="text-[15px] text-marketing-inkSoft leading-[1.55]">
            Your breath is at{' '}
            <strong className="text-marketing-green-900 font-semibold">
              {Math.round(todayBaseline)}
            </strong>{' '}
            BPM{' '}
            <span className="text-marketing-inkMuted">
              (your regulated baseline is{' '}
              <span className="text-marketing-green-900 font-medium">
                {Math.round(regulatedBaseline)}
              </span>
              )
            </span>
            .
          </p>
        </Panel>
        <Panel title="A note">
          <p className="font-serif text-[16px] italic leading-[1.5] text-marketing-green-900">
            &ldquo;{affirmation.text}&rdquo;
          </p>
        </Panel>
      </div>

      <div className="mt-8 flex justify-center">
        <button
          type="button"
          onClick={onTalk}
          className={[
            'inline-flex items-center gap-2.5',
            'bg-marketing-green-800 text-marketing-cream',
            'px-6 py-3 rounded-full',
            'text-[14px] font-semibold',
            'shadow-[0_8px_20px_-8px_rgba(23,52,4,0.4)]',
            'transition-all duration-200',
            'hover:bg-marketing-green-900 hover:-translate-y-px',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marketing-green-400',
          ].join(' ')}
        >
          I&rsquo;d like to talk about it
        </button>
      </div>
    </section>
  );
}

interface PanelProps { title: string; children: React.ReactNode }

function Panel({ title, children }: PanelProps) {
  return (
    <article className="rounded-[14px] border border-marketing-line bg-marketing-cream px-5 py-4">
      <h3 className="font-mono text-[10px] uppercase tracking-[1.5px] text-marketing-inkMuted font-semibold mb-2">
        {title}
      </h3>
      {children}
    </article>
  );
}

export default MorningCheckCard;
