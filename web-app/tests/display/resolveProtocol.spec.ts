/**
 * resolveProtocol.spec.ts — Pure unit tests for the ADR-018 §A protocol
 * resolution rule.
 *
 * Coverage:
 *   1. No recent run → state fallback: shifting → physiological_sigh
 *   2. No recent run → state fallback: overloaded → physiological_sigh
 *   3. No recent run → state fallback: drained → box_breath
 *   4. No recent run → state fallback: steady → physiological_sigh
 *   5. Recent run within 5 min → use run's protocol (physiological_sigh)
 *   6. Recent run within 5 min → use run's protocol (box_breath)
 *   7. Recent run exactly AT 5 min boundary (stale) → state fallback
 *   8. recentRun undefined → state fallback
 */

import { describe, it, expect } from 'vitest';
import { resolveProtocol } from '../../src/services/display/resolveProtocol';
import type { RecentReflectRun } from '../../src/services/display/resolveProtocol';

const NOW = 1_000_000_000_000; // fixed reference time
const FIVE_MIN_MS = 5 * 60_000;

describe('resolveProtocol', () => {
  // ── State fallback (no recent run) ────────────────────────────────────

  it('returns physiological_sigh for shifting when no recentRun', () => {
    const result = resolveProtocol({
      dashboardState: 'shifting',
      now: NOW,
    });
    expect(result).toBe('physiological_sigh');
  });

  it('returns physiological_sigh for overloaded when no recentRun', () => {
    const result = resolveProtocol({
      dashboardState: 'overloaded',
      now: NOW,
    });
    expect(result).toBe('physiological_sigh');
  });

  it('returns box_breath for drained when no recentRun', () => {
    const result = resolveProtocol({
      dashboardState: 'drained',
      now: NOW,
    });
    expect(result).toBe('box_breath');
  });

  it('returns physiological_sigh for steady when no recentRun', () => {
    const result = resolveProtocol({
      dashboardState: 'steady',
      now: NOW,
    });
    expect(result).toBe('physiological_sigh');
  });

  // ── Agent 3 advisory (recent run present) ─────────────────────────────

  it('uses recentRun protocol when run is within 5 min (physiological_sigh)', () => {
    const run: RecentReflectRun = {
      ts: NOW - FIVE_MIN_MS + 1_000, // 1s within the window
      protocol: 'physiological_sigh',
    };
    const result = resolveProtocol({
      recentRun: run,
      dashboardState: 'drained', // would normally return box_breath
      now: NOW,
    });
    expect(result).toBe('physiological_sigh');
  });

  it('uses recentRun protocol when run is within 5 min (box_breath)', () => {
    const run: RecentReflectRun = {
      ts: NOW - 60_000, // 1 min ago
      protocol: 'box_breath',
    };
    const result = resolveProtocol({
      recentRun: run,
      dashboardState: 'shifting', // would normally return physiological_sigh
      now: NOW,
    });
    expect(result).toBe('box_breath');
  });

  it('falls back to state default when recentRun is exactly 5 min old (stale)', () => {
    const run: RecentReflectRun = {
      ts: NOW - FIVE_MIN_MS, // exactly AT boundary — not within
      protocol: 'box_breath',
    };
    const result = resolveProtocol({
      recentRun: run,
      dashboardState: 'shifting',
      now: NOW,
    });
    // 5 min exactly is NOT within (< not <=), so should fall back to state default
    expect(result).toBe('physiological_sigh');
  });

  it('falls back to state default when recentRun is undefined', () => {
    const result = resolveProtocol({
      recentRun: undefined,
      dashboardState: 'drained',
      now: NOW,
    });
    expect(result).toBe('box_breath');
  });
});
