# DDD — Memory Bounded Context

**Status:** Accepted (V1)
**Source of truth:** docs/02_research/05_canonical_build_plan.md
**Build Day:** 3 of 8

## Purpose

The Memory context owns persistence and the privacy boundary. It runs the IndexedDB session store (full-fidelity, always-local, the source of truth for the SPA), the Supabase write client (anon-key, hardcoded `user_id = 'demo-user-001'`, only labels and id references — never raw vitals), the `morning_check` query that joins yesterday's rows from both stores, and — critically — the structural guarantee that V1 sends only state labels and affirmation IDs (no raw vitals series; no user-typed text) so the privacy promise holds without any runtime toggle. It does not classify state, sense vitals, or pick affirmations.

## Boundary

Inside: IndexedDB schema and writes for sessions, transitions, interventions, feedback, and the rolling recency-of-5 list; the Supabase `createClient` call site and the only two `insert` paths for `state_transitions` and `interventions`; the `morning_check` query that returns the rows used to compute `MorningCheckPayload`. Outside: sensor I/O (`Sensing`), classification (`State`), affirmation choice/render (`Intervention`). The seams are: subscriptions to `StateTransition`, `TriggerEvent`, `InterventionRendered`, and `UserFeedback`; a CALLABLE `MorningCheckQuery` that the worker invokes; and the `recentAffirmationIds()` callable that the Intervention context invokes. Reference: `docs/05_architecture/01_system_architecture.md` §6 (privacy diagram) and `docs/02_research/05_canonical_build_plan.md` §3 (data classification) + §8 (Supabase 2-table schema).

## Ubiquitous Language

| Term | Definition |
|---|---|
| **SessionStore** | The IndexedDB-backed store; full-fidelity local truth. |
| **SupabaseSync** | The thin write-only client to `*.supabase.co` for the 2 V1 tables. |
| **state_transitions** | Supabase table: `(id, user_id, ts, from_state, to_state, trigger_reason, breath_bpm, hr_bpm)`. Source: build plan §8. |
| **interventions** | Supabase table: `(id, user_id, transition_id, affirmation_id, breath_pattern, user_feedback, ts)`. |
| **user_id** | Constant string `'demo-user-001'` in V1; replaced by `auth.uid()` post-buildathon (ADR-011 stretch). |
| **Structural privacy (V1)** | Privacy enforced by what is sent (state labels + affirmation IDs only), not by a runtime kill-switch. No Always-Local toggle in V1; the post-buildathon toggle is out of scope. |
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
  /** CALLABLE — append a state transition (writes IDB always; Supabase always in V1 per structural privacy in doc 05 §3). */
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
2. **`SupabaseSync` (aggregate).** The `createClient` instance and the two `insert` methods. Invariant: only ever writes to `state_transitions` and `interventions`; every row carries `user_id = 'demo-user-001'`; never writes raw vitals series or user-typed text. Operations: `insertTransition`, `insertIntervention`, `morningCheckCloud`.
3. **`MorningCheckQuery` (aggregate).** The composer that merges IDB and Supabase rows by `id` (Supabase wins on conflict, since it is the canonical cross-device source). Invariant: result is sorted by `ts` descending; duplicate `id`s collapsed.

## Invariants

1. **No raw vitals leave the device.** No code path writes `breathBpm`, `hrBpm`, or `motionBandPower` *series* (the ring-buffer contents) to Supabase. Single sample-at-transition values are permitted on `state_transitions` rows per §8 schema.
2. **No user-typed text leaves the device in V1.** `appendWhatsAlive` only writes to IDB. There is no Supabase column for it in V1; adding one requires a new ADR.
3. **`user_id` is constant.** Every Supabase row carries `user_id = 'demo-user-001'` in V1, until **ADR-011** promotes to `auth.uid()`.
4. **Privacy is structural, not toggle-driven (V1).** Per `docs/02_research/05_canonical_build_plan.md` §3, V1 enforces the privacy promise by what we choose to send (state labels + affirmation IDs only) — not by a runtime kill-switch. There is no `isAlwaysLocal()` API in V1; there is no Always-Local toggle UI in V1. The toggle is post-buildathon (potentially as part of a future ADR superseding ADR-011, or a fresh ADR after launch). The Memory context's only Supabase guards in V1 are: (a) never write raw vitals series; (b) never write user-typed text; (c) every row carries `user_id = 'demo-user-001'` per ADR-007.
5. **Default-on cloud sync.** V1 always syncs state labels + affirmation IDs to Supabase so the `morning_check` story crosses device boundaries; structural privacy guarantees (no raw vitals series, no user-typed text) make this safe without a toggle.
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

- `tests/memory/sessionStore.spec.ts` — uses `fake-indexeddb` and a `globalThis.fetch` spy. **Asserts the structural privacy invariants:** the `globalThis.fetch` spy must record only `*.supabase.co` and `mailto:` calls (never any other origin); `appendTransition` must NOT send raw vitals series; `appendWhatsAlive` must NOT call `fetch` at all (IDB-only).

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
- [Supabase RLS docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — for the post-buildathon promotion
