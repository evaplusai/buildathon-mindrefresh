# DDD — Dashboard Display Bounded Context

**Status:** Proposed (V2 — Dashboard v2)
**Source of truth:** `docs/03_designs/dashboard-v2_spec.md`, ADR-015, ADR-017
**Build Day:** Post-V1 / Dashboard v2 sprint

## Purpose

The Display context owns **everything between the data layer and the
dashboard UI**: the 3-state → 4-state mapping, the four derived sensor
signals (cardiac micro-motion / postural stillness / movement cadence /
breath rate), the Pattern Mirror longitudinal aggregator, the Today
Strip per-day computation, and the Demo Mode scripted state machine.

It does not classify state from sensors (`State`), pick affirmations
(`Intervention`), persist anything (`Memory`), or run the agent swarm
(`Reflection`). It is a **read model** — pure functions over inputs from
the other contexts, optionally cached in IndexedDB for performance.

## Boundary

Inside: `toDashboardState()` (the 3→4 mapping), the four signal
normalisers (`derive*`), `computeMirrorObservations`,
`computeTodayStrip`, the Demo Mode state machine, the disagreement
logger that consumes `DashboardStateAdvisory` from `Reflection`. The
React components for the State Dial, Live Signals panel, Pattern
Mirror, Today Strip, and Demo Mode toggle.

Outside: the `triggerWorker` (still owns 3-state classification —
ADR-010 / DDD-02); the `wsClient` (Sensing); `sessionStore` (Memory);
the agent swarm (Reflection); the Intervention surfaces
(AffirmationCard / BreathGuide / MorningCheckCard).

The seams:
- **Inbound:** `StateTransition` events from `State`, raw `VitalsFrame`
  from `Sensing`, `recentTransitions` queries from `Memory`.
- **Inbound:** `DashboardStateAdvisory` from `Reflection`.
- **Outbound:** rendered React tree only — no events, no callables.

## Ubiquitous Language

| Term | Definition |
|---|---|
| **DashboardState** | One of `steady`, `shifting`, `overloaded`, `drained`. The 4-valued display label. |
| **toDashboardState** | Pure function `(internalState, severity, dwellMs, signals) → DashboardState`. The single place the 3→4 mapping is encoded. |
| **SignalsFrame** | The 4 derived live values rendered in the signals panel — `breathBpm`, `cardiacMicroMotion` (0..1), `posturalStillness` (0..1), `movementCadence` (0..1). |
| **MirrorObservation** | One of up to 4 longitudinal observations rendered in the Pattern Mirror. Each has text, evidence caption, icon key, and confidence. |
| **TodayStripData** | The per-day visualisation payload — segments, reset markers, 4 stat tiles. |
| **DemoArc** | The scripted 44-second 4-state loop driven by the Demo Mode toggle. |
| **stateLadder** | The 4-rung visual showing which state is currently active. Same vocabulary as `DashboardState`. |
| **dwellMs** | Milliseconds since the most recent `StateTransition` into the current internal state. Used in `toDashboardState` to escalate `activated → overloaded` past the 60 s threshold. |
| **regulatedBaseline** | The user's 7-day breath EWMA in `regulated` state (already emitted by the worker as `BaselineUpdate`). Used to differentiate `recovering → drained` vs `recovering → shifting`. |
| **disagreement** | A logged event when `Reflection`'s `AdvisoryState` differs from the sensor-derived `DashboardState`. |

## Public Interface

```ts
// web-app/src/types/display.ts
import type { State } from './state';

export type DashboardState = 'steady' | 'shifting' | 'overloaded' | 'drained';

export interface DashboardStateInput {
  state: State;                  // 'regulated' | 'activated' | 'recovering'
  severity: number;              // 0..1
  dwellMs: number;               // ms since last transition
  breathBpm?: number;
  regulatedBaseline?: number;
  cardiacMicroMotion?: number;   // 0..1
  posturalStillness?: number;    // 0..1
  movementCadence?: number;      // 0..1
}

export interface SignalsFrame {
  ts: number;
  breathBpm: number;
  cardiacMicroMotion: number;
  posturalStillness: number;
  movementCadence: number;
  source: 'live' | 'recorded';
}

export interface MirrorObservation {
  text: string;
  evidence: string;
  iconKey: 'moon' | 'sun' | 'screen' | 'load';
  confidence: number;
}

export interface TodayStripData {
  segments: { start: number; end: number; state: DashboardState }[];
  resetMarkers: number[];
  stats: {
    shiftsCaughtToday: number;
    avgLeadMinutesThisWeek: number;
    steadyMinutesToday: number;
    crashesThisWeek: number;
  };
}

// web-app/src/services/display/toDashboardState.ts
export function toDashboardState(input: DashboardStateInput): DashboardState;

// web-app/src/services/signals/derive.ts
export function deriveSignals(buffer: VitalsRingBuffer, source: 'live' | 'recorded'): SignalsFrame;

// web-app/src/services/patternMirror.ts
export async function computeMirrorObservations(
  store: SessionStore,
  daysBack?: number,
): Promise<MirrorObservation[]>;

// web-app/src/services/todayStrip.ts
export async function computeTodayStrip(
  store: SessionStore,
  now: number,
): Promise<TodayStripData>;
```

## Domain Events

| Event | Direction | Payload | Producer | Consumer(s) |
|---|---|---|---|---|
| `StateTransition` | consume | (existing State shape) | State | this |
| `VitalsFrame` | consume | (existing Sensing shape) | Sensing | this |
| `getTransitionsSince` | consume (callable) | `(sinceMs) → MorningRow[]` | Memory | this |
| `BaselineUpdate` | consume | `{field: 'regulatedBaseline', value: number}` | State | this |
| `DashboardStateAdvisory` | consume | `{advised, sensor, agreed}` | Reflection | this |

This context emits no events. It produces a rendered UI.

## Aggregates / Entities / Value Objects

1. **`DashboardStateMapper` (aggregate root for state mapping).** Pure;
   stateless; the body of `toDashboardState`. Invariant: deterministic —
   same input → same output. Tested with the table from ADR-015 §"The
   mapping" exhaustively.
2. **`SignalsDeriver` (aggregate root for signal derivations).**
   Stateless except for borrowing the existing `VitalsRingBuffer`.
   Invariant: every output value is in [0, 1] except `breathBpm` which
   passes through unchanged. If `presence === false`, all four derived
   values are `null` (sentinel) and the panel renders "—".
3. **`PatternMirrorCache` (aggregate).** Backed by IndexedDB under
   `display.patternMirror.{date}`. Holds the 4 computed observations
   and a TTL of 24 hours. Invariant: invalidate-on-write — any new
   `StateTransition` past midnight invalidates yesterday's cached entry.
4. **`TodayStripDataAggregator` (aggregate).** Stateless; one query +
   one bucket pass per render. Invariant: segments cover a contiguous
   range from start-of-day to `now`; gaps are filled with the most
   recent prior state.
5. **`DemoArcRunner` (aggregate root for Demo Mode).** Holds a timer
   stack. Invariant: stop() clears every pending timer; restart() does
   not double-fire.
6. **`MirrorObservation` (value object).** Immutable.
7. **`TodayStripData` (value object).** Immutable.
8. **`DisagreementLog` (value object — one per advisory mismatch).**
   Captures `{ts, advised, sensor, runId}`. Routed to ReasoningBank
   via the existing `hooks_intelligence_trajectory-step` MCP tool with
   `kind: 'disagreement'`.

## Invariants

1. **Mapping purity.** `toDashboardState` is a pure function; no
   reference to global mutable state, no IO, no Date.now reads. Tested.
2. **Sensor wins on conflict.** When a `DashboardStateAdvisory` from
   `Reflection` disagrees with the sensor-derived display, the sensor
   wins. The disagreement is recorded but never alters the displayed
   state. (ADR-015, ADR-016.)
3. **Signal range.** All four derived signals are in [0, 1] (or null
   when presence is false). The `signal-bar-fill` width is computed as
   `value * 100%` directly.
4. **Pattern Mirror cold-start.** When fewer than 7 days of transitions
   exist, `computeMirrorObservations` returns a single placeholder
   observation explaining the cold-start instead of fabricating data.
5. **Today Strip start-of-day.** The strip renders from local 6 AM
   only (matching the design's axis labels). Any transition before 6 AM
   is shown as the strip's left-edge starting state.
6. **Demo Mode bypass.** When `?demo=1` is set, this context bypasses
   `wsClient`, the worker, and `Reflection` entirely. Displayed states
   are driven by the `DemoArcRunner` timer stack only.
7. **No new persistence.** This context owns NO Supabase tables and NO
   new IndexedDB stores beyond `display.patternMirror.{date}` (a cache
   under the existing Memory IDB connection).
8. **Idempotent computation.** `computeTodayStrip` with the same inputs
   returns equal payloads (deep-equal). Tested.
9. **Modal a11y (ADR-018).** The BreathingModal renders via `createPortal`
   into `#modal-root`; carries `role="dialog"` + `aria-modal="true"`;
   focus moves to close button on open and returns to opener on close;
   ESC + backdrop click dismiss; `prefers-reduced-motion` disables orb
   keyframes and uses discrete per-phase scales.
10. **Modal completion logging (ADR-018).** Every modal session — whether
    the user completes or aborts mid-protocol — appends an Intervention
    row with `breathPattern: BreathProtocol`, `durationMs`, and a new
    `completed: boolean` column. Mid-protocol aborts have `completed:
    false`.
11. **Agent-advisory protocol (ADR-018).** Modal protocol selection rule:
    if a `ReflectRun` exists within the last 5 minutes with non-empty
    Agent 3 output, use its `protocol`; else fall back to the state-based
    default (sigh for shifting/overloaded/steady; box breath for
    drained).

## Anti-corruption layer

The boundary between `Display` and the rest of the app is enforced via:

1. **Read-only access to `Memory`.** Display only calls
   `sessionStore.getTransitionsSince` and reads from the
   `display.patternMirror.*` cache it owns. It never writes outside its
   own cache.
2. **No worker mutation.** Display only consumes worker emits
   (`StateTransition`, `BaselineUpdate`); it never posts messages.
3. **Schema validation on `Reflection` advisory.** Every
   `DashboardStateAdvisory` event is validated against the
   `DashboardState` enum before consumption; an invalid value is
   discarded with a console warning (Reflection's bug, not Display's).

## File map

| File | Description |
|---|---|
| `web-app/src/types/display.ts` | `DashboardState`, `DashboardStateInput`, `SignalsFrame`, `MirrorObservation`, `TodayStripData`. |
| `web-app/src/services/display/toDashboardState.ts` | The 3→4 mapping (pure). |
| `web-app/src/services/display/disagreementLog.ts` | Routes advisory mismatches to ReasoningBank. |
| `web-app/src/services/signals/derive.ts` | The 4 signal normalisers. |
| `web-app/src/services/patternMirror.ts` | Longitudinal aggregator + cache. |
| `web-app/src/services/todayStrip.ts` | Per-day aggregator. |
| `web-app/src/services/demoMode.ts` | The scripted 44 s arc runner. |
| `web-app/src/components/dashboard/StateDial.tsx` | The hero card with name + ladder + mandala SVG. |
| `web-app/src/components/dashboard/StateLadder.tsx` | The 4-rung visual. |
| `web-app/src/components/dashboard/Mandala.tsx` | The animated 3-ring + core SVG. |
| `web-app/src/components/dashboard/SignalsPanel.tsx` | The dark green 4-signal card. |
| `web-app/src/components/dashboard/PatternMirror.tsx` | The 4-observation list. |
| `web-app/src/components/dashboard/TodayStrip.tsx` | The day timeline. |
| `web-app/src/components/dashboard/ResetCard.tsx` | The state-keyed reset prompt. |
| `web-app/src/components/dashboard/BreathingModal.tsx` | The full-screen orb. Per ADR-018: Portal-mounted at `#modal-root`; focus trap + ESC/backdrop dismiss; honours `prefers-reduced-motion`; runs the 3 protocols (physiological sigh, box breath, 4-7-8) per `breathProtocols.json` timing; logs Intervention row on close (with `completed: boolean`). |
| `web-app/src/services/display/resolveProtocol.ts` | Per ADR-018: resolves `(recentReflectRun, dashboardState) → BreathProtocol`. Agent 3 advisory + state fallback table. |
| `web-app/src/data/breathProtocols.json` | Per ADR-018: per-protocol phase timings + per-phase instruction text. |
| `web-app/src/components/dashboard/DemoModeToggle.tsx` | The pill toggle in the nav. |

## Tests

- `tests/display/stateMapping.spec.ts` — exhaustive table from ADR-015.
- `tests/display/agentValidation.spec.ts` — disagreement path.
- `tests/display/signalsDerive.spec.ts` — pure normalisers.
- `tests/display/patternMirror.spec.ts` — fake-IDB seeded with 12 days.
- `tests/display/todayStrip.spec.ts` — fake-IDB seeded with a half-day arc.
- `tests/display/demo-mode.spec.ts` — the 44 s scripted arc.
- E2E: `e2e/dashboard-v2-signals.spec.ts`,
  `e2e/dashboard-v2-pattern-mirror.spec.ts`,
  `e2e/dashboard-v2-today-strip.spec.ts`,
  `e2e/dashboard-v2-demo-mode.spec.ts`.

## Out of scope (V2)

- LLM-polished prose for Pattern Mirror (rule-based templating ships;
  LLM polish is a future ADR — see ADR-017 §"LLM polish — optional,
  deferred").
- Cross-device sync of Pattern Mirror snapshots (single-device only;
  ADR-017 §"What we MUST NOT rebuild" §"Cross-device pattern sync").
- Real cardiac micro-motion sensor (we ship a derived proxy).
- A "drag to scrub" interaction on the Today Strip — read-only in V2.
- Multi-day overlay on the Today Strip — V3.
- 30-day Today Strip variant — V3.
- A configurable observation set in Pattern Mirror — V3.

## References

- ADR-015 (the mapping rules implemented in `toDashboardState`)
- ADR-017 (the signals + Pattern Mirror + Today Strip decisions)
- ADR-016 (the source of `DashboardStateAdvisory` events)
- DDD-02 State (the source of `StateTransition` and `BaselineUpdate`)
- DDD-04 Memory (the source of historical queries)
- DDD-06 Reflection (the producer of advisory events)
- `docs/03_designs/dashboard-v2_spec.md`
- `docs/03_designs/dashboard-v2.html`
