import { describe, it, expect } from 'vitest';
import { VitalsRingBuffer } from '../../src/services/vitalsRingBuffer';
import {
  classify,
  type StateRulesConfig,
} from '../../src/workers/stateRules';
import type { State } from '../../src/types/state';
import type { VitalsFrame } from '../../src/types/vitals';
import rulesJson from '../../src/data/stateRules.json';

const RULES = rulesJson as StateRulesConfig;

function frame(ts: number, breathBpm: number): VitalsFrame {
  return {
    ts,
    breathBpm,
    presence: true,
    motionBandPower: 0,
    source: 'recorded',
  };
}

/** Push one sample per second of `seconds` length, breath = `start + i*step`. */
function ramp(
  buf: VitalsRingBuffer,
  startTs: number,
  seconds: number,
  start: number,
  step: number,
) {
  for (let i = 0; i <= seconds; i++) {
    buf.push(frame(startTs + i * 1000, start + i * step));
  }
}

/** Push one sample per second at constant breath. */
function flat(
  buf: VitalsRingBuffer,
  startTs: number,
  seconds: number,
  bpm: number,
) {
  for (let i = 0; i <= seconds; i++) {
    buf.push(frame(startTs + i * 1000, bpm));
  }
}

describe('stateRules (ADR-010 — 3-state breath-trajectory classifier)', () => {
  it('transitions regulated → activated after 60s of breath > 14 BPM rising > 1 BPM/min', () => {
    const buf = new VitalsRingBuffer({ capacityMs: 10 * 60_000 });
    // 60-second ramp from 14.5 → 16 BPM (slope = 1.5 BPM/min, all > 14).
    ramp(buf, 0, 60, 14.5, 1.5 / 60);
    const verdict = classify({
      ringBuffer: buf,
      current: 'regulated',
      lastTransitionTs: 0,
      now: 60_000,
      rules: RULES,
    });
    expect(verdict).not.toBeNull();
    expect(verdict!.next).toBe<State>('activated');
    expect(verdict!.reason).toMatch(/BPM/);
  });

  it('does NOT transition regulated → activated when the rise is not yet sustained 60s', () => {
    const buf = new VitalsRingBuffer({ capacityMs: 10 * 60_000 });
    // Only 30 s of climb — entry-condition window not satisfied.
    ramp(buf, 0, 30, 15, 1.5 / 60);
    const verdict = classify({
      ringBuffer: buf,
      current: 'regulated',
      lastTransitionTs: 0,
      now: 30_000,
      rules: RULES,
    });
    expect(verdict).toBeNull();
  });

  it('transitions activated → recovering after 30s of descent > 0.5 BPM/min', () => {
    const buf = new VitalsRingBuffer({ capacityMs: 10 * 60_000 });
    // Drop from 18 → 17 BPM over 30 s ⇒ slope = -2 BPM/min.
    ramp(buf, 0, 30, 18, -1 / 30);
    const verdict = classify({
      ringBuffer: buf,
      current: 'activated',
      lastTransitionTs: 0,
      now: 30_000,
      rules: RULES,
    });
    expect(verdict).not.toBeNull();
    expect(verdict!.next).toBe<State>('recovering');
  });

  it('transitions recovering → regulated after 30s within band with flat trend', () => {
    const buf = new VitalsRingBuffer({ capacityMs: 10 * 60_000 });
    flat(buf, 0, 30, 12); // 12 BPM, slope 0 BPM/min, in [8,14].
    const verdict = classify({
      ringBuffer: buf,
      current: 'recovering',
      lastTransitionTs: 0,
      now: 30_000,
      rules: RULES,
    });
    expect(verdict).not.toBeNull();
    expect(verdict!.next).toBe<State>('regulated');
  });

  it('allows recovering → activated direct re-entry when descent reverses', () => {
    const buf = new VitalsRingBuffer({ capacityMs: 10 * 60_000 });
    // Sharp climb during recovery: +3 BPM over 30 s ⇒ slope = +6 BPM/min.
    ramp(buf, 0, 30, 14.5, 3 / 30);
    const verdict = classify({
      ringBuffer: buf,
      current: 'recovering',
      lastTransitionTs: 0,
      now: 30_000,
      rules: RULES,
    });
    expect(verdict).not.toBeNull();
    expect(verdict!.next).toBe<State>('activated');
  });

  it('honours the 5-second minimum dwell debounce on every transition', () => {
    const buf = new VitalsRingBuffer({ capacityMs: 10 * 60_000 });
    ramp(buf, 0, 60, 14.5, 1.5 / 60); // would otherwise fire activated.
    const verdict = classify({
      ringBuffer: buf,
      current: 'regulated',
      // Pretend a transition fired 2 s ago — must suppress.
      lastTransitionTs: 58_000,
      now: 60_000,
      rules: RULES,
    });
    expect(verdict).toBeNull();
  });

  it('does not transition when the latest breath sample is missing', () => {
    const buf = new VitalsRingBuffer({ capacityMs: 10 * 60_000 });
    buf.push({
      ts: 1_000,
      presence: true,
      motionBandPower: 0,
      source: 'recorded',
    });
    const verdict = classify({
      ringBuffer: buf,
      current: 'regulated',
      lastTransitionTs: 0,
      now: 1_000,
      rules: RULES,
    });
    expect(verdict).toBeNull();
  });

  it('returns null (no illegal transition) when conditions for a legal next-state are absent', () => {
    // Regulated buffer with calm breath — neither activated nor any other
    // state should be selected. The classifier guards invariant 5 by only
    // ever moving to a documented neighbour state.
    const buf = new VitalsRingBuffer({ capacityMs: 10 * 60_000 });
    flat(buf, 0, 60, 12); // calm 12 BPM for 60 s.
    const verdict = classify({
      ringBuffer: buf,
      current: 'regulated',
      lastTransitionTs: 0,
      now: 60_000,
      rules: RULES,
    });
    expect(verdict).toBeNull();
  });
});
