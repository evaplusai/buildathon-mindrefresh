# DDD — Reflection Bounded Context

**Status:** Proposed (V2 — Dashboard v2)
**Source of truth:** `docs/03_designs/dashboard-v2_spec.md`, ADR-016
**Build Day:** Post-V1 / Dashboard v2 sprint

## Purpose

The Reflection context owns **the Reflect-card surface and the agent
swarm that powers it**. Given a string of user-typed text, it (1)
extracts linguistic patterns on-device, (2) maps the patterns + current
sensor state into an *advisory* `DashboardState`, and (3) generates a
reflective reframe in MindRefresh voice. It does not classify
nervous-system state from sensors (that is `State`'s job), does not pick
from the curated affirmations corpus (that is `Intervention`'s job for
sensor-driven surfaces), and does not persist anything beyond
ReasoningBank trajectory metadata.

The Reflect card is a **distinct intervention surface** parallel to the
sensor-driven `AffirmationCard` / `BreathGuide` / `MorningCheckCard`
trio. The user explicitly invokes Reflect by typing into the textarea
and pressing the button; it is not a passive sensor-triggered surface.

## Boundary

Inside: the three agent contracts (Pattern Scorer, State Mapper, Reframe
Writer); the model-routing decisions per ADR-016; the SSE streaming
client + Edge Function endpoint; the prompt-injection guard; the
hybrid-fallback wrapper; the `ReflectCard.tsx` UI component and its
sub-components (`AgentCard`, `PatternChips`, `ReframeBlock`); the
trajectory-recording calls into ReasoningBank.

Outside: sensor I/O (`Sensing`), nervous-system classification (`State`),
the sensor-triggered affirmation pipeline (`Intervention`), persistence
(`Memory`), the Today Strip and Pattern Mirror aggregators (`Display`).

The seams are:
- **Inbound:** the user's textarea submit (a single string)
- **Inbound, advisory:** the latest `DashboardState` derived by `Display`
  (Agent 2 needs it as context)
- **Outbound:** an `InterventionRendered` event for `Memory` (so the
  Reflect run is logged alongside sensor-driven interventions)
- **Outbound:** a `dashboardStateAdvisory` event for `Display` (so the
  agent's State Mapper output can be compared against the sensor's,
  with the conflict logged but the sensor winning per ADR-015)
- **Outbound:** trajectory writes via `mcp__claude-flow__hooks_intelligence_trajectory-*`

## Ubiquitous Language

| Term | Definition |
|---|---|
| **ReflectRun** | One end-to-end execution of the agent swarm — from textarea submit to all 3 agent cards in `done` state. Carries an id (UUID) used as `transitionId` in the resulting Intervention. |
| **PatternScore** | One row of Agent 1's output — `{key, score, evidence}`. |
| **patternKey** | One of 8 fixed categories — `urgency` / `catastrophizing` / `rumination` / `exhaustion` / `overwhelm` / `minimization` / `perfectionism` / `isolation`. |
| **PatternLevel** | Visual bucket — `high` (≥ 0.5), `med` (0.2–0.5), `low` (< 0.2). Drives chip colour. |
| **AdvisoryState** | Agent 2's chosen `DashboardState`. Validated by `Display`'s `toDashboardState`; the sensor wins on disagreement (ADR-015). |
| **Reframe** | Agent 3's text output — 2 to 4 sentences, observational voice, italics on the key observational verb phrase (rendered by frontend, not produced by the model). |
| **VoiceCheck** | Agent 3's self-report on its own tone — included in Agent 3's JSON output as `voice_check: "observational, not corrective"`. |
| **AgentTier** | Per CLAUDE.md ADR-026 routing: `1` (WASM Booster), `2` (Haiku), `3` (Sonnet/Opus). |
| **FallbackPath** | Deterministic mock output (the V1-reference HTML's `scoreText` / `pickState` / `pickReframe`) used when a real call exceeds the 4 s budget. |
| **AgentStatus** | One of `idle` / `thinking` / `done` / `error`. The UI renders this per agent card. |
| **ReasoningBank trajectory** | The structured record (one per ReflectRun) written via `hooks_intelligence_trajectory-{start,step,end}`. |

## Public Interface

```ts
// web-app/src/types/reflection.ts
import type { DashboardState } from './display';

export type PatternKey =
  | 'urgency' | 'catastrophizing' | 'rumination' | 'exhaustion'
  | 'overwhelm' | 'minimization' | 'perfectionism' | 'isolation';

export type AgentTier = 1 | 2 | 3;
export type AgentStatus = 'idle' | 'thinking' | 'done' | 'error';

export interface PatternScore {
  key: PatternKey;
  score: number;             // 0..1
  evidence: string;          // short phrase from the user's text
}

export interface PatternScorerOutput {
  patterns: PatternScore[];  // top 3, score-desc
  rawObservations: string;   // 1 sentence; never echoed to the cloud
}

export interface StateMapperOutput {
  state: DashboardState;     // advisory; sensor wins
  confidence: number;        // 0..1
  evidenceTrace: string;     // shown beneath the state name in the card
  leadTimeMinutes?: number;  // populated when state ∈ {shifting, overloaded}
}

export type BreathProtocol =
  | 'physiological_sigh'
  | 'box_breath'
  | 'four_seven_eight';

export interface ReframeWriterOutput {
  reframe: string;           // 2..4 sentences; plain text
  voiceCheck: string;        // self-report; tested against expected phrase
  lengthWords: number;
  protocol: BreathProtocol;  // ADR-018 — agent-advisory protocol selection
  protocolReason: string;    // ADR-018 — 1-line rationale shown in agent card
}

export interface ReflectRun {
  id: string;                // UUID
  ts: number;
  patternScores: PatternScorerOutput;
  stateMapping: StateMapperOutput;
  reframe: ReframeWriterOutput;
  fallbackUsed: boolean;     // true if any agent fell back to mock
  durationMs: number;
}

// web-app/src/services/reflect/reflectClient.ts
export interface ReflectAPI {
  /** CALLABLE — submit user text; returns an EventSource-like stream. */
  start(text: string): ReadableStream<ReflectStreamEvent>;
  /** SUBSCRIBABLE — fired exactly once per run with the full result. */
  onComplete(cb: (run: ReflectRun) => void): Unsubscribe;
  /** SUBSCRIBABLE — per-agent status updates. */
  onAgentUpdate(cb: (e: { agent: AgentTier; status: AgentStatus; payload?: unknown }) => void): Unsubscribe;
}
```

The Edge Function endpoint is `/api/reflect`; protocol is SSE per
ADR-016 §"Streaming pattern".

## Domain Events

| Event | Direction | Payload | Producer | Consumer(s) |
|---|---|---|---|---|
| `ReflectSubmitted` | inbound | `{text, ts}` | UI | this |
| `latestDashboardState` | consume (callable) | `() => DashboardState` | Display | this |
| `AgentStatusChanged` | emit | `{agent, status, payload}` | this | UI (own component) |
| `InterventionRendered` | emit | `{transitionId: ReflectRun.id, affirmationId: 'reflect-' + run.id, breathPattern}` | this | Memory |
| `DashboardStateAdvisory` | emit | `{advised: DashboardState, sensor: DashboardState, agreed: boolean}` | this | Display |
| `ReasoningBankTrajectory` | emit (via MCP) | full ReflectRun + verdicts | this | ReasoningBank (AgentDB) |

The `InterventionRendered` consumer in Memory is the same one used by
sensor-driven interventions — the Reflect run is one row in
`interventions` with `breath_pattern` derived from the dashboard state
(steady→natural, shifting/overloaded→cyclic_sigh, drained→extended_exhale).

## Aggregates / Entities / Value Objects

1. **`ReflectRun` (aggregate root).** Identified by UUID. Created at
   textarea-submit; closed when all three agents reach `done` (or the
   fallback path completes). Invariant: a `ReflectRun` exists for
   exactly one user submission; reruns produce new ids.
2. **`AgentSpec` (3 instances — Pattern Scorer, State Mapper, Reframe
   Writer).** Each holds a tier assignment, a system prompt, a JSON
   schema for output, and a fallback function. Invariant: tier
   assignment matches ADR-016 §"Tier assignment per agent" exactly.
3. **`PatternScorerOutput` (value object).** Immutable; produced
   on-device. Invariant: every `key` is one of the 8 canonical
   `PatternKey` values; scores in [0, 1]; top 3 only.
4. **`StateMapperOutput` (value object).** Immutable; produced by the
   State Mapper. Invariant: `state` is one of the 4 `DashboardState`
   values; the value is *advisory*, never authoritative.
5. **`ReframeWriterOutput` (value object).** Immutable; produced by the
   Reframe Writer. Invariant: `lengthWords ∈ [12, 60]` (range tested);
   `voiceCheck` matches the expected phrase set; `reframe` contains no
   exclamation point. ADR-018 extends with `protocol` ∈ `BreathProtocol`
   (advisory) and `protocolReason` (1-line rationale, ≤ 80 chars).
6. **`AidefenceVerdict` (value object).** Result of
   `aidefence_is_safe(text)`. Invariant: if `is_safe === false`, no
   agent runs; the UI shows a polite refusal copy.

## Invariants

1. **Privacy: raw text never leaves the device.** Agent 1 runs on-device
   exclusively (WASM/ONNX path or deterministic fallback). Agents 2 and
   3 receive ONLY Agent 1's structured output and the latest
   `DashboardState`, never the raw user text. Mechanically enforced by
   `tests/reflection/privacy.spec.ts`.
2. **Sensor wins on state.** Agent 2's `DashboardState` is advisory.
   The dashboard's displayed state is always derived by
   `Display.toDashboardState` from the sensor (ADR-015). Disagreements
   are logged to ReasoningBank.
3. **Voice rules.** Reframe text contains no exclamation point and no
   imperative ("you should…") forms. Mechanically tested.
4. **Length window.** Reframe is 2 to 4 sentences. Tested.
5. **Fallback isolation.** If any agent falls back to mock, the run
   completes within 4 s and the response carries `fallbackUsed: true`.
   The UI tags the affirmation card with `data-fallback="true"` for
   e2e visibility.
6. **Aidefence gate.** Every user text passes through
   `mcp__claude-flow__aidefence_is_safe` before any agent runs. Failed
   safety check → no swarm execution.
7. **Tier discipline.** No agent calls a model from a tier other than
   the one ADR-016 assigns. Mechanically tested.
8. **ReasoningBank record per run.** Every completed run produces
   exactly one trajectory entry via `hooks_intelligence_trajectory-end`.

## Anti-corruption layer

The Reflect context's anti-corruption layer is the **agent JSON-schema
validator**. Each agent output is parsed against the typed schemas in
this file; if validation fails, the agent's output is replaced with the
fallback path's mock output for that agent (so the swarm always
completes). The validator lives in `web-app/src/services/reflect/validate.ts`
and is the single place that knows how to coerce a model response into a
typed value object.

The `latestDashboardState()` callable into `Display` is the only place
this context reads from outside its own boundary. The reverse —
`Display` reading from this context — is forbidden; `Display` only
*receives* `DashboardStateAdvisory` events, it does not call into
`Reflection`.

## File map

| File | Description |
|---|---|
| `web-app/src/pages/Dashboard.tsx` | Mounts `<ReflectCard />` (existing; no new page route in V2). |
| `web-app/src/components/dashboard/ReflectCard.tsx` | The card UI; ports the `dashboard-v2.html` reference structure. |
| `web-app/src/components/dashboard/AgentCard.tsx` | One of three; renders status + payload. |
| `web-app/src/components/dashboard/PatternChips.tsx` | Renders Agent 1's `patterns[]` as colour-coded chips. |
| `web-app/src/components/dashboard/ReframeBlock.tsx` | Renders Agent 3's reframe with italic-on-verb-phrase post-processing. |
| `web-app/src/services/reflect/reflectClient.ts` | EventSource wrapper around `/api/reflect`. |
| `web-app/src/services/reflect/agent1-pattern-scorer.ts` | On-device Tier-1 implementation + deterministic fallback. |
| `web-app/src/services/reflect/agentSpecs.ts` | The 3 system prompts + output schemas. |
| `web-app/src/services/reflect/fallback.ts` | Ports `scoreText` / `pickState` / `pickReframe` from the design HTML reference. |
| `web-app/src/services/reflect/validate.ts` | JSON schema → value object coercion. |
| `web-app/api/reflect.ts` | Vercel Edge Function — fan-outs Agent 2 + Agent 3, emits SSE. |
| `web-app/src/types/reflection.ts` | `PatternKey`, `PatternScore`, the agent output shapes, `ReflectRun`. |

## Tests

- `tests/reflection/agent1-on-device.spec.ts` — see ADR-016.
- `tests/reflection/privacy.spec.ts` — see ADR-016.
- `tests/reflection/fallback.spec.ts` — see ADR-016.
- `tests/reflection/state-mapper-validation.spec.ts` — see ADR-016.
- `tests/reflection/aidefence.spec.ts` — see ADR-016.
- `tests/reflection/voice-rules.spec.ts` — feeds 20 fixture reframes
  (10 valid, 10 violating); asserts the validator accepts/rejects per
  the rules.
- E2E: `e2e/reflect-card.spec.ts` — see ADR-016.

## Out of scope (V2)

- Streaming partial Agent 3 output (token-by-token) — V2 ships
  `done`-only events. SSE granularity sufficient.
- Multi-turn Reflect (the user replies to a reframe and the swarm
  re-runs) — V3.
- A "Save this reframe to my journal" affordance — V3 (would require
  a new persistence row in `interventions` with `is_starred: true`).
- Voice-input variant of Reflect — V3 (Whisper local-only).
- SONA-fine-tuned per-user reframe writer — needs ≥200 trajectories
  per user; ADR-016 commits only to recording, not training.
- Multi-language reframes — V3.
- A "let me try a different reframe" reroll button — V3.

## References

- ADR-016 (the routing + streaming + privacy decisions this DDD
  implements)
- ADR-015 (`DashboardState` 4-value vocabulary; Agent 2's output is
  validated against)
- ADR-007 (privacy framing; Agent 2/3 inputs honour the same boundary)
- ADR-005 (two-link architecture; `/api/reflect` Edge Function is a
  third surface — but only carries derived data, never raw vitals)
- DDD-02 State context (the sensor-derived state Agent 2 is advisory
  against)
- DDD-04 Memory context (the Intervention-row consumer)
- DDD-07 Display context (the `DashboardState` mapping + the
  `DashboardStateAdvisory` consumer)
- `docs/03_designs/dashboard-v2_spec.md` §"The agent swarm — current
  vs. real"
- `docs/03_designs/dashboard-v2.html` lines 851–947 (reference UI)
- pi.ruv.io guidance on agent swarm tier routing
