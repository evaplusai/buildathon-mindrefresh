/**
 * demoMode.ts — Scripted 44-second state arc for Demo Mode (?demo=1).
 *
 * Per ADR-017 §"Demo Mode (?demo=1)": a timer-driven state machine that
 * bypasses wsClient and drives DashboardState directly.
 *
 * Arc:
 *   0s  → steady
 *   4s  → shifting
 *   14s → overloaded
 *   26s → drained
 *   38s → steady (end of arc)
 *   44s → restart arc (loop)
 *
 * Invariants (DDD-07 §Aggregates #5):
 *   - stop() clears every pending timer; idempotent.
 *   - start() is idempotent (calling twice has no double-fire).
 *
 * Ownership: aggregators-coder (Sprint A Block 4, task DA-B4-T1).
 */

import type { DashboardState } from '../types/display';

export interface DemoArcRunner {
  /** Start the arc. Calls onState immediately with 'steady', then drives the
   *  remaining states on schedule. Idempotent: calling while already running
   *  has no effect. */
  start(onState: (s: DashboardState) => void): void;
  /** Stop all pending timers and mark the runner as inactive. Idempotent. */
  stop(): void;
  /** Returns true when the arc is actively running. */
  isActive(): boolean;
}

// Arc definition: [delayFromStartMs, state]
const ARC: Array<[number, DashboardState]> = [
  [0,     'steady'],
  [4000,  'shifting'],
  [14000, 'overloaded'],
  [26000, 'drained'],
  [38000, 'steady'],
];

/** Full arc duration; after this the loop restarts. */
const ARC_DURATION_MS = 44_000;

/**
 * Create a new DemoArcRunner.
 *
 * @returns A DemoArcRunner that can be started and stopped.
 */
export function createDemoArcRunner(): DemoArcRunner {
  let active = false;
  const timers: ReturnType<typeof setTimeout>[] = [];

  function clearAllTimers(): void {
    for (const t of timers) clearTimeout(t);
    timers.length = 0;
  }

  function scheduleArc(onState: (s: DashboardState) => void): void {
    for (const [delay, state] of ARC) {
      if (delay === 0) {
        // Fire immediately (synchronous) so the caller gets steady right away.
        onState(state);
      } else {
        timers.push(
          setTimeout(() => {
            if (active) onState(state);
          }, delay),
        );
      }
    }

    // Schedule the restart at 44s
    timers.push(
      setTimeout(() => {
        if (active) {
          clearAllTimers();
          scheduleArc(onState);
        }
      }, ARC_DURATION_MS),
    );
  }

  return {
    start(onState: (s: DashboardState) => void): void {
      // Idempotent: if already running, do nothing.
      if (active) return;

      active = true;
      scheduleArc(onState);
    },

    stop(): void {
      active = false;
      clearAllTimers();
    },

    isActive(): boolean {
      return active;
    },
  };
}
