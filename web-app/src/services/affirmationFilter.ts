// affirmationFilter.ts — pure-function selector for the Intervention bounded context.
//
// Responsibilities (per docs/ddd/03_intervention_context.md):
//   1. Filter the corpus by the requested `state` (invariant 1, state match).
//   2. Exclude any id present in `recentIds` (invariant 2, recency window).
//   3. If recency exclusion would empty the surviving set, relax the recency
//      list one entry at a time, dropping the OLDEST id first
//      (invariant 2, partial relaxation; state match is non-negotiable).
//   4. Pick uniformly at random from the survivors using the injected RNG so
//      tests can seed `Math.random` for determinism.
//   5. Pair the chosen affirmation with the canonical `BreathPattern` for the
//      requested state — invariant 7, state drives BreathPattern.
//
// `recentIds` is treated as a chronologically ordered list (oldest first,
// newest last). This matches `MemoryAPI.recentAffirmationIds()` returning the
// last 5 in insertion order; relaxation drops the head.

import type { Affirmation, BreathPattern, Intervention } from '../types/intervention';
import type { State } from '../types/state';

/** Canonical State → BreathPattern map. Mirrors `data/breathPatterns.json`. */
export const breathPatternForState: Record<State, BreathPattern> = {
  regulated: 'natural',
  activated: 'cyclic_sigh',
  recovering: 'extended_exhale',
};

export interface PickArgs {
  corpus: Affirmation[];
  state: State;
  transitionId: string;
  /** Last 5 ids shown to this user (oldest first). */
  recentIds: string[];
  ts: number;
  /** Injectable RNG for seeded tests; defaults to `Math.random`. */
  random?: () => number;
}

/**
 * Pick a state-matched affirmation, honouring the recency window, and pair it
 * with the canonical breath pattern for the state.
 *
 * Throws if the corpus contains no entry for the requested state — an empty
 * state-filtered set is malformed corpus, not a recoverable runtime condition.
 */
export function pickAffirmation(args: PickArgs): Intervention {
  const { corpus, state, transitionId, recentIds, ts } = args;
  const random = args.random ?? Math.random;

  // Step 1 — state filter (invariant 1). If empty here, the corpus itself is
  // malformed: surface a clear error rather than silently misbehaving.
  const stateMatched = corpus.filter((a) => a.state === state);
  if (stateMatched.length === 0) {
    throw new Error(
      `affirmationFilter: corpus has no affirmation for state="${state}"`,
    );
  }

  // Step 2 — recency exclusion with progressive relaxation (invariant 2).
  // Walk a copy of `recentIds` from oldest → newest, dropping one entry at a
  // time until the surviving candidate set is non-empty. State match is never
  // relaxed — only recency.
  let exclusion = new Set(recentIds);
  let candidates = stateMatched.filter((a) => !exclusion.has(a.id));
  // `recentRelaxable` shadows recentIds so we can pop the oldest each loop.
  const recentRelaxable = [...recentIds];
  while (candidates.length === 0 && recentRelaxable.length > 0) {
    recentRelaxable.shift(); // drop the oldest id from the recency window
    exclusion = new Set(recentRelaxable);
    candidates = stateMatched.filter((a) => !exclusion.has(a.id));
  }

  // Defensive: at this point the loop has either found candidates or fully
  // emptied the recency list. Since stateMatched is non-empty (checked above),
  // candidates must now contain at least the entire stateMatched set.
  if (candidates.length === 0) {
    // Should be unreachable; kept as a guard against future refactors.
    candidates = stateMatched;
  }

  // Step 3 — uniform random pick from survivors.
  const idx = Math.floor(random() * candidates.length);
  const picked = candidates[Math.min(idx, candidates.length - 1)];

  // Step 4 — pair with the canonical breath pattern for the state
  // (invariant 7). modality is intentionally NOT consulted here.
  return {
    transitionId,
    affirmationId: picked.id,
    breathPattern: breathPatternForState[state],
    ts,
  };
}
