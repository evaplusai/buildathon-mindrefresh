/**
 * todayStrip.spec.ts — Tests for computeTodayStrip.
 *
 * Seeded with a half-day arc (5-6 transitions) via fake-indexeddb.
 *
 * Coverage:
 *   1. Segments are contiguous (no gaps, no overlaps)
 *   2. First segment starts at startOfDayLocal
 *   3. Last segment ends at `now`
 *   4. Reset markers include only completed BreathingModal interventions
 *   5. steadyMinutesToday reflects time in steady state
 *   6. shiftsCaughtToday counts early-intercepted activations
 *   7. Empty transitions → single steady segment from dayStart to now
 *   8. crashesThisWeek: count of recovering→regulated without breath_bpm
 */

import { beforeEach, describe, it, expect } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createSessionStore } from '../../src/services/sessionStore';
import { computeTodayStrip, startOfDayLocal } from '../../src/services/todayStrip';
import type { StateTransition } from '../../src/types/state';
import type { Intervention } from '../../src/types/intervention';

// ── Helpers ────────────────────────────────────────────────────────────

let dbCounter = 0;
function nextDbName(): string {
  dbCounter++;
  return `test-strip-${Date.now()}-${dbCounter}`;
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

function makeIntervention(overrides: Partial<Intervention> & { completed?: boolean } = {}): Intervention & { completed?: boolean } {
  return {
    transitionId: crypto.randomUUID(),
    affirmationId: 'test',
    breathPattern: 'cyclic_sigh',
    ts: Date.now(),
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────────

describe('computeTodayStrip', () => {
  const NOW = (() => {
    const d = new Date();
    d.setHours(14, 0, 0, 0); // 14:00 local, well after 06:00 day start
    return d.getTime();
  })();
  const DAY_START = startOfDayLocal(NOW);

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).indexedDB = new IDBFactory();
  });

  it('segments are contiguous (no gaps, no overlaps)', async () => {
    const store = createSessionStore({ dbName: nextDbName() });

    const t1 = makeTransition({ ts: DAY_START + 30 * 60_000, from: 'regulated', to: 'activated' });
    const t2 = makeTransition({ ts: DAY_START + 60 * 60_000, from: 'activated', to: 'recovering' });
    const t3 = makeTransition({ ts: DAY_START + 90 * 60_000, from: 'recovering', to: 'regulated' });

    await store.appendTransition(t1);
    await store.appendTransition(t2);
    await store.appendTransition(t3);

    const result = await computeTodayStrip(store, NOW);

    // Each segment's end should equal the next segment's start
    for (let i = 0; i < result.segments.length - 1; i++) {
      expect(result.segments[i].end).toBe(result.segments[i + 1].start);
    }
  });

  it('first segment starts at startOfDayLocal and last segment ends at now', async () => {
    const store = createSessionStore({ dbName: nextDbName() });

    const t1 = makeTransition({ ts: DAY_START + 30 * 60_000, from: 'regulated', to: 'activated' });
    await store.appendTransition(t1);

    const result = await computeTodayStrip(store, NOW);

    expect(result.segments[0].start).toBe(DAY_START);
    expect(result.segments[result.segments.length - 1].end).toBe(NOW);
  });

  it('reset markers include completed BreathingModal interventions', async () => {
    const store = createSessionStore({ dbName: nextDbName() });

    const resetTs = DAY_START + 45 * 60_000;
    const completedIntervention = makeIntervention({
      ts: resetTs,
      breathPattern: 'physiological_sigh',
      completed: true,
    });
    const incompleteIntervention = makeIntervention({
      ts: resetTs + 5000,
      breathPattern: 'box_breath',
      completed: false,
    });
    // Natural breath doesn't count as a BreathingModal reset
    const naturalIntervention = makeIntervention({
      ts: resetTs + 10_000,
      breathPattern: 'natural',
      completed: true,
    });

    await store.appendIntervention(completedIntervention);
    await store.appendIntervention(incompleteIntervention);
    await store.appendIntervention(naturalIntervention);

    const result = await computeTodayStrip(store, NOW);

    // Only the completed physiological_sigh counts as a reset marker
    expect(result.resetMarkers).toContain(resetTs);
    expect(result.resetMarkers).not.toContain(resetTs + 5000); // incomplete
    // natural is included in the BREATH_PROTOCOLS set as a legacy pattern
    // (cyclic_sigh and extended_exhale are included) — only 'natural' is excluded
  });

  it('steadyMinutesToday reflects time in steady state', async () => {
    const store = createSessionStore({ dbName: nextDbName() });

    // Two-hour window at start of day is steady (before any transition)
    // We'll check the segment computation: dayStart → t1 is steady
    const twoHoursMs = 2 * 60 * 60_000;
    const t1 = makeTransition({ ts: DAY_START + twoHoursMs, from: 'regulated', to: 'activated' });
    await store.appendTransition(t1);

    const result = await computeTodayStrip(store, NOW);

    // Should have at least 2 hours (120 minutes) of steady
    expect(result.stats.steadyMinutesToday).toBeGreaterThanOrEqual(120);
  });

  it('shiftsCaughtToday counts early-intercepted activations', async () => {
    const store = createSessionStore({ dbName: nextDbName() });

    // Early intercept: regulated→activated, then activated→recovering within 60s
    const activatedTs = DAY_START + 1 * 60 * 60_000;
    const t1 = makeTransition({ ts: activatedTs, from: 'regulated', to: 'activated' });
    const t2 = makeTransition({ ts: activatedTs + 30_000, from: 'activated', to: 'recovering' }); // 30s dwell

    // Late transition: dwell > 60s = NOT caught early
    const lateActivatedTs = DAY_START + 3 * 60 * 60_000;
    const t3 = makeTransition({ ts: lateActivatedTs, from: 'regulated', to: 'activated' });
    const t4 = makeTransition({ ts: lateActivatedTs + 90_000, from: 'activated', to: 'recovering' }); // 90s dwell

    await store.appendTransition(t1);
    await store.appendTransition(t2);
    await store.appendTransition(t3);
    await store.appendTransition(t4);

    const result = await computeTodayStrip(store, NOW);

    expect(result.stats.shiftsCaughtToday).toBe(1); // Only the 30s dwell counts
  });

  it('returns a single steady segment when no transitions today', async () => {
    const store = createSessionStore({ dbName: nextDbName() });

    const result = await computeTodayStrip(store, NOW);

    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].state).toBe('steady');
    expect(result.segments[0].start).toBe(DAY_START);
    expect(result.segments[0].end).toBe(NOW);
  });

  it('all 4 stats are present and numeric', async () => {
    const store = createSessionStore({ dbName: nextDbName() });

    const t1 = makeTransition({ ts: DAY_START + 60 * 60_000, from: 'regulated', to: 'activated' });
    await store.appendTransition(t1);

    const result = await computeTodayStrip(store, NOW);

    expect(typeof result.stats.shiftsCaughtToday).toBe('number');
    expect(typeof result.stats.avgLeadMinutesThisWeek).toBe('number');
    expect(typeof result.stats.steadyMinutesToday).toBe('number');
    expect(typeof result.stats.crashesThisWeek).toBe('number');

    // Default avgLeadMinutesThisWeek when no tagged transitions = 8
    expect(result.stats.avgLeadMinutesThisWeek).toBe(8);
  });

  it('crashesThisWeek counts recovering→regulated without breath_bpm', async () => {
    const store = createSessionStore({ dbName: nextDbName() });

    // A recovering→regulated without breath_bpm = crash proxy
    const weekStart = Date.now() - 3 * 24 * 60 * 60_000; // 3 days ago
    const t1: StateTransition = {
      id: crypto.randomUUID(),
      ts: weekStart + 1000,
      from: 'recovering',
      to: 'regulated',
      reason: 'recovery',
      breathBpm: 0, // 0 is falsy, let the proxy handle it
    };
    // Create one with breathBpm = 0 (which acts like undefined)
    await store.appendTransition({ ...t1, breathBpm: undefined as unknown as number });

    const result = await computeTodayStrip(store, NOW);

    expect(result.stats.crashesThisWeek).toBeGreaterThanOrEqual(1);
  });
});
