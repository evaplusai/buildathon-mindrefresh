/**
 * patternMirror.ts — Longitudinal observation aggregator + 24h IDB cache.
 *
 * Per ADR-017 §"Pattern Mirror": runs 5 fixed rule queries against the
 * sessionStore; caches the result for 24 hours. All computation is
 * on-device (no cloud calls).
 *
 * Ownership: aggregators-coder (Sprint A Block 2, task DA-B2-T1).
 */

import type { MirrorObservation } from '../types/display';
import type { SessionStore } from './sessionStore';

// ──────────────────────────────────────────────────────────────────────
// Public types
// ──────────────────────────────────────────────────────────────────────

export interface PatternMirrorSnapshot {
  /** Unix ms timestamp when the observations were computed. */
  computedAt: number;
  /** The computed observations (0–4 items, or a single cold-start placeholder). */
  observations: MirrorObservation[];
}

// ──────────────────────────────────────────────────────────────────────
// TTL constants
// ──────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 24 * 60 * 60_000;  // 24 hours
const MIN_DAYS_FOR_MIRROR = 7;
const MAX_OBSERVATIONS = 4;

// ──────────────────────────────────────────────────────────────────────
// Inline statistics helpers (no external deps)
// ──────────────────────────────────────────────────────────────────────

/**
 * Pearson correlation coefficient for two equal-length arrays.
 * Returns 0 if arrays are empty or have zero variance.
 */
function pearsonCorr(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n === 0 || n !== ys.length) return 0;

  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let denomX = 0;
  let denomY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }
  const denom = Math.sqrt(denomX * denomY);
  return denom === 0 ? 0 : num / denom;
}

/** Format a Date as YYYY-MM-DD in local time. */
function toLocalDateString(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Get the local day-of-week name (Mon, Tue, …). */
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function localDayName(ts: number): string {
  return DAY_NAMES[new Date(ts).getDay()];
}

/** Mean of an array, or 0 if empty. */
function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// ──────────────────────────────────────────────────────────────────────
// Rule implementations
// ──────────────────────────────────────────────────────────────────────

/** Rule 1: Sleep-debt correlation.
 *
 * For each of the last `daysBack` days, bucket the day's first
 * morning_check baseline correlated against the day's count of
 * `activated` transitions. If r > 0.5 over >= 7 days, emit observation.
 *
 * Per ADR-017: "per-day morning_check baseline correlated against
 * per-day count of activated→* transitions."
 *
 * Proxy: we use `breath_bpm` on the first `regulated→activated`
 * transition of each day as the "baseline" (morning wake state).
 * If breath_bpm is missing we use the transition count only.
 */
function ruleSleepDebt(
  transitionsByDay: Map<string, Array<{ from_state: string; to_state: string; breath_bpm?: number; ts: number }>>,
): MirrorObservation | null {
  // Collect days with a measurable baseline (breath_bpm on first regulated→*)
  const baselines: number[] = [];
  const activatedCounts: number[] = [];

  for (const rows of transitionsByDay.values()) {
    // First transition of the day — use breath_bpm as baseline proxy
    const firstRow = rows[0];
    const bpm = firstRow?.breath_bpm;
    if (bpm === undefined || bpm === null) continue;

    const activatedCount = rows.filter(
      (r) => r.from_state === 'regulated' && r.to_state === 'activated',
    ).length;

    baselines.push(bpm);
    activatedCounts.push(activatedCount);
  }

  if (baselines.length < MIN_DAYS_FOR_MIRROR) return null;

  const r = pearsonCorr(baselines, activatedCounts);
  if (r <= 0.5) return null;

  const daysCount = baselines.length;
  const highDays = baselines.filter((bpm, i) => bpm < 14 && activatedCounts[i] > 1).length;

  return {
    text: 'Your system tends to become overloaded earlier on days after sleep under 6.5 hours.',
    evidence: `${highDays} of ${daysCount} days · correlation strong`,
    iconKey: 'moon',
    confidence: Math.min(r, 1),
  };
}

/** Rule 2: Recovery channel preference.
 *
 * Compare time-to-`regulated` for activated→recovering pairs invoked-with-
 * Reflect-within-5min vs not. If Reflect-tagged sessions recover >= 20%
 * faster, emit observation.
 */
function ruleRecoveryChannel(
  transitionsByDay: Map<string, Array<{ from_state: string; to_state: string; ts: number }>>,
  interventionTs: number[],
): MirrorObservation | null {
  const REFLECT_WINDOW_MS = 5 * 60_000;

  const withReflectMs: number[] = [];
  const withoutReflectMs: number[] = [];

  for (const rows of transitionsByDay.values()) {
    for (let i = 0; i < rows.length - 1; i++) {
      const r = rows[i];
      if (r.from_state !== 'activated' && r.to_state !== 'recovering') continue;
      if (r.to_state !== 'recovering') continue;

      // Find when this recovering episode ended (next regulated)
      const recoveryStart = r.ts;
      const nextRegulated = rows.slice(i + 1).find(
        (t) => t.from_state === 'recovering' && t.to_state === 'regulated',
      );
      if (!nextRegulated) continue;

      const durationMs = nextRegulated.ts - recoveryStart;

      // Was there a Reflect intervention within 5 min of this transition?
      const hadReflect = interventionTs.some(
        (ts) => ts >= r.ts && ts <= r.ts + REFLECT_WINDOW_MS,
      );

      if (hadReflect) {
        withReflectMs.push(durationMs);
      } else {
        withoutReflectMs.push(durationMs);
      }
    }
  }

  if (withReflectMs.length < 3 || withoutReflectMs.length < 3) return null;

  const meanWith = mean(withReflectMs);
  const meanWithout = mean(withoutReflectMs);
  if (meanWithout === 0) return null;

  const improvement = (meanWithout - meanWith) / meanWithout;
  if (improvement < 0.2) return null;

  const pct = Math.round(improvement * 100);
  return {
    text: 'When you take a moment to Reflect after activation, your recovery time tends to shorten.',
    evidence: `${pct}% faster recovery · ${withReflectMs.length} sessions vs ${withoutReflectMs.length}`,
    iconKey: 'sun',
    confidence: Math.min(improvement, 1),
  };
}

/** Rule 3: Day-of-week pattern.
 *
 * Group `activated` counts by weekday; emit observation for top quartile weekdays.
 */
function ruleDayOfWeek(
  allTransitions: Array<{ from_state: string; to_state: string; ts: number }>,
): MirrorObservation | null {
  const counts: Record<string, number> = {};
  for (const t of allTransitions) {
    if (t.from_state === 'regulated' && t.to_state === 'activated') {
      const day = localDayName(t.ts);
      counts[day] = (counts[day] ?? 0) + 1;
    }
  }

  const entries = Object.entries(counts);
  if (entries.length < 4) return null; // Need enough variety

  entries.sort((a, b) => b[1] - a[1]);
  const allCounts = entries.map(([, c]) => c);
  const q3 = allCounts[Math.floor(allCounts.length * 0.25)];

  const hotDays = entries.filter(([, c]) => c >= q3).map(([d]) => d);
  if (hotDays.length === 0) return null;

  const label = hotDays.length === 1 ? hotDays[0] : `${hotDays.slice(0, -1).join(', ')} and ${hotDays[hotDays.length - 1]}`;
  const topCount = entries[0][1];

  return {
    text: `Your activation tends to peak on ${label}s.`,
    evidence: `${topCount} activations on average · top-quartile day`,
    iconKey: 'screen',
    confidence: 0.75,
  };
}

/** Rule 4: Weekly load drift.
 *
 * Compare this week's mean recovery-window length against the 30-day baseline.
 * If shorter by >= 15%, emit observation #4.
 */
function ruleWeeklyLoadDrift(
  allTransitions: Array<{ from_state: string; to_state: string; ts: number }>,
  now: number,
): MirrorObservation | null {
  const ONE_WEEK_MS = 7 * 24 * 60 * 60_000;
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60_000;
  const weekStart = now - ONE_WEEK_MS;
  const monthStart = now - THIRTY_DAYS_MS;

  function recoveryWindows(
    transitions: Array<{ from_state: string; to_state: string; ts: number }>,
    start: number,
    end: number,
  ): number[] {
    const windows: number[] = [];
    const inRange = transitions.filter((t) => t.ts >= start && t.ts <= end);

    for (let i = 0; i < inRange.length - 1; i++) {
      const t = inRange[i];
      if (t.from_state !== 'activated' || t.to_state !== 'recovering') continue;
      const recoveryStart = t.ts;
      const end2 = inRange.slice(i + 1).find(
        (r) => r.from_state === 'recovering' && r.to_state === 'regulated',
      );
      if (end2) windows.push(end2.ts - recoveryStart);
    }
    return windows;
  }

  const thisWeekWindows = recoveryWindows(allTransitions, weekStart, now);
  const baselineWindows = recoveryWindows(allTransitions, monthStart, now);

  if (thisWeekWindows.length < 2 || baselineWindows.length < 4) return null;

  const thisWeekMean = mean(thisWeekWindows);
  const baselineMean = mean(baselineWindows);
  if (baselineMean === 0) return null;

  const drift = (baselineMean - thisWeekMean) / baselineMean;
  if (drift < 0.15) return null;

  const pct = Math.round(drift * 100);
  return {
    text: 'Your recovery windows have been shorter this week — your nervous system is adapting.',
    evidence: `${pct}% shorter than 30-day baseline · ${thisWeekWindows.length} recoveries this week`,
    iconKey: 'load',
    confidence: Math.min(drift, 1),
  };
}

/** Rule 5: Reset effectiveness.
 *
 * Percentage of `activated` events reaching `recovering` within 10 min
 * when a BreathingModal reset was begun (completed: true) vs not.
 */
function ruleResetEffectiveness(
  allTransitions: Array<{ from_state: string; to_state: string; ts: number }>,
  interventions: Array<{ breathPattern: string; completed: boolean; ts: number }>,
): MirrorObservation | null {
  const RESET_WINDOW_MS = 10 * 60_000;

  // Only count completed BreathingModal interventions
  const completedResetTs = interventions
    .filter((i) => i.completed === true && i.breathPattern !== 'natural')
    .map((i) => i.ts);

  let withResetReached = 0;
  let withResetTotal = 0;
  let withoutResetReached = 0;
  let withoutResetTotal = 0;

  for (const t of allTransitions) {
    if (t.from_state !== 'regulated' || t.to_state !== 'activated') continue;
    const activatedAt = t.ts;

    // Did a completed reset begin within the RESET_WINDOW_MS?
    const hadReset = completedResetTs.some(
      (rts) => rts >= activatedAt && rts <= activatedAt + RESET_WINDOW_MS,
    );

    // Did the user reach 'recovering' within 10 min?
    const reachedRecovery = allTransitions.some(
      (r) =>
        r.from_state === 'activated' &&
        r.to_state === 'recovering' &&
        r.ts > activatedAt &&
        r.ts <= activatedAt + RESET_WINDOW_MS,
    );

    if (hadReset) {
      withResetTotal++;
      if (reachedRecovery) withResetReached++;
    } else {
      withoutResetTotal++;
      if (reachedRecovery) withoutResetReached++;
    }
  }

  if (withResetTotal < 3 || withoutResetTotal < 3) return null;

  const rateWith = withResetReached / withResetTotal;
  const rateWithout = withoutResetReached / withoutResetTotal;
  if (rateWith <= rateWithout) return null; // Reset didn't help — skip

  const pctWith = Math.round(rateWith * 100);
  const pctWithout = Math.round(rateWithout * 100);

  return {
    text: 'Starting a breathing reset significantly improves your path back to calm.',
    evidence: `${pctWith}% recovery with reset vs ${pctWithout}% without · ${withResetTotal} resets`,
    iconKey: 'load',
    confidence: rateWith - rateWithout,
  };
}

// ──────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────

/**
 * Compute Pattern Mirror observations from the last `daysBack` days of data.
 *
 * - If cache exists and is < 24h old, return cached.
 * - If < 7 days of transition data, return cold-start placeholder.
 * - Otherwise run all 5 rules and return up to 4 observations.
 *
 * @param store - The V2 SessionStore (returned by createSessionStore).
 * @param daysBack - Number of days to look back (default 12, per ADR-017).
 */
export async function computeMirrorObservations(
  store: SessionStore,
  daysBack = 12,
): Promise<MirrorObservation[]> {
  const now = Date.now();
  const today = toLocalDateString(now);

  // ── Cache check ──────────────────────────────────────────────────────
  const cached = await store.getPatternMirrorSnapshot(today);
  if (cached && now - cached.computedAt < CACHE_TTL_MS) {
    return cached.observations;
  }

  // ── Fetch raw data ───────────────────────────────────────────────────
  const lookbackMs = daysBack * 24 * 60 * 60_000;
  const sinceTs = now - lookbackMs;
  const allTransitions = await store.getTransitionsSince(sinceTs);
  const allInterventions = await store.getInterventionsSince(sinceTs);

  // ── Cold-start check ─────────────────────────────────────────────────
  // Count distinct days that have any transition data.
  const distinctDays = new Set(allTransitions.map((t) => toLocalDateString(t.ts)));
  if (distinctDays.size < MIN_DAYS_FOR_MIRROR) {
    const placeholder: MirrorObservation[] = [
      {
        text: 'Pattern Mirror unlocks after 7 days of observation.',
        evidence: 'Cold-start',
        iconKey: 'load',
        confidence: 0,
      },
    ];
    await store.putPatternMirrorSnapshot(today, { computedAt: now, observations: placeholder });
    return placeholder;
  }

  // ── Build per-day transition buckets ─────────────────────────────────
  const transitionsByDay = new Map<string, typeof allTransitions>();
  for (const t of allTransitions) {
    const day = toLocalDateString(t.ts);
    if (!transitionsByDay.has(day)) transitionsByDay.set(day, []);
    transitionsByDay.get(day)!.push(t);
  }

  // ── Intervention timestamps for Rule 2 ───────────────────────────────
  const interventionTs = allInterventions.map((i) => i.ts);

  // ── Run rules ────────────────────────────────────────────────────────
  const observations: MirrorObservation[] = [];

  const r1 = ruleSleepDebt(transitionsByDay as Map<string, Array<{
    from_state: string; to_state: string; breath_bpm?: number; ts: number;
  }>>);
  if (r1) observations.push(r1);

  if (observations.length < MAX_OBSERVATIONS) {
    const r2 = ruleRecoveryChannel(transitionsByDay as Map<string, Array<{
      from_state: string; to_state: string; ts: number;
    }>>, interventionTs);
    if (r2) observations.push(r2);
  }

  if (observations.length < MAX_OBSERVATIONS) {
    const r3 = ruleDayOfWeek(allTransitions);
    if (r3) observations.push(r3);
  }

  if (observations.length < MAX_OBSERVATIONS) {
    const r4 = ruleWeeklyLoadDrift(allTransitions, now);
    if (r4) observations.push(r4);
  }

  if (observations.length < MAX_OBSERVATIONS) {
    const r5 = ruleResetEffectiveness(allTransitions, allInterventions);
    if (r5) observations.push(r5);
  }

  // ── Cache and return ──────────────────────────────────────────────────
  const snapshot: PatternMirrorSnapshot = { computedAt: now, observations };
  await store.putPatternMirrorSnapshot(today, snapshot);
  return observations;
}
