# ADR-007: Supabase V1 simplified — 2 tables, no auth, hardcoded user_id

**Status:** Accepted
**Date:** 2026-04-26
**Build Day:** 3 of 8
**Supersedes:** (none)
**Superseded by:** (will be partially superseded by ADR-011 if Day-6 stretch slack permits the auth + RLS upgrade)

## Context

Earlier drafts of the schema (`docs/02_research/03_research_plan.md`)
sketched a 6-table Supabase model: `users`, `sessions`, `state_transitions`,
`interventions`, `raw_vitals_optional`, `whats_alive_entries`, plus
magic-link auth, RLS policies on every table keyed off `auth.uid()`, and an
opt-in flag for raw-vitals storage. That schema is correct for the
post-buildathon product. It is wrong for the V1 ship target.

The constraint is build days. Days 3–6 carry the entire build:
sensor flash and calibration, classifier, all five trigger detectors,
MorningCheckCard, breath-pattern animation, recorded-fixture fallback,
cross-browser pass, release-binary build, README, and the demo video
recording on Day 7. Within that envelope, magic-link auth costs at minimum
a callback-URL roundtrip on three browsers, an email-template configuration,
an RLS policy per table, and a debugging budget that historically eats a
half-day per surprise (`docs/02_research/05_canonical_build_plan.md` §1, v3
amendment, "simplified Supabase from 6 tables + auth + RLS to 2 tables +
anon writes + hardcoded `user_id` for V1"; §10 Day 6, item 6).

The hackathon brief lists Supabase as a recommended Quick Link tool. Cutting
Supabase entirely (the doc 04 proposal) sacrifices the recommended-tooling
rubric line and removes the only persistence story behind the morning_check
demo moment. The middle position — keep Supabase, simplify it brutally — is
the one this ADR codifies.

## Decision

V1 ships exactly the following Supabase footprint:

- **Two tables:** `state_transitions` and `interventions`. Schemas locked in
  `docs/02_research/05_canonical_build_plan.md` §8.
- **No auth UI.** No magic-link, no email templates, no callback URL, no
  session refresh logic. The browser uses `createClient(VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY)` and nothing else.
- **Hardcoded user_id.** All rows are written with
  `user_id = 'demo-user-001'`. The constant is defined once in the client
  (`docs/02_research/05_canonical_build_plan.md` §8 "V1 client setup") and
  passed by the application layer on every insert.
- **RLS DISABLED on both tables.** The anon role has read+write via the
  anon key. Default `user_id = 'demo-user-001'` is set on the column so an
  insert that omits it still works.
- **No raw_vitals table.** No `whats_alive` table. No embedding tables. Adding
  any new table in V1 requires a new ADR.

We do **not** ship: magic-link auth, RLS policies, an authenticated client
session, password recovery, account deletion, multi-user write isolation, or
any UI surface that asks the user for credentials. The "I'd like to talk
about it" free-form text from the MorningCheckCard
(`docs/02_research/05_canonical_build_plan.md` §5) is **not** synced — it
lives only in the browser's IndexedDB.

The Day-6 stretch path (ADR-011) is documented but explicitly gated on
slack: only if Day 6 finishes the feature freeze with hours to spare do we
flip on auth + RLS. The default outcome is to ship V1 with the hardcoded
user_id and document the limitation prominently in the README and write-up.

## Consequences

### Positive

- Day-6 budget for "Supabase wiring" collapses from "two days, mostly
  debugging" to "0.25 day, mostly typing". This is what makes the rest of
  the schedule feasible (`docs/02_research/05_canonical_build_plan.md` §9
  reuse map).
- The morning_check demo works on the judge's machine without the judge
  needing to sign up, click an email link, or wait for a session refresh.
  All judges land on the same fictional user's history, which is exactly
  what the demo needs (`docs/02_research/05_canonical_build_plan.md` §10
  Day 6, item 1; §11 demo script).
- The hackathon's recommended-tooling rubric line is satisfied with real
  HTTPS row writes that a judge can see in DevTools Network.
- The data classification (`docs/02_research/05_canonical_build_plan.md` §3)
  remains intact: only state labels and affirmation IDs cross the cloud
  link. No raw vitals, no user-typed text, no PII.
- Post-buildathon migration to ADR-011's auth + RLS schema is purely
  additive: enable RLS, add policies that allow the anon role only on rows
  with `user_id = 'demo-user-001'` for backwards compatibility, swap the
  client to authenticated mode. No table-shape changes required.

### Negative

- **Privacy.** With hardcoded user_id and no RLS, anyone with the anon key
  (which ships in the deployed JS bundle, by design — the anon key is
  public) can read or write rows under `demo-user-001`. They could write
  spurious state transitions, delete rows (Supabase anon delete is
  enabled-by-default unless explicitly revoked), or read another judge's
  test session. We accept this for V1 because:
  - The only data stored are state labels (`regulated`/`activated`/
    `recovering`), affirmation IDs (e.g. `som-006`), trigger reasons, and
    one-sample HR/breath numbers. None of it is identifiable, none of it
    is sensitive in isolation.
  - The demo window is May 1–3 (judging period); abuse outside that
    window has no demo impact.
  - The README (`docs/02_research/05_canonical_build_plan.md` §11
    submission checklist, item 5) calls this out explicitly so it is not
    a hidden flaw.
- **No multi-user story.** A real user installing this build at home would
  see their data co-mingled with every other person who deployed it. There
  is no fix for this short of ADR-011.
- **Reduced scoring on "secure-by-default" axes.** A security-minded judge
  who reads the migration will see RLS disabled and `user_id` defaulted in
  the column, and will mark us down on a security rubric if one exists.
  We trade those points for shipped functionality.

### Neutral

- Supabase free-tier auto-pauses after 7 days of inactivity. Mitigation
  documented in `docs/02_research/05_canonical_build_plan.md` §14, risk
  #14: tag the project active across the judging window and document the
  re-wake step in the README.
- The 5 trigger detectors do not depend on Supabase being reachable. The
  morning_check fallback path queries IndexedDB first and only consults
  Supabase for cross-device history. A Supabase outage degrades but does
  not break the demo.

## Alternatives Considered

- **Full 6-table schema with magic-link auth and per-table RLS.** Rejected:
  the historically-typical debugging budget for a fresh magic-link setup
  on three browsers eats more than the entire Day-6 freeze window. We have
  one builder. Doc 05 §1 v3 amendment makes the cut explicit.
- **No Supabase; use IndexedDB only.** Rejected: cuts the
  recommended-tooling rubric line, breaks the "syncs across devices"
  framing of the morning_check demo, and removes the only place the demo
  can produce non-trivial yesterday-history without faking it. Doc 05 §15
  reverses doc 04's "drop Supabase" recommendation for these reasons.
- **Keep Supabase but ship signed-in-as-anonymous via Supabase's anonymous
  sign-in feature.** Rejected: still requires session management, refresh
  handling, and an "is the anonymous session live" failure mode on demo
  day. The hardcoded-string user_id has zero failure modes.
- **Use a separate Supabase project per judge, distributed in the README.**
  Rejected: the demo URL (`https://mindrefresh-studio.vercel.app/`,
  `docs/02_research/05_canonical_build_plan.md` §11) points to one project
  by build, and switching projects means rebuilding and redeploying. The
  hardcoded-user_id approach handles "many judges, one project" trivially.

## References

- `docs/02_research/05_canonical_build_plan.md` §1 (v3 amendment, the cut),
  §3 (data classification, what crosses the cloud link), §8 (full SQL
  schema and client setup), §10 Day 6 (Supabase wiring time budget), §11
  (submission checklist, README disclosure), §14 risks #14 and #18.
- `docs/01_initial/01_problem.md` (privacy framing).
- ADR-005 (two-link architecture; this ADR fixes the cloud-link half).
- ADR-011 (Day 6 stretch upgrade — auth + RLS). Not yet written; will be
  authored on Day 6 only if slack permits.
- [Supabase Row Level Security docs](https://supabase.com/docs/guides/database/postgres/row-level-security).
- [Supabase Pricing — free-tier limits](https://supabase.com/pricing).

## Test Hooks (London-school)

- `tests/triggers/morningCheck.spec.ts`
  (`docs/02_research/05_canonical_build_plan.md` §13) mocks the Supabase
  client with canned `state_transitions` rows for `user_id =
  'demo-user-001'` and asserts the morning_check payload computes
  `yesterdayCount`, `lastEventTs`, `todayBaseline`, and
  `regulatedBaseline` correctly. The test fails if the client query is
  written without the `user_id` filter, mechanically encoding the
  hardcoded-user_id half of this ADR.
- The "no `whats_alive` table, no `raw_vitals` table" half is design-time
  and not directly testable; its enforcement lives in code review against
  the §8 schema.
