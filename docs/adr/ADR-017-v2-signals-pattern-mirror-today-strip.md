# ADR-017: V2 multi-signal panel + Pattern Mirror + Today Strip — query-only, no new persistence

**Status:** Accepted
**Date:** 2026-04-30
**Build Day:** Post-V1 / Dashboard v2 sprint
**Implementation:** shipped 2026-04-30 in Sprint A; `services/{patternMirror,todayStrip,signals/derive,demoMode}.ts` + IDB cache extension on `sessionStore`. 4 derived signals over `vitalsRingBuffer`; Pattern Mirror has 5 rule queries + 24h cache + cold-start placeholder; Today Strip computes contiguous segments + 4 stat tiles; Demo Mode plays scripted 44s arc with idempotent start/stop. 35 unit tests across 4 spec files.
**Supersedes:** (none — extends ADR-005, ADR-007, DDD-04)
**Superseded by:** (none)

## Context

The Dashboard v2 spec adds three longitudinal/aggregation surfaces that
V1 does not have:

1. **Live Signals panel** — 4 live bars: breath rate, cardiac micro-motion,
   postural stillness, movement cadence (`dashboard-v2.html` lines
   820–845). V1's `wsClient` only surfaces `breathBpm` to the main
   thread.
2. **Pattern Mirror** — 4 reflective observations from the user's last 12
   days, e.g. "Your system tends to become overloaded earlier on days
   after sleep under 6.5 hours" (`dashboard-v2.html` lines 962–991). V1
   has no longitudinal aggregation surface.
3. **Today Strip** — horizontal timeline of state segments from 6 AM to 9
   PM with reset markers and 4 stat tiles (`dashboard-v2.html` lines
   994–1017). V1 has no day-bucketed visualisation.

This ADR scopes how each is wired without changing persistence schemas,
without adding tables, and without inventing new sensor data. It uses
**existing Memory queries + a small set of new pure aggregators** —
nothing more.

## Decision

### Live Signals panel — extend `VitalsFrame`, no new wires below the worker

The sensing-server emits more than just breath. The schema in
`docs/02_research/05_canonical_build_plan.md` §6 already includes
`breath_bpm`, `hr_bpm`, `presence`, `motion_band_power`. Two of the four
spec fields map directly:

| Spec field | Source | Available now? |
|---|---|---|
| Breath rate | `breath_bpm` | ✅ yes (V1) |
| Cardiac micro-motion | `hr_bpm` × derivative-of-presence | ✅ derivable from V1 fields |
| Postural stillness | inverse of `motion_band_power` over 30 s window | ✅ derivable |
| Movement cadence | `motion_band_power` short-window EWMA | ✅ derivable |

We do NOT need new sensing-server features. We extend `VitalsFrame` and
add four pure normaliser functions in a new file
`web-app/src/services/signals/derive.ts`:

```ts
export interface SignalsFrame {
  ts: number;
  breathBpm: number;             // raw
  cardiacMicroMotion: number;    // 0..1 normalised
  posturalStillness: number;     // 0..1 normalised (1 = frozen)
  movementCadence: number;       // 0..1 normalised
  source: 'live' | 'recorded';
}

export function deriveSignals(buffer: VitalsRingBuffer): SignalsFrame;
```

The dashboard subscribes to the existing wsClient stream, runs
`deriveSignals` against the existing `vitalsRingBuffer`, and renders the
4 bars. **No worker changes** — the derivations live on the main thread
because the values feed only the UI (the worker continues to consume the
raw `VitalsFrame` for classification per ADR-005).

If `presence === false` (sensor empty room), all 4 bars render as
"—" and the sensor-status pill flips to "Sensor idle · room empty."

### Pattern Mirror — query Memory, summarise client-side, cache 24h

The 4 observations in the design HTML are hand-written examples like:

> "Your system tends to become overloaded earlier on days after sleep
> under 6.5 hours."

Real observations are derived from `sessionStore` (the V1 IndexedDB
wrapper) by a new pure aggregator in
`web-app/src/services/patternMirror.ts`:

```ts
export interface MirrorObservation {
  text: string;                 // serif body, italic on observational verb
  evidence: string;             // mono caption — "9 of 12 days · correlation strong"
  iconKey: 'moon' | 'sun' | 'screen' | 'load';
  confidence: number;           // 0..1 — affects rendering opacity
}

export async function computeMirrorObservations(
  store: SessionStore,
  daysBack: number = 12,
): Promise<MirrorObservation[]>;
```

The aggregator runs **5 fixed queries** against `sessionStore`:

1. **Sleep-debt correlation:** for each of the last `daysBack` days,
   bucket the day's first morning_check baseline; correlate against the
   day's count of `activated` transitions. If correlation > 0.5 over ≥7
   days, emit observation #1.
2. **Recovery channel preference:** find pairs of `activated→recovering`
   where the user invoked Reflect within 5 min vs. did not. Compare mean
   time-to-`regulated`. If walks/Reflect-tagged sessions recover ≥20%
   faster, emit observation #2.
3. **Day-of-week pattern:** group `activated` counts by weekday; find
   weekdays in the top quartile. Emit observation #3 with the weekday(s).
4. **Weekly load drift:** compare this week's mean recovery-window length
   against the user's 30-day baseline. If shorter by ≥15%, emit
   observation #4.
5. **Reset effectiveness:** percentage of `activated` events that hit
   `recovering` within 10 min when a reset was begun via the breathing
   modal vs. when not.

If fewer than 5 days of data exist, the Pattern Mirror renders a
placeholder card: "Pattern Mirror unlocks after 7 days of observation."
This avoids hallucinating insights.

The aggregator output is **cached in IndexedDB** under
`patternMirror.snapshot` for 24 hours, computed once on first
dashboard mount per day (or invalidated if the user explicitly taps a
"refresh observations" affordance). This keeps the dashboard mount cheap.

#### LLM polish — optional, deferred

Generating the *prose* of an observation (turning "9 of 12 days,
r=0.62" into "Your system tends to become overloaded earlier on days
after sleep under 6.5 hours") could use `ruvllm_chat_format` against a
small local model. For V2 we ship **rule-based templated prose** — a
fixed phrase per observation with the numbers slotted in. The
templating is deterministic, tests well, and ships in an afternoon.
Post-V2 ADR (TBD) flips to local LLM polish when the latency story
holds.

### Today Strip — pure SVG from `sessionStore` query

A single query: `getTransitionsSince(startOfDayLocal())`. Result is an
array of `StateTransition`s with timestamps. The component renders:

- A horizontal SVG track from 6 AM to 9 PM (15-hour window)
- One `<rect>` per state segment (start = previous transition ts, end =
  next transition ts)
- Fill colour from the existing `--state-*` CSS variables (per ADR-015)
- Reset markers (`↻`) at any timestamp where an
  `Intervention.breathPattern === 'cyclic_sigh'` row exists with feedback
  recorded
- 4 stat tiles: shifts caught, average lead time this week, total time
  steady today, crashes this week

```ts
export interface TodayStripData {
  segments: { start: number; end: number; state: DashboardState }[];
  resetMarkers: number[];          // ts of completed resets
  stats: {
    shiftsCaughtToday: number;
    avgLeadMinutesThisWeek: number;
    steadyMinutesToday: number;
    crashesThisWeek: number;
  };
}

export async function computeTodayStrip(
  store: SessionStore,
  now: number,
): Promise<TodayStripData>;
```

All 4 stats are derived from the same `getTransitionsSince` plus the
existing `interventions` rows. No new persistence.

### Demo Mode (`?demo=1`) — bypass everything

The design HTML's demo arc (`runDemoArc()` at lines 1203–1215) is a
scripted 44 s loop through the 4 states. We port this verbatim as a
small dashboard-only state machine that:

- Disconnects from the real `wsClient`
- Disables the Reflect swarm
- Drives `setDashboardState(...)` directly on a timer
- Synthesises a Pattern Mirror placeholder ("Demo data shown")
- Synthesises a Today Strip with hardcoded segments

Demo Mode is gated behind `?demo=1` so it never runs in production.
Useful for unattended kiosk demos and recorded screencasts.

### What we MUST NOT rebuild (per ADR-016 reuse contract)

| Concern | Reuse this | Do NOT build |
|---|---|---|
| Day-bucketed transition queries | `sessionStore.getTransitionsSince` (existing, V1) | A new IDB index |
| Cardiac/stillness/movement derivations | Pure functions over `vitalsRingBuffer` (existing) | A new worker |
| Pattern Mirror cache | IndexedDB under `patternMirror.snapshot` via `sessionStore` extension | A separate Dexie store |
| Cross-device pattern sync | `agentdb_pattern-store` (already wired) — only if multi-device demo is needed; V2 ships single-device | A bespoke sync protocol |
| LLM polish (deferred) | `ruvllm_chat_format` — when ready | A custom tokeniser |

## Consequences

### Positive

- All three new surfaces ship without a single new persistence table,
  without modifying the worker, without changing the sensing-server.
- The privacy framing from ADR-007 holds: nothing new crosses the cloud
  link. Pattern Mirror computes on-device.
- The Today Strip + Pattern Mirror are real on day one (with limited
  data) and become richer organically as more transitions accumulate.
- Demo Mode gives the buildathon a never-broken kiosk path.

### Negative

- The 4 derived signals are *approximations* of the spec language. Real
  cardiac micro-motion is a research signal; we surface a derived
  proxy and the design tokens for it. We label the tooltip "Derived
  from breath cadence + presence variance — proxy signal" so we don't
  overclaim.
- Pattern Mirror's rule-based templating limits expressiveness vs.
  what an LLM-polished version would produce. Acceptable for V2.
- The 30-day baseline for "weekly load drift" requires 30 days of
  data. New users see "Pattern Mirror unlocks after 7 days" (also fine)
  for a while.

### Neutral

- The Today Strip's "shifts caught before they crested" stat depends on
  `acute_spike` and `slow_drift` triggers logged with their severity in
  the existing schema — already true.
- The signals panel's bars animate via CSS transitions on `width`,
  exactly as the design HTML does. Identical visual.

## Alternatives Considered

- **Add a `patternMirrorObservations` Supabase table.** Rejected:
  observations are user-private and trivially recomputable from
  transitions. ADR-007's "no new tables in V1" still applies in spirit.
  Post-V2 if cross-device computed observations become valuable.
- **Compute Pattern Mirror server-side via a backend cron.** Rejected:
  introduces backend, breaks the "local processing" promise visible in
  the marketing page footer. Single-device IDB compute is fine.
- **Surface real cardiac micro-motion via additional sensing-server
  fields.** Rejected for V2: would require sensing-server changes (new
  field in the WS schema), which is outside this slice. Use the
  derived proxy.
- **Skip the LLM-polished prose entirely; ship raw stats.** Rejected:
  the design HTML uses observational prose for the brand voice. Rule-
  based templating preserves that without new infrastructure.
- **Use a Web Worker for the Pattern Mirror aggregator.** Rejected:
  the queries take ≤30 ms on realistic data; main-thread compute is
  fine. Re-evaluate if 30-day data sets push past 100 ms.

## References

- `docs/03_designs/dashboard-v2_spec.md` §"What's in the reference file"
  (Live Signals, Pattern Mirror, Today Strip descriptions)
- `docs/03_designs/dashboard-v2.html` lines 820–845, 962–991, 994–1017
- `docs/02_research/05_canonical_build_plan.md` §6 (sensing-server
  schema; the existing fields the derivations consume)
- ADR-005 (two-link architecture; this ADR honours the local-link
  privacy boundary)
- ADR-007 (no new tables in V1)
- ADR-015 (4-state mapping; Today Strip + signals panel use the same
  mapping)
- DDD-04 Memory context (the `sessionStore` API used by both Pattern
  Mirror and Today Strip)
- DDD-07 Display context — the home of `computeMirrorObservations` and
  `computeTodayStrip`

## Test Hooks (London-school)

- `tests/display/signalsDerive.spec.ts` — pure tests of the four
  normalisers; feeds synthetic ring-buffer states, asserts each output
  is in [0, 1].
- `tests/display/patternMirror.spec.ts` — fake-indexeddb seeded with
  12 days of transitions; asserts each of the 5 rule queries fires
  the expected observation when the data crosses the threshold.
- `tests/display/todayStrip.spec.ts` — fake-indexeddb seeded with a
  half-day arc; asserts segments, reset markers, and 4 stats compute
  correctly.
- `tests/display/demo-mode.spec.ts` — drives the dashboard in `?demo=1`
  mode; asserts no `wsClient` connection is opened; asserts the 4
  states cycle within 44 s.
- E2E: `e2e/dashboard-v2-signals.spec.ts` — loads
  `/dashboard?source=recorded`; asserts all 4 signal bars render with
  numeric values within 5 s of mount.
