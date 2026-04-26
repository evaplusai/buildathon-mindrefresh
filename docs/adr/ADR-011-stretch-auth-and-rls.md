# ADR-011: Day-6 stretch — auth + RLS upgrade

**Status:** Proposed
**Date:** 2026-04-26
**Build Day:** 3 of 8
**Supersedes:** none
**Superseded by:** none

## Context

V1 ships Supabase with two tables (`state_transitions`, `interventions`), Row Level Security disabled, the `anon` role authorised to read and write, and every row tagged with a hardcoded `user_id = 'demo-user-001'` (`docs/02_research/05_canonical_build_plan.md` §3, §8; ADR-007). This is a deliberate buildathon shortcut. It removes magic-link callback debugging, redirect-allowlist configuration, RLS policy bugs, and the "did you click the link in your email" demo failure mode from the Day 6 critical path.

It also has two real costs. First, the demo URL is unsafe to share publicly: anyone with the public anon key (visible in the browser bundle by design) can read every row in both tables. For a buildathon with judge-only access this is acceptable; for any real user post-launch it is not. Second, the cross-device pattern story — "your morning_check on your laptop reflects the activated events on your phone last night" — does not work without auth, because every device is the same `demo-user-001`. For the demo this is a feature (the morning_check has non-trivial pre-seeded history); for real users it is a bug.

This ADR records the **conditional plan** to upgrade Supabase from V1's anon-write configuration to magic-link auth + RLS, *if and only if* the Day 6 EOD slack rule is satisfied. The decision is intentionally deferred until end of Day 6 because the upgrade adds 4–6 hours of work whose failure modes are unpredictable: redirect-URL allowlists, JWT propagation in the supabase-js client, RLS policy ordering, and the migration of the hardcoded demo data to a real `auth.users` row. Attempting it on Day 6 evening when other freeze-blocking work is incomplete would risk shipping a broken Supabase write path on Day 7 — a strictly worse outcome than V1's documented hardcoded-user_id limitation.

## Decision

If, at end of Day 6 (Wed Apr 29), **all four** promotion criteria below are met, this ADR is promoted to `Accepted` and the upgrade is shipped. Otherwise this ADR is marked `Deferred — post-buildathon` and V1 ships unchanged.

When promoted, the upgrade comprises:

1. **Enable Supabase Auth** with email magic-link only (no OAuth providers, no password). Set the `SITE_URL` and the `Additional Redirect URLs` allowlist in the Supabase dashboard to include the production Vercel deployment URL (`https://mindrefresh-studio.vercel.app/auth/callback`) and `http://localhost:5173/auth/callback` for local dev.
2. **Enable RLS** on both tables: `alter table public.state_transitions enable row level security;` and the same on `public.interventions`.
3. **Add four policies per table** — `state_transitions_select_own`, `state_transitions_insert_own`, `state_transitions_update_own`, `state_transitions_delete_own`, and the matching four on `interventions`. All policies are `to authenticated using (auth.uid() = user_id)` with matching `with check` clauses. No `to anon` policies; the `anon` role loses table access entirely.
4. **Migrate `user_id` column type** from `text not null default 'demo-user-001'` to `uuid not null references auth.users(id) on delete cascade` on both tables. The migration drops the existing demo-fictional rows (they are buildathon test data, not real user data — backfill is "delete and re-seed under a real auth.users row that the demo signs in as"). The `state_transitions_user_id_ts_idx` and `interventions_user_id_idx` indexes are recreated against the new column type.
5. **Add `/auth/callback` route** to the React app that completes the magic-link exchange via `supabase.auth.exchangeCodeForSession(code)`, stores the session, and redirects to `/dashboard`. Add a minimal sign-in page at `/sign-in` with one email input and a "send me a link" button.
6. **Add an "Always-Local" toggle in Settings** that, when on, disables the Supabase client entirely (no inserts, no reads — IndexedDB only) and persists the choice to `localStorage`. This preserves the structural-privacy promise (`docs/01_initial/01_problem.md` final paragraph) for users who decline cloud sync.
7. **Re-record the morning_check demo** against a real auth.uid() with pre-seeded yesterday-history (insert via service-role key during the Day-6 evening seeding step, not via the live app). The recorded-fixture path retains the original demo-user-001 history for offline judges.

## Consequences

### Positive
- The demo URL becomes safe to share publicly. The anon role no longer has table access; an attacker with the anon key can no longer enumerate rows.
- Cross-device pattern story works for real post-launch users: `auth.uid()` follows the user across devices via magic-link sign-in.
- Privacy story strengthens: the "Always-Local" toggle gives a concrete "no cloud" path matching the original problem statement's promise.
- RLS audit posture improves; `npx @claude-flow/cli@latest security scan` (build plan §10 Day 6 item 5) will no longer flag the open `anon` write surface.

### Negative
- 4–6 hours of work whose failure modes are auth-callback-shaped: wrong redirect URL → magic link silently lands on a 404; missing `with check` on insert policy → all writes fail with 403 with no clue why; supabase-js v2 session-refresh edge cases on cold-load.
- The `morning_check` live demo path becomes harder. Currently it just queries `where user_id = 'demo-user-001'` and gets pre-seeded history. After upgrade, the demo presenter has to be signed in as a specific seeded user — losing one click on demo day to the magic-link flow risks the strongest demo moment. Mitigated by keeping the recorded-fixture path (`?source=recorded`) on the original demo-user-001 schema for the video.
- One more service to monitor on demo day: Supabase Auth's email delivery (magic links via Resend / their default SMTP) has a non-zero failure rate.

### Neutral
- The 2-table schema shape is unchanged; only the column type and the policies change. Future post-buildathon expansion to 6 tables (the full schema) is unaffected.
- The Web Worker, the 3-state classifier (ADR-010), and the WS contract (ADR-008) are all unchanged.

## Alternatives Considered

### Skip the upgrade entirely
Acceptable for buildathon if Day 6 has no slack. The cost is shipping with a documented limitation in README (cross-device sync requires post-launch auth work) and an open `anon` write surface that is fine for judge-only access. Picked as the fallback if the four promotion criteria are not all met.

### Third-party auth (Clerk, Auth0, NextAuth)
Rejected. Adds a second cloud surface, a second SDK, a second set of redirect-URL configurations, and a second source of demo-day failure. Supabase already ships first-party auth that issues JWTs the supabase-js client picks up automatically. Bringing in Clerk would be net negative for both ship-time and demo robustness.

### Custom JWT signing
Rejected. Buildathon-grade auth code is a security risk. The only safe path inside 4 hours is a managed service.

### Keep `anon` writes but add row-level constraint that `user_id = current_setting('request.jwt.claims', true)::json->>'user_id'`
Rejected as security theatre. The `anon` role can fabricate any header. Half-RLS is worse than no RLS — it suggests safety where there is none.

## Promotion / Rollback Criteria

This ADR is promoted from `Proposed` to `Accepted` if **and only if** the following four conditions are *all* true at end of Day 6 (Wed Apr 29, end of working day, before midnight feature freeze):

1. **Cross-browser pass complete.** Day-6 §10 item 3 is checked off in the canonical plan. Chrome, Safari, Firefox all show live state transitions and a working morning_check on at least the recorded fixture.
2. **Sensing-server release binary built and uploaded.** Day-6 §10 item 4 done; the binary is downloadable from a GitHub Release artifact URL and runs on a fresh macOS machine without a Rust toolchain. (Or, if ADR-009 lands in Outcome B, this criterion is automatically satisfied as N/A.)
3. **At least 2 hours of focus time remaining** before the developer's personal feature-freeze cutoff (Day 6 EOD). "Focus time" means: dishes done, no other commitments, dev environment warm, last commit green.
4. **The morning_check live demo path is verified working** end-to-end against the V1 hardcoded-user_id schema. If the morning_check is broken, do not introduce auth changes on top — fix the demo first, then if any time is left, consider this ADR.

If any one of the four is false, mark this ADR as **`Deferred — post-buildathon`** and ship V1 unchanged. Do not start the auth migration past midnight Day 6 under any circumstances. Day 7 is locked for demo + write-up (build plan §11) and any auth-shaped breakage would compound.

Rollback path if the upgrade is shipped and breaks: revert the four migration commits (RLS enable, policies, column type change, route add), redeploy. Estimated rollback time 15 minutes given clean migrations. The Always-Local toggle can stay as a feature even if the rest is rolled back.

## References

- `docs/02_research/05_canonical_build_plan.md` §3 (data classification, user_id story), §8 (V1 schema), §10 (Day 6 stretch line), §15
- `docs/01_initial/01_problem.md` (structural-privacy promise — backed by the Always-Local toggle)
- ADR-007 (Supabase V1 simplified, no auth, hardcoded user_id — the state this ADR conditionally upgrades from)
- ADR-005 (two-link architecture — Supabase is the only cloud surface, unaffected by auth choice)
- [Supabase Row Level Security docs](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Auth — magic link](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- Risk register §14 NEW #18 (hardcoded user_id as accepted V1 limitation)

## Test Hooks (London-school)

If promoted to Accepted, the following tests must be added or updated before merge:

- `tests/auth/magicLinkCallback.spec.ts` — `/auth/callback` route exchanges a code for a session via a mocked `supabase.auth.exchangeCodeForSession`; on success redirects to `/dashboard`; on error renders a sign-in-again CTA.
- `tests/auth/alwaysLocalToggle.spec.ts` — when the Always-Local flag is on in `localStorage`, the Supabase client is not constructed and no network calls fire; IndexedDB writes still succeed.
- `tests/supabase/rlsPolicies.spec.ts` — integration test against a Supabase local instance: an `authenticated` JWT for user A can only `select / insert / update / delete` rows where `user_id = A`; the `anon` role gets 403 on every operation against both tables.
- `tests/triggers/morningCheck.spec.ts` (existing, per build plan §13) — updated to inject a real `auth.uid()` instead of the hardcoded `demo-user-001` constant; the test contract shape is otherwise unchanged.

If this ADR is `Deferred — post-buildathon`, none of the above tests are written and the existing morning_check test continues to mock the hardcoded user_id.
