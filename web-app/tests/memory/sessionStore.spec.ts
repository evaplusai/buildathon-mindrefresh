import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
// fake-indexeddb is registered globally via src/test/setup.ts.
import { IDBFactory } from 'fake-indexeddb';

import { createSessionStore, DEMO_USER_ID } from '../../src/services/sessionStore';
import { createMorningCheckQuery } from '../../src/services/morningCheckQuery';
import type { StateTransition } from '../../src/types/state';
import type { Intervention } from '../../src/types/intervention';

/**
 * Memory DDD §Invariants — structural privacy regression suite.
 *
 * These tests encode the invariants from docs/ddd/04_memory_context.md:
 *   1. No raw vitals series leave the device.
 *   2. No user-typed text leaves the device in V1.
 *   3. Every Supabase row carries user_id = 'demo-user-001'.
 *   7. recentAffirmationIds returns at most 5 ids, most-recent-first.
 *
 * Sprint C: the SessionStore is IDB-only — ZERO `fetch` calls. Sprint D
 * will add a separate cloudSync.ts; the spy will permit *.supabase.co
 * origins then.
 */

let fetchSpy: ReturnType<typeof vi.fn>;
let dbCounter = 0;
function nextDbName() {
  dbCounter += 1;
  return `mindrefresh-test-${Date.now()}-${dbCounter}`;
}

beforeEach(() => {
  // Reset IndexedDB between tests so stores start empty and we get
  // deterministic ordering on `recentAffirmationIds`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).indexedDB = new IDBFactory();
  fetchSpy = vi.fn(() =>
    Promise.resolve(new Response('', { status: 200 })),
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).fetch = fetchSpy;
});

afterEach(() => {
  vi.restoreAllMocks();
});

function makeTransition(overrides: Partial<StateTransition> = {}): StateTransition {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    ts: overrides.ts ?? Date.now(),
    from: overrides.from ?? 'regulated',
    to: overrides.to ?? 'activated',
    reason: overrides.reason ?? 'breath_rise',
    breathBpm: overrides.breathBpm ?? 17,
    hrBpm: overrides.hrBpm,
  };
}

function makeIntervention(transitionId: string, affirmationId: string, ts = Date.now()): Intervention {
  return {
    transitionId,
    affirmationId,
    breathPattern: 'natural',
    ts,
  };
}

describe('sessionStore — structural privacy invariants (Memory DDD)', () => {
  it('makes ZERO fetch calls across every public operation in V1 (no Supabase wired yet)', async () => {
    const store = createSessionStore({ dbName: nextDbName() });

    await store.appendTransition(makeTransition());
    await store.appendIntervention(makeIntervention('t-1', 'som-001'));
    await store.appendFeedback({ transitionId: 't-1', signal: 'helped' });
    await store.appendWhatsAlive('I felt my shoulders soften', 't-1');
    await store.recentAffirmationIds();
    await store.morningCheckQuery(24 * 3600_000);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('appendTransition does NOT serialize a breathBpm or hrBpm series (only single sample-at-transition values per §8 schema)', async () => {
    const dbName = nextDbName();
    const store = createSessionStore({ dbName });
    const t = makeTransition({
      id: 'tx-shape',
      ts: Date.now() - 60_000,
      breathBpm: 18,
      hrBpm: 72,
    });
    await store.appendTransition(t);

    const rows = await store.morningCheckQuery(24 * 3600_000);
    expect(rows).toHaveLength(1);
    const row = rows[0] as Record<string, unknown>;

    // Single scalar at-transition values are permitted; series fields
    // (arrays / buffers) MUST NOT be present.
    expect(typeof row.breath_bpm).toBe('number');
    for (const [k, v] of Object.entries(row)) {
      expect(Array.isArray(v), `field ${k} must not be an array (no series)`).toBe(false);
      expect(ArrayBuffer.isView(v), `field ${k} must not be a typed array`).toBe(false);
    }
  });

  it('appendWhatsAlive writes to IndexedDB and does NOT call fetch (V1: no Supabase column for user-typed text)', async () => {
    const store = createSessionStore({ dbName: nextDbName() });
    await store.appendWhatsAlive('a private sentence I would not want sent anywhere', 't-private');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('emits Persisted events on every successful append', async () => {
    const store = createSessionStore({ dbName: nextDbName() });
    const events: Array<{ kind: string }> = [];
    store.onPersisted((e) => events.push(e));

    await store.appendTransition(makeTransition());
    await store.appendIntervention(makeIntervention('t-1', 'som-001'));
    await store.appendFeedback({ transitionId: 't-1', signal: 'neutral' });
    await store.appendWhatsAlive('hello', 't-1');

    expect(events.map((e) => e.kind)).toEqual([
      'transition',
      'intervention',
      'feedback',
      'whats_alive',
    ]);
  });

  it('uses user_id = "demo-user-001" by default (ADR-007)', async () => {
    // Indirect verification: the `morningCheckQuery` index range filters by
    // user_id, so a row written under the default user must be readable
    // back via that path. A row written under a different user_id by a
    // *separate* store handle must NOT be visible.
    const dbName = nextDbName();
    const defaultStore = createSessionStore({ dbName });
    const otherStore = createSessionStore({ dbName, userId: 'other-user' });

    await defaultStore.appendTransition(makeTransition({ id: 'tx-default' }));
    await otherStore.appendTransition(makeTransition({ id: 'tx-other' }));

    const rows = await defaultStore.morningCheckQuery(24 * 3600_000);
    const ids = rows.map((r) => r.id);
    expect(ids).toContain('tx-default');
    expect(ids).not.toContain('tx-other');
    // Sanity: the constant exported matches the ADR.
    expect(DEMO_USER_ID).toBe('demo-user-001');
  });

  it('recentAffirmationIds returns at most 5 ids, ordered most-recent-first', async () => {
    const store = createSessionStore({ dbName: nextDbName() });
    const baseTs = 1_700_000_000_000;
    for (let i = 0; i < 7; i++) {
      await store.appendIntervention(
        makeIntervention(`t-${i}`, `som-${String(i).padStart(3, '0')}`, baseTs + i * 1000),
      );
    }

    const recent = await store.recentAffirmationIds();
    expect(recent).toHaveLength(5);
    // Most recent (i=6) first, then 5, 4, 3, 2.
    expect(recent).toEqual(['som-006', 'som-005', 'som-004', 'som-003', 'som-002']);
  });

  it('round-trip: appendTransition then morningCheckQuery returns the row in MorningRow shape (anti-corruption layer translates to snake_case)', async () => {
    const store = createSessionStore({ dbName: nextDbName() });
    const ts = Date.now() - 60_000;
    await store.appendTransition({
      id: 'tx-roundtrip',
      ts,
      from: 'regulated',
      to: 'activated',
      reason: 'breath_rise',
      breathBpm: 19,
    });

    const rows = await store.morningCheckQuery(24 * 3600_000);
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.id).toBe('tx-roundtrip');
    expect(row.ts).toBe(ts);
    expect(row.from_state).toBe('regulated');
    expect(row.to_state).toBe('activated');
    expect(row.trigger_reason).toBe('breath_rise');
    expect(row.breath_bpm).toBe(19);
    // No camelCase leakage from the internal value object.
    expect((row as Record<string, unknown>).from).toBeUndefined();
    expect((row as Record<string, unknown>).breathBpm).toBeUndefined();
  });

  it('morningCheckQuery filters out rows older than the sinceMs window', async () => {
    const store = createSessionStore({ dbName: nextDbName() });
    const now = Date.now();
    await store.appendTransition(makeTransition({ id: 'old', ts: now - 3 * 24 * 3600_000 }));
    await store.appendTransition(makeTransition({ id: 'fresh', ts: now - 60_000 }));

    const rows = await store.morningCheckQuery(24 * 3600_000);
    expect(rows.map((r) => r.id)).toEqual(['fresh']);
  });

  it('createMorningCheckQuery delegates to the store (Sprint C: IDB-only seam for the Sprint D Supabase merge)', async () => {
    const store = createSessionStore({ dbName: nextDbName() });
    const query = createMorningCheckQuery(store);
    const now = Date.now();
    await store.appendTransition(makeTransition({ id: 'q-row', ts: now - 10_000 }));
    const rows = await query(24 * 3600_000);
    expect(rows.map((r) => r.id)).toEqual(['q-row']);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
