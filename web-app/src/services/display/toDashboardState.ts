/**
 * Pure 3→4 state mapping function per ADR-015 §"The mapping".
 *
 * Invariants:
 * - Deterministic: same input always yields same output.
 * - No IO, no Date.now, no global mutable state.
 * - Sensor wins over any agent advisory — callers must never override this output.
 *
 * Ownership: foundation-coder (Sprint A Block 1, task DA-B1-T2).
 */

import type {
  DashboardState,
  DashboardStateInput,
} from '../../types/display';

/**
 * Derives a 4-valued display label from the 3-state worker classification
 * plus optional severity / dwell / signal inputs.
 *
 * Mapping table (ADR-015):
 *
 * | Internal state | Condition                                           | Display label |
 * |----------------|-----------------------------------------------------|---------------|
 * | regulated      | always                                              | steady        |
 * | activated      | dwellMs < 60_000 OR severity < 0.5                  | shifting      |
 * | activated      | dwellMs >= 60_000 AND severity >= 0.5               | overloaded    |
 * | recovering     | breathBpm > regulatedBaseline + 2                   | shifting      |
 * | recovering     | breathBpm <= regulatedBaseline (or via stillness)   | drained       |
 * | recovering     | breathBpm / baseline missing                        | shifting (fallback) |
 */
export function toDashboardState(input: DashboardStateInput): DashboardState {
  const { state, severity, dwellMs, breathBpm, regulatedBaseline, posturalStillness } = input;

  // -------------------------------------------------------------------------
  // regulated → always steady
  // -------------------------------------------------------------------------
  if (state === 'regulated') {
    return 'steady';
  }

  // -------------------------------------------------------------------------
  // activated → shifting or overloaded based on dwell + severity
  // -------------------------------------------------------------------------
  if (state === 'activated') {
    const longDwell = dwellMs >= 60_000;
    const highSeverity = severity >= 0.5;
    if (longDwell && highSeverity) {
      return 'overloaded';
    }
    return 'shifting';
  }

  // -------------------------------------------------------------------------
  // recovering → drained or shifting
  //
  // Load-bearing rule (ADR-015): when V2 signals are present AND
  // posturalStillness > 0.6 while recovering, prefer `drained` — the body
  // has crashed below baseline regardless of breath measurement.
  // -------------------------------------------------------------------------
  if (state === 'recovering') {
    // V2 signal override: postural stillness > 0.6 wins when present
    if (posturalStillness !== undefined && posturalStillness > 0.6) {
      return 'drained';
    }

    // Breath-based fallback: requires both breathBpm and regulatedBaseline
    if (breathBpm !== undefined && regulatedBaseline !== undefined) {
      if (breathBpm > regulatedBaseline + 2) {
        return 'shifting'; // still elevated above baseline
      }
      return 'drained'; // at or below baseline — post-crash / shutdown analogue
    }

    // Missing breathBpm or regulatedBaseline → conservative fallback
    return 'shifting';
  }

  // TypeScript exhaustiveness guard — State is a closed union; this is
  // unreachable at runtime but ensures the function always returns.
  return 'shifting';
}
