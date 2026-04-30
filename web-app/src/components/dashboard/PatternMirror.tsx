/**
 * PatternMirror — 4-up grid of longitudinal observations from the last 12 days.
 *
 * Per design HTML lines 962–991 and ADR-017 §"Pattern Mirror".
 *
 * On mount: calls computeMirrorObservations(store) from the aggregator service
 * (aggregators-coder owns the implementation). Renders 4 observation cards,
 * or a single cold-start placeholder when fewer observations exist.
 *
 * Italic-on-keyword formatting: observation text uses <em>…</em> markers
 * in the string. We parse these by splitting on <em>…</em> and wrapping in
 * <em> JSX elements.
 *
 * Icon map: moon = sleep, sun = recovery/activity, screen = screen/pattern, load = load/signal.
 */

import { useEffect, useState } from 'react';
import type { MirrorObservation } from '../../types/display';
// aggregators-coder owns computeMirrorObservations — importing at runtime
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — expected swarm dependency (aggregators-coder)
import { computeMirrorObservations } from '../../services/patternMirror';

export interface PatternMirrorProps {
  /** The sessionStore instance — passed from the page-level context. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  store: any;
}

// ---------------------------------------------------------------------------
// SVG icons (inline — no external dependencies)
// ---------------------------------------------------------------------------
const ICONS: Record<MirrorObservation['iconKey'], React.ReactNode> = {
  moon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  ),
  sun: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
      <circle cx="12" cy="12" r="5"/>
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
    </svg>
  ),
  screen: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <path d="M9 9h6v6H9z"/>
    </svg>
  ),
  load: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
      <path d="M3 12h4l3-9 4 18 3-9h4"/>
    </svg>
  ),
};

// ---------------------------------------------------------------------------
// Parse <em>...</em> markers in plain text strings
// ---------------------------------------------------------------------------
function parseEmphasis(text: string): React.ReactNode {
  const parts = text.split(/(<em>[^<]*<\/em>)/);
  return parts.map((part, i) => {
    const match = part.match(/^<em>(.*)<\/em>$/);
    if (match) {
      return (
        <em key={i} className="italic text-marketing-green-600">
          {match[1]}
        </em>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function PatternMirror({ store }: PatternMirrorProps) {
  const [observations, setObservations] = useState<MirrorObservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // initial state is already loading=true; no need to set again here
    computeMirrorObservations(store)
      .then((obs: MirrorObservation[]) => {
        if (!cancelled) {
          setObservations(obs);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [store]);

  const isColdStart = observations.length === 1 && observations[0]?.iconKey == null;

  return (
    <section
      className="bg-marketing-cream2 border border-marketing-line rounded-[22px] p-9 mb-6"
      aria-label="Pattern Mirror — longitudinal observations"
    >
      {/* Header */}
      <div className="flex justify-between items-baseline mb-6 flex-wrap gap-3">
        <div>
          <div className="font-mono text-[11px] tracking-[2px] text-marketing-green-700 uppercase font-semibold">
            Pattern mirror
          </div>
          <h2 className="font-serif text-[28px] leading-[1.2] text-marketing-green-900 font-medium tracking-[-0.4px] mt-1.5">
            What your last 12 days{' '}
            <em className="italic text-marketing-green-600">are showing.</em>
          </h2>
        </div>
        <div className="font-mono text-[11px] text-marketing-inkMuted tracking-[0.5px]">
          {loading ? 'Loading…' : 'Updated this morning · 12 days observed'}
        </div>
      </div>

      {/* Content */}
      {loading && (
        <div className="text-marketing-inkMuted text-[14px] font-mono italic animate-pulse">
          Computing observations…
        </div>
      )}

      {error && (
        <div className="text-marketing-inkMuted text-[14px]">
          Unable to load observations. Check back after more data is collected.
        </div>
      )}

      {!loading && !error && (
        isColdStart ? (
          // Cold-start single card
          <div className="bg-marketing-warmWhite border border-marketing-line rounded-[14px] p-6">
            <p className="font-serif text-[17px] leading-[1.4] text-marketing-green-900">
              {parseEmphasis(observations[0]?.text ?? 'Pattern Mirror unlocks after 7 days of observation.')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-5">
            {observations.map((obs, i) => (
              <div
                key={i}
                className={[
                  'bg-marketing-warmWhite border border-marketing-line',
                  'rounded-[14px] p-6 pb-5',
                  'relative transition-transform duration-200 hover:-translate-y-0.5',
                  'hover:shadow-[0_12px_24px_-16px_rgba(23,52,4,0.15)]',
                ].join(' ')}
                style={{ opacity: 0.5 + obs.confidence * 0.5 }}
              >
                {/* Icon */}
                <div className="w-9 h-9 rounded-full bg-[#EAF3DE] flex items-center justify-center mb-3.5 text-marketing-green-700">
                  {ICONS[obs.iconKey] ?? ICONS.load}
                </div>

                {/* Observation text */}
                <p className="font-serif text-[17px] leading-[1.4] text-marketing-green-900 font-normal tracking-[-0.1px] mb-2.5">
                  {parseEmphasis(obs.text)}
                </p>

                {/* Evidence caption */}
                <div className="text-[12px] text-marketing-inkMuted leading-[1.5] font-mono tracking-[0.3px]">
                  {obs.evidence}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </section>
  );
}

export default PatternMirror;
