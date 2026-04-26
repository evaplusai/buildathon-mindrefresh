// 3-state breath-trajectory classifier (V1, ADR-010).
//
// Pure function over a VitalsRingBuffer + the current State. Never mutates
// anything; the only side effect is producing the next-state verdict.
//
// References:
//   docs/adr/ADR-010-three-state-breath-trajectory-classifier.md
//   docs/02_research/05_canonical_build_plan.md §4
//   docs/ddd/02_state_context.md (invariants 1, 2, 5)

import type { VitalsRingBuffer } from '../services/vitalsRingBuffer';
import type { State } from '../types/state';

export interface RegulatedRule {
  breathMin: number;
  breathMax: number;
  trend: 'flat_or_descending';
}

export interface ActivatedRule {
  breathMin: number;
  trend: 'rising_gt_1bpm_per_min';
  sustainSeconds: number;
}

export interface RecoveringRule {
  trend: 'descending_gt_0.5bpm_per_min';
  sustainSeconds: number;
}

export interface StateRulesConfig {
  regulated: RegulatedRule;
  activated: ActivatedRule;
  recovering: RecoveringRule;
  debounceSeconds: number;
}

export interface ClassifyArgs {
  ringBuffer: VitalsRingBuffer;
  current: State;
  lastTransitionTs: number;
  now: number;
  rules: StateRulesConfig;
}

export interface ClassifyResult {
  next: State;
  reason: string;
}

// Numerical thresholds derived from the rule strings. The JSON file remains
// the only source of breath/sustain numbers; these constants only encode the
// fixed slope/flat-tolerance language baked into the rule names per ADR-010.
const RISING_BPM_PER_MIN = 1;
const DESCENT_BPM_PER_MIN = 0.5;
const FLAT_TREND_TOLERANCE = 0.5; // |slope| < 0.5 BPM/min counts as "flat"
// Allow the entry-condition window to be considered "full" when at least
// 95% of the requested span has accumulated. Absorbs sub-second sample jitter
// without weakening the 60 s / 30 s contracts.
const WINDOW_FULL_RATIO = 0.95;

/**
 * Decide whether the classifier should transition out of `current` given the
 * latest contents of the ring buffer.
 *
 * Returns the next state plus a human-readable reason on transition; returns
 * `null` when no transition is warranted (either because the entry-condition
 * window is not yet satisfied, the 5 s minimum dwell has not elapsed, or the
 * data simply does not justify a move).
 *
 * Pure: never mutates `args.ringBuffer` or any other input.
 */
export function classify(args: ClassifyArgs): ClassifyResult | null {
  const { ringBuffer, current, lastTransitionTs, now, rules } = args;
  const latest = ringBuffer.latest();
  if (!latest || latest.breathBpm == null) return null;

  // Invariant 1 — 5 s minimum dwell on every transition.
  const debounceMs = rules.debounceSeconds * 1000;
  if (now - lastTransitionTs < debounceMs) return null;

  const breath = latest.breathBpm;

  switch (current) {
    case 'regulated':
      return regulatedToActivated(ringBuffer, breath, rules);
    case 'activated':
      return activatedToRecovering(ringBuffer, rules);
    case 'recovering':
      return (
        recoveringToActivated(ringBuffer, rules) ??
        recoveringToRegulated(ringBuffer, breath, rules)
      );
    /* c8 ignore next */
    default:
      return null;
  }
}

function regulatedToActivated(
  buf: VitalsRingBuffer,
  breath: number,
  rules: StateRulesConfig,
): ClassifyResult | null {
  const sustainMs = rules.activated.sustainSeconds * 1000;
  if (!windowFull(buf, sustainMs)) return null;
  if (breath <= rules.activated.breathMin) return null;

  const slope = buf.slopeBreath(sustainMs);
  if (slope == null || slope < RISING_BPM_PER_MIN) return null;

  // Sustained-above-threshold check: every breath sample inside the
  // sustain window must sit above the activation threshold so a single
  // late spike alone cannot flip the state.
  if (!sustainedAbove(buf, rules.activated.breathMin, sustainMs)) return null;

  return {
    next: 'activated',
    reason: `breath rose >${RISING_BPM_PER_MIN} BPM/min for ${rules.activated.sustainSeconds}s above ${rules.activated.breathMin} BPM`,
  };
}

function activatedToRecovering(
  buf: VitalsRingBuffer,
  rules: StateRulesConfig,
): ClassifyResult | null {
  const sustainMs = rules.recovering.sustainSeconds * 1000;
  if (!windowFull(buf, sustainMs)) return null;
  const slope = buf.slopeBreath(sustainMs);
  if (slope == null || slope > -DESCENT_BPM_PER_MIN) return null;

  return {
    next: 'recovering',
    reason: `breath descended >${DESCENT_BPM_PER_MIN} BPM/min for ${rules.recovering.sustainSeconds}s`,
  };
}

function recoveringToRegulated(
  buf: VitalsRingBuffer,
  breath: number,
  rules: StateRulesConfig,
): ClassifyResult | null {
  const sustainMs = rules.recovering.sustainSeconds * 1000;
  if (!windowFull(buf, sustainMs)) return null;
  if (breath < rules.regulated.breathMin || breath > rules.regulated.breathMax) {
    return null;
  }
  const slope = buf.slopeBreath(sustainMs);
  if (slope == null || Math.abs(slope) >= FLAT_TREND_TOLERANCE) return null;
  if (
    !sustainedWithin(
      buf,
      rules.regulated.breathMin,
      rules.regulated.breathMax,
      sustainMs,
    )
  ) {
    return null;
  }
  return {
    next: 'regulated',
    reason: `breath stayed in ${rules.regulated.breathMin}-${rules.regulated.breathMax} BPM with flat trend for ${rules.recovering.sustainSeconds}s`,
  };
}

function recoveringToActivated(
  buf: VitalsRingBuffer,
  rules: StateRulesConfig,
): ClassifyResult | null {
  const sustainMs = rules.recovering.sustainSeconds * 1000;
  if (!windowFull(buf, sustainMs)) return null;
  const slope = buf.slopeBreath(sustainMs);
  if (slope == null || slope <= RISING_BPM_PER_MIN) return null;
  return {
    next: 'activated',
    reason: `breath descent reversed: rising >${RISING_BPM_PER_MIN} BPM/min during recovery`,
  };
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Helpers                                                                  */
/* ──────────────────────────────────────────────────────────────────────── */

function windowFull(buf: VitalsRingBuffer, windowMs: number): boolean {
  const span = buf.spanMs(windowMs);
  return span != null && span >= windowMs * WINDOW_FULL_RATIO;
}

function sustainedAbove(
  buf: VitalsRingBuffer,
  threshold: number,
  windowMs: number,
): boolean {
  const samples = buf.samplesIn(windowMs);
  if (samples.length < 2) return false;
  return samples.every(
    (s) => s.breathBpm != null && s.breathBpm > threshold,
  );
}

function sustainedWithin(
  buf: VitalsRingBuffer,
  min: number,
  max: number,
  windowMs: number,
): boolean {
  const samples = buf.samplesIn(windowMs);
  if (samples.length < 2) return false;
  return samples.every(
    (s) =>
      s.breathBpm != null && s.breathBpm >= min && s.breathBpm <= max,
  );
}
