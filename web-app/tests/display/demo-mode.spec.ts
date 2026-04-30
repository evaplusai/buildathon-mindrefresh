/**
 * demo-mode.spec.ts — Tests for the DemoArcRunner scripted 44s arc.
 *
 * Uses Vitest fake timers. Asserts:
 *   1. 'steady' fires immediately on start (t=0)
 *   2. 'shifting' fires at t=4s
 *   3. 'overloaded' fires at t=14s
 *   4. 'drained' fires at t=26s
 *   5. 'steady' fires at t=38s
 *   6. stop() clears timers — no further state changes after stop
 *   7. restart loop: arc restarts at t=44s
 *   8. start() is idempotent — calling twice does not double-fire
 */

import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { createDemoArcRunner } from '../../src/services/demoMode';

describe('DemoArcRunner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires steady immediately on start (t=0)', () => {
    const runner = createDemoArcRunner();
    const states: string[] = [];

    runner.start((s) => states.push(s));

    expect(states).toEqual(['steady']);
    runner.stop();
  });

  it('fires shifting at t=4s', () => {
    const runner = createDemoArcRunner();
    const states: string[] = [];

    runner.start((s) => states.push(s));
    vi.advanceTimersByTime(4000);

    expect(states).toContain('shifting');
    runner.stop();
  });

  it('fires overloaded at t=14s', () => {
    const runner = createDemoArcRunner();
    const states: string[] = [];

    runner.start((s) => states.push(s));
    vi.advanceTimersByTime(14_000);

    expect(states).toContain('overloaded');
    runner.stop();
  });

  it('fires drained at t=26s', () => {
    const runner = createDemoArcRunner();
    const states: string[] = [];

    runner.start((s) => states.push(s));
    vi.advanceTimersByTime(26_000);

    expect(states).toContain('drained');
    runner.stop();
  });

  it('fires steady again at t=38s (end of arc)', () => {
    const runner = createDemoArcRunner();
    const states: string[] = [];

    runner.start((s) => states.push(s));
    vi.advanceTimersByTime(38_000);

    const steadyOccurrences = states.filter((s) => s === 'steady').length;
    expect(steadyOccurrences).toBeGreaterThanOrEqual(2); // initial + arc end
    runner.stop();
  });

  it('stop() clears timers — no further state changes after stop', () => {
    const runner = createDemoArcRunner();
    const states: string[] = [];

    runner.start((s) => states.push(s));
    expect(states).toEqual(['steady']); // immediate fire

    runner.stop();
    expect(runner.isActive()).toBe(false);

    vi.advanceTimersByTime(50_000);

    // No additional states should have been appended after stop
    expect(states).toEqual(['steady']);
  });

  it('isActive reflects running state', () => {
    const runner = createDemoArcRunner();
    expect(runner.isActive()).toBe(false);

    runner.start(() => {});
    expect(runner.isActive()).toBe(true);

    runner.stop();
    expect(runner.isActive()).toBe(false);
  });

  it('restart loop: arc restarts at t=44s', () => {
    const runner = createDemoArcRunner();
    const states: string[] = [];

    runner.start((s) => states.push(s));
    // Advance to just past 44s — should restart and fire 'steady' again
    vi.advanceTimersByTime(44_100);

    // First arc: steady(0), shifting(4s), overloaded(14s), drained(26s), steady(38s)
    // Restart at 44s → steady again
    const steadyCount = states.filter((s) => s === 'steady').length;
    expect(steadyCount).toBeGreaterThanOrEqual(3); // initial + t=38s + restart
    runner.stop();
  });

  it('start() is idempotent — calling twice does not double-fire states', () => {
    const runner = createDemoArcRunner();
    const states: string[] = [];

    runner.start((s) => states.push(s));
    runner.start((s) => states.push(s)); // second call should be no-op

    vi.advanceTimersByTime(4000);

    // 'steady' fires once (not twice), 'shifting' fires once (not twice)
    const shiftingCount = states.filter((s) => s === 'shifting').length;
    expect(shiftingCount).toBe(1);
    runner.stop();
  });
});
