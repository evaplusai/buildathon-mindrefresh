# DDD — State Bounded Context

**Status:** Accepted (V1)
**Source of truth:** docs/02_research/05_canonical_build_plan.md
**Build Day:** 3 of 8

## Purpose

The State context owns the interpretation layer: turning a stream of raw `Vitals` into a small, debounced, well-defined set of nervous-system labels and triggers. It runs entirely inside `triggerWorker.ts` (a Web Worker) and is the only place in the app that decides whether the user is `regulated`, `activated`, or `recovering`, and the only place that fires the five trigger detectors (`acute_spike`, `slow_drift`, `recovery`, `manual`, `morning_check`). It does not own sensor I/O, affirmation choice, or persistence.

## Boundary

Inside: the 3-state breath-trajectory classifier with its 5 s debounce and dwell rules; the five trigger detectors as pure functions over the ring buffer (plus, for `morning_check`, a query to `Memory`); the worker-side ring buffer; the per-user breath baseline EWMA. Outside: WebSocket I/O (`Sensing`), affirmation choice and rendering (`Intervention`), all writes to IndexedDB or Supabase (`Memory`). The seams are the two `postMessage` boundaries — `Vitals` in from the main thread, `state_transition` / `trigger` / `baseline_update` out — defined in build plan §6. The diagram in `docs/05_architecture/01_system_architecture.md` §5 places this context between Sensing and Intervention; that placement still holds, with the Personalization box removed for V1.

## Ubiquitous Language

| Term | Definition |
|---|---|
| **State** | One of `regulated`, `activated`, `recovering`. Derived from breath trajectory only in V1. Source: build plan §4. |
| **regulated** | Breath 8–14 BPM, flat or descending. Calm baseline. (Dana 2018; Porges 2009.) |
| **activated** | Breath > 14 BPM AND rising > 1 BPM/min sustained 60 s. Sympathetic activation. |
| **recovering** | Breath descending > 0.5 BPM/min after `activated`. Post-activation return. |
| **dwell** | Minimum time the classifier requires evidence to remain in a state before transitioning out. 5 s in V1. |
| **debounce** | Per ADR-010: a 5-second minimum-dwell rule plus the entry-condition window (60 s for `activated`, 30 s for `recovering`); no separate sub-second evidence rule. |
| **trigger** | A discrete intervention-worthy event derived from the ring buffer. One of 5 V1 types. |
| **acute_spike** | Breath rises > 4 BPM in 30 s. |
| **slow_drift** | Breath trends up > 1 BPM/min for 10 min. |
| **recovery** | Breath descends > 0.5 BPM/min for 30 s after `activated`. |
| **manual** | User-initiated trigger via "I need a moment" button. |
| **morning_check** | First `presence=true` after a >6 h gap; queries yesterday's history. |
| **transitionId** | UUID minted at the moment of a state change; later joins to the affirmation row in `interventions`. |
| **MorningCheckPayload** | `{yesterdayCount, lastEventTs, todayBaseline, regulatedBaseline}` — attached to a `morning_check` trigger so the main thread can render the comparison card without a second round trip. |
| **stateRules.json** | Static thresholds for the 3-state classifier (cold-start values; SONA cut from V1). |

## Public Interface

```ts
// src/types/state.ts
export type State = 'regulated' | 'activated' | 'recovering';

export type TriggerType =
  | 'acute_spike' | 'slow_drift' | 'recovery' | 'manual' | 'morning_check';

export interface StateTransition {
  id: string;                    // UUID, the transitionId
  ts: number;
  from: State;
  to: State;
  reason: string;                // human-readable, e.g. 'breath rose >1 BPM/min for 60s'
  breathBpm: number;             // sample at moment of transition
  hrBpm?: number;
}

export interface TriggerEvent {
  type: TriggerType;
  transitionId: string;          // joins to a StateTransition (or the synthetic one for `manual`)
  severity: number;              // 0..1
  ts: number;
  morningPayload?: MorningCheckPayload;
}

export interface MorningCheckPayload {
  yesterdayCount: number;        // # of activated transitions in the last 24h
  lastEventTs: number;           // ts of yesterday's most recent transition
  todayBaseline: number;         // this morning's first-presence breath
  regulatedBaseline: number;     // user's 7-day regulated EWMA
}

// src/workers/triggerWorker.ts (the only handle the main thread holds)
export interface StateAPI {
  /** SUBSCRIBABLE — every confirmed state change. */
  onTransition(cb: (e: StateTransition) => void): Unsubscribe;
  /** SUBSCRIBABLE — every trigger fire (independent of transitions). */
  onTrigger(cb: (e: TriggerEvent) => void): Unsubscribe;
  /** CALLABLE — push a Vitals frame from the main thread. */
  ingest(v: Vitals): void;
  /** CALLABLE — user tapped "I need a moment". */
  manualTrigger(): void;
  /** CALLABLE — full reset, e.g. on reconnect. */
  reset(): void;
}
```

## Domain Events

| Event | Direction | Payload | Producer | Consumer(s) |
|---|---|---|---|---|
| `Vitals` | consume | `{ts, breathBpm?, hrBpm?, presence, motionBandPower, source}` | Sensing | this |
| `StateTransition` | emit | as defined above | this | Intervention, Memory |
| `TriggerEvent` | emit | as defined above | this | Intervention, Memory |
| `BaselineUpdate` | emit | `{field, value}` | this | Memory |
| `MorningCheckQuery` | consume (callable) | `{since: ISOString}` → rows | Memory (called by this) | this |

`StateTransition` and `TriggerEvent` are the canonical cross-context shapes; they are reproduced verbatim in `Intervention`'s and `Memory`'s consumed-events tables.

## Aggregates / Entities / Value Objects

1. **`StateClassifier` (aggregate root).** Holds current `State`, time-since-last-transition, and the dwell timer. Invariant (per ADR-010): never emits a transition before the 5 s minimum dwell elapses AND the entry-condition window has been satisfied (60 s sustained breath > 14 BPM rising for `activated`; 30 s descent > 0.5 BPM/min for `recovering`; 30 s within regulated range and flat trend for `regulated`). Operations: `feed(v)`, `current()`.
2. **`TriggerDetector` (5 instances, one per `TriggerType`).** Each is a pure function over the ring buffer (or, for `morning_check`, the buffer + `MorningCheckQuery`). Invariant: idempotent on the same window — re-running the detector on the same input produces the same verdict.
3. **`MorningCheckPayload` (value object).** Immutable; computed once at the moment of `morning_check` fire. Invariant: `yesterdayCount >= 0`, `regulatedBaseline > 0`.
4. **`StateTransition` (entity).** Identified by `id` (UUID). Created exactly once per real transition; reused as `transitionId` by downstream contexts.

## Invariants

1. **5 s dwell.** No state transition fires before 5 s have elapsed since the previous one.
2. **Entry-condition windows.** Per ADR-010: `regulated→activated` requires breath > 14 BPM rising sustained 60 s; `activated→recovering` requires descent > 0.5 BPM/min for 30 s; `recovering→regulated` requires 30 s within regulated range with flat trend. There is no separate sub-second evidence rule beyond the 5 s minimum dwell.
3. **`morning_check` gating.** Fires only when (a) the previous `presence=true` event in IndexedDB is older than 6 hours AND (b) the current frame is `presence=true` with `motionBandPower` above the noise threshold in `stateRules.json`.
4. **Single classifier owner.** All state changes flow through `StateClassifier.feed`; no other module mutates current state.
5. **Allowed transitions only.** `regulated → activated`, `activated → recovering`, `recovering → regulated`, `recovering → activated` are the only legal transitions. Any other is a programming error and throws.
6. **Worker-only.** The classifier runs only inside `triggerWorker.ts`; it never executes on the main thread (privacy + perf isolation per build plan §6).

## Anti-corruption layer

The State context translates from `Sensing`'s `Vitals` (raw measurements) into its own internal sample shape used by the ring buffer and detectors. That translation lives at the top of `src/workers/triggerWorker.ts` (the `onmessage` handler). The threshold configuration is loaded from `src/data/stateRules.json` and cast against the internal vocabulary in `src/workers/stateRules.ts` so a JSON edit cannot smuggle in fields the classifier does not expect.

## File map

| File | Description |
|---|---|
| `src/workers/triggerWorker.ts` | Worker entrypoint; owns `StateClassifier` and the 5 detectors. |
| `src/workers/stateRules.ts` | Pure 3-state classifier function. |
| `src/workers/triggerDetectors.ts` | Five pure detectors over the ring buffer. |
| `src/data/stateRules.json` | Cold-start thresholds. |
| `src/types/state.ts` | `State`, `StateTransition`, `TriggerEvent`, `MorningCheckPayload`. |

## Tests

- `tests/state/stateRules.spec.ts` — feeds synthetic breath series; asserts `regulated → activated` only after 60 s sustained rise, and `activated → recovering` only after 30 s descent at > 0.5 BPM/min, with 5 s debounce. Mechanically enforces invariants 1, 2, 5.
- `tests/triggers/morningCheck.spec.ts` — uses `fake-indexeddb` and fake timers; asserts `morning_check` fires only after a >6 h gap and that the `MorningCheckPayload` is correctly assembled from yesterday's rows. Mechanically enforces invariant 3.

Both files are listed in build plan §13.

## Out of scope (V1)

- The 4-state polyvagal classifier (`shutdown` state) — cut by **ADR-010** for V1; restoration post-buildathon when motion + dwell tie-breakers ship.
- HRV-driven thresholds — out per **ADR-006**.
- SONA-personalised threshold adaptation per user — cut by **ADR-007**; thresholds remain literal.
- WebGPU-based classification — out per **ADR-007**.
- Any direct DB write — `State` only emits events; persistence is `Memory`'s job.
- **`late_push` and `cumulative_load` triggers** from earlier drafts are post-buildathon. V1 ships exactly 5 triggers (`acute_spike`, `slow_drift`, `recovery`, `manual`, `morning_check`) per ADR-005 / doc 05 §5. Do not reintroduce based on stale references to docs 01 / 03 / 04.

## References

- `docs/02_research/05_canonical_build_plan.md` §4 (state classifier), §5 (triggers incl. morning_check), §6 (Worker contract), §13 (tests)
- `docs/05_architecture/01_system_architecture.md` §5
- `docs/adr/ADR-006-hrv-out-of-v1.md`
- `docs/adr/ADR-010-three-state-breath-trajectory-classifier.md`
- Porges 2009; Yilmaz Balban et al. 2023 (cyclic sigh); Dana 2018 (regulated breathing)
