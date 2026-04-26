# DDD — Intervention Bounded Context

**Status:** Accepted (V1)
**Source of truth:** docs/02_research/05_canonical_build_plan.md
**Build Day:** 3 of 8

## Purpose

The Intervention context owns "what shows up on screen when the State context fires." Given a `StateTransition` or `TriggerEvent`, it picks one state-matched somatic affirmation from the user-supplied `affirmations.json` corpus, picks the matching breath pattern from `breathPatterns.json`, and renders the `AffirmationCard`, `BreathGuide`, and (for `morning_check`) `MorningCheckCard`. It does not classify states, sense vitals, or persist — but it does emit `InterventionRendered` and `UserFeedback` events that `Memory` consumes.

## Boundary

Inside: the affirmation corpus (treated as a static asset), the `AffirmationSelector` filter-and-pick logic (state filter → recency exclude-last-5 → seeded random), the `BreathPatternLibrary` lookup, and the React components that put the words on the screen — `AffirmationCard.tsx`, `BreathGuide.tsx`, `MorningCheckCard.tsx`. Outside: state classification (`State`), vitals collection (`Sensing`), persistence including the recency window storage (`Memory` — Intervention reads recency from `Memory` via a small CALLABLE). The seams: subscribed events from `State`, callable to `Memory.recentAffirmationIds()`, and the React render boundary on the way out. Reference: `docs/05_architecture/01_system_architecture.md` §5 (Intervention context box) and §7 (source layout).

## Ubiquitous Language

| Term | Definition |
|---|---|
| **affirmation** | One row of `affirmations.json`: `{id, state, text, modality}`. The corpus is **provided by the user as a V1 asset**. |
| **modality** | One of `breath`, `witness`, `anchor` — guides which `BreathPattern` to pair. |
| **AffirmationCard** | The animated card that renders `text` with opacity / translate-y / scale; ported from `upstream/mind-refresh-05`. |
| **BreathGuide** | Animated breathing visual paced by the `breath_pattern` value. |
| **MorningCheckCard** | The 3-panel comparison card (yesterday / this-morning / one affirmation) — single CTA "I'd like to talk about it". |
| **breath_pattern** | One of `natural`, `cyclic_sigh`, `extended_exhale`. (V1: exactly 3.) |
| **recency window** | The last 5 affirmation `id`s shown to this user; the selector excludes them to avoid repetition. |
| **state-matched** | Filter rule: only affirmations whose `state` equals the requested state are eligible. |
| **seeded random** | Deterministic pick within the eligible set; tests inject a seed via `Math.random` mock. |
| **Intervention** | One unit of "what the app showed in response to one event": `{transitionId, affirmationId, breathPattern}`. |
| **UserFeedback** | A 3-valued tap signal: `helped` / `neutral` / `unhelpful`. |
| **TrustedWitness** | The "talk to a chosen person" button; in V1 a `mailto:` link with a pre-canned message — no relay, no server. |
| **trigger payload** | Specific shape passed for `morning_check` triggers: `MorningCheckPayload`, used to render the comparison card. |

## Public Interface

```ts
// src/types/intervention.ts
import type { State, StateTransition, TriggerEvent } from './state';

export type Modality = 'breath' | 'witness' | 'anchor';
export type BreathPattern = 'natural' | 'cyclic_sigh' | 'extended_exhale';

export interface Affirmation {
  id: string;                    // e.g. 'som-001'
  state: State;
  text: string;
  modality: Modality;
}

export interface Intervention {
  transitionId: string;
  affirmationId: string;
  breathPattern: BreathPattern;
  ts: number;
}

// src/services/affirmationFilter.ts
export interface InterventionAPI {
  /** CALLABLE — returns the chosen affirmation + paired breath pattern. */
  pick(input: {
    state: State;
    transitionId: string;
    recentIds: string[];         // last 5 ids (queried from Memory)
  }): Intervention;

  /** SUBSCRIBABLE — fired after the UI completes the entrance animation. */
  onRendered(cb: (e: Intervention) => void): Unsubscribe;

  /** CALLABLE — user tapped a feedback button. */
  recordFeedback(transitionId: string, signal: 'helped' | 'neutral' | 'unhelpful'): void;

  /** SUBSCRIBABLE — re-emits the feedback for Memory to persist. */
  onFeedback(cb: (e: { transitionId: string; signal: 'helped'|'neutral'|'unhelpful' }) => void): Unsubscribe;
}
```

> **Selection rule (load-bearing).** `BreathPattern` is selected by `state` ONLY (via `BreathPatternLibrary[state]`). `modality` is metadata used for affirmation diversity (the `recency exclusion` and `random pick` operate within a state-filtered set) and does NOT drive the BreathGuide. If state=`activated` and the picked affirmation is `modality: anchor`, the user still sees the cyclic-sigh `BreathPattern` because state wins.

## Domain Events

| Event | Direction | Payload | Producer | Consumer(s) |
|---|---|---|---|---|
| `StateTransition` | consume | `{id, ts, from, to, reason, breathBpm, hrBpm?}` | State | this |
| `TriggerEvent` | consume | `{type, transitionId, severity, ts, morningPayload?}` | State | this |
| `InterventionRendered` | emit | `{transitionId, affirmationId, breathPattern, ts}` | this | Memory |
| `UserFeedback` | emit | `{transitionId, signal}` | this | Memory |
| `recentAffirmationIds()` | consume (callable) | `() => string[]` | Memory | this |

The `StateTransition` and `TriggerEvent` shapes match exactly the emitted shapes in the State context's table.

## Aggregates / Entities / Value Objects

1. **`AffirmationCorpus` (aggregate).** The in-memory immutable copy of `affirmations.json`. Invariant: every entry has a non-empty `text`, a valid `state`, and a globally unique `id`. Operations: `byState(state)`.
2. **`AffirmationSelector` (aggregate root for selection logic).** Stateless. Operation: `pick(state, recentIds)` — applies state filter, recency exclusion, then picks. Invariant: never returns an `id` from `recentIds`; never returns an entry whose `state` does not match.
3. **`BreathPatternLibrary` (aggregate).** Static map `State → BreathPattern`. Invariant: every `State` has exactly one canonical pattern (regulated → natural; activated → cyclic_sigh; recovering → extended_exhale).
4. **`Intervention` (value object).** Immutable record of "what was shown for `transitionId`."

## Invariants

1. **State match.** `selector.pick({state})` never returns an affirmation whose `state` field differs from the requested state.
2. **Recency exclusion.** No `id` in `recentIds` (last 5) is ever returned. If state-filtering plus recency would leave the set empty, recency is partially relaxed (oldest of the 5 dropped first), but state match is non-negotiable.
3. **Breath pattern domain.** `Intervention.breathPattern ∈ {natural, cyclic_sigh, extended_exhale}` — exactly the 3 V1 values.
4. **Corpus immutability.** `AffirmationCorpus` is loaded once at boot and never mutated; hot-swap requires a full reload.
5. **No render without a transitionId.** Every `Intervention` carries the `transitionId` from the upstream `StateTransition` or `TriggerEvent` — so feedback can later join the intervention row to the transition row in `Memory`.
6. **`morning_check` exclusivity.** When the input event is a `morning_check` trigger, the rendered surface is the `MorningCheckCard`, never the plain `AffirmationCard`.
7. **State drives BreathPattern; modality drives affirmation diversity.** No code path may select a BreathPattern from `modality`.

## Anti-corruption layer

The user-supplied `affirmations.json` may arrive in a slightly different shape than the canonical `Affirmation` interface (e.g. with extra prose fields like `scripture`, `reference` from the ported template). The translator at the top of `src/services/affirmationFilter.ts` strips unknown fields and validates that `state ∈ {regulated, activated, recovering}` and `modality ∈ {breath, witness, anchor}` before publishing the corpus. The render-time translator from `Modality → BreathPattern` lives in the same file, so the rest of the app deals only with the canonical types.

## File map

| File | Description |
|---|---|
| `src/services/affirmationFilter.ts` | Corpus loader, validator, and `AffirmationSelector`. |
| `src/data/affirmations.json` | **User-provided asset** (V1). State-tagged corpus. |
| `src/data/breathPatterns.json` | The 3 V1 breath patterns and their pacing parameters. |
| `src/components/intervention/AffirmationCard.tsx` | Animated card renderer (ported, scripture/reference fields removed). |
| `src/components/intervention/BreathGuide.tsx` | Animation paced by current `breathing_rate_bpm` for `natural`, fixed for `cyclic_sigh` / `extended_exhale`. |
| `src/components/dashboard/MorningCheckCard.tsx` | 3-panel comparison card; consumes `MorningCheckPayload`. |
| `src/types/intervention.ts` | `Affirmation`, `Intervention`, `Modality`, `BreathPattern`. |

## Tests

- `tests/intervention/affirmationFilter.spec.ts` — seeds `Math.random`, loads a fixture corpus, asserts that for `state = 'activated'` only activated entries are returned, that the last-5 recency window is honoured, and that a request returns *some* result rather than throwing when recency would empty the set. Mechanically enforces invariants 1 and 2.

Listed in build plan §13.

## Out of scope (V1)

- HNSW retrieval over the corpus — cut. **ADR-007** (architecture cuts).
- WebGPU LLM rephrasing of affirmations (`@ruvector/ruvllm`) — cut. **ADR-007**.
- Embedding-similarity ranking against user-typed text (`whatsAlive` field) — cut. **ADR-007**.
- SONA per-user MicroLoRA personalisation — cut. **ADR-007** + **ADR-010**.
- A 4th breath pattern for `shutdown` — out, since `shutdown` is itself out per **ADR-010**.
- Server-side affirmation rendering or streaming — V1 is fully client-side.

## References

- `docs/02_research/05_canonical_build_plan.md` §5 (morning_check + comparison card), §7 (affirmation pipeline), §13 (tests)
- `docs/05_architecture/01_system_architecture.md` §5, §7
- `docs/adr/ADR-007-supabase-v1-simplified.md` (architecture cuts; will also list pipeline simplifications)
- `docs/adr/ADR-010-three-state-breath-trajectory-classifier.md`
- Yilmaz Balban et al. 2023 — cyclic sighing (basis for `cyclic_sigh` pattern)
- Porges 2011 — extended-exhale rationale
- `upstream/mind-refresh-05/src/components/result/AffirmationCard.tsx` — the ported component
