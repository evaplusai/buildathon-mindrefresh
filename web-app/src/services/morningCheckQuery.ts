// morningCheckQuery.ts — anti-corruption layer for the morning_check trigger.
//
// Per Memory DDD §Anti-corruption + §Aggregates #3
// (docs/ddd/04_memory_context.md):
//
//   "Translates Supabase rows + IDB rows into the unified MorningRow[]
//    the State worker expects. Supabase wins on `id` collision, since it
//    is the canonical cross-device source."
//
// Sprint D V1 — IDB ALWAYS, Supabase if `cloudSync.isEnabled()`. The
// State worker continues to receive the same `MorningRow[]` shape sorted
// descending by ts.
//
// Failure semantics: a failed cloud read NEVER masks the IDB rows. The
// cloud read is wrapped in `.catch(() => [])` so the worker still sees the
// local truth even with the network down (Memory DDD invariant 6).

import type { MemoryAPI, MorningRow } from '../types/session';
import type { CloudSync } from './cloudSync';

export type MorningCheckQuery = (sinceMs: number) => Promise<MorningRow[]>;

/**
 * Produce the morning-check query function bound to the given store and
 * cloud sync.
 *
 * - If `cloudSync.isEnabled() === false`: returns IDB rows only.
 * - Otherwise: queries IDB and Supabase in parallel, merges by `id`
 *   (Supabase wins on collision), returns sorted desc by ts.
 */
export function createMorningCheckQuery(
  store: MemoryAPI,
  cloudSync?: CloudSync,
): MorningCheckQuery {
  return async (sinceMs: number): Promise<MorningRow[]> => {
    const localPromise = store.morningCheckQuery(sinceMs);

    if (!cloudSync || !cloudSync.isEnabled()) {
      return localPromise;
    }

    const cloudPromise = cloudSync
      .morningCheckCloud(sinceMs)
      .catch(() => [] as MorningRow[]);

    const [localRows, cloudRows] = await Promise.all([localPromise, cloudPromise]);

    // Merge by `id`. IDB rows go in first; cloud rows overwrite on collision
    // because cloud is the canonical cross-device source per Memory DDD
    // §Aggregates #3.
    const merged = new Map<string, MorningRow>();
    for (const row of localRows) merged.set(row.id, row);
    for (const row of cloudRows) merged.set(row.id, row);

    return Array.from(merged.values()).sort((a, b) => b.ts - a.ts);
  };
}
