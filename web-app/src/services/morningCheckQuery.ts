// morningCheckQuery.ts — anti-corruption layer for the morning_check trigger.
//
// Per Memory DDD §Anti-corruption (docs/ddd/04_memory_context.md):
//   "Translates Supabase rows + IDB rows into the unified MorningRow[]
//    the State worker expects."
//
// Sprint C V1 — IDB ONLY. The function returned by `createMorningCheckQuery`
// is, for now, a thin delegate to `store.morningCheckQuery(sinceMs)`. The
// reason it lives in its own file is the cleaner Sprint D upgrade path:
//
//   Sprint D (per ADR-007 §Day 6 stretch / ADR-011): augment this file
//   with a Supabase read path, merge IDB + Supabase rows by `id`
//   (Supabase wins on `id` collision, per Memory DDD §Aggregates #3),
//   re-sort by ts desc, dedupe. The State worker continues to receive
//   the same `MorningRow[]` shape — no change needed in
//   `triggerWorker.ts` / `triggerDetectors.ts`.
//
// Until Sprint D, this file MUST NOT call `fetch`. ZERO HTTP.

import type { MemoryAPI, MorningRow } from '../types/session';

export type MorningCheckQuery = (sinceMs: number) => Promise<MorningRow[]>;

/**
 * Produce the morning-check query function bound to the given store.
 *
 * Sprint C: IDB only.
 * Sprint D: this is the seam where Supabase rows get merged in.
 */
export function createMorningCheckQuery(store: MemoryAPI): MorningCheckQuery {
  return (sinceMs: number) => store.morningCheckQuery(sinceMs);
}
