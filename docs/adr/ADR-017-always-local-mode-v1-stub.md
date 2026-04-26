# ADR-017: Always-Local Mode is a V1 API Stub; Toggle UI is Post-Buildathon

**Status:** Accepted
**Date:** 2026-04-26
**Build Day:** 3 of 8
**Supersedes:** (none)
**Superseded by:** (none)
**Resolves contradiction surfaced in:** `docs/02_research/06_swarm_output_review.md` Critical Issue #7

## Context

The MindRefreshStudio product spec (`docs/01_initial/01_problem.md`, final paragraph) promises an "optional Local-Only Mode for users needing maximum privacy." Three downstream documents disagreed about how that promise lands in V1:

- **Implementation plan §15** explicitly excludes "Local-Only mode toggle UI" from V1, treating the structural privacy of the data classification (only state labels and affirmation IDs cross the cloud) as sufficient.
- **Memory bounded-context DDD (`docs/ddd/04_memory_context.md`) §Invariants** treats Always-Local Mode as a V1 invariant — invariant #4 specifies that when `isAlwaysLocal()` returns true, the Memory context must instantiate no Supabase client, must call `fetch` for no non-`mailto:` URL, and must complete `appendTransition`/`appendIntervention` from IndexedDB only.
- **ADR-007 (Supabase V1 simplified)** does not mention Always-Local at all — V1's Supabase posture is pure hardcoded `user_id = 'demo-user-001'` with anon writes; the ADR neither permits nor forbids a runtime kill-switch.
- **ADR-011 (Day 6 stretch — auth + RLS)** treats the Always-Local toggle UI as part of the auth-stretch upgrade path — i.e. ships only conditionally, only on Day 6 if all four promotion criteria are met.

This contradiction is exactly the kind of drift that wastes Day-4 hours: the builder reads the Memory DDD, codes the kill-switch, then notices the plan §15 excludes the toggle UI and stops, leaving an API surface with no consumer. Or the builder follows plan §15 and skips the kill-switch entirely, breaks the Memory DDD's invariant #4, and breaks the test that the same DDD makes the canonical privacy-claim test (`tests/memory/sessionStore.spec.ts`).

This ADR resolves the contradiction by separating the **API contract** from the **toggle UI**.

## Decision

V1 ships the Always-Local Mode **as an API stub** in `src/services/sessionStore.ts`:

```ts
export function isAlwaysLocal(): boolean {
  return false;  // V1 stub — no toggle UI yet; always returns false in production code paths.
}
```

The function exists, lives in the Memory bounded context, is exported as part of `MemoryAPI`, and is called by both `appendTransition` and `appendIntervention` before any Supabase operation. In V1 production it always returns `false`, so cloud sync is on. In tests, it can be mocked or stubbed to return `true`, exercising the privacy kill-switch path defined by the Memory DDD invariant #4.

The **toggle UI is post-buildathon** — explicitly out of V1 scope per implementation plan §15. If ADR-011 (auth + RLS Day-6 stretch) is promoted to Accepted, the toggle UI ships as part of that bundle. Otherwise, the toggle UI is roadmap.

The **privacy kill-switch test** (`tests/memory/sessionStore.spec.ts`, scheduled in plan task `S5-B2-T5`) is the canonical site that mechanically asserts the invariant. It mocks `isAlwaysLocal` to return `true` and asserts `globalThis.fetch` is never called for any URL whose origin is not `mailto:`. It also asserts the negative — when `isAlwaysLocal` returns `false` (the V1 production case), only `*.supabase.co` and `mailto:` URLs are ever called.

The data classification in `docs/02_research/05_canonical_build_plan.md` §3 — that raw CSI never leaves the sensing-server and per-second vitals never leave the browser — is the **substantive** privacy posture in V1. The Always-Local toggle is the **opt-out** mechanism for users who want even less data flow than the structural minimum. Because in V1 no toggle UI exists, the V1 user gets the structural posture by default; the runtime kill-switch is dormant code paths that ship with the product, ready to activate when the UI lands.

## Consequences

### Positive

- Resolves the three-way contradiction between plan §15, Memory DDD invariant #4, and ADR-011.
- Memory DDD test (`sessionStore.spec.ts`) becomes write-able today — it depends on the API surface, not the UI.
- The privacy claim in the demo voice-over (1:35 of doc 05 §11) is mechanically backed by a green test, not aspirational.
- Post-buildathon, shipping the toggle UI is an additive change — no API or schema migration required.
- The substantive privacy posture (raw vitals never leave the browser) is independent of the toggle and works in V1 by structure, not by user action.

### Negative

- A future reader sees `isAlwaysLocal()` always returning `false` and may assume the function is dead code. Mitigation: the function's docstring and ADR-017's reference link in the source comment explain the V1 stub posture.
- Users who wanted a literal "Always-Local" button at submission don't get one. The README "Limitations" section names this clearly.
- The hardcoded `false` return in V1 means the kill-switch path can be exercised only in tests, which means a regression in production code paths (e.g., a future PR that bypasses `isAlwaysLocal()` and calls `fetch` directly) would not be caught by static analysis until the toggle UI ships. Mitigation: add an ESLint rule (post-buildathon) that flags direct `fetch` calls outside `src/services/supabaseClient.ts`.

### Neutral

- ADR-011's promotion criteria do not change; if promoted, the toggle UI lands on Day 6 as part of that ADR's scope, and the V1 stub is replaced by a `useAlwaysLocal()` hook reading from a localStorage-backed boolean.
- The Memory DDD's anti-corruption layer (`src/services/supabaseClient.ts`) is the only file in V1 that gates Supabase calls behind `isAlwaysLocal()`. Centralising the gate there keeps the test surface small.

## Alternatives Considered

### Alternative A — Drop Always-Local from V1 entirely (matches plan §15 literally)

Reject the Memory DDD's invariant #4 entirely. No `isAlwaysLocal()` function. No kill-switch test. **Rejected because:** breaks the Memory DDD invariant the swarm wrote and which the privacy-claim test depends on. Also makes the future toggle UI a breaking API change rather than additive.

### Alternative B — Ship the full toggle UI in V1 (matches Memory DDD literally)

Build a Settings page, persist the toggle in localStorage, render a "Sync: ON / OFF" indicator on the dashboard. **Rejected because:** plan §15 explicitly excludes it; the UI work is 30–60 minutes that is more usefully spent on the MorningCheckCard (the strongest demo beat); and shipping the toggle without the full data-classification audit (which is a Day-7 job, not a Day-3 one) risks a misconfiguration that makes the privacy claim louder than the implementation.

### Alternative C — Make the kill-switch a build-time `import.meta.env.VITE_ALWAYS_LOCAL` flag

Privacy kill-switch is determined at build time by an env var; no runtime toggle. **Rejected because:** the test (`sessionStore.spec.ts`) needs to exercise both states in the same test process, which is harder with a build-time flag than with a function that can be mocked.

## Promotion / Rollback Criteria

This ADR is **Accepted** and applies for V1. The decision should be revisited if any of the following becomes true:

- ADR-011 is promoted to Accepted on Day 6, in which case the toggle UI ships and `isAlwaysLocal()` reads from a real source — this ADR is then **superseded by ADR-011**.
- The Memory DDD's invariant #4 is changed (would require a new ADR superseding both this and the Memory DDD section).
- A late-V1 incident reveals the structural privacy posture is insufficient (would require a hot ADR, not an after-the-fact change to this one).

## References

- `docs/01_initial/01_problem.md` (final paragraph — "optional Local-Only Mode")
- `docs/02_research/05_canonical_build_plan.md` §3 (data classification)
- `docs/02_research/06_swarm_output_review.md` Critical Issue #7
- `docs/adr/ADR-007-supabase-v1-simplified.md`
- `docs/adr/ADR-011-stretch-auth-and-rls.md`
- `docs/ddd/04_memory_context.md` §Invariants (esp. #4)
- `docs/plan/implementation-plan.md` §6 Block 2 (`S5-B2-T1`, `S5-B2-T5`), §15

## Test Hooks (London-school)

- `tests/memory/sessionStore.spec.ts` — the canonical privacy kill-switch test (scheduled in plan `S5-B2-T5`).
  - When `isAlwaysLocal` mocked to `true`: assert `globalThis.fetch` recorded zero calls; `appendTransition` returned successfully; IDB has the row.
  - When `isAlwaysLocal` returns `false` (V1 production path): assert `globalThis.fetch` calls only matched `*.supabase.co` or `mailto:`; no other origins.
  - Negative invariant: no test setup writes raw vitals series or user-typed text to Supabase, ever.
