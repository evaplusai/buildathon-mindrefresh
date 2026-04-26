import { describe, it, expect } from 'vitest';
import { VitalsRingBuffer } from '../../src/services/vitalsRingBuffer';
import {
  detectMorningCheck,
  type MemoryQuery,
} from '../../src/workers/triggerDetectors';
import type { State } from '../../src/types/state';
import type { VitalsFrame } from '../../src/types/vitals';

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

function frame(overrides: Partial<VitalsFrame> & { ts: number }): VitalsFrame {
  return {
    breathBpm: 12,
    presence: true,
    motionBandPower: 0.3,
    source: 'recorded',
    ...overrides,
  };
}

/**
 * Build a MemoryQuery mock with seeded last-presence + transition rows.
 * Sprint C will replace this with the IndexedDB-backed implementation.
 */
function mockMemory(opts: {
  lastPresenceTs?: number;
  rows?: Array<{ ts: number; from: State; to: State }>;
  regulatedBaseline?: number;
}): MemoryQuery {
  return {
    getLastPresenceTs: () => opts.lastPresenceTs,
    getTransitionsSince: (since: number) =>
      (opts.rows ?? []).filter((r) => r.ts >= since),
    getRegulatedBaseline: () => opts.regulatedBaseline ?? 12,
  };
}

describe('morningCheck trigger', () => {
  it('fires when the previous presence event is older than 6 hours and a new presence is detected', () => {
    const now = 1_000_000_000_000;
    const buf = new VitalsRingBuffer();
    buf.push(frame({ ts: now, presence: true, breathBpm: 16 }));

    const ev = detectMorningCheck({
      ringBuffer: buf,
      now,
      current: 'regulated',
      memory: mockMemory({
        lastPresenceTs: now - SIX_HOURS_MS - 1, // > 6 h ago by 1 ms
        rows: [],
      }),
    });
    expect(ev).not.toBeNull();
    expect(ev!.type).toBe('morning_check');
    expect(ev!.transitionId).toBeTruthy();
  });

  it('attaches a MorningCheckPayload with yesterdayCount, lastEventTs, todayBaseline, regulatedBaseline', () => {
    const now = 1_700_000_000_000;
    const buf = new VitalsRingBuffer();
    buf.push(frame({ ts: now, presence: true, breathBpm: 17 }));

    const yesterdayRows: Array<{ ts: number; from: State; to: State }> = [
      // Three of these are activated transitions (the metric the card shows).
      { ts: now - 23 * 3600_000, from: 'regulated', to: 'activated' },
      { ts: now - 20 * 3600_000, from: 'activated', to: 'recovering' },
      { ts: now - 18 * 3600_000, from: 'regulated', to: 'activated' },
      { ts: now - 14 * 3600_000, from: 'recovering', to: 'regulated' },
      { ts: now - 10 * 3600_000, from: 'regulated', to: 'activated' },
    ];

    const ev = detectMorningCheck({
      ringBuffer: buf,
      now,
      current: 'regulated',
      memory: mockMemory({
        lastPresenceTs: now - 8 * 3600_000, // 8 h ago — qualifies.
        rows: yesterdayRows,
        regulatedBaseline: 12,
      }),
    });

    expect(ev).not.toBeNull();
    const p = ev!.morningPayload!;
    expect(p.yesterdayCount).toBe(3); // three rows where to === 'activated'
    expect(p.lastEventTs).toBe(yesterdayRows[yesterdayRows.length - 1].ts);
    expect(p.todayBaseline).toBe(17);
    expect(p.regulatedBaseline).toBe(12);
  });

  it('does not fire when the gap since the last presence event is less than 6 hours', () => {
    const now = 1_000_000_000_000;
    const buf = new VitalsRingBuffer();
    buf.push(frame({ ts: now, presence: true }));

    const ev = detectMorningCheck({
      ringBuffer: buf,
      now,
      current: 'regulated',
      memory: mockMemory({
        lastPresenceTs: now - SIX_HOURS_MS + 1_000, // 5 h 59 min 59 s ago
      }),
    });
    expect(ev).toBeNull();
  });

  it('does not fire on a fresh session (no prior presence in memory)', () => {
    const now = 1_000_000_000_000;
    const buf = new VitalsRingBuffer();
    buf.push(frame({ ts: now, presence: true }));

    const ev = detectMorningCheck({
      ringBuffer: buf,
      now,
      current: 'regulated',
      memory: mockMemory({ lastPresenceTs: undefined }),
    });
    expect(ev).toBeNull();
  });

  it('does not fire when the current frame has presence=false', () => {
    const now = 1_000_000_000_000;
    const buf = new VitalsRingBuffer();
    buf.push(frame({ ts: now, presence: false }));

    const ev = detectMorningCheck({
      ringBuffer: buf,
      now,
      current: 'regulated',
      memory: mockMemory({
        lastPresenceTs: now - 12 * 3600_000,
      }),
    });
    expect(ev).toBeNull();
  });

  it('computes yesterdayCount from seeded state_transitions in the last 24 hours', () => {
    const now = 1_700_000_000_000;
    const buf = new VitalsRingBuffer();
    buf.push(frame({ ts: now, presence: true, breathBpm: 15 }));

    const rows: Array<{ ts: number; from: State; to: State }> = [
      // Two within 24 h, one outside (must be excluded).
      { ts: now - 25 * 3600_000, from: 'regulated', to: 'activated' }, // outside
      { ts: now - 20 * 3600_000, from: 'regulated', to: 'activated' }, // counts
      { ts: now - 5 * 3600_000, from: 'regulated', to: 'activated' }, // counts
    ];

    const ev = detectMorningCheck({
      ringBuffer: buf,
      now,
      current: 'regulated',
      memory: mockMemory({
        lastPresenceTs: now - 7 * 3600_000,
        rows,
      }),
    });
    expect(ev).not.toBeNull();
    expect(ev!.morningPayload!.yesterdayCount).toBe(2);
  });
});
