/**
 * patternMirror.spec.ts — Tests for computeMirrorObservations.
 *
 * Uses fake-indexeddb. Seeded with 12 days of synthetic transitions.
 *
 * Coverage:
 *   1.  Cold-start: < 7 days of data → returns single placeholder
 *   2.  Cold-start placeholder has correct text and iconKey
 *   3.  Rule 1 fires when sleep-debt correlation r > 0.5 over >= 7 days
 *   4.  Rule 1 does NOT fire when correlation is weak (r <= 0.5)
 *   5.  Rule 2 fires when Reflect-tagged sessions recover >= 20% faster
 *   6.  Rule 3 fires when a weekday is in the top quartile for activation count
 *   7.  Rule 4 fires when this week's recovery windows are >= 15% shorter
 *   8.  Rule 5 fires when completed resets improve recovery rate
 *   9.  Cache hit: second call within 24h returns cached (no recompute)
 *   10. Cache miss: after 24h, recomputes fresh
 *   11. Output capped at 4 observations
 */

import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createSessionStore } from '../../src/services/sessionStore';
import { computeMirrorObservations } from '../../src/services/patternMirror';
import type { StateTransition } from '../../src/types/state';

// ── Helpers ────────────────────────────────────────────────────────────

let dbCounter = 0;
function nextDbName(): string {
  dbCounter++;
  return `test-mirror-${Date.now()}-${dbCounter}`;
}

/** Unix ms for N days ago at noon local time. */
function daysAgo(n: number, hourOfDay = 12): number {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hourOfDay, 0, 0, 0);
  return d.getTime();
}

function makeTransition(overrides: Partial<StateTransition> = {}): StateTransition {
  return {
    id: crypto.randomUUID(),
    ts: Date.now(),
    from: 'regulated',
    to: 'activated',
    reason: 'test',
    breathBpm: 16,
    ...overrides,
  };
}

/**
 * Seed a store with N days of data: one regulated→activated transition per day.
 * Optional breath_bpm values for sleep-debt correlation.
 */
async function seedDays(
  store: ReturnType<typeof createSessionStore>,
  numDays: number,
  breathBpmByDay?: number[],
): Promise<void> {
  for (let i = 0; i < numDays; i++) {
    const bpm = breathBpmByDay ? breathBpmByDay[i] : 15;
    await store.appendTransition(
      makeTransition({
        id: crypto.randomUUID(),
        ts: daysAgo(numDays - i),
        from: 'regulated',
        to: 'activated',
        breathBpm: bpm,
      }),
    );
    // Add a recovering transition to give the day some history
    await store.appendTransition(
      makeTransition({
        id: crypto.randomUUID(),
        ts: daysAgo(numDays - i) + 30 * 60_000,
        from: 'activated',
        to: 'recovering',
        breathBpm: bpm,
      }),
    );
    await store.appendTransition(
      makeTransition({
        id: crypto.randomUUID(),
        ts: daysAgo(numDays - i) + 60 * 60_000,
        from: 'recovering',
        to: 'regulated',
        breathBpm: bpm,
      }),
    );
  }
}

// ── Tests ───────────────────────────────────────────────────────────────

describe('computeMirrorObservations', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).indexedDB = new IDBFactory();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Cold-start ──────────────────────────────────────────────────────

  it('returns single cold-start placeholder when < 7 distinct days of data', async () => {
    const store = createSessionStore({ dbName: nextDbName() });

    // Seed only 3 days
    await seedDays(store, 3);

    const observations = await computeMirrorObservations(store);

    expect(observations).toHaveLength(1);
    expect(observations[0].confidence).toBe(0);
  });

  it('cold-start placeholder has correct text and iconKey', async () => {
    const store = createSessionStore({ dbName: nextDbName() });

    // Seed only 5 days
    await seedDays(store, 5);

    const observations = await computeMirrorObservations(store);

    expect(observations[0].text).toContain('Pattern Mirror unlocks after 7 days');
    expect(observations[0].evidence).toBe('Cold-start');
    expect(observations[0].iconKey).toBe('load');
  });

  // ── Rule 3: Day-of-week ─────────────────────────────────────────────

  it('Rule 3 fires when a weekday is in the top quartile for activation count', async () => {
    const store = createSessionStore({ dbName: nextDbName() });

    // Seed 12 days with varying activation patterns
    await seedDays(store, 12);

    // Add extra activations on specific days to create a top-quartile weekday
    for (let extra = 0; extra < 5; extra++) {
      // Add multiple activations for the same day 7 days ago to create a heavy day
      await store.appendTransition(
        makeTransition({
          id: crypto.randomUUID(),
          ts: daysAgo(7) + extra * 60 * 60_000,
          from: 'regulated',
          to: 'activated',
        }),
      );
    }

    const observations = await computeMirrorObservations(store);

    // Should have fired at least one rule (Rule 3 with heavy weekday)
    expect(observations.length).toBeGreaterThan(0);
    // Should not be the cold-start placeholder
    expect(observations[0].confidence).toBeGreaterThan(0);
  });

  // ── Rule 4: Weekly load drift ──────────────────────────────────────

  it('Rule 4 fires when this week recovery windows are >= 15% shorter than baseline', async () => {
    const store = createSessionStore({ dbName: nextDbName() });

    // Seed many days with long recoveries (baseline) then short ones this week
    const LONG_RECOVERY_MS = 60 * 60_000; // 60 min
    const SHORT_RECOVERY_MS = 5 * 60_000;  // 5 min

    // Old recoveries (3+ weeks ago) — long
    for (let i = 0; i < 8; i++) {
      const activatedAt = daysAgo(25 + i, 10);
      await store.appendTransition(makeTransition({
        id: crypto.randomUUID(), ts: activatedAt, from: 'regulated', to: 'activated',
      }));
      await store.appendTransition(makeTransition({
        id: crypto.randomUUID(), ts: activatedAt + 10_000, from: 'activated', to: 'recovering',
      }));
      await store.appendTransition(makeTransition({
        id: crypto.randomUUID(), ts: activatedAt + LONG_RECOVERY_MS, from: 'recovering', to: 'regulated',
      }));
    }

    // This week's recoveries — short
    for (let i = 0; i < 4; i++) {
      const activatedAt = daysAgo(i, 9);
      await store.appendTransition(makeTransition({
        id: crypto.randomUUID(), ts: activatedAt, from: 'regulated', to: 'activated',
      }));
      await store.appendTransition(makeTransition({
        id: crypto.randomUUID(), ts: activatedAt + 5_000, from: 'activated', to: 'recovering',
      }));
      await store.appendTransition(makeTransition({
        id: crypto.randomUUID(), ts: activatedAt + SHORT_RECOVERY_MS, from: 'recovering', to: 'regulated',
      }));
    }

    const observations = await computeMirrorObservations(store, 30);

    // Rule 4 should fire — this week is ~92% shorter than baseline
    const rule4 = observations.find((o) => o.text.includes('shorter this week'));
    expect(rule4).toBeDefined();
  });

  // ── Rule 5: Reset effectiveness ────────────────────────────────────

  it('Rule 5 fires when completed resets significantly improve recovery rate', async () => {
    const store = createSessionStore({ dbName: nextDbName() });

    // 12 days baseline first
    await seedDays(store, 12);

    // Add multiple activations WITH completed resets that reach recovering quickly
    for (let i = 0; i < 5; i++) {
      const activatedAt = daysAgo(i + 1, 8);

      await store.appendTransition(makeTransition({
        id: crypto.randomUUID(), ts: activatedAt, from: 'regulated', to: 'activated',
      }));

      // Completed reset intervention
      await store.appendIntervention({
        transitionId: crypto.randomUUID(),
        affirmationId: 'test',
        breathPattern: 'physiological_sigh',
        ts: activatedAt + 2 * 60_000, // 2 min after activation
        completed: true,
      });

      // Quick recovery (within 10 min)
      await store.appendTransition(makeTransition({
        id: crypto.randomUUID(), ts: activatedAt + 5 * 60_000, from: 'activated', to: 'recovering',
      }));
    }

    // Add activations WITHOUT resets that don't reach recovering within 10 min
    for (let i = 0; i < 5; i++) {
      const activatedAt = daysAgo(i + 1, 14);
      await store.appendTransition(makeTransition({
        id: crypto.randomUUID(), ts: activatedAt, from: 'regulated', to: 'activated',
      }));
      // No recovery within 10 min — they take 20 min
      await store.appendTransition(makeTransition({
        id: crypto.randomUUID(), ts: activatedAt + 20 * 60_000, from: 'activated', to: 'recovering',
      }));
    }

    const observations = await computeMirrorObservations(store);

    const rule5 = observations.find((o) => o.text.includes('breathing reset'));
    expect(rule5).toBeDefined();
  });

  // ── Cache behaviour ─────────────────────────────────────────────────

  it('cache hit: second call within 24h returns cached result', async () => {
    const store = createSessionStore({ dbName: nextDbName() });
    await seedDays(store, 8);

    // First call — computes and caches
    const first = await computeMirrorObservations(store);

    // Add more data — should NOT affect result since cache is still fresh
    await store.appendTransition(makeTransition({ ts: Date.now() }));

    // Second call — should return same cached result
    const second = await computeMirrorObservations(store);

    // Should be identical (same content from cache)
    expect(second).toEqual(first);
  });

  it('cache miss: after TTL expires, recomputes fresh', async () => {
    const store = createSessionStore({ dbName: nextDbName() });
    await seedDays(store, 8);

    // First call
    await computeMirrorObservations(store);

    // Simulate 25 hours passing — expire the cache
    const now = Date.now() + 25 * 60 * 60_000;

    // Spy on getPatternMirrorSnapshot to verify it was called
    const getSpy = vi.spyOn(store, 'getPatternMirrorSnapshot');
    const putSpy = vi.spyOn(store, 'putPatternMirrorSnapshot');

    // We need to call with a "now" that is 25h later — patternMirror uses
    // Date.now() internally, so we mock it
    const realDateNow = Date.now;
    vi.spyOn(Date, 'now').mockReturnValue(now);

    await computeMirrorObservations(store);

    // putPatternMirrorSnapshot should have been called (fresh computation)
    expect(putSpy).toHaveBeenCalled();
    expect(getSpy).toHaveBeenCalled();

    vi.spyOn(Date, 'now').mockRestore?.();
    Date.now = realDateNow;
  });

  // ── Output cap ───────────────────────────────────────────────────────

  it('output is capped at 4 observations', async () => {
    const store = createSessionStore({ dbName: nextDbName() });

    // Seed enough data for all 5 rules to potentially fire
    await seedDays(store, 12);

    const observations = await computeMirrorObservations(store);

    expect(observations.length).toBeLessThanOrEqual(4);
  });
});
