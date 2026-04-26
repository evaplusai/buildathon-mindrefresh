import type { VitalsFrame } from '../types/vitals';

export interface RingBufferOpts {
  capacityMs?: number;
}

export class VitalsRingBuffer {
  private samples: VitalsFrame[] = [];
  private opts: RingBufferOpts;

  constructor(opts: RingBufferOpts = {}) {
    this.opts = opts;
  }

  private capacity() {
    return this.opts.capacityMs ?? 60_000;
  }

  push(v: VitalsFrame) {
    this.samples.push(v);
    const cutoff = v.ts - this.capacity();
    while (this.samples.length && this.samples[0].ts < cutoff) {
      this.samples.shift();
    }
  }

  size() {
    return this.samples.length;
  }

  meanBreath(windowMs?: number): number | undefined {
    const w = windowMs ?? this.capacity();
    const now = this.samples.at(-1)?.ts ?? 0;
    const xs = this.samples
      .filter((s) => s.ts >= now - w && s.breathBpm != null)
      .map((s) => s.breathBpm!);
    if (!xs.length) return undefined;
    return xs.reduce((a, b) => a + b, 0) / xs.length;
  }

  slopeBreath(windowMs?: number): number | undefined {
    const w = windowMs ?? this.capacity();
    const now = this.samples.at(-1)?.ts ?? 0;
    const xs = this.samples.filter(
      (s) => s.ts >= now - w && s.breathBpm != null,
    );
    if (xs.length < 2) return undefined;
    const first = xs[0];
    const last = xs[xs.length - 1];
    const dtMin = (last.ts - first.ts) / 60_000;
    if (dtMin <= 0) return undefined;
    return (last.breathBpm! - first.breathBpm!) / dtMin;
  }

  latest(): VitalsFrame | undefined {
    return this.samples.at(-1);
  }

  /**
   * Read-only snapshot of the breath-bearing samples within `windowMs` of the
   * latest frame (defaults to the buffer's full capacity). Used by the state
   * classifier and the trigger detectors to inspect the window without
   * needing to know the buffer's internal storage shape.
   */
  samplesIn(windowMs?: number): VitalsFrame[] {
    if (this.samples.length === 0) return [];
    const w = windowMs ?? this.capacity();
    const now = this.samples[this.samples.length - 1].ts;
    const cutoff = now - w;
    return this.samples.filter((s) => s.ts >= cutoff);
  }

  /**
   * Time-span (ms) between the oldest and newest sample inside `windowMs`.
   * Returns `undefined` for fewer than 2 samples in that window.
   */
  spanMs(windowMs?: number): number | undefined {
    const xs = this.samplesIn(windowMs);
    if (xs.length < 2) return undefined;
    return xs[xs.length - 1].ts - xs[0].ts;
  }

  clear() {
    this.samples = [];
  }
}
