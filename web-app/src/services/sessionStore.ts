// sessionStore.ts — IndexedDB-backed SessionStore aggregate (Memory DDD).
//
// Source of truth for the SPA. Full-fidelity local persistence per
// docs/ddd/04_memory_context.md §Aggregates and §Invariants:
//
//   • Always-local writes (IDB never fails the caller).
//   • Append-only — no updates to transitions/interventions/feedback/whats_alive.
//   • user_id is hardcoded to 'demo-user-001' per ADR-007.
//   • Structural privacy: this file MUST NOT call `fetch`. The Supabase
//     mirror (Sprint D) lives in a separate `cloudSync.ts` and is wired
//     alongside this store by the Dashboard.
//
// Schema (DB `mindrefresh-v1`, 4 object stores):
//   • transitions      keyPath=id, indexes by_ts, by_user_id_ts
//   • interventions    keyPath=id, indexes by_user_id_ts, by_transition_id
//   • feedback         keyPath=id, indexes by_transition_id, by_ts
//   • whats_alive      keyPath=id, indexes by_transition_id, by_ts
//
// The `MorningRow` shape is the snake_case row used by the cross-context
// boundary (this file is the anti-corruption layer per Memory DDD
// §Anti-corruption — internal `StateTransition.from` becomes external
// `from_state`, etc.).

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

import type { State, StateTransition } from '../types/state';
import type { Intervention } from '../types/intervention';
import type { MemoryAPI, MorningRow } from '../types/session';
import type { Unsubscribe } from '../types/vitals';

/** Hardcoded user identifier for V1 per ADR-007. */
export const DEMO_USER_ID = 'demo-user-001';

/** Database name + version. Bump version if schema changes. */
const DB_NAME = 'mindrefresh-v1';
const DB_VERSION = 1;

/** Internal IDB row shape for transitions — snake_case to match the
 *  Supabase `state_transitions` schema (build plan §8) so the IDB rows
 *  are directly the rows the morning_check query returns. */
interface TransitionRow {
  id: string;
  user_id: string;
  ts: number;
  from_state: State;
  to_state: State;
  trigger_reason?: string;
  breath_bpm?: number;
  hr_bpm?: number;
  /** Convenience: the latest presence value at transition (true unless the
   *  user disappears mid-session). Used by `getLastPresence()` in the
   *  worker snapshot. */
  presence?: boolean;
}

interface InterventionRow {
  id: string;
  user_id: string;
  ts: number;
  transition_id: string;
  affirmation_id: string;
  breath_pattern: string;
}

interface FeedbackRow {
  id: string;
  ts: number;
  transition_id: string;
  signal: 'helped' | 'neutral' | 'unhelpful';
}

interface WhatsAliveRow {
  id: string;
  ts: number;
  transition_id: string;
  text: string;
}

interface MindRefreshDB extends DBSchema {
  transitions: {
    key: string;
    value: TransitionRow;
    indexes: { by_ts: number; by_user_id_ts: [string, number] };
  };
  interventions: {
    key: string;
    value: InterventionRow;
    indexes: {
      by_user_id_ts: [string, number];
      by_transition_id: string;
    };
  };
  feedback: {
    key: string;
    value: FeedbackRow;
    indexes: { by_transition_id: string; by_ts: number };
  };
  whats_alive: {
    key: string;
    value: WhatsAliveRow;
    indexes: { by_transition_id: string; by_ts: number };
  };
}

export interface SessionStoreOpts {
  /** Override DB name — primarily for tests that want isolation. */
  dbName?: string;
  /** UUID minter; defaults to `crypto.randomUUID()`. */
  newId?: () => string;
  /** Override `user_id` — primarily for tests that want isolation. */
  userId?: string;
}

type PersistedKind = 'transition' | 'intervention' | 'feedback' | 'whats_alive';

/**
 * Construct a SessionStore — the IDB-backed `MemoryAPI` aggregate.
 *
 * IMPORTANT: this returns a SYNC handle to an ASYNC underlying database;
 * the IDB connection is opened lazily on first use. Every public method
 * is async and awaits the connection before doing work.
 */
export function createSessionStore(opts: SessionStoreOpts = {}): MemoryAPI {
  const dbName = opts.dbName ?? DB_NAME;
  const userId = opts.userId ?? DEMO_USER_ID;
  const newId = opts.newId ?? (() => globalThis.crypto.randomUUID());

  let dbPromise: Promise<IDBPDatabase<MindRefreshDB>> | null = null;
  function getDb(): Promise<IDBPDatabase<MindRefreshDB>> {
    if (!dbPromise) {
      dbPromise = openDB<MindRefreshDB>(dbName, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('transitions')) {
            const s = db.createObjectStore('transitions', { keyPath: 'id' });
            s.createIndex('by_ts', 'ts');
            s.createIndex('by_user_id_ts', ['user_id', 'ts']);
          }
          if (!db.objectStoreNames.contains('interventions')) {
            const s = db.createObjectStore('interventions', { keyPath: 'id' });
            s.createIndex('by_user_id_ts', ['user_id', 'ts']);
            s.createIndex('by_transition_id', 'transition_id');
          }
          if (!db.objectStoreNames.contains('feedback')) {
            const s = db.createObjectStore('feedback', { keyPath: 'id' });
            s.createIndex('by_transition_id', 'transition_id');
            s.createIndex('by_ts', 'ts');
          }
          if (!db.objectStoreNames.contains('whats_alive')) {
            const s = db.createObjectStore('whats_alive', { keyPath: 'id' });
            s.createIndex('by_transition_id', 'transition_id');
            s.createIndex('by_ts', 'ts');
          }
        },
      });
    }
    return dbPromise;
  }

  const persistedListeners = new Set<(e: { kind: PersistedKind }) => void>();
  function emitPersisted(kind: PersistedKind) {
    persistedListeners.forEach((cb) => cb({ kind }));
  }

  // ──────────────────────────────────────────────────────────────────────
  // Anti-corruption layer: domain → IDB row.
  // Per Memory DDD §Anti-corruption, internal value objects (camelCase
  // `from`, `to`, `breathBpm`, …) are translated here to the snake_case
  // row shape that matches the Supabase schema in build plan §8.
  // ──────────────────────────────────────────────────────────────────────

  function transitionToRow(t: StateTransition): TransitionRow {
    const row: TransitionRow = {
      id: t.id,
      user_id: userId,
      ts: t.ts,
      from_state: t.from,
      to_state: t.to,
      trigger_reason: t.reason,
      // Per Memory DDD invariant 1: store the SAMPLE-AT-TRANSITION value
      // only (a single scalar). Never a series.
      breath_bpm: t.breathBpm,
      hr_bpm: t.hrBpm,
      presence: true,
    };
    return row;
  }

  function rowToMorningRow(r: TransitionRow): MorningRow {
    return {
      id: r.id,
      ts: r.ts,
      from_state: r.from_state,
      to_state: r.to_state,
      trigger_reason: r.trigger_reason,
      breath_bpm: r.breath_bpm,
    };
  }

  // ──────────────────────────────────────────────────────────────────────
  // MemoryAPI
  // ──────────────────────────────────────────────────────────────────────

  async function appendTransition(t: StateTransition): Promise<void> {
    const db = await getDb();
    await db.put('transitions', transitionToRow(t));
    emitPersisted('transition');
  }

  async function appendIntervention(i: Intervention): Promise<void> {
    const db = await getDb();
    const row: InterventionRow = {
      id: newId(),
      user_id: userId,
      ts: i.ts,
      transition_id: i.transitionId,
      affirmation_id: i.affirmationId,
      breath_pattern: i.breathPattern,
    };
    await db.put('interventions', row);
    emitPersisted('intervention');
  }

  async function appendFeedback(f: {
    transitionId: string;
    signal: 'helped' | 'neutral' | 'unhelpful';
  }): Promise<void> {
    const db = await getDb();
    const row: FeedbackRow = {
      id: newId(),
      ts: Date.now(),
      transition_id: f.transitionId,
      signal: f.signal,
    };
    await db.put('feedback', row);
    emitPersisted('feedback');
  }

  /**
   * Append the user-typed "what's alive" sentence. IDB ONLY — per Memory
   * DDD invariant 2 + ADR-007, no Supabase column for user-typed text in
   * V1. This function MUST NOT call `fetch`.
   */
  async function appendWhatsAlive(text: string, transitionId: string): Promise<void> {
    const db = await getDb();
    const row: WhatsAliveRow = {
      id: newId(),
      ts: Date.now(),
      transition_id: transitionId,
      text,
    };
    await db.put('whats_alive', row);
    emitPersisted('whats_alive');
  }

  /**
   * Most-recent-first list of the last 5 affirmation ids (recency cap = 5
   * per Memory DDD invariant 7).
   */
  async function recentAffirmationIds(): Promise<string[]> {
    const db = await getDb();
    const tx = db.transaction('interventions', 'readonly');
    const idx = tx.store.index('by_user_id_ts');
    // Walk descending from the end of the [user_id, ts] index.
    const range = IDBKeyRange.bound([userId, -Infinity], [userId, Infinity]);
    const results: string[] = [];
    let cursor = await idx.openCursor(range, 'prev');
    while (cursor && results.length < 5) {
      results.push(cursor.value.affirmation_id);
      cursor = await cursor.continue();
    }
    await tx.done;
    return results;
  }

  /**
   * Last `sinceMs` worth of state-transition rows in `MorningRow` shape,
   * sorted descending by ts. IDB-only in Sprint C; Sprint D's
   * `morningCheckQuery.ts` will merge Supabase rows by id.
   */
  async function morningCheckQuery(sinceMs: number): Promise<MorningRow[]> {
    const db = await getDb();
    const cutoff = Date.now() - sinceMs;
    const tx = db.transaction('transitions', 'readonly');
    const idx = tx.store.index('by_user_id_ts');
    const range = IDBKeyRange.bound([userId, cutoff], [userId, Infinity]);
    const rows = await idx.getAll(range);
    await tx.done;
    return rows
      .map(rowToMorningRow)
      .sort((a, b) => b.ts - a.ts);
  }

  function onPersisted(cb: (e: { kind: PersistedKind }) => void): Unsubscribe {
    persistedListeners.add(cb);
    return () => persistedListeners.delete(cb);
  }

  return {
    appendTransition,
    appendIntervention,
    appendFeedback,
    appendWhatsAlive,
    recentAffirmationIds,
    morningCheckQuery,
    onPersisted,
  };
}
