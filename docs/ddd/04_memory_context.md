# DDD — Memory Bounded Context

**Status:** Accepted (V1)
**Source of truth:** docs/02_research/05_canonical_build_plan.md
**Build Day:** 3 of 8

## Purpose

The Memory context owns persistence and the privacy boundary. It runs the IndexedDB session store (full-fidelity, always-local, the source of truth for the SPA), the Supabase write client (anon-key, hardcoded `user_id = 'demo-user-001'`, only labels and id references — never raw vitals), the `morning_check` query that joins yesterday's rows from both stores, and — critically — the structural guarantee that turning on Always-Local Mode means *no* network call to a non-mailto URL is ever made. It does not classify state, sense vitals, or pick affirmations.

## Boundary

Inside: IndexedDB schema and writes for sessions, transitions, interventions, feedback, and the rolling recency-of-5 list; the Supabase `createClient` call site and the only two `insert` paths for `state_transitions` and `interventions`; the `morning_check` query that returns the rows used to compute `MorningCheckPayload`; the Always-Local Mode toggle and the kill switch around the Supabase client. Outside: sensor I/O (`Sensing`), classification (`State`), affirmation choice/render (`Intervention`). The seams are: subscriptions to `StateTransition`, `TriggerEvent`, `InterventionRendered`, and `UserFeedback`; a CALLABLE `MorningCheckQuery` that the worker invokes; and the `recentAffirmationIds()` callable that the Intervention context invokes. Reference: `docs/05_architecture/01_system_architecture.md` §6 (privacy diagram) and `docs/02_research/05_canonical_build_plan.md` §3 (data classification) + §8 (Supabase 2-table schema).

## Ubiquitous Language

| Term | Definition |
|---|---|
| **SessionStore** | The IndexedDB-backed store; full-fidelity local truth. |
| **SupabaseSync** | The thin write-only client to `*.supabase.co` for the 2 V1 tables. |
| **state_transitions** | Supabase table: `(id, user_id, ts, from_state, to_state, trigger_reason, breath_bpm, hr_bpm)`. Source: build plan §8. |
| **interventions** | Supabase table: `(id, user_id, transition_id, affirmation_id, breath_pattern, user_feedback, ts)`. |
| **user_id** | Constant string `'demo-user-001'` in V1; replaced by `auth.uid()` post-buildathon (ADR-011 stretch). |
| **Always-Local Mode** | A user-facing toggle. ON = no Supabase client is constructed; no `fetch` to a non-`mailto:` URL is permitted. Default OFF for the demo (so morning_check syncs work). |
| **recency window** | The last 5 affirmation `id`s shown — stored in IndexedDB, exposed via `recentAffirmationIds()`. |
| **MorningCheckQuery** | The function that returns the last 24 h of `state_transitions` for the current user, joining IndexedDB + Supabase rows by `id`. |
| **anon key** | Supabase publishable key stored in `import.meta.env.VITE_SUPABASE_ANON_KEY`; not a secret per se but namespaced. |
| **raw vitals** | Per-second `Vitals` samples — **never written to Supabase, ever**. |
| **whats_alive text** | User-typed sentence from the morning-check CTA — **lives only in IndexedDB in V1**. |
| **Persisted** | Domain event emitted after a successful local-and-(maybe)-cloud write. |

## Public Interface

```ts
// src/types/session.ts
import type { State, StateTransition, TriggerEvent } from './state';
import type { Intervention } from './intervention';

export interface MorningRow {                        // raw row used by the query
  id: string;
  ts: number;
  from_state: State;
  to_state: State;
  trigger_reason?: string;
  breath_bpm?: number;
}

// src/services/sessionStore.ts
export interface MemoryAPI {
  /** CALLABLE — append a state transition (writes IDB always; Supabase if not Always-Local). */
  appendTransition(t: StateTransition): Promise<void>;
  /** CALLABLE — append a rendered intervention. */
  appendIntervention(i: Intervention): Promise<void>;
  /** CALLABLE — append a user feedback signal. */
  appendFeedback(f: { transitionId: string; signal: 'helped'|'neutral'|'unhelpful' }): Promise<void>;
  /** CALLABLE — append the user-typed whats-alive text (IDB only, never Supabase in V1). */
  appendWhatsAlive(text: string, transitionId: string): Promise<void>;
  /** CALLABLE — last 5 affirmation ids, for recency exclusion. */
  recentAffirmationIds(): Promise<string[]>;
  /** CALLABLE — used by the morning_check trigger detector. */
  morningCheckQuery(sinceMs: number): Promise<MorningRow[]>;
  /** SUBSCRIBABLE — emitted after every successful append. */
  onPersisted(cb: (e: { kind: 'transition'|'intervention'|'feedback'|'whats_alive' }) => void): Unsubscribe;
  /** CALLABLE — runtime status, for UI privacy badge. */
  isAlwaysLocal(): boolean;
}
```

## Domain Events

| Event | Direction | Payload | Producer | Consumer(s) |
|---|---|---|---|---|
| `StateTransition` | consume | `{id, ts, from, to, reason, breathBpm, hrBpm?}` | State | this |
| `TriggerEvent` | consume | `{type, transitionId, severity, ts, morningPayload?}` | State | this (for trigger row metadata) |
| `InterventionRendered` | consume | `{transitionId, affirmationId, breathPattern, ts}` | Intervention | this |
| `UserFeedback` | consume | `{transitionId, signal}` | Intervention | this |
| `Persisted` | emit | `{kind}` | this | UI (status indicators) |
| `MorningCheckResult` | emit (callable return) | `MorningRow[]` | this | State (worker, for `morning_check`) |

Shapes match the State and Intervention emitted-events tables.

## Aggregates / Entities / Value Objects

1. **`SessionStore` (aggregate root).** The IndexedDB connection and its object stores (`transitions`, `interventions`, `feedback`, `whats_alive`, `meta`). Invariant: every write is atomic per call; no partially-persisted record. Operations: `appendTransition`, `appendIntervention`, `appendFeedback`, `appendWhatsAlive`, `recentAffirmationIds`, `morningCheckLocal`.
2. **`SupabaseSync` (aggregate).** The `createClient` instance and the two `insert` methods. Invariant: only ever instantiated when Always-Local Mode is OFF; only ever writes to `state_transitions` and `interventions`; every row carries `user_id = 'demo-user-001'`. Operations: `insertTransition`, `insertIntervention`, `morningCheckCloud`.
3. **`MorningCheckQuery` (aggregate).** The composer that merges IDB and Supabase rows by `id` (Supabase wins on conflict, since it is the canonical cross-device source). Invariant: result is sorted by `ts` descending; duplicate `id`s collapsed.

## Invariants

1. **No raw vitals leave the device.** No code path writes `breathBpm`, `hrBpm`, or `motionBandPower` *series* (the ring-buffer contents) to Supabase. Single sample-at-transition values are permitted on `state_transitions` rows per §8 schema.
2. **No user-typed text leaves the device in V1.** `appendWhatsAlive` only writes to IDB. There is no Supabase column for it in V1; adding one requires a new ADR.
3. **`user_id` is constant.** Every Supabase row carries `user_id = 'demo-user-001'` in V1, until **ADR-011** promotes to `auth.uid()`.
4. **Always-Local kill switch (V1: API stub).** Per **ADR-017**, `isAlwaysLocal()` exists in V1 as an API stub that always returns `false` — there is no toggle UI in V1. The invariant the API enforces is contractual and tested: when `isAlwaysLocal()` does return true (e.g. in tests, or post-buildathon when the toggle UI ships), (a) no Supabase client is instantiated, (b) `globalThis.fetch` is never called for any URL whose origin is not `mailto:`, and (c) `appendTransition` / `appendIntervention` complete successfully using IDB only. The toggle UI is post-buildathon (or part of the ADR-011 stretch).
5. **Default-on cloud sync.** Always-Local is OFF by default for the demo so the `morning_check` story crosses device boundaries.
6. **Atomic appends.** A failed Supabase write does not roll back the IDB write — IDB is the source of truth; cloud is an eventually-consistent mirror. Failed cloud writes are logged but never re-thrown to callers.
7. **Recency cap = 5.** `recentAffirmationIds()` returns at most 5 ids, ordered most-recent-first.

## Anti-corruption layer

Two translators sit at the boundary. (1) `src/services/supabaseClient.ts` translates the internal `StateTransition` and `Intervention` value objects into the snake_case Supabase row shape (`from_state`, `to_state`, `trigger_reason`, `breath_bpm`, `affirmation_id`, `breath_pattern`, …) per the SQL in build plan §8 — and translates back on read in `morningCheckCloud`. (2) `src/services/morningCheckQuery.ts` translates Supabase rows + IDB rows into the unified `MorningRow[]` the State worker expects. Anything that touches `*.supabase.co` lives behind those two files; the rest of the codebase only sees domain types.

## File map

| File | Description |
|---|---|
| `src/services/sessionStore.ts` | IndexedDB wrapper; the `SessionStore` aggregate. |
| `src/services/supabaseClient.ts` | Supabase `createClient` + the only 2 insert methods + the kill-switch around them. |
| `src/services/morningCheckQuery.ts` | Composes IDB + Supabase rows for the `morning_check` trigger. |
| `src/types/session.ts` | `MorningRow`, `MemoryAPI`, persisted-event shapes. |

## Tests

- `tests/memory/sessionStore.spec.ts` — uses `fake-indexeddb` and a `globalThis.fetch` spy. Two scenarios: (a) Always-Local Mode ON → after `appendTransition`, `appendIntervention`, `appendWhatsAlive`, the spy records **zero** non-`mailto:` calls; (b) Always-Local Mode OFF → the spy records calls only to hosts ending in `*.supabase.co` (and `mailto:` for the Trusted Witness button). Mechanically enforces invariants 1, 2, 4.

Listed in build plan §13 (extension of the test plan; the privacy assertion is the strongest-typed invariant in V1).

## Out of scope (V1)

- Magic-link auth and RLS — **ADR-007** (deferred); **ADR-011** (Day 6 stretch only).
- A `raw_vitals` table — never. Adding one requires a new ADR.
- A `whats_alive` table in Supabase — not in V1; **ADR-007**.
- A `wellness_vector_samples` table for the 8-dim wellness vector — out per **ADR-007**.
- ONNX / vector-embedding storage — out per **ADR-007**.
- HNSW indexing of any persisted text — out per **ADR-007**.
- Cross-device conflict resolution beyond "Supabase wins on `id` collision in the morning_check merge" — V1 ships single-device-typical use.

## References

- `docs/02_research/05_canonical_build_plan.md` §3 (data classification + privacy threat model), §5 (morning_check), §8 (Supabase 2-table schema)
- `docs/05_architecture/01_system_architecture.md` §6 (privacy boundary diagram)
- `docs/adr/ADR-005-two-link-architecture.md`
- `docs/adr/ADR-007-supabase-v1-simplified.md` (Day 3)
- `docs/adr/ADR-011-stretch-auth-and-rls.md` (Day 6, conditional)
- `docs/adr/ADR-017-always-local-mode-v1-stub.md`
- [Supabase RLS docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — for the post-buildathon promotion
