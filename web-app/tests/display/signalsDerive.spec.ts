/**
 * Tests for deriveSignals() — ADR-017 §"Live Signals panel".
 *
 * All numeric outputs except breathBpm must be in [0, 1].
 * presence=false (room empty) must return null.
 *
 * Uses a real VitalsRingBuffer populated with synthetic frames.
 *
 * Ownership: foundation-coder (Sprint A Block 1, task DA-B1-T5).
 */

import { describe, it, expect } from 'vitest';
import { VitalsRingBuffer } from '../../src/services/vitalsRingBuffer';
import { deriveSignals } from '../../src/services/signals/derive';
import type { VitalsFrame } from '../../src/types/vitals';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function frame(
  ts: number,
  overrides: Partial<VitalsFrame> = {},
): VitalsFrame {
  return {
    ts,
    breathBpm: 14,
    presence: true,
    motionBandPower: 0.1,
    source: 'recorded',
    ...overrides,
  };
}

function filledBuffer(
  count: number,
  startTs = 1_000,
  frameOverrides: Partial<VitalsFrame> = {},
): VitalsRingBuffer {
  const buf = new VitalsRingBuffer({ capacityMs: 60_000 });
  for (let i = 0; i < count; i++) {
    buf.push(frame(startTs + i * 1_000, frameOverrides));
  }
  return buf;
}

// ---------------------------------------------------------------------------
// Null sentinel — presence=false
// ---------------------------------------------------------------------------

describe('presence=false sentinel', () => {
  it('returns null when the only frame has presence=false', () => {
    const buf = new VitalsRingBuffer({ capacityMs: 60_000 });
    buf.push(frame(1_000, { presence: false }));
    expect(deriveSignals(buf, 'live')).toBeNull();
  });

  it('returns null when any frame in the 30s window has presence=false', () => {
    const buf = filledBuffer(25);
    // Push a recent absence
    buf.push(frame(26_000, { presence: false }));
    expect(deriveSignals(buf, 'live')).toBeNull();
  });

  it('returns null for an empty buffer', () => {
    const buf = new VitalsRingBuffer({ capacityMs: 60_000 });
    expect(deriveSignals(buf, 'recorded')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Output range — all derived values in [0, 1]
// ---------------------------------------------------------------------------

describe('output range invariants', () => {
  it('cardiacMicroMotion is in [0, 1] with hr_bpm present', () => {
    const buf = filledBuffer(30, 1_000, { hrBpm: 75 });
    const sf = deriveSignals(buf, 'live');
    expect(sf).not.toBeNull();
    expect(sf!.cardiacMicroMotion).toBeGreaterThanOrEqual(0);
    expect(sf!.cardiacMicroMotion).toBeLessThanOrEqual(1);
  });

  it('cardiacMicroMotion is in [0, 1] without hr_bpm (variance proxy path)', () => {
    // Varying breath rates will produce non-zero variance
    const buf = new VitalsRingBuffer({ capacityMs: 60_000 });
    for (let i = 0; i < 30; i++) {
      buf.push(frame(1_000 + i * 1_000, { breathBpm: 12 + (i % 5), hrBpm: undefined }));
    }
    const sf = deriveSignals(buf, 'live');
    expect(sf).not.toBeNull();
    expect(sf!.cardiacMicroMotion).toBeGreaterThanOrEqual(0);
    expect(sf!.cardiacMicroMotion).toBeLessThanOrEqual(1);
  });

  it('posturalStillness is in [0, 1]', () => {
    const buf = filledBuffer(30);
    const sf = deriveSignals(buf, 'recorded');
    expect(sf).not.toBeNull();
    expect(sf!.posturalStillness).toBeGreaterThanOrEqual(0);
    expect(sf!.posturalStillness).toBeLessThanOrEqual(1);
  });

  it('movementCadence is in [0, 1]', () => {
    const buf = filledBuffer(30);
    const sf = deriveSignals(buf, 'recorded');
    expect(sf).not.toBeNull();
    expect(sf!.movementCadence).toBeGreaterThanOrEqual(0);
    expect(sf!.movementCadence).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Semantic correctness
// ---------------------------------------------------------------------------

describe('high motion → high movementCadence and low posturalStillness', () => {
  it('high uniform motion-band-power yields movementCadence near 1 and posturalStillness near 0', () => {
    const buf = filledBuffer(30, 1_000, { motionBandPower: 1.0 });
    const sf = deriveSignals(buf, 'live');
    expect(sf).not.toBeNull();
    // With uniform motion, EWMA ≈ max → cadence ≈ 1, stillness ≈ 0
    expect(sf!.movementCadence).toBeGreaterThan(0.8);
    expect(sf!.posturalStillness).toBeLessThan(0.2);
  });

  it('zero motion-band-power yields movementCadence = 0 and posturalStillness = 1', () => {
    const buf = filledBuffer(30, 1_000, { motionBandPower: 0 });
    const sf = deriveSignals(buf, 'recorded');
    expect(sf).not.toBeNull();
    expect(sf!.movementCadence).toBe(0);
    expect(sf!.posturalStillness).toBe(1);
  });
});

describe('stable breath rate', () => {
  it('constant breath rate (zero variance) produces cardiacMicroMotion near 0 when no hr_bpm', () => {
    const buf = filledBuffer(30, 1_000, { breathBpm: 14, hrBpm: undefined });
    const sf = deriveSignals(buf, 'recorded');
    expect(sf).not.toBeNull();
    // Zero variance → cardiacMicroMotion = 0 (the proxy reads "nothing happening")
    expect(sf!.cardiacMicroMotion).toBe(0);
  });

  it('source is passed through to the SignalsFrame', () => {
    const buf = filledBuffer(10, 1_000);
    expect(deriveSignals(buf, 'recorded')!.source).toBe('recorded');
    expect(deriveSignals(buf, 'live')!.source).toBe('live');
  });
});

describe('breathBpm pass-through', () => {
  it('breathBpm reflects the latest sample value', () => {
    const buf = filledBuffer(10, 1_000, { breathBpm: 18 });
    const sf = deriveSignals(buf, 'live');
    expect(sf).not.toBeNull();
    expect(sf!.breathBpm).toBe(18);
  });
});
