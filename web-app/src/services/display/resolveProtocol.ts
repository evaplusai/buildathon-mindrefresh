/**
 * resolveProtocol.ts — Protocol selection rule per ADR-018 §A.
 *
 * Single source of truth for which BreathProtocol the BreathingModal runs:
 *   1. If a recent ReflectRun (within 5 min) has a non-empty Agent 3 protocol
 *      advisory, use that.
 *   2. Otherwise fall back to the state-based default table:
 *        shifting    → physiological_sigh
 *        overloaded  → physiological_sigh
 *        drained     → box_breath
 *        steady      → physiological_sigh  (user-initiated "I need a moment")
 *
 * Ownership: aggregators-coder (Sprint A Block 3, task DA-B3-T10).
 */

import type { DashboardState, BreathProtocol } from '../../types/display';

/** Five-minute freshness window for Agent 3 advisory (ADR-018 §A). */
const RECENT_RUN_TTL_MS = 5 * 60_000;

export interface RecentReflectRun {
  /** Unix timestamp (ms) when the run completed. */
  ts: number;
  /** Protocol recommended by Agent 3. */
  protocol: BreathProtocol;
}

/**
 * Resolve the breath protocol to use for the BreathingModal.
 *
 * @param opts.recentRun - The most recent ReflectRun, if any.
 * @param opts.dashboardState - The current sensor-derived dashboard state.
 * @param opts.now - Current timestamp in ms (injectable for deterministic tests).
 * @returns The BreathProtocol to pass to the modal.
 */
export function resolveProtocol(opts: {
  recentRun?: RecentReflectRun;
  dashboardState: DashboardState;
  now: number;
}): BreathProtocol {
  const { recentRun, dashboardState, now } = opts;

  // Rule 1: Agent 3 advisory — use if fresh (within 5 min).
  if (recentRun && now - recentRun.ts < RECENT_RUN_TTL_MS) {
    return recentRun.protocol;
  }

  // Rule 2: State-based fallback table (ADR-018 §A).
  switch (dashboardState) {
    case 'drained':
      return 'box_breath';
    case 'shifting':
    case 'overloaded':
    case 'steady':
    default:
      return 'physiological_sigh';
  }
}
