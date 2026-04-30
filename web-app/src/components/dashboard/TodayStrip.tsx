/**
 * TodayStrip — horizontal timeline of state segments from 6 AM to 9 PM.
 *
 * Per design HTML lines 994–1017 and ADR-017 §"Today Strip".
 *
 * On mount: calls computeTodayStrip(store, Date.now()) from the aggregator
 * service (aggregators-coder owns the implementation). Renders:
 *   - SVG-style horizontal track (absolute positioning %)
 *   - State segments coloured per DashboardState
 *   - Reset markers (↻) at intervention timestamps
 *   - "NOW" cursor at current time position
 *   - 4 stat tiles: shifts caught, avg lead time, steady minutes, crashes
 *   - Axis labels: 6AM → 9PM (6 ticks)
 */

import { useEffect, useMemo, useState } from 'react';
import type { TodayStripData, DashboardState } from '../../types/display';
// aggregators-coder owns computeTodayStrip — expected swarm dependency
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — expected swarm dependency (aggregators-coder)
import { computeTodayStrip } from '../../services/todayStrip';

export interface TodayStripProps {
  /** The sessionStore instance — passed from the page-level context. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  store: any;
}

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------
const DAY_START_HOUR = 6;  // 6 AM
const DAY_END_HOUR = 21;   // 9 PM
const DAY_SPAN_MS = (DAY_END_HOUR - DAY_START_HOUR) * 60 * 60 * 1000;

const AXIS_LABELS = ['6 AM', '9 AM', '12 PM', '3 PM', '6 PM', '9 PM'];

function startOfDayLocal(now: number): number {
  const d = new Date(now);
  d.setHours(DAY_START_HOUR, 0, 0, 0);
  return d.getTime();
}

function tsToPercent(ts: number, dayStart: number): number {
  const pct = ((ts - dayStart) / DAY_SPAN_MS) * 100;
  return Math.max(0, Math.min(100, pct));
}

const STATE_COLORS: Record<DashboardState, string> = {
  steady:     'var(--state-steady, #639922)',
  shifting:   'var(--state-shifting, #C99B4F)',
  overloaded: 'var(--state-overloaded, #C97A6B)',
  drained:    'var(--state-drained, #6B7558)',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function TodayStrip({ store }: TodayStripProps) {
  const [data, setData] = useState<TodayStripData | null>(null);
  const [loading, setLoading] = useState(true);
  // Seed nowPct + dayStart from initial mount time — kept stable across
  // renders so the JSX reads pure values. The interval updates them.
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  const dayStart = useMemo(() => startOfDayLocal(nowTick), [nowTick]);
  const nowPct = useMemo(() => tsToPercent(nowTick, dayStart), [nowTick, dayStart]);

  useEffect(() => {
    let cancelled = false;
    computeTodayStrip(store, Date.now())
      .then((d: TodayStripData) => {
        if (!cancelled) {
          setData(d);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    // Update NOW marker every minute
    const interval = setInterval(() => {
      setNowTick(Date.now());
    }, 60_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [store]);

  const stats = data?.stats ?? {
    shiftsCaughtToday: 0,
    avgLeadMinutesThisWeek: 0,
    steadyMinutesToday: 0,
    crashesThisWeek: 0,
  };

  const steadyHours = Math.floor(stats.steadyMinutesToday / 60);
  const steadyMins = stats.steadyMinutesToday % 60;
  const steadyLabel = steadyHours > 0
    ? `${steadyHours}:${String(steadyMins).padStart(2, '0')}`
    : `${steadyMins}m`;

  return (
    <section
      className="bg-marketing-warmWhite border border-marketing-line rounded-[22px] px-9 py-8"
      aria-label="Today's state timeline"
    >
      {/* Header */}
      <div className="flex justify-between items-baseline mb-7">
        <div className="font-serif text-[22px] text-marketing-green-900 font-medium tracking-[-0.3px]">
          Today, so far.{' '}
          <em className="italic text-marketing-green-600">How the day is unfolding.</em>
        </div>

        {/* Legend */}
        <div className="flex gap-[18px] font-mono text-[10px] tracking-[1px] text-marketing-inkMuted uppercase">
          {(['steady', 'shifting', 'overloaded', 'drained'] as DashboardState[]).map((s) => (
            <div key={s} className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: STATE_COLORS[s] }}
                aria-hidden="true"
              />
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </div>
          ))}
        </div>
      </div>

      {/* Track */}
      <div
        className="relative h-20 bg-marketing-cream2 rounded-xl overflow-hidden mb-3.5"
        role="img"
        aria-label="Today's state timeline track"
      >
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-mono text-[11px] text-marketing-inkMuted animate-pulse">Loading…</span>
          </div>
        ) : (
          <>
            {/* State segments */}
            {data?.segments.map((seg, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0 transition-opacity duration-300"
                style={{
                  left: `${tsToPercent(seg.start, dayStart)}%`,
                  width: `${tsToPercent(seg.end, dayStart) - tsToPercent(seg.start, dayStart)}%`,
                  background: STATE_COLORS[seg.state],
                  opacity: seg.state === 'steady' ? 0.55 : 0.85,
                }}
                aria-hidden="true"
              />
            ))}

            {/* Reset markers */}
            {data?.resetMarkers.map((ts, i) => (
              <div
                key={i}
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-[22px] h-[22px] bg-marketing-cream border-[1.5px] border-marketing-green-800 rounded-full flex items-center justify-center text-marketing-green-800 text-[12px] font-bold z-[3]"
                style={{ left: `${tsToPercent(ts, dayStart)}%` }}
                aria-label="Reset performed"
                title="Breathing reset"
              >
                &#8635;
              </div>
            ))}

            {/* NOW marker */}
            {nowPct > 0 && nowPct < 100 && (
              <div
                className="absolute top-0 bottom-0 w-[2px] bg-marketing-green-900 z-[2]"
                style={{ left: `${nowPct}%` }}
                aria-hidden="true"
              >
                <div
                  className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-marketing-green-900 rounded-full"
                  aria-hidden="true"
                />
                <div
                  className="absolute -top-[22px] left-1/2 -translate-x-1/2 font-mono text-[9px] tracking-[1px] text-marketing-green-900 font-bold"
                  aria-hidden="true"
                >
                  NOW
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Axis */}
      <div className="flex justify-between font-mono text-[10px] text-marketing-inkMuted tracking-[0.8px] px-1">
        {AXIS_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      {/* Stats */}
      <div className="mt-6 pt-6 border-t border-t-marketing-line grid grid-cols-4 gap-8">
        <div>
          <div className="font-serif text-[28px] font-medium text-marketing-green-900 tracking-[-0.4px] leading-none mb-1.5">
            <em className="italic text-marketing-green-600">{stats.shiftsCaughtToday}</em>
          </div>
          <div className="text-[12px] text-marketing-inkMuted leading-[1.4]">
            Shifts caught<br />before they crested
          </div>
        </div>

        <div>
          <div className="font-serif text-[28px] font-medium text-marketing-green-900 tracking-[-0.4px] leading-none mb-1.5">
            <em className="italic text-marketing-green-600">{stats.avgLeadMinutesThisWeek}</em>
            <span className="text-[18px] text-marketing-inkSoft"> min</span>
          </div>
          <div className="text-[12px] text-marketing-inkMuted leading-[1.4]">
            Average lead time<br />this week
          </div>
        </div>

        <div>
          <div className="font-serif text-[28px] font-medium text-marketing-green-900 tracking-[-0.4px] leading-none mb-1.5">
            <em className="italic text-marketing-green-600">{steadyLabel}</em>
          </div>
          <div className="text-[12px] text-marketing-inkMuted leading-[1.4]">
            Total time<br />in steady today
          </div>
        </div>

        <div>
          <div className="font-serif text-[28px] font-medium text-marketing-green-900 tracking-[-0.4px] leading-none mb-1.5">
            <em className="italic text-marketing-green-600">{stats.crashesThisWeek}</em>
          </div>
          <div className="text-[12px] text-marketing-inkMuted leading-[1.4]">
            Crashes<br />this week
          </div>
        </div>
      </div>
    </section>
  );
}

export default TodayStrip;
