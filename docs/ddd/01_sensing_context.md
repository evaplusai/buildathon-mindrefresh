# DDD — Sensing Bounded Context

**Status:** Accepted (V1)
**Source of truth:** docs/02_research/05_canonical_build_plan.md
**Build Day:** 3 of 8

## Purpose

The Sensing context owns the boundary between MindRefreshStudio and the local Rust sensing-server. It establishes and maintains a single WebSocket connection to `ws://localhost:8765/ws/sensing`, parses every `SensingUpdate` JSON frame into a typed `Vitals` value, and exposes a 1 Hz vitals stream plus a 60-second ring buffer with a rolling EWMA breath baseline to the rest of the app. It does not classify states, choose affirmations, or persist anything to the cloud — it is purely the I/O and short-term-memory layer over the post-FFT sensor feed.

## Boundary

Inside the boundary: WebSocket lifecycle (connect / reconnect / clean shutdown), JSON parsing and validation, the in-memory 60 s ring buffer, the 7-day breath EWMA baseline tracker (which is rehydrated on cold start from `Memory.SessionStore`), and the `?source=recorded` JSONL replay path. Outside the boundary: the 3-state classifier (lives in `State`), affirmation lookup (`Intervention`), all persistence (`Memory`), and the binary CSI frames themselves — those are owned by the Rust daemon, never reach the browser, and are explicitly out of scope per `docs/05_architecture/01_system_architecture.md` §6 (privacy boundary). The seams are: (1) the WebSocket protocol with the sensing-server, (2) `postMessage` from main thread to `triggerWorker` carrying `Vitals` frames.

## Ubiquitous Language

| Term | Definition |
|---|---|
| **Vitals** | One sensor sample at time `ts`: `{breathBpm?, hrBpm?, presence, motionBandPower}`. Source: build plan §6 postMessage contract. |
| **SensingUpdate** | The wire-format JSON the sensing-server emits at 1 Hz on the WS endpoint. Source: `upstream/RuView/v2/.../main.rs` L189–267. |
| **breathing_rate_bpm** | Breaths per minute, extracted by FFT over the 0.1–0.5 Hz CSI band (6–30 BPM). |
| **heart_rate_bpm** | Heart beats per minute, FFT 0.67–2.0 Hz band (40–120 BPM). Display-only in V1. |
| **presence** | Boolean motion gate — true when any qualifying motion is detected in the room. |
| **motion_band_power** | Whole-body translation proxy; used by `morning_check` to decide if presence is a real return rather than a single noisy frame. |
| **ring buffer** | Fixed-capacity, FIFO, time-ordered list of the last N seconds of `Vitals`. |
| **baseline** | Rolling EWMA of breath rate over 7 days; the user's "regulated" anchor. |
| **source=live** | Default mode. Real WebSocket to the local daemon. |
| **source=recorded** | Demo-fallback mode. Replays `fixtures/recorded-csi-session.jsonl` through the same `Vitals` contract. |
| **Unsubscribe** | Returned by `subscribe()`; idempotent function that detaches a listener. |

## Public Interface

```ts
// src/types/vitals.ts
export type VitalsSource = 'live' | 'recorded';

export interface Vitals {
  ts: number;                    // epoch ms, monotonic non-decreasing
  breathBpm?: number;            // undefined when sensor is still warming up
  hrBpm?: number;                // display-only in V1
  presence: boolean;             // never null/undefined
  motionBandPower: number;       // [0, +inf)
  source: VitalsSource;
}

// src/services/wsClient.ts
export interface SensingAPI {
  /** SUBSCRIBABLE — push of every parsed Vitals frame, ~1 Hz. */
  subscribe(callback: (v: Vitals) => void): Unsubscribe;
  /** CALLABLE — synchronous read of current 60 s window. */
  snapshot(): Vitals[];
  /** CALLABLE — current rolling baseline (EWMA over 7 days). */
  baseline(): { breathBpm: number; hrBpm?: number };
  /** CALLABLE — clean shutdown for navigation away. */
  disconnect(): void;
}

export type Unsubscribe = () => void;

export function createSensingClient(opts: {
  url?: string;                  // default 'ws://localhost:8765/ws/sensing'
  source?: VitalsSource;         // 'live' | 'recorded'
  fixtureUrl?: string;           // when source='recorded'
  rehydrateBaseline?: () => Promise<{ breathBpm: number; hrBpm?: number } | null>;
}): SensingAPI;
```

## Domain Events

| Event | Direction | Payload | Producer | Consumer(s) |
|---|---|---|---|---|
| `Vitals` | emit | `{ts, breathBpm?, hrBpm?, presence, motionBandPower, source}` | this | State (worker) |
| `BaselineUpdate` | emit | `{field: 'breath' \| 'hr', value: number}` | this (via State worker re-emit) | Memory |
| (none) | consume | — | — | — |

Sensing is a pure source. It has no upstream domain dependencies inside the SPA.

## Aggregates / Entities / Value Objects

1. **`VitalsStream` (aggregate root).** Wraps the `WebSocket`. Invariant: at most one open socket per `SensingAPI` instance. Operations: `connect`, `parseFrame`, `emit`, `disconnect`. Identity is the URL.
2. **`VitalsRingBuffer` (aggregate).** A fixed-capacity time-window store. Invariant: contents are sorted by `ts` ascending and never exceed 60 s of wall-clock span. Operations: `append(v)`, `snapshot()`, `slope(field, windowSec)`, `mean(field, windowSec)`. Pure — no I/O.
3. **`BaselineTracker` (aggregate).** Owns the 7-day EWMA per field. Invariant: `value` is finite once at least one sample has been observed; never NaN. Operations: `observe(v)`, `current()`, `rehydrate(stored)`.
4. **`Vitals` (value object).** Immutable. Equality by structural value of `ts`. No identity beyond timestamp.

## Invariants

1. **One socket per client.** `createSensingClient` opens exactly one WS and reuses it; `disconnect()` is idempotent.
2. **Ring buffer cap.** `VitalsRingBuffer.snapshot().length <= 60` and the span between first and last `ts` never exceeds 60_000 ms.
3. **Sample monotonicity.** For any two consecutive frames `a, b` delivered to subscribers, `b.ts >= a.ts`. Out-of-order frames are dropped, not reordered.
4. **`presence` is never null.** Parser substitutes `false` if the field is absent; subscribers may rely on the boolean.
5. **No raw CSI in scope.** The Sensing context never receives, parses, or stores binary CSI frames; only post-FFT JSON.
6. **Source label preserved.** The `source` field on every emitted `Vitals` matches the mode the client was constructed with.

## Anti-corruption layer

The translator from sensing-server vocabulary (`SensingUpdate` with snake_case fields like `breathing_rate_bpm`, `heart_rate_bpm`, `motion_band_power`, optional / nullable fields) into our internal `Vitals` value object lives in `src/services/wsClient.ts` (the private `parseSensingUpdate` function). The same file owns the recorded-fixture JSONL replay shim, which fakes the WebSocket but produces the *same* internal `Vitals` shape — so downstream contexts cannot tell live from recorded apart from the `source` label.

## File map

| File | Description |
|---|---|
| `src/services/wsClient.ts` | WebSocket lifecycle + parser + recorded-fixture replay; exports `createSensingClient`. |
| `src/services/vitalsRingBuffer.ts` | Pure 60 s ring buffer; rolling mean and slope helpers. |
| `src/services/baselineTracker.ts` | 7-day breath EWMA; rehydrates from `SessionStore` on boot. |
| `src/types/vitals.ts` | `Vitals`, `VitalsSource`, `Unsubscribe`, `SensingAPI` types. |

(See `docs/05_architecture/01_system_architecture.md` §7 source layout.)

## Tests

- `tests/sensing/wsClient.spec.ts` — mocks the global `WebSocket`, emits canned `SensingUpdate` JSON, asserts the subscriber receives a structurally valid `Vitals`. Mechanically enforces invariants 1, 4, 5, 6.
- `tests/sensing/vitalsRingBuffer.spec.ts` — pure-function tests over the ring buffer; asserts oldest sample is evicted at capacity and that `slope`/`mean` are correct over synthetic series. Mechanically enforces invariants 2 and 3.

Both files are listed in build plan §13.

## Out of scope (V1)

- HRV / RR-interval extraction — out per **ADR-006** (sensing-server emits a smoothed 1 Hz HR series, SDNN over which is meaningless).
- Multi-sensor fusion / CSI mesh — single-node only, per `01_system_architecture.md` §8.
- Direct UDP socket to ESP32 — the browser cannot open UDP; the Rust daemon owns that link.
- Pose estimation / 17-keypoint extraction — wrong product.
- Reading or storing raw CSI frames in the browser — privacy boundary, see `01_system_architecture.md` §6.

## References

- `docs/02_research/05_canonical_build_plan.md` §2 (architecture), §6 (Web Worker postMessage contract), §13 (test plan)
- `docs/05_architecture/01_system_architecture.md` §3, §6, §7
- `docs/adr/ADR-005-two-link-architecture.md`
- `docs/adr/ADR-006-hrv-out-of-v1.md`
- `docs/adr/ADR-008-port-and-path-locked.md`
- `upstream/RuView/v2/crates/wifi-densepose-sensing-server/src/cli.rs` L11–32 (port 8765 default)
- `upstream/RuView/v2/crates/wifi-densepose-sensing-server/src/main.rs` L189–267, L4662 (`SensingUpdate` shape, WS route)
