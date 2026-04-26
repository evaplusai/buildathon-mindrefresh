// TriggerCore — the testable, side-effect-free heart of the State context.
//
// `triggerWorker.ts` is now a thin shell that wires this core to `self`
// and `postMessage`. Everything below is reachable from a Vitest unit test
// without touching the Worker globals.
//
// Responsibilities:
//   • Own the ring buffer (a single source of truth for breath history).
//   • Drive the 3-state classifier on every ingest, debounced + dwell-gated
//     by `stateRules.ts`.
//   • Run the 5 trigger detectors and surface their verdicts via callbacks.
//   • Mint `transitionId`s (UUIDs) on every emitted event.
//
// Time is read exclusively through `opts.now()`; the worker shell wires
// `Date.now`, tests pass a fake.

import type { VitalsFrame } from '../types/vitals';
import type {
  State,
  StateTransition,
  TriggerEvent,
} from '../types/state';
import { VitalsRingBuffer } from '../services/vitalsRingBuffer';
import { classify, type StateRulesConfig } from './stateRules';
import {
  detectAcuteSpike,
  detectManual,
  detectMorningCheck,
  detectRecovery,
  detectSlowDrift,
  type MemoryQuery,
} from './triggerDetectors';

export interface TriggerCoreOpts {
  /** Wall-clock source. Tests inject a fake; production uses `Date.now`. */
  now?: () => number;
  /** Dependency injection — defaults to a fresh 10-min ring buffer. */
  ringBuffer?: VitalsRingBuffer;
  /** Threshold configuration; defaults to the bundled stateRules.json. */
  rules: StateRulesConfig;
  /** Memory adapter; required for the morning_check detector to fire. */
  memory?: MemoryQuery;
  /** UUID factory; defaults to `crypto.randomUUID()`. */
  newId?: () => string;
}

export interface TriggerCore {
  ingest(frame: VitalsFrame): void;
  manualTrigger(): void;
  reset(): void;
  onTransition(cb: (e: StateTransition) => void): () => void;
  onTrigger(cb: (e: TriggerEvent) => void): () => void;
  /** Read-only accessor primarily for tests. */
  current(): State;
}

const DEFAULT_BUFFER_CAPACITY_MS = 10 * 60_000; // 10 min — enough for slow_drift.

export function createTriggerCore(opts: TriggerCoreOpts): TriggerCore {
  const now = opts.now ?? Date.now;
  const ringBuffer =
    opts.ringBuffer ?? new VitalsRingBuffer({ capacityMs: DEFAULT_BUFFER_CAPACITY_MS });
  const memory = opts.memory;
  const newId = opts.newId ?? (() => globalThis.crypto.randomUUID());
  const rules = opts.rules;

  let currentState: State = 'regulated';
  let lastTransitionTs = 0;

  const transitionListeners = new Set<(e: StateTransition) => void>();
  const triggerListeners = new Set<(e: TriggerEvent) => void>();

  function emitTransition(e: StateTransition) {
    transitionListeners.forEach((cb) => cb(e));
  }
  function emitTrigger(e: TriggerEvent) {
    triggerListeners.forEach((cb) => cb(e));
  }

  function ingest(frame: VitalsFrame): void {
    ringBuffer.push(frame);
    const ts = now();

    // 1. Run the classifier and emit any state transition.
    const verdict = classify({
      ringBuffer,
      current: currentState,
      lastTransitionTs,
      now: ts,
      rules,
    });
    if (verdict) {
      const id = newId();
      const transition: StateTransition = {
        id,
        ts,
        from: currentState,
        to: verdict.next,
        reason: verdict.reason,
        breathBpm: frame.breathBpm ?? ringBuffer.latest()?.breathBpm ?? 0,
        hrBpm: frame.hrBpm,
      };
      currentState = verdict.next;
      lastTransitionTs = ts;
      emitTransition(transition);
    }

    // 2. Run the four data-driven detectors. The classifier already owns
    //    the manual trigger; that's emitted from `manualTrigger()` only.
    const detectorCtx = {
      ringBuffer,
      now: ts,
      current: currentState,
      newId,
    };
    const dataDetectors = [
      detectAcuteSpike,
      detectSlowDrift,
      detectRecovery,
    ];
    for (const detect of dataDetectors) {
      const ev = detect(detectorCtx);
      if (ev) emitTrigger(ev);
    }

    if (memory) {
      const morning = detectMorningCheck({ ...detectorCtx, memory });
      if (morning) emitTrigger(morning);
    }
  }

  function manualTrigger(): void {
    const ev = detectManual({
      ringBuffer,
      now: now(),
      current: currentState,
      newId,
    });
    emitTrigger(ev);
  }

  function reset(): void {
    ringBuffer.clear();
    currentState = 'regulated';
    lastTransitionTs = 0;
  }

  function onTransition(cb: (e: StateTransition) => void): () => void {
    transitionListeners.add(cb);
    return () => transitionListeners.delete(cb);
  }
  function onTrigger(cb: (e: TriggerEvent) => void): () => void {
    triggerListeners.add(cb);
    return () => triggerListeners.delete(cb);
  }

  return {
    ingest,
    manualTrigger,
    reset,
    onTransition,
    onTrigger,
    current: () => currentState,
  };
}
