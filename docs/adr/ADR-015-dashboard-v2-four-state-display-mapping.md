# ADR-015: Dashboard v2 displays a 4-state ladder mapped from V1's 3-state classifier

**Status:** Proposed
**Date:** 2026-04-30
**Build Day:** Post-V1 / Dashboard v2 sprint
**Supersedes:** (none — extends ADR-010)
**Superseded by:** (none)

## Context

The V1 product locked the nervous-system classifier to **three** states —
`regulated`, `activated`, `recovering` — by ADR-010 (build plan §4) and the
State DDD (`docs/ddd/02_state_context.md`). The 4th polyvagal state
(`shutdown`) was explicitly cut for V1 with restoration listed as
post-buildathon scope.

The Dashboard v2 spec
(`docs/03_designs/dashboard-v2_spec.md`,
`docs/03_designs/dashboard-v2.html`) uses a **four**-state ladder —
`steady`, `shifting`, `overloaded`, `drained` — driving:

- The `state-dial` colour scheme (steady=`#639922`, shifting=`#C99B4F`,
  overloaded=`#C97A6B`, drained=`#6B7558`)
- The 4-rung ladder visual
- The signals panel's bar fill colour
- The reset card's per-state protocol text
- The today-strip segment colours
- The agent-swarm State Mapper output

If we accept the new 4-state vocabulary at the worker level, we (a) reverse
ADR-010, (b) require a fresh classifier with a 4th entry-condition window,
(c) regenerate `stateRules.json`, (d) churn `triggerWorker.ts`,
`stateRules.ts`, all 6 product specs, and (e) break the existing
`StateTransition` shape consumed by Memory and Intervention.

This ADR proposes a cleaner alternative: **keep the worker's 3-state
classifier exactly as V1 ships it** and add a single pure mapping function
that derives a 4-valued display state from `(state, severity, dwell, signals)`
at the Display layer. The worker remains the single source of nervous-system
truth; the dashboard renders a richer label derived from the same truth.

## Decision

### The mapping

A new pure function `toDashboardState(input) → DashboardState` lives in
the new Display bounded context (DDD-07).

```ts
type DashboardState = 'steady' | 'shifting' | 'overloaded' | 'drained';

interface DashboardStateInput {
  state: State;                    // 'regulated' | 'activated' | 'recovering'
  severity: number;                // 0..1; latest TriggerEvent.severity
  dwellMs: number;                 // ms since last transition into `state`
  breathBpm?: number;              // current sample
  regulatedBaseline?: number;      // EWMA (already on MorningCheckPayload)
  // optional V2 signals (see ADR-017)
  cardiacMicroMotion?: number;     // 0..1 normalised
  posturalStillness?: number;      // 0..1
  movementCadence?: number;        // 0..1
}
```

Mapping rules (deterministic, encoded as a pure function tested in
`tests/display/stateMapping.spec.ts`):

| Internal `state` | Additional signal | Dashboard label |
|---|---|---|
| `regulated` | always | `steady` |
| `activated` | dwellMs < 60 000 OR severity < 0.5 | `shifting` |
| `activated` | dwellMs ≥ 60 000 AND severity ≥ 0.5 | `overloaded` |
| `recovering` | breath above regulatedBaseline + 2 BPM | `shifting` (still elevated) |
| `recovering` | breath at-or-below regulatedBaseline | `drained` (post-crash) |

The `recovering → drained` rule is the load-bearing one: when the body
returns past the regulated baseline AND postural stillness > 0.6 (when
available) OR breath is flat with low movement cadence, the user has
crashed below baseline (the `shutdown` polyvagal state in everything but
classifier name). When V2 signals (cardiac, stillness, movement) are not
yet wired, the breath-only fallback is used.

### What this preserves

- **ADR-010 stands untouched.** No new state is added to the worker.
- **`StateTransition` and `TriggerEvent` shapes are unchanged.** Memory
  and Intervention contexts are untouched. Existing 91 unit tests + 11 e2e
  tests continue to pass without modification.
- **The 5-second debounce, the 60-second / 30-second entry-condition
  windows, and the dwell rules from ADR-010** remain the only gates on
  state change. The dashboard-state derivation is a *view*, not a state
  machine.
- **Persistence stays in the V1 vocabulary.** Supabase rows continue to
  carry `regulated|activated|recovering`. The dashboard-state can always
  be re-derived from a stored transition; we do NOT persist
  `DashboardState`. (Revising ADR-007 is out of scope for this slice.)

### What this implies for the agent swarm

The Reflect agent swarm's State Mapper agent (per Dashboard v2 spec §"Real
agents") returns a `dashboardState` string from {steady, shifting, overloaded,
drained}. Its output goes through the same `toDashboardState()` validator —
the agent's choice is *advisory*; if it disagrees with the sensor-derived
mapping, the sensor wins (per ADR-005 two-link architecture: the local
sensor is the trust anchor). The agent's choice is logged for offline
analysis but never overrides the body's signal.

Conflict-resolution rule (encoded in DDD-07):

```
displayed = sensorDerivedDashboardState
agentSuggested = agentSwarmDashboardState
if displayed !== agentSuggested:
    log to ReasoningBank (trajectory metadata)
    use displayed
```

## Consequences

### Positive

- Zero churn to the State worker, the worker tests, the Memory
  persistence schema, the Intervention recency logic. The V1 invariants
  (ADR-010, ADR-006) hold by construction.
- The 4-state UI vocabulary that the design HTML asks for ships intact:
  same colours, same ladder, same reset protocols.
- Adding the 4th display state is a pure-function unit test plus a few
  Tailwind class additions. ~80 LOC of new code.
- The dashboard-state mapping is reversible: if a future ADR reverses
  ADR-010 and introduces a real `shutdown` worker state, the mapping
  collapses to identity and `stateMapping.spec.ts` is the single file that
  changes.

### Negative

- A reader of the worker code sees three states and a reader of the
  dashboard sees four. The mapping rules in this ADR + DDD-07 are the
  bridge; if they drift the UI lies. Mitigation: the mapping is a single
  pure function with exhaustive tests; the agent swarm's State Mapper
  output is validated against the same function.
- The `recovering → drained` boundary depends on the regulated baseline
  EWMA, which is currently emitted via `BaselineUpdate` but not consumed
  on the main thread. We need to plumb baseline through to the Display
  context. ~20 LOC.
- The agent swarm's "advisory" State Mapper carries a teaching-vs-trusting
  ambiguity for users who notice the disagreement. Mitigation: the UI
  never shows the agent's state directly — it only shows the
  sensor-derived state, with the agent's reasoning as text in the agent
  card. The conflict is invisible unless the user reads the agent log.

### Neutral

- The "drained" label uses a muted gray-green that intentionally reads
  *quieter* than the other states. This communicates "system flat" without
  alarming. Aligned with the design HTML's voice rules ("observational, not
  corrective").
- Demo Mode (the scripted 44 s loop in dashboard-v2.html) drives the
  dashboard via direct `setDashboardState()` calls — bypassing both the
  worker and the agent swarm. Acceptable as a demo affordance; gated
  behind `?demo=1` so it never runs in production.

## Alternatives Considered

- **Reverse ADR-010 and ship a real 4-state classifier.** Rejected: high
  cost, breaks 6 spec files, requires a new entry-condition window for
  `shutdown`, requires re-validating thresholds against captured fixtures,
  and Memory/Intervention shape changes ripple downstream. Cost-benefit
  bad for a UI vocabulary upgrade.
- **Map only at the *render* layer (CSS classes) without a typed mapping
  function.** Rejected: scatters the rule across components; impossible to
  test mechanically; agent swarm's State Mapper output has no contract to
  validate against.
- **Two parallel state machines (3 internal, 4 displayed) maintained
  separately by hand.** Rejected: drift inevitable.
- **Add `shutdown` as a 4th state in the worker for V2 ONLY when
  multi-signal fusion ships (cardiac + stillness + movement).** Acceptable
  long-term path; this ADR is the first step. A future ADR will reverse
  this one when (a) the cardiac/stillness/movement detectors land, (b)
  fixture-validated thresholds exist, (c) Memory's enum is migrated. Until
  then, the mapping is the bridge.

## References

- `docs/03_designs/dashboard-v2_spec.md` (4-state ladder, design tokens)
- `docs/03_designs/dashboard-v2.html` lines 36–39 (state colour vars),
  lines 1051–1084 (STATES dictionary defining the 4 visual states),
  lines 1103–1149 (`renderState` per-state branch).
- `docs/02_research/05_canonical_build_plan.md` §4 (3-state classifier),
  §15 (4-state explicitly cut for V1).
- ADR-010 (the locked 3-state classifier).
- ADR-005 (two-link architecture; sensor is trust anchor).
- ADR-006 (HRV out of V1; relevant because cardiac micro-motion is *not*
  HRV — it's the breath-rate-extraction-by-product, already exposed).
- DDD-02 State context (unchanged).
- DDD-07 Display context (`docs/ddd/07_dashboard_display_context.md`) —
  the home of `toDashboardState()`.
- ADR-016 (agent swarm; consumes the same mapping for Agent 2's output).
- ADR-017 (V2 sensor signals; supplies the optional inputs to the mapping).

## Test Hooks (London-school)

- `tests/display/stateMapping.spec.ts` — pure function tests; for each row
  in the mapping table above, supplies the input vector and asserts the
  exact `DashboardState` output. Includes edge cases: missing optional
  signals (V2 not yet wired), severity exactly 0.5, dwell exactly 60s.
- `tests/display/agentValidation.spec.ts` — feeds an agent swarm output
  whose `dashboardState` disagrees with the sensor; asserts the rendered
  dashboard uses the sensor's value AND that the disagreement is appended
  to a ReasoningBank trajectory entry (mocked).
- E2E: `e2e/dashboard-state-ladder.spec.ts` — drives the worker via the
  recorded fixture and asserts the ladder rung activation matches the
  expected display state at 4 timestamps in the arc.
