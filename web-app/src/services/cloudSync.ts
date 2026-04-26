// cloudSync.ts — write-only Supabase mirror for the Memory bounded context.
//
// Per ADR-007 + Memory DDD §Aggregates #2 (SupabaseSync), this is the ONLY
// site in the codebase that calls `*.supabase.co`. Privacy invariants:
//
//   1. Never serialise raw vitals series (Memory DDD invariant 1).
//   2. Never serialise user-typed text (Memory DDD invariant 2).
//   3. Every row carries `user_id = 'demo-user-001'` (Memory DDD invariant 3).
//   6. IDB is the source of truth — failed cloud writes are LOGGED but never
//      re-thrown to callers (Memory DDD invariant 6).
//
// Fail-soft: when the env vars `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
// are missing the module degrades to a no-op. The app still runs; judges who
// don't run Supabase locally still see the demo work without crashes. This
// matches the "structural privacy by what we send, not by a runtime
// kill-switch" framing in Memory DDD invariant 4.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { StateTransition } from '../types/state';
import type { Intervention } from '../types/intervention';
import type { MorningRow } from '../types/session';

/** Hardcoded user identifier for V1 per ADR-007. */
export const DEMO_USER_ID = 'demo-user-001';

export interface CloudSync {
  /** Insert a state transition. Fire-and-forget; never throws. */
  insertTransition(t: StateTransition): Promise<void>;
  /** Insert a rendered intervention. Fire-and-forget; never throws. */
  insertIntervention(i: Intervention): Promise<void>;
  /** Read the last `sinceMs` window of state_transitions for the demo user. */
  morningCheckCloud(sinceMs: number): Promise<MorningRow[]>;
  /** True iff env vars are present; false collapses every write to a no-op. */
  isEnabled(): boolean;
}

export interface CloudSyncOpts {
  /** Override for tests; the production module reads `import.meta.env`. */
  url?: string;
  /** Override for tests; the production module reads `import.meta.env`. */
  anonKey?: string;
  /** Override for tests; defaults to DEMO_USER_ID. */
  userId?: string;
  /** Override for tests; defaults to `createClient`. */
  clientFactory?: (url: string, anonKey: string) => SupabaseClient;
}

let envWarningLogged = false;

/**
 * Construct a CloudSync handle.
 *
 * If env vars are missing, `isEnabled()` returns false and every insert is
 * a no-op. This keeps the demo working without a Supabase project — the
 * morning_check still runs against IndexedDB.
 */
export function createCloudSync(opts: CloudSyncOpts = {}): CloudSync {
  const url = opts.url ?? import.meta.env.VITE_SUPABASE_URL;
  const anonKey = opts.anonKey ?? import.meta.env.VITE_SUPABASE_ANON_KEY;
  const userId = opts.userId ?? DEMO_USER_ID;

  let client: SupabaseClient | null = null;
  if (typeof url === 'string' && url.length > 0 && typeof anonKey === 'string' && anonKey.length > 0) {
    const factory = opts.clientFactory ?? createClient;
    client = factory(url, anonKey);
  } else if (!envWarningLogged) {
    envWarningLogged = true;
    console.info(
      '[cloudSync] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing — running in local-only mode (no cloud writes).',
    );
  }

  function isEnabled(): boolean {
    return client !== null;
  }

  // ──────────────────────────────────────────────────────────────────────
  // Anti-corruption layer (Memory DDD §Anti-corruption): camelCase domain
  // value objects → snake_case Supabase row shapes (per build plan §8).
  // No raw vitals series, no user-typed text.
  // ──────────────────────────────────────────────────────────────────────

  async function insertTransition(t: StateTransition): Promise<void> {
    if (!client) return;
    try {
      const { error } = await client.from('state_transitions').insert({
        id: t.id,
        user_id: userId,
        ts: new Date(t.ts).toISOString(),
        from_state: t.from,
        to_state: t.to,
        trigger_reason: t.reason,
        // Single sample-at-transition values only; never a series.
        breath_bpm: t.breathBpm,
        hr_bpm: t.hrBpm,
      });
      if (error) {
        console.warn('[cloudSync] insertTransition failed:', error.message);
      }
    } catch (e) {
      console.warn('[cloudSync] insertTransition threw:', e);
    }
  }

  async function insertIntervention(i: Intervention): Promise<void> {
    if (!client) return;
    try {
      const { error } = await client.from('interventions').insert({
        user_id: userId,
        transition_id: i.transitionId,
        affirmation_id: i.affirmationId,
        breath_pattern: i.breathPattern,
        ts: new Date(i.ts).toISOString(),
      });
      if (error) {
        console.warn('[cloudSync] insertIntervention failed:', error.message);
      }
    } catch (e) {
      console.warn('[cloudSync] insertIntervention threw:', e);
    }
  }

  async function morningCheckCloud(sinceMs: number): Promise<MorningRow[]> {
    if (!client) return [];
    try {
      const since = new Date(Date.now() - sinceMs).toISOString();
      const { data, error } = await client
        .from('state_transitions')
        .select('id, ts, from_state, to_state, trigger_reason, breath_bpm')
        .eq('user_id', userId)
        .gte('ts', since)
        .order('ts', { ascending: false });
      if (error) {
        console.warn('[cloudSync] morningCheckCloud failed:', error.message);
        return [];
      }
      if (!Array.isArray(data)) return [];
      return data.map((r): MorningRow => ({
        id: String(r.id),
        ts: new Date(r.ts as string).getTime(),
        from_state: r.from_state as MorningRow['from_state'],
        to_state: r.to_state as MorningRow['to_state'],
        trigger_reason: r.trigger_reason ?? undefined,
        breath_bpm: r.breath_bpm == null ? undefined : Number(r.breath_bpm),
      }));
    } catch (e) {
      console.warn('[cloudSync] morningCheckCloud threw:', e);
      return [];
    }
  }

  return { insertTransition, insertIntervention, morningCheckCloud, isEnabled };
}
