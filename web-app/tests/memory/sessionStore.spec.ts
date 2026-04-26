import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
// fake-indexeddb is registered globally via src/test/setup.ts.
import { IDBFactory } from 'fake-indexeddb';

import { createSessionStore, DEMO_USER_ID } from '../../src/services/sessionStore';
import { createMorningCheckQuery } from '../../src/services/morningCheckQuery';
import { createCloudSync } from '../../src/services/cloudSync';
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
 * Sprint C: the SessionStore itself is IDB-only — it MUST make ZERO
 * `fetch` calls (Memory invariant 1).
 *
 * Sprint D: a sibling `cloudSync.ts` writes to `*.supabase.co`. The
 * structural-privacy invariant is now: any recorded `fetch` URL across
 * the WHOLE Memory context must match `*.supabase.co` (or `mailto:`,
 * which is reserved for the Trusted Witness button outside this
 * context). Every other origin is forbidden mechanically.
 */

const ALLOWED_URL_RE = /^(https?:\/\/[^/]*\.supabase\.co(?::\d+)?\/|mailto:)/i;

function assertOnlyAllowedFetches(spy: ReturnType<typeof vi.fn>) {
  for (const call of spy.mock.calls) {
    const arg = call[0];
    const url =
      typeof arg === 'string'
        ? arg
        : arg instanceof URL
          ? arg.toString()
          : arg && typeof arg === 'object' && 'url' in arg
            ? String((arg as { url: string }).url)
            : String(arg);
    expect(
      ALLOWED_URL_RE.test(url),
      `fetch URL ${url} must match *.supabase.co or mailto: (Memory DDD structural-privacy invariant)`,
    ).toBe(true);
  }
}

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
  // Sprint D structural-privacy invariant — applied to every test in this
  // suite. ANY recorded fetch URL must match *.supabase.co or mailto:.
  assertOnlyAllowedFetches(fetchSpy);
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

  it('createMorningCheckQuery without a cloudSync delegates to the store (IDB-only fallback)', async () => {
    const store = createSessionStore({ dbName: nextDbName() });
    const query = createMorningCheckQuery(store);
    const now = Date.now();
    await store.appendTransition(makeTransition({ id: 'q-row', ts: now - 10_000 }));
    const rows = await query(24 * 3600_000);
    expect(rows.map((r) => r.id)).toEqual(['q-row']);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('cloudSync — Sprint D structural-privacy contract', () => {
  it('insertTransition issues an HTTPS POST to *.supabase.co (and only there)', async () => {
    const cloud = createCloudSync({
      url: 'https://abc123.supabase.co',
      anonKey: 'public-anon-key',
    });
    expect(cloud.isEnabled()).toBe(true);

    await cloud.insertTransition({
      id: 'tx-cloud-1',
      ts: Date.now(),
      from: 'regulated',
      to: 'activated',
      reason: 'breath_rise',
      breathBpm: 17,
    });

    // The supabase-js client batches the call through `fetch`; assert at
    // least one call was made and that EVERY URL is supabase.co. The
    // global afterEach also runs assertOnlyAllowedFetches.
    expect(fetchSpy).toHaveBeenCalled();
    const urls = fetchSpy.mock.calls.map((c) => {
      const a = c[0];
      return typeof a === 'string'
        ? a
        : a instanceof URL
          ? a.toString()
          : String((a as { url: string }).url);
    });
    for (const u of urls) {
      expect(u).toMatch(/^https:\/\/[^/]*\.supabase\.co(?::\d+)?\//);
    }
  });

  it('isEnabled() === false when env vars are missing — every insert is a no-op (no fetch)', async () => {
    const cloud = createCloudSync({ url: '', anonKey: '' });
    expect(cloud.isEnabled()).toBe(false);
    await cloud.insertTransition({
      id: 'tx-noop',
      ts: Date.now(),
      from: 'regulated',
      to: 'activated',
      reason: 'breath_rise',
      breathBpm: 17,
    });
    await cloud.insertIntervention({
      transitionId: 'tx-noop',
      affirmationId: 'som-001',
      breathPattern: 'natural',
      ts: Date.now(),
    });
    const cloudRows = await cloud.morningCheckCloud(24 * 3600_000);
    expect(cloudRows).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
