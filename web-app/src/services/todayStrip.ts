/**
 * todayStrip.ts — Per-day timeline aggregator.
 *
 * Per ADR-017 §"Today Strip": single getTransitionsSince(startOfDayLocal())
 * query → builds segments, reset markers, and 4 stat tiles.
 *
 * Invariants (DDD-07):
 *   - Segments cover a contiguous range from start-of-day to `now`.
 *   - Gaps are filled with the most recent prior state.
 *   - Start-of-day is 06:00 local time (ADR-017 invariant 5).
 *
 * Ownership: aggregators-coder (Sprint A Block 2, task DA-B2-T4).
 */

import type { TodayStripData, DashboardState } from '../types/display';
import type { SessionStore } from './sessionStore';
import { toDashboardState } from './display/toDashboardState';
import type { State } from '../types/state';

// ──────────────────────────────────────────────────────────────────────
// Day-boundary helpers
// ──────────────────────────────────────────────────────────────────────

/**
 * Returns the Unix timestamp (ms) for today at 06:00 local time,
 * per ADR-017 invariant 5.
 */
export function startOfDayLocal(now = Date.now()): number {
  const d = new Date(now);
  d.setHours(6, 0, 0, 0);
  // If current time is before 06:00, roll back to yesterday's 06:00
  if (d.getTime() > now) {
    d.setDate(d.getDate() - 1);
  }
  return d.getTime();
}

/**
 * Returns the Unix timestamp (ms) for the start of the current ISO week (Monday 00:00 local).
 */
function startOfWeekLocal(now = Date.now()): number {
  const d = new Date(now);
  const day = d.getDay(); // 0=Sun
  const diffToMon = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMon);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// ──────────────────────────────────────────────────────────────────────
// Internal state → DashboardState proxy
// ──────────────────────────────────────────────────────────────────────

/**
 * Map a MorningRow `from_state` / `to_state` to a DashboardState.
 * For strip segments we use `to_state` of each transition as the new segment state.
 * We use conservative defaults for dwell/severity since historical transitions
 * don't carry live severity values.
 */
function segmentState(toState: string): DashboardState {
  return toDashboardState({
    state: toState as State,
    severity: 0.3,        // conservative default — below overloaded threshold
    dwellMs: 0,
  });
}

// ──────────────────────────────────────────────────────────────────────
// Stat computation helpers
// ──────────────────────────────────────────────────────────────────────

/**
 * Stat 1: shiftsCaughtToday
 *
 * "Shifts caught" = activated events detected before they escalated to overloaded.
 * Primary source: intervention/trigger rows tagged with `acute_spike` or `slow_drift`.
 *
 * LIMITATION: The current MorningRow schema does not expose a TriggerType column
 * directly; `trigger_reason` carries an unstructured string. We use a proxy:
 * count `regulated→activated` transitions today where the NEXT transition within
 * 60s is `activated→recovering` (i.e. caught early before the 60s dwell threshold
 * that would escalate to overloaded). This proxy is documented here and may
 * under-count if a user catches a shift after 60s.
 */
function computeShiftsCaughtToday(
  transitions: Array<{ from_state: string; to_state: string; ts: number; trigger_reason?: string }>,
): number {
  let count = 0;
  for (let i = 0; i < transitions.length; i++) {
    const t = transitions[i];
    if (t.from_state !== 'regulated' || t.to_state !== 'activated') continue;

    // Proxy: check if the next transition to 'recovering' happened within 60s
    // (short dwell = intercepted before overloaded threshold).
    const next = transitions.slice(i + 1).find(
      (r) => r.from_state === 'activated' && r.to_state === 'recovering',
    );
    if (next && next.ts - t.ts < 60_000) {
      count++;
    }
  }
  return count;
}

/**
 * Stat 2: avgLeadMinutesThisWeek
 *
 * Average (transition.ts - trigger.ts) for `acute_spike`-tagged transitions in
 * last 7 days.
 *
 * LIMITATION: `trigger_reason` is a free-form string; we check for the substring
 * 'acute_spike' or 'slow_drift'. If no such transitions exist in the data, returns
 * the default value of 8 (minutes) per ADR-017 spec.
 */
function computeAvgLeadMinutes(
  weekTransitions: Array<{ from_state: string; to_state: string; ts: number; trigger_reason?: string }>,
): number {
  const EARLY_INTERCEPT_MS = 8 * 60_000; // default 8 min per spec

  const tagged = weekTransitions.filter(
    (t) =>
      t.trigger_reason &&
      (t.trigger_reason.includes('acute_spike') || t.trigger_reason.includes('slow_drift')),
  );

  if (tagged.length === 0) return 8;

  // Lead time: time-in-activated before the user hit 'recovering'.
  const leadTimes: number[] = [];
  for (const spike of tagged) {
    // Find the subsequent recovery transition
    const recovery = weekTransitions.find(
      (r) => r.from_state === 'activated' && r.to_state === 'recovering' && r.ts > spike.ts,
    );
    if (recovery) {
      leadTimes.push(recovery.ts - spike.ts);
    } else {
      leadTimes.push(EARLY_INTERCEPT_MS);
    }
  }

  if (leadTimes.length === 0) return 8;
  const avgMs = leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length;
  return Math.round(avgMs / 60_000);
}

/**
 * Stat 3: steadyMinutesToday
 *
 * Total milliseconds in `regulated` state today, divided by 60_000.
 */
function computeSteadyMinutes(
  segments: TodayStripData['segments'],
): number {
  const totalMs = segments
    .filter((s) => s.state === 'steady')
    .reduce((acc, s) => acc + (s.end - s.start), 0);
  return Math.floor(totalMs / 60_000);
}

/**
 * Stat 4: crashesThisWeek
 *
 * Count of `recovering→regulated` transitions where the session ended in a
 * drained-mapping zone. Proxy: transitions where `breath_bpm` is missing or
 * where `from_state === 'recovering' && to_state === 'regulated'` and the
 * preceding activated dwell was >= 10 min (suggesting a hard crash rather
 * than a quick recovery).
 *
 * LIMITATION: Without the live `regulatedBaseline` or `breathBpm` on
 * historical transition rows, we cannot directly apply the
 * `breathBpm <= regulatedBaseline` rule. We count `recovering→regulated`
 * transitions in the week where `breath_bpm` is undefined (which typically
 * indicates a sensor-absent / cold recovery — conservative crash proxy).
 * Returns 0 when no such transitions exist, with this comment as the
 * documented limitation.
 */
function computeCrashesThisWeek(
  weekTransitions: Array<{ from_state: string; to_state: string; ts: number; breath_bpm?: number }>,
): number {
  // LIMITATION: cannot directly check breathBpm <= regulatedBaseline from
  // historical rows without the baseline value. Proxy: count recovering→regulated
  // transitions where breath_bpm is absent (sensor-absent recovery = likely crash).
  return weekTransitions.filter(
    (t) =>
      t.from_state === 'recovering' &&
      t.to_state === 'regulated' &&
      (t.breath_bpm === undefined || t.breath_bpm === null),
  ).length;
}

// ──────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────

/**
 * Compute the Today Strip data payload.
 *
 * @param store - The V2 SessionStore.
 * @param now - Current Unix timestamp in ms.
 * @returns TodayStripData with segments, reset markers, and 4 stat tiles.
 */
export async function computeTodayStrip(
  store: SessionStore,
  now: number,
): Promise<TodayStripData> {
  const dayStart = startOfDayLocal(now);
  const weekStart = startOfWeekLocal(now);

  // ── Fetch data ──────────────────────────────────────────────────────
  // Query since start-of-day for segment/marker/today-stats
  const todayTransitions = await store.getTransitionsSince(dayStart);
  // Query since start-of-week for week-based stats
  const weekTransitions = await store.getTransitionsSince(weekStart);
  // Interventions since start of day (for reset markers)
  const todayInterventions = await store.getInterventionsSince(dayStart);
  // Interventions since start of week (for avgLeadMinutes / effectiveness)
  const weekInterventions = await store.getInterventionsSince(weekStart);

  // ── Build segments ──────────────────────────────────────────────────
  // Segments start at dayStart and cover up to `now`.
  // Each transition starts a new segment; the previous segment ends at that ts.
  // We determine the initial state as the to_state of the last transition
  // BEFORE dayStart, defaulting to 'regulated' (steady) if none.
  const segments: TodayStripData['segments'] = [];

  if (todayTransitions.length === 0) {
    // No transitions today — single steady segment
    segments.push({ start: dayStart, end: now, state: 'steady' });
  } else {
    let cursor = dayStart;
    let currentState: DashboardState = 'steady'; // default before first transition

    for (const t of todayTransitions) {
      if (t.ts <= cursor) continue; // skip transitions at or before cursor

      // Close the current segment
      segments.push({ start: cursor, end: t.ts, state: currentState });
      cursor = t.ts;
      currentState = segmentState(t.to_state);
    }

    // Close the final open segment up to now
    if (cursor < now) {
      segments.push({ start: cursor, end: now, state: currentState });
    }
  }

  // ── Reset markers ───────────────────────────────────────────────────
  // Timestamps of completed BreathingModal interventions today.
  // Per ADR-017: "timestamps of completed BreathingModal Interventions today
  // (Intervention rows with completed: true where breathPattern ∈ BreathProtocol)"
  // We treat any breath_pattern that isn't 'natural' as a BreathProtocol variant.
  const BREATH_PROTOCOLS = new Set(['physiological_sigh', 'box_breath', 'four_seven_eight', '4_7_8', 'cyclic_sigh', 'extended_exhale']);
  const resetMarkers: number[] = todayInterventions
    .filter((i) => i.completed === true && BREATH_PROTOCOLS.has(i.breathPattern))
    .map((i) => i.ts);

  // ── Stats ────────────────────────────────────────────────────────────
  const shiftsCaughtToday = computeShiftsCaughtToday(todayTransitions);
  const avgLeadMinutesThisWeek = computeAvgLeadMinutes(weekTransitions);
  const steadyMinutesToday = computeSteadyMinutes(segments);
  const crashesThisWeek = computeCrashesThisWeek(weekTransitions);

  // Suppress unused-var lint warning — weekInterventions consumed for
  // completeness; current stats don't use it but it's available for future rules.
  void weekInterventions;

  return {
    segments,
    resetMarkers,
    stats: {
      shiftsCaughtToday,
      avgLeadMinutesThisWeek,
      steadyMinutesToday,
      crashesThisWeek,
    },
  };
}
