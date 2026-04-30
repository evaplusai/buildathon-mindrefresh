/**
 * Tests for toDashboardState() — ADR-015 §"The mapping".
 *
 * Each test corresponds to a row in the mapping table or an edge-case that
 * the ADR explicitly calls out. The function is pure; no mocks needed.
 *
 * Ownership: foundation-coder (Sprint A Block 1, task DA-B1-T3).
 */

import { describe, it, expect } from 'vitest';
import { toDashboardState } from '../../src/services/display/toDashboardState';
import type { DashboardStateInput } from '../../src/types/display';

// ---------------------------------------------------------------------------
// Helper: build a minimal valid input, then override per-test
// ---------------------------------------------------------------------------

function input(overrides: Partial<DashboardStateInput>): DashboardStateInput {
  return {
    state: 'regulated',
    severity: 0,
    dwellMs: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// regulated → steady (always, regardless of other inputs)
// ---------------------------------------------------------------------------

describe('regulated state', () => {
  it('maps regulated to steady with minimal inputs', () => {
    expect(toDashboardState(input({ state: 'regulated' }))).toBe('steady');
  });

  it('maps regulated to steady even with high severity (severity is irrelevant for regulated)', () => {
    expect(
      toDashboardState(input({ state: 'regulated', severity: 0.9, dwellMs: 120_000 })),
    ).toBe('steady');
  });

  it('maps regulated to steady even when all optional V2 signals are present', () => {
    expect(
      toDashboardState(
        input({
          state: 'regulated',
          severity: 1.0,
          dwellMs: 200_000,
          breathBpm: 20,
          regulatedBaseline: 12,
          cardiacMicroMotion: 0.9,
          posturalStillness: 0.9,
          movementCadence: 0.1,
        }),
      ),
    ).toBe('steady');
  });
});

// ---------------------------------------------------------------------------
// activated → shifting or overloaded
// ---------------------------------------------------------------------------

describe('activated state', () => {
  it('maps activated (short dwell, low severity) to shifting', () => {
    expect(
      toDashboardState(input({ state: 'activated', severity: 0.3, dwellMs: 30_000 })),
    ).toBe('shifting');
  });

  it('maps activated (short dwell, high severity) to shifting — dwell condition fails', () => {
    // dwellMs < 60_000 → shifting even when severity >= 0.5
    expect(
      toDashboardState(input({ state: 'activated', severity: 0.8, dwellMs: 59_999 })),
    ).toBe('shifting');
  });

  it('maps activated (long dwell, low severity) to shifting — severity condition fails', () => {
    // severity < 0.5 → shifting even when dwellMs >= 60_000
    expect(
      toDashboardState(input({ state: 'activated', severity: 0.49, dwellMs: 60_000 })),
    ).toBe('shifting');
  });

  it('maps activated (long dwell, high severity) to overloaded', () => {
    expect(
      toDashboardState(input({ state: 'activated', severity: 0.5, dwellMs: 60_000 })),
    ).toBe('overloaded');
  });

  it('maps activated with severity exactly 0.5 and dwell exactly 60_000 to overloaded (inclusive boundaries)', () => {
    expect(
      toDashboardState(input({ state: 'activated', severity: 0.5, dwellMs: 60_000 })),
    ).toBe('overloaded');
  });

  it('maps activated with severity exactly 0.5 and dwell 60_001 to overloaded', () => {
    expect(
      toDashboardState(input({ state: 'activated', severity: 0.5, dwellMs: 60_001 })),
    ).toBe('overloaded');
  });
});

// ---------------------------------------------------------------------------
// recovering → shifting or drained
// ---------------------------------------------------------------------------

describe('recovering state — breath-based rules', () => {
  it('maps recovering (breath above baseline + 2) to shifting', () => {
    expect(
      toDashboardState(
        input({ state: 'recovering', severity: 0.2, dwellMs: 10_000, breathBpm: 16, regulatedBaseline: 12 }),
      ),
    ).toBe('shifting'); // 16 > 12 + 2 = 14
  });

  it('maps recovering (breath exactly at baseline + 2 boundary) to shifting', () => {
    // 14 > 12 + 2 = 14 → false (not strictly greater), so drained
    expect(
      toDashboardState(
        input({ state: 'recovering', severity: 0.2, dwellMs: 10_000, breathBpm: 14, regulatedBaseline: 12 }),
      ),
    ).toBe('drained'); // 14 is not > 14
  });

  it('maps recovering (breath below baseline + 2) to drained', () => {
    expect(
      toDashboardState(
        input({ state: 'recovering', severity: 0.2, dwellMs: 10_000, breathBpm: 11, regulatedBaseline: 12 }),
      ),
    ).toBe('drained');
  });

  it('maps recovering with missing breathBpm to shifting (fallback)', () => {
    expect(
      toDashboardState(
        input({ state: 'recovering', severity: 0.1, dwellMs: 5_000, regulatedBaseline: 12 }),
      ),
    ).toBe('shifting');
  });

  it('maps recovering with missing regulatedBaseline to shifting (fallback)', () => {
    expect(
      toDashboardState(
        input({ state: 'recovering', severity: 0.1, dwellMs: 5_000, breathBpm: 13 }),
      ),
    ).toBe('shifting');
  });

  it('maps recovering with both breathBpm and regulatedBaseline missing to shifting (fallback)', () => {
    expect(
      toDashboardState(
        input({ state: 'recovering', severity: 0.1, dwellMs: 5_000 }),
      ),
    ).toBe('shifting');
  });
});

describe('recovering state — V2 posturalStillness load-bearing rule', () => {
  it('maps recovering (posturalStillness > 0.6) to drained regardless of breath', () => {
    // Even with breath elevated above baseline, posturalStillness > 0.6 wins
    expect(
      toDashboardState(
        input({
          state: 'recovering',
          severity: 0.2,
          dwellMs: 10_000,
          breathBpm: 16,
          regulatedBaseline: 12,
          posturalStillness: 0.7,
        }),
      ),
    ).toBe('drained');
  });

  it('does NOT apply posturalStillness rule when value is exactly 0.6 (not strictly greater)', () => {
    // posturalStillness === 0.6 → falls through to breath check
    expect(
      toDashboardState(
        input({
          state: 'recovering',
          severity: 0.2,
          dwellMs: 10_000,
          breathBpm: 16,
          regulatedBaseline: 12,
          posturalStillness: 0.6,
        }),
      ),
    ).toBe('shifting'); // breath rule takes over: 16 > 14
  });

  it('maps recovering (posturalStillness > 0.6, no breath data) to drained', () => {
    expect(
      toDashboardState(
        input({
          state: 'recovering',
          severity: 0.1,
          dwellMs: 5_000,
          posturalStillness: 0.8,
        }),
      ),
    ).toBe('drained');
  });
});
