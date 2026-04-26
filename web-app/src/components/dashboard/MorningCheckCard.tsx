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
// Single CTA: "I'd like to talk about it" — Dashboard wires this to a free
// text box. For V1 the text is local-only (ADR-007).

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
      className={[
        'max-w-3xl mx-auto',
        'bg-surface-800/85 backdrop-blur-xl',
        'rounded-2xl shadow-2xl border border-slate-700/60',
        'p-8',
      ].join(' ')}
      aria-label="Morning check comparison"
    >
      <header className="mb-6 flex items-center gap-3">
        <span className="text-xs uppercase tracking-widest text-accent-cyan">Morning check</span>
        <span className="h-px flex-1 bg-slate-700" />
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Panel title="Yesterday">
          <p className="text-slate-200 leading-relaxed">
            You went into <strong className="text-amber-300">activated</strong>{' '}
            <strong className="text-slate-100">{yesterdayCount}</strong>{' '}
            {yesterdayCount === 1 ? 'time' : 'times'} yesterday — last one at{' '}
            <span className="text-slate-100">{formatRelativeTime(lastEventTs)}</span>.
          </p>
        </Panel>
        <Panel title="This morning">
          <p className="text-slate-200 leading-relaxed">
            Your breath is at{' '}
            <strong className="text-slate-100">{Math.round(todayBaseline)}</strong>{' '}
            BPM <span className="text-slate-400">(your regulated baseline is{' '}
            <span className="text-slate-100">{Math.round(regulatedBaseline)}</span>)</span>.
          </p>
        </Panel>
        <Panel title="A note">
          <p className="text-slate-100 italic leading-relaxed">
            &ldquo;{affirmation.text}&rdquo;
          </p>
        </Panel>
      </div>

      <div className="mt-8 flex justify-center">
        <button
          type="button"
          onClick={onTalk}
          className={[
            'px-5 py-2.5 rounded-full',
            'bg-accent-cyan/15 border border-accent-cyan/50 text-accent-cyan',
            'text-sm tracking-wide',
            'transition-colors duration-200 hover:bg-accent-cyan/25',
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
    <article className="rounded-xl border border-slate-700/70 bg-surface-900/50 p-5">
      <h3 className="text-xs uppercase tracking-widest text-slate-400 mb-2">
        {title}
      </h3>
      {children}
    </article>
  );
}

export default MorningCheckCard;
