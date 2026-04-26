import { describe, it, expect } from 'vitest';
import { VitalsRingBuffer } from '../../src/services/vitalsRingBuffer';
import type { VitalsFrame } from '../../src/types/vitals';

function frame(ts: number, breathBpm?: number): VitalsFrame {
  return {
    ts,
    breathBpm,
    presence: true,
    motionBandPower: 0,
    source: 'live',
  };
}

describe('VitalsRingBuffer', () => {
  it('appends samples and reports size', () => {
    const buf = new VitalsRingBuffer({ capacityMs: 60_000 });
    buf.push(frame(1_000, 12));
    buf.push(frame(2_000, 13));
    expect(buf.size()).toBe(2);
    expect(buf.latest()?.ts).toBe(2_000);
  });

  it('evicts samples older than the capacity window', () => {
    const buf = new VitalsRingBuffer({ capacityMs: 60_000 });
    buf.push(frame(0, 10));
    buf.push(frame(30_000, 11));
    buf.push(frame(70_000, 12));
    // Anything older than (70_000 - 60_000) = 10_000 should be gone.
    expect(buf.size()).toBe(2);
    expect(buf.latest()?.ts).toBe(70_000);
  });

  it('computes mean breath over the configured window', () => {
    const buf = new VitalsRingBuffer({ capacityMs: 60_000 });
    buf.push(frame(0, 10));
    buf.push(frame(30_000, 14));
    buf.push(frame(60_000, 18));
    const mean = buf.meanBreath();
    expect(mean).toBeDefined();
    expect(mean!).toBeCloseTo(14, 5);
  });

  it('computes slope as BPM-per-minute over the available samples', () => {
    const buf = new VitalsRingBuffer({ capacityMs: 60_000 });
    buf.push(frame(0, 10));
    buf.push(frame(60_000, 16)); // +6 BPM in 1 minute → slope = 6
    const slope = buf.slopeBreath();
    expect(slope).toBeDefined();
    expect(slope!).toBeCloseTo(6, 5);
  });

  it('returns undefined slope when fewer than 2 breath samples', () => {
    const buf = new VitalsRingBuffer({ capacityMs: 60_000 });
    buf.push(frame(0, 10));
    expect(buf.slopeBreath()).toBeUndefined();
  });

  it('clear() empties the buffer', () => {
    const buf = new VitalsRingBuffer({ capacityMs: 60_000 });
    buf.push(frame(0, 12));
    buf.clear();
    expect(buf.size()).toBe(0);
    expect(buf.latest()).toBeUndefined();
  });
});
