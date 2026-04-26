// Five trigger detectors (V1):
//   acute_spike, slow_drift, recovery, manual, morning_check.
//
// Each detector is a pure function over the ring buffer (and, for
// `morning_check`, an injected MemoryQuery). Detectors never mutate the
// buffer, never touch `self` / `postMessage`, and are idempotent on the
// same input window (DDD §Aggregates invariant 2).
//
// References:
//   docs/02_research/05_canonical_build_plan.md §5
//   docs/ddd/02_state_context.md §Domain Events / §Invariants

import type { VitalsRingBuffer } from '../services/vitalsRingBuffer';
import type {
  MorningCheckPayload,
  State,
  TriggerEvent,
} from '../types/state';

/**
 * Read-only contract the morning-check detector needs from the Memory
 * context. Sprint C will provide the real impl backed by IndexedDB; Sprint B
 * tests inject a mock.
 */
export interface MemoryQuery {
  /** Timestamp (ms) of the most recent presence=true event, or undefined. */
  getLastPresenceTs(): number | undefined;
  /** State-transition rows since the given epoch ms. */
  getTransitionsSince(sinceMs: number): Array<{
    ts: number;
    from: State;
    to: State;
  }>;
  /** EWMA-style baseline (BPM) of the user's regulated breath; default 12. */
  getRegulatedBaseline?(): number;
}

export interface DetectorContext {
  ringBuffer: VitalsRingBuffer;
  now: number;
  current: State;
  /** Optional UUID factory; defaults to `crypto.randomUUID()`. */
  newId?: () => string;
}

export interface MorningDetectorContext extends DetectorContext {
  memory: MemoryQuery;
}

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const DEFAULT_REGULATED_BASELINE_BPM = 12;

function newTransitionId(ctx: { newId?: () => string }): string {
  if (ctx.newId) return ctx.newId();
  // crypto.randomUUID is available in modern browsers, Node 19+, and happy-dom.
  return globalThis.crypto.randomUUID();
}

/**
 * acute_spike — breath rises > 4 BPM inside the last 30 s.
 * Severity scales with the magnitude of the rise (4 BPM → 0, 12 BPM → 1).
 */
export function detectAcuteSpike(ctx: DetectorContext): TriggerEvent | null {
  const windowMs = 30_000;
  const samples = ctx.ringBuffer.samplesIn(windowMs);
  const breathSamples = samples.filter((s) => s.breathBpm != null);
  if (breathSamples.length < 2) return null;

  let min = Infinity;
  let max = -Infinity;
  let minTs = 0;
  let maxTs = 0;
  for (const s of breathSamples) {
    const b = s.breathBpm!;
    if (b < min) {
      min = b;
      minTs = s.ts;
    }
    if (b > max) {
      max = b;
      maxTs = s.ts;
    }
  }
  // The rise has to actually be a rise — max must follow min in time.
  if (maxTs <= minTs) return null;
  const rise = max - min;
  if (rise <= 4) return null;

  return {
    type: 'acute_spike',
    transitionId: newTransitionId(ctx),
    severity: clamp01((rise - 4) / 8),
    ts: ctx.now,
  };
}

/**
 * slow_drift — breath trends up > 1 BPM/min sustained for at least 10 min.
 * Returns `null` when the buffer holds less than 10 minutes of data.
 */
export function detectSlowDrift(ctx: DetectorContext): TriggerEvent | null {
  const windowMs = 10 * 60_000;
  const span = ctx.ringBuffer.spanMs(windowMs);
  if (span == null || span < windowMs * 0.95) return null;

  const slope = ctx.ringBuffer.slopeBreath(windowMs);
  if (slope == null || slope <= 1) return null;

  return {
    type: 'slow_drift',
    transitionId: newTransitionId(ctx),
    severity: clamp01((slope - 1) / 4),
    ts: ctx.now,
  };
}

/**
 * recovery — breath descends > 0.5 BPM/min for ≥ 30 s after `activated`.
 * Complementary to the classifier's `activated → recovering` transition;
 * both fire on the same ingest by design (DDD invariant 5 + canonical demo).
 */
export function detectRecovery(ctx: DetectorContext): TriggerEvent | null {
  if (ctx.current !== 'activated') return null;
  const windowMs = 30_000;
  const span = ctx.ringBuffer.spanMs(windowMs);
  if (span == null || span < windowMs * 0.95) return null;
  const slope = ctx.ringBuffer.slopeBreath(windowMs);
  if (slope == null || slope > -0.5) return null;
  return {
    type: 'recovery',
    transitionId: newTransitionId(ctx),
    severity: clamp01((-slope - 0.5) / 4),
    ts: ctx.now,
  };
}

/**
 * manual — fires when the user taps "I need a moment". Always emits a
 * trigger with the current state, regardless of vitals.
 */
export function detectManual(ctx: DetectorContext): TriggerEvent {
  return {
    type: 'manual',
    transitionId: newTransitionId(ctx),
    severity: 0.5,
    ts: ctx.now,
  };
}

/**
 * morning_check — fires when the previous presence=true event in memory is
 * older than 6 h AND the current frame is presence=true. Idempotent over
 * the same window.
 */
export function detectMorningCheck(
  ctx: MorningDetectorContext,
): TriggerEvent | null {
  const latest = ctx.ringBuffer.latest();
  if (!latest || !latest.presence) return null;

  const lastPresenceTs = ctx.memory.getLastPresenceTs();
  if (lastPresenceTs == null) return null; // fresh session — nothing to compare against
  if (ctx.now - lastPresenceTs <= SIX_HOURS_MS) return null;

  const since = ctx.now - TWENTY_FOUR_HOURS_MS;
  const rows = ctx.memory.getTransitionsSince(since);
  const yesterdayActivated = rows.filter((r) => r.to === 'activated');
  const lastEventTs = rows.length > 0 ? rows[rows.length - 1].ts : lastPresenceTs;

  const regulatedBaseline = ctx.memory.getRegulatedBaseline?.()
    ?? DEFAULT_REGULATED_BASELINE_BPM;
  const todayBaseline = latest.breathBpm ?? regulatedBaseline;

  const morningPayload: MorningCheckPayload = {
    yesterdayCount: yesterdayActivated.length,
    lastEventTs,
    todayBaseline,
    regulatedBaseline,
  };

  return {
    type: 'morning_check',
    transitionId: newTransitionId(ctx),
    severity: clamp01(
      Math.abs(todayBaseline - regulatedBaseline) / regulatedBaseline,
    ),
    ts: ctx.now,
    morningPayload,
  };
}

function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}
