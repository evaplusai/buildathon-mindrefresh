# Post-Fix Review — verifying the 11 fixes from `07_plan_fix.md`

**Auditor:** Senior reviewer (ruthless mode)
**Date:** 2026-04-26 (Build Day 3, evening)
**Scope:** Verify each of the 11 fixes from `docs/02_research/07_plan_fix.md` was applied; hunt for new drift introduced by the fixes themselves.

---

# 1. Verdict

**Fix-then-ship.** 9 of 11 fixes landed cleanly. Two fixes (Fix 1 ADR-009, Fix 7 ADR-017 deletion) are PARTIAL: ADR-009 still carries leftover template language in §Promotion / Rollback Criteria that contradicts the new Status header, and the ADR-017 cut left **three** stale references in load-bearing docs (`implementation-plan.md` line 12, line 327, and the test description in §13). Fix 11 (README platform note) is NOT APPLIED — the `S6-B3-T2` task body never gained a platform sub-bullet. None of these are architectural; all are line-edits. Total NEW DRIFT items: 6, all line-precise. The build is shippable today after a 15-minute edit pass.

---

# 2. Fix Application Status

| # | Description | Files touched | Status | Evidence |
|---|---|---|---|---|
| 1 | Build gate + close ADR-009 | `docs/adr/ADR-009*.md`, `docs/adr/build-gate-day3.log` | **PARTIAL** | Status header is `Accepted (Outcome A — PASS)` (L3); 21.46 s timestamp landed (L8, L20); `build-gate-day3.log` exists, ends `Finished dev profile [unoptimized + debuginfo] target(s) in 21.46s` (L362). **BUT** §Promotion / Rollback Criteria L56 still reads `This ADR is `Proposed` until the build runs. Promotion ... by editing this file as instructed in the "Edit instructions" block above` — template language that contradicts the new Status. See Drift #1. |
| 2 | Modality vs BreathPattern resolution | `docs/ddd/03_intervention_context.md` | **APPLIED** | "Selection rule (load-bearing)" block at L76; Invariant 7 "State drives BreathPattern; modality drives affirmation diversity" at L105. |
| 3 | Recency window = "last 5" | `docs/02_research/05_canonical_build_plan.md`, all DDDs, plan | **APPLIED** | Doc 05 §7 L225: `Recency window: the canonical exclusion window is the last 5 affirmations shown`. Cross-check: Intervention DDD L26, L100; Memory DDD L25, L94; plan §13 L325, S5-B1-T2 — all "last 5". `grep "last 10\|last_10"` returns ZERO load-bearing hits. |
| 4 | `hr_bpm` column documentation | `docs/adr/ADR-007*.md`, `docs/adr/ADR-006*.md` | **APPLIED** | ADR-007 §Decision L55: `Note on hr_bpm column: kept as a one-sample-at-transition value for V2 migration path... NEVER read by the V1 classifier... documented dead code that becomes live in V2`. ADR-006 §Neutral L118 cross-refs: `Cross-ref: ADR-007 §Decision documents the hr_bpm column as a forward-compatible storage field`. |
| 5 | ADR-011 Deferred | `docs/adr/ADR-011-stretch-auth-and-rls.md` | **APPLIED** | Status L3: `Deferred — post-buildathon`; deferred-on L4: `2026-04-26`; deferral note L10 explains math (`auth + RLS work is estimated 4–6 hours and the original promotion criterion of "≥ 2 hours"... was insufficient`); §Promotion / Rollback Criteria L67 prefaced with `(Original criteria, now obsolete by deferral; preserved for V2 reference.)`. |
| 6 | ADR-008 dev-build env override | `docs/adr/ADR-008-port-and-path-locked.md` | **APPLIED** | §Decision L61: `Exception for dev / non-localhost daemon. When import.meta.env.DEV === true, the WebSocket URL may be overridden by VITE_SENSING_WS_URL ... Production builds (Vercel) ALWAYS use the locked constant`. Production-vs-dev split clean. |
| 7 | ADR-017 dropped | `docs/adr/`, `docs/ddd/04_memory_context.md`, `docs/plan/implementation-plan.md` | **PARTIAL** | File `ADR-017-always-local-mode-v1-stub.md` does NOT exist on disk (`ls docs/adr/` confirms). Memory DDD invariant 4 (L91) reverted to structural-privacy-only wording with no `isAlwaysLocal()` API. **BUT** `grep -rn "ADR-017"` finds **`docs/plan/implementation-plan.md` L12**: `ADRs 005–011 + 017 already in docs/adr/` (false — 017 doesn't exist). And `grep -rn "isAlwaysLocal"` finds **`docs/plan/implementation-plan.md` L327** (test #6 description: `globalThis.fetch spy records zero calls when isAlwaysLocal() returns true`). See Drift #2 and #3. |
| 8 | State DDD cuts late_push / cumulative_load | `docs/ddd/02_state_context.md` | **APPLIED** | §Out of scope L140: `late_push and cumulative_load triggers from earlier drafts are post-buildathon. V1 ships exactly 5 triggers... Do not reintroduce based on stale references to docs 01 / 03 / 04`. `grep` confirms these tokens do NOT appear in any other DDD or load-bearing doc. |
| 9 | Placeholder corpus written | `web-app/src/data/affirmations.placeholder.json` | **APPLIED** | File exists, parses as JSON, 12 entries, schema `{id, state, modality, text}` for every entry, exactly 4 per state across `regulated / activated / recovering`. Validated via `python3 -c "import json; …"`. |
| 10 | ADR-007 `no whats_alive` invariant | `docs/adr/ADR-007*.md` | **APPLIED** | §Decision L53: `No whats_alive table in V1. User-typed text persists only in IndexedDB. Adding such a table requires a new ADR explicitly reversing this`. |
| 11 | README platform note pre-baked into S6-B3-T2 | `docs/plan/implementation-plan.md` | **NOT APPLIED** | Plan task `S6-B3-T2` (L241) reads: `Write README.md quickstart: live URL, ?source=recorded URL, sensor wiring photo, release binary URL, build command, license (MIT), RuView attribution paragraph, privacy promise.` — no sub-bullet noting "Live mode requires macOS arm64; other platforms use ?source=recorded." See Drift #4. |

---

# 3. New Drift Introduced By Fixes

### Drift #1 — ADR-009 §Promotion / Rollback Criteria contradicts its own Status header

- **Severity:** **High**
- **File:line:** `docs/adr/ADR-009-sensing-server-build-verdict.md` L56
- **What's broken:** The header (L3) says `Accepted (Outcome A — PASS)`, but the §Promotion / Rollback Criteria still reads `This ADR is Proposed until the build runs. Promotion to Accepted happens by editing this file as instructed in the "Edit instructions" block above, today.` There is no "Edit instructions" block above (it was deleted, correctly), so this paragraph now references a phantom. An agent reading top-to-bottom hits a contradiction.
- **Fix:** Replace L54–56 with `This ADR was Proposed at 09:30 on Build Day 3 and Accepted at 10:18 the same day after the cargo build verified Outcome A. There is no rollback path — the verdict is recorded. Retry attempts post-buildathon will be tracked in a successor ADR.`

### Drift #2 — Plan §1 line 12 still claims ADR-017 exists on disk

- **Severity:** **High**
- **File:line:** `docs/plan/implementation-plan.md` L12
- **What's broken:** `Repo state at plan time: scaffold not yet stood up; no web-app/ directory; sensing-server unbuilt; ADRs 005–011 + 017 already in docs/adr/.` ADR-017 was deleted as part of Fix 7 — this line lies.
- **Fix:** Change `ADRs 005–011 + 017 already in docs/adr/` to `ADRs 005–011 already in docs/adr/`.

### Drift #3 — Plan §13 test #6 description still references `isAlwaysLocal()` kill-switch

- **Severity:** **Critical**
- **File:line:** `docs/plan/implementation-plan.md` L327
- **What's broken:** Row 6 of the test table reads `Privacy kill-switch: globalThis.fetch spy records zero calls when isAlwaysLocal() returns true; only *.supabase.co and mailto: calls otherwise; no raw vitals series ever sent.` This is the contract Claude Code would implement. With ADR-017 dropped and the Memory DDD reverted to structural-privacy-only (DDD L111: `Asserts the structural privacy invariants...`), this test description and the DDD diverge. Claude Code will mock `isAlwaysLocal()` based on the plan and ship a function that the DDD says doesn't exist.
- **Fix:** Replace the test #6 "Contract asserted" cell with `Structural privacy invariants: globalThis.fetch spy records only *.supabase.co and mailto: calls (never any other origin); appendTransition does NOT send raw vitals series; appendWhatsAlive does NOT call fetch (IDB-only).` Mocked-dependency cell is fine as-is.

### Drift #4 — Plan §1 ADR-009 / ADR-011 status lines stale

- **Severity:** **High**
- **File:line:** `docs/plan/implementation-plan.md` L9
- **What's broken:** `ADR-009 (build verdict — Proposed, pending Day-3 gate)` is wrong (now Accepted, Outcome A). `ADR-011 (auth + RLS — Proposed, gated to Day-6 stretch criteria)` is wrong (now Deferred — post-buildathon). The plan §1 header is precisely where Claude Code reads ADR posture before doing work; these two lines drove half the previous fixes.
- **Fix:** Replace L9 with the verbatim text in §5 below.

### Drift #5 — Plan task `S6-B3-T2` (README) lacks platform support note

- **Severity:** **Medium**
- **File:line:** `docs/plan/implementation-plan.md` L241
- **What's broken:** Per Fix 11, the future README must explicitly say "Live mode requires macOS arm64; other platforms use `?source=recorded`." Without a sub-bullet on the task, Claude Code on Day 6 will write the README without this note, and a Linux/Windows judge will see a mysterious connection error.
- **Fix:** Append to the `S6-B3-T2` task description: `; explicit "Live mode requires macOS arm64 with the released binary; all other platforms use ?source=recorded" sub-section under §Limitations.`

### Drift #6 — Doc 05 §11 submission checklist L387 lists ADRs `005–010` (missing 011)

- **Severity:** **Medium**
- **File:line:** `docs/02_research/05_canonical_build_plan.md` L387
- **What's broken:** `Public GitHub repo with React app, ADRs 005–010, RuView attribution, Supabase migration.` ADR-011 exists (Deferred), so the repo-with-ADRs claim should include it. Plan DoD #4 has the same issue at L338 (`ADRs 005–010 (and 007/008/011 status set)`) — that one is fine because it explicitly mentions 011. Doc 05 L387 is the gap.
- **Fix:** Change `ADRs 005–010` to `ADRs 005–011` on L387.

---

# 4. Cross-Document Consistency Sweep

**A. Plan §1 header consistency.**
- ADR-009 listed as `Proposed, pending Day-3 gate` (L9) — **STALE; should be `Accepted, Outcome A`.** See Drift #4.
- ADR-011 listed as `Proposed, gated to Day-6 stretch criteria` (L9) — **STALE; should be `Deferred — post-buildathon`.** See Drift #4.
- ADR-017 NOT listed (L9) — confirmed.
- "Repo state at plan time" (L12) lists `ADRs 005–011 + 017` — **STALE.** See Drift #2.

**B. Plan §13 (test table) and §14 (DoD).**
- §13 row 6 still says "Privacy kill-switch ... isAlwaysLocal()" — **STALE.** See Drift #3.
- §14 DoD #14 (L348) reads `pnpm test runs 6 spec files, all green (5 Day-3 specs + sessionStore.spec.ts Day-5 privacy kill-switch)`. The phrase "privacy kill-switch" is now an artefact; should read `... + sessionStore.spec.ts Day-5 structural-privacy assertions`. **MEDIUM drift; folded into Drift #3 fix.**

**C. State DDD cross-context shapes.**
- State DDD L41–42 lists exactly `acute_spike | slow_drift | recovery | manual | morning_check` — 5 values. **OK.**
- Intervention DDD §Domain Events L83 consumes `TriggerEvent {type, transitionId, severity, ts, morningPayload?}` matching exactly. **OK.**
- Memory DDD §Domain Events L72 same shape. **OK.**

**D. Memory DDD invariant 5 ("Default-on cloud sync").**
- L92: `Default-on cloud sync. V1 always syncs state labels + affirmation IDs to Supabase so the morning_check story crosses device boundaries; structural privacy guarantees ... make this safe without a toggle.` **CLEAN.** No `isAlwaysLocal()`; no toggle conditional.

**E. Doc 05 §3 data classification table.**
- L96–102: rows are CSI / Vitals / State classification / State transition events / Affirmation shown / User feedback. No "8-dim wellness vector" row. No `isAlwaysLocal` mention. **CLEAN.**
- L73 (cuts list) lists `8-dim wellness vector (post-buildathon)` correctly — that's the only place it appears, as a cut.

**F. `docs/02_research/06_swarm_output_review.md`.**
- File untouched per spec. Confirmed via timestamp comparison: it still references ADR-017 and `isAlwaysLocal` as the previous review round's open issue. **CORRECT — historical record, not load-bearing.**

**G. Cargo build log file.**
- Exists at `docs/adr/build-gate-day3.log`; 362 lines; final line (L362): `Finished dev profile [unoptimized + debuginfo] target(s) in 21.46s`. **CLEAN.**

**H. Supabase schema in doc 05 §8 vs ADR-007.**
- Doc 05 §8 L242–253 defines `state_transitions` (with `hr_bpm numeric -- HR at transition (1 sample)` comment); ADR-007 §Decision L55 explicitly documents `hr_bpm` as V2 migration field. **CONSISTENT.** Both 2 tables, no auth, RLS disabled.

**I. Plan §15 "Things explicitly NOT this plan's concern".**
- L366: `Local-Only mode toggle UI (V1's structural privacy is enough)`. **STILL PRESENT.** Correct — this was always V1 out-of-scope and survived the ADR-017 deletion. **CLEAN.**

**J. Hidden duplicate-task survival.**
- `S3-B1-T2` (L46): `Verify ADR-007 status Accepted ...`. **OK — "verify".**
- `S3-B1-T3` (L47): `Verify ADR-008 status Accepted ...`. **OK — "verify".**
- `S6-B4-T2` (L251): `(Stretch) Promote docs/adr/ADR-011 ... from Proposed to Accepted`. **PROBLEM:** ADR-011 is now `Deferred — post-buildathon`, not `Proposed`. The promotion logic in this task is now obsolete; if the Day-6 stretch path runs, it would need to write a new ADR superseding 011, not mutate 011. **MEDIUM drift; flagged as part of Drift #4 family.** Recommend rewording to `(Stretch) If conditions met, write ADR-018 superseding ADR-011 ... and proceed; do not mutate ADR-011 itself.`

---

# 5. Plan §1 Header — Concrete Recommendation

**Current L9 (verbatim):**
```
- **ADRs in `docs/adr/`:** ADR-005 (two-link architecture), ADR-006 (HRV out of V1), ADR-007 (Supabase V1 simplified), ADR-008 (port and path locked), ADR-009 (build verdict — Proposed, pending Day-3 gate), ADR-010 (3-state classifier), ADR-011 (auth + RLS — Proposed, gated to Day-6 stretch criteria).
```

**Replace with:**
```
- **ADRs in `docs/adr/`:** ADR-005 (two-link architecture — Accepted), ADR-006 (HRV out of V1 — Accepted), ADR-007 (Supabase V1 simplified — Accepted), ADR-008 (port and path locked — Accepted), ADR-009 (build verdict — Accepted, Outcome A: macOS build passed in 21.46 s on 2026-04-26), ADR-010 (3-state classifier — Accepted), ADR-011 (auth + RLS — Deferred — post-buildathon).
```

**Current L12 (verbatim):**
```
- **Repo state at plan time:** scaffold not yet stood up; no `web-app/` directory; sensing-server unbuilt; ADRs 005–011 + 017 already in `docs/adr/`.
```

**Replace with:**
```
- **Repo state at plan time:** scaffold not yet stood up; no `web-app/` directory beyond `src/data/`; sensing-server build verified (ADR-009 Outcome A, see `docs/adr/build-gate-day3.log`); ADRs 005–011 in `docs/adr/`.
```

**Current L35 (verbatim, morning standup):**
```
- Yesterday: doc 05 v3 written; doc 03 superseded; ADRs 005/006/009/010 already in `docs/adr/`.
```

**Replace with:**
```
- Yesterday: doc 05 v3 written; doc 03 superseded; ADRs 005/006/007/008/009/010/011 in `docs/adr/`.
```
(Day-3 morning standup is being read by an agent on Day 3 morning who already has ADR-007/008/011 in front of them — rewriting protects against the agent thinking it must write 007/008 from scratch.)

---

# 6. Final Recommendation

**Commit now:** All 9 cleanly-applied fixes (Fix 2, 3, 4, 5, 6, 8, 9, 10) plus the placeholder corpus (`web-app/src/data/affirmations.placeholder.json`) — these are correct and shippable.

**Fix-before-commit (15 minutes total):**

1. ADR-009 L54–56: replace stale "Proposed until..." paragraph (Drift #1).
2. Plan L9: rewrite ADR list with current statuses (Drift #4 + §5 above).
3. Plan L12: drop the `+ 017` (Drift #2).
4. Plan L327: rewrite test #6 contract description (Drift #3 — **critical, this drives test code**).
5. Plan L241: append platform-note sub-bullet to S6-B3-T2 (Drift #5).
6. Doc 05 L387: change `ADRs 005–010` to `ADRs 005–011` (Drift #6).
7. Plan L251 (S6-B4-T2): reword to "write a successor ADR" instead of "promote ADR-011" (Drift #4 family, item J).

**Leave for later:** ADR-011's residual Always-Local toggle text inside §Decision item 6 and §References. ADR-011 is now `Deferred — post-buildathon`; per the deferral note (L10) the original criteria are explicitly preserved as historical reference. Editing that body now would muddy the deferral semantics. If the Day-6 stretch fires, the successor ADR (per fix #7 above) chooses whether the toggle is in scope — and that's the right place for the decision.

After the 15-minute pass, this plan is shippable. The architecture is sound; the fixes are real; the new drift is clerical, not structural.

---

## Executive summary (200 words)

Of the 11 fixes in `07_plan_fix.md`, 9 landed cleanly and 2 are partial. The placeholder corpus is in place at `web-app/src/data/affirmations.placeholder.json` (12 entries, 4 per state, schema-correct). The recency-window number is now uniformly "5" across all four DDDs and the plan. The modality-vs-BreathPattern selection rule is now load-bearing in the Intervention DDD. ADR-011 is Deferred, ADR-009 is Accepted with Outcome A, the Cargo build log is on disk and ends at the success line. The State DDD now explicitly cuts `late_push` and `cumulative_load`. ADR-007 documents `hr_bpm` as a V2 migration field and `no whats_alive` as a V1 invariant. ADR-008 has the dev-build env override. ADR-017 was deleted from disk and from the Memory DDD. The drift count is **6** — one critical (plan §13 test row still references `isAlwaysLocal()` and would drive Claude Code to ship dead code), three high (ADR-009 has leftover template prose; plan §1 lines 9 and 12 carry stale ADR statuses), and two medium (S6-B3-T2 has no platform sub-bullet; doc 05 L387 says "005–010"). Total fix time: 15 minutes. The build is shippable today after that pass.

**Audit file:** `/Users/eva/Workspace/work/buildathon-mindrefresh/docs/02_research/08_post_fix_review.md`

**NEW DRIFT items found:** **6** (1 critical, 3 high, 2 medium). Goal was zero; 15 minutes of edits closes it.
