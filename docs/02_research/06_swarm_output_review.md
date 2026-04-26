# 06 — Swarm Output Audit (Day 3, post-spawn)

**Reviewer:** Code-review pass against doc 05 (canonical), `01_problem.md`, `02_buildathon.md`, and the upstream Rust source.
**Files audited:** 7 ADRs (005–011), 4 DDDs (Sensing/State/Intervention/Memory), 1 implementation plan.
**Source-of-truth pin:** `docs/02_research/05_canonical_build_plan.md` v3.

---

# 1. Verdict

**Fix-then-ship.** The swarm output is structurally sound — port/path lock, state vocab, trigger list, table count, and user_id default agree across all 12 docs in the load-bearing places. The architecture is buildable from these alone. **But:** the implementation plan is stale relative to the ADRs the *same swarm* wrote (treats 007/008/011 as unwritten), several DDDs cite ADR filenames that do not exist on disk, the State DDD invents a `1 s evidence` invariant that has no mandate in doc 05 or ADR-010, and the Memory DDD's `sessionStore.spec.ts` is unscheduled. None of these block coding today; all of them need a 30-minute pass before Day 4 09:00. Three small re-writes, not a re-spawn.

---

# 2. Critical Issues (must fix before coding starts)

1. **Plan still schedules already-written ADRs as Day-3 tasks.**
   - **Severity:** High.
   - **Location:** `docs/plan/implementation-plan.md` §4 Block 1 tasks `S3-B1-T2` ("Write ADR-007"), `S3-B1-T3` ("Write ADR-008"), and §7 Block 4 task `S6-B4-T2` ("Write ADR-011").
   - **What's wrong:** ADR-007, ADR-008, and ADR-011 exist as accepted/proposed files in `docs/adr/`. The plan tells the solo builder to spend 30+20+20 = 70 minutes today writing what is already written.
   - **Why it matters:** Day 3 has 4 hours of meaningful build time once the build gate is running. Wasting an hour of that on phantom work is one block lost.
   - **Fix:** Rename `S3-B1-T2`/`-T3` to "Verify ADR-007 / ADR-008 status: Accepted; banner-link from doc 05 ADR table" (5 min total). Replace `S6-B4-T2` with "Promote ADR-011 from Proposed to Accepted; otherwise mark Deferred per its own §Promotion criteria" (5 min). Reclaim the time for the calibration gate or fixture capture.

2. **Plan §1 Header is desynchronised with reality of `docs/adr/`.**
   - **Severity:** High.
   - **Location:** `docs/plan/implementation-plan.md` lines 9–10.
   - **What's wrong:** Header lists "ADRs 005, 006, 009, 010" as already in `docs/adr/` and says "To add today: ADR-007 (Supabase 2-table no-auth), ADR-008 (port lock). To add later: ADR-011 (auth + RLS upgrade)". But the swarm produced ADR-007, ADR-008, and ADR-011 in the same pass.
   - **Why it matters:** Anyone resuming the plan from scratch will believe three ADRs are missing and re-author them. Path of least resistance is identical-content drift.
   - **Fix:** Replace lines 9–10 with: "ADRs in `docs/adr/`: 005, 006, 007, 008, 009 (Proposed — pending build-gate outcome), 010, 011 (Proposed — gated to Day-6 stretch criteria)."

3. **State DDD invents a `1 s evidence` invariant that contradicts ADR-010.**
   - **Severity:** High (semantic drift in the most-tested layer).
   - **Location:** `docs/ddd/02_state_context.md` Ubiquitous Language line 24 ("Suppression of a transition unless ≥1 s of new evidence agrees with it"); Invariants §2 line 106; Aggregates §1 line 98 ("never emits a transition unless dwell ≥ 5 s and at least 1 s of new evidence agrees").
   - **What's wrong:** ADR-010 §Decision specifies "5-second minimum dwell on every transition" — a single timer. The 60-second sustained-rise / 30-second descent / flat-trend windows are the *evidence* requirements; there is no 1-second sub-rule in doc 05 §4 or ADR-010. The DDD's "≥1 s of new evidence" is invented and conflicts with the ADR's pure-dwell rule.
   - **Why it matters:** `tests/state/stateRules.spec.ts` is the spine of the State context. If the DDD's 1-s evidence assertion gets coded, the test will fail; if the test gets written to it, the test will not match doc 05 or ADR-010. Either way, an hour of debug.
   - **Fix:** In State DDD, delete the "1 s evidence rule" invariant and the corresponding line in `StateClassifier`'s aggregate description. Replace with "5 s minimum dwell + the entry-condition window (60 s for activated, 30 s for recovering) is the only debounce."

4. **DDD ADR-link filenames don't match disk filenames.**
   - **Severity:** Medium (build-time annoyance, not blocking).
   - **Location:**
     - `docs/ddd/01_sensing_context.md` line 130 → `ADR-008-port-lock.md` (actual: `ADR-008-port-and-path-locked.md`).
     - `docs/ddd/02_state_context.md` line 146 → `ADR-010-3-state-breath-trajectory.md` (actual: `ADR-010-three-state-breath-trajectory-classifier.md`).
     - `docs/ddd/03_intervention_context.md` line 140 → `ADR-010-3-state-breath-trajectory.md` (same drift).
     - `docs/ddd/04_memory_context.md` line 133 → `ADR-011-auth-rls-stretch.md` (actual: `ADR-011-stretch-auth-and-rls.md`).
     - `docs/ddd/01_sensing_context.md` line 129 → `ADR-006-hrv-out-of-v1.md` "(to be written Day 3)" — already written.
   - **Why it matters:** Markdown link rot in the very docs the builder will Cmd-click during Day 4 implementation.
   - **Fix:** 5-minute search-and-replace pass across all 4 DDDs.

5. **System architecture §1 still describes the V0 product (4-state, SONA, HNSW).**
   - **Severity:** Medium.
   - **Location:** `docs/05_architecture/01_system_architecture.md` §1, §2 (vendor table cites `@ruvector/sona`, `@ruvector/core`, `@ruvector/ruvllm`), §4 sequence diagram (HNSW step), §7 source layout (`affirmationRetriever.ts`, `rephraser.ts`, `sonaPersonalization.ts`, `WhatsAliveInput.tsx`, `PatternMirror.tsx`).
   - **What's wrong:** ADR-010 §Context calls this "the draft system architecture (`docs/05_architecture/01_system_architecture.md` §1) committed to a four-state polyvagal classifier" — i.e., the doc itself is acknowledged stale, but it has no Status banner saying "superseded by doc 05 v3".
   - **Why it matters:** The plan §3 references this doc's §7 source layout for scaffold directories. A builder following §7 will create files (`affirmationRetriever.ts`, `WhatsAliveInput.tsx`) that the cuts have explicitly removed.
   - **Fix:** Add a top-of-file banner: "**Status:** Partially superseded by `docs/02_research/05_canonical_build_plan.md` v3. §1 is V0; §7 source layout includes files (`WhatsAliveInput.tsx`, `affirmationRetriever.ts`, `rephraser.ts`, `sonaPersonalization.ts`, `PatternMirror.tsx`) that are post-buildathon. See doc 05 §1 'V1 explicit non-goals'."

6. **Plan §13 misses Memory DDD's `sessionStore.spec.ts`.**
   - **Severity:** Medium.
   - **Location:** `docs/plan/implementation-plan.md` §13 lists 5 tests; Memory DDD §Tests line 113 lists `tests/memory/sessionStore.spec.ts` as enforcing invariants 1, 2, 4 (no raw vitals, no whats_alive, Always-Local kill switch).
   - **Why it matters:** This is the privacy-claim test. If it isn't scheduled, the privacy promise in the demo script (1:35) is unbacked.
   - **Fix:** Add `S5-B2-T5` (Day 5 Block 2) "Write `tests/memory/sessionStore.spec.ts` per Memory DDD §Tests (privacy kill-switch enforcement)." 30 min. Update §13 table count to 6 tests; update §14 DoD item 14 from "5 spec files" to "6 spec files".

7. **Plan §15 contradicts Memory DDD on the Always-Local toggle.**
   - **Severity:** Medium.
   - **Location:** `docs/plan/implementation-plan.md` §15 line 363 lists "Local-Only mode toggle UI" as NOT in this plan; Memory DDD §Ubiquitous Language line 24 says Always-Local Mode is a "user-facing toggle" with default OFF; ADR-011 §Decision item 6 says the Always-Local toggle "preserves the structural-privacy promise (`docs/01_initial/01_problem.md` final paragraph)".
   - **Why it matters:** ADR-007 is the V1 Supabase ADR; ADR-011 introduces Always-Local *only* as part of the auth-stretch upgrade. The Memory DDD invariant 4 (the kill switch) is V1 by its own status header. The plan refuses to build the toggle at all. Three docs disagree.
   - **Fix:** Pick one: (a) Memory DDD's `isAlwaysLocal()` API stays as a no-op stub in V1 (always returns `false`); the toggle UI is post-buildathon. (b) Or build the toggle as a 30-min Day-6 task. Recommended: (a). Edit Memory DDD §Invariants to say "the kill-switch is an API stub in V1 (always false); the toggle UI is post-buildathon per plan §15."

8. **Plan EOD Day-3 freeze check requires ADR-009 Accepted, but ADR-009 ships as a template.**
   - **Severity:** Medium.
   - **Location:** Plan §4 line 30 ("ADR-009 closed with Outcome A or Outcome B"); ADR-009 Status line 3 ("Proposed (pending Day-3 risk gate)"); ADR-009 Edit instructions block lines 11–24 (template, fill-in instructions).
   - **What's wrong:** The plan correctly schedules `S3-B1-T4` as a 10-minute close-out, but the ADR is still in template form — neither outcome block has been deleted, the timestamp is unfilled. The risk: builder runs the gate, gets pass/fail, forgets to actually edit the template before the EOD check.
   - **Fix:** Add a one-line reminder to `S3-B1-T4` exit criterion: "Verify Edit-instructions block deleted, Status line changed to Accepted, timestamp filled, one Outcome block deleted."

---

# 3. Cross-Document Drift Audit

| Fact under audit | Doc 05 | ADRs | DDDs | Plan | Verdict |
|---|---|---|---|---|---|
| WS URL `ws://localhost:8765/ws/sensing` | §2 line 35 | ADR-005 L46, ADR-008 L29, ADR-009 L28 | Sensing L9, L61 | L72, L84, L112, L321 | ✅ consistent |
| UDP port 5005 | §2 line 23 | ADR-005 L45, ADR-008 L30, ADR-009 L28 | (implicit) | L47, L111 | ✅ consistent |
| Bind 127.0.0.1 default | §2 line 33 | ADR-005, ADR-008 L31 | Sensing L131 | (n/a) | ✅ consistent |
| State enum `regulated\|activated\|recovering` | §4, §8 | ADR-010 L19 | State L39, Memory L43 | L70, L120, L322 | ✅ consistent |
| Trigger list (5 detectors) | §5 | ADR-005 L53–55 | State L9, L41 | L129–134 | ✅ consistent |
| Supabase 2 tables (V1) | §8 | ADR-007 L39, ADR-011 L11 | Memory L21–22 | L221, §14 | ✅ consistent |
| `user_id = 'demo-user-001'` (V1 default) | §3, §8 | ADR-005 L85, ADR-007 L45, ADR-011 L11 | Memory L23, L92 | L196, L222 | ✅ consistent |
| Day count (Days 3–6 build, 7 demo, 8 buffer) | §1 line 9 | (n/a) | (n/a) | §1 lines 5–7 | ✅ consistent |
| Privacy line "Raw biometric signals never leave your device. Only state events sync…" | §3 line 93 | quoted partial in ADR-005 L29 | Memory states "no raw vitals" but does not quote the line | Plan L232 quotes verbatim | ⚠️ **drift** — `01_initial/01_problem.md` says "raw biometric data never leaves the home" (different); `01_system_architecture.md` §6 says "raw CSI never leaves the sensing-server process. Vitals frames never leave the browser." Three different phrasings. Plan-quoted version is the canonical. |
| Affirmation file path `src/data/affirmations.json` | §7 | ADR-007 (n/a), ADR-010 (n/a) | Intervention L113 | L166 | ✅ consistent |
| Breath-rate ranges | §4 (regulated 8–14, activated >14 rising 1 BPM/min, recovering descent 0.5 BPM/min) | ADR-010 L23–25 | State L20–22 | L120 | ✅ consistent |
| Debounce / dwell | §4 "5 s debounce on every transition" | ADR-010 L19 "debounced by 5 seconds" + L27 "5-second minimum dwell" | State Invariants §1 (5 s dwell) + §2 (1 s evidence) | L85, L322 ("≥5 s debounce") | ❌ **drift** — State DDD invariant 2 invents a 1-s evidence rule absent from doc 05 and ADR-010. See Critical Issue #3. |
| Affirmation count | §7 (no count specified) | (n/a) | Intervention §Aggregates §1 (no count) | Plan L166 ("12-entry placeholder (4 per state)"); System arch §7 line 244 ("20 affirmations (4 states × 5)") | ❌ **drift** — system architecture §7 says 20 (legacy 4-state); plan says 12 placeholder. Source of truth: plan/Intervention DDD. System arch §7 is stale (Critical Issue #5). |
| ADRs in submission checklist | §11 line 385 says "ADRs 005–010" | (n/a) | (n/a) | Plan §14 DoD item 4 says "ADRs 005–010 (and 007/008/011 status set)" | ⚠️ **drift** — doc 05 omits 011 from the submission list. Plan covers it. Recommend doc 05 §11 patch: "ADRs 005–011" since 011 must ship with explicit Promoted-or-Deferred status. |
| `?source=recorded` fallback | §1, §10 Day 3 item 4 | ADR-005 L106, ADR-009 L46–58 | Sensing L28, L96 | `S5-B3-T1`, `S4-B4-T3` | ✅ consistent |
| Morning-check 6 h gap | §5 ("> 6 h gap") | (n/a) | State Invariant 3 line 107 (">6 hours") | Plan L133 (">6 h gap"), L323 (">6 h ago") | ✅ consistent |
| Five mock-first tests | §13 (5 named files) | (mentioned per ADR) | Memory DDD adds a 6th (`sessionStore.spec.ts`) | Plan §13 still lists 5 | ❌ **drift** — see Critical Issue #6. |

---

# 4. Missing ADRs (load-bearing decisions in doc 05 lacking an ADR)

The following decisions are load-bearing in doc 05 and are quoted in plan/DDD execution but have no ADR:

| # | Decision | Why load-bearing | Suggested ADR title | When to write |
|---|---|---|---|---|
| 1 | Vite + React 18 + TS + Tailwind + shadcn/ui as the SPA stack (Ruv house style). | Plan §4 Block 2 builds on this verbatim; the test infrastructure (Vitest) is downstream of it. | ADR-012 SPA stack: Vite + React 18 + TS + Tailwind + shadcn (Ruv house style). | **Day 4** — short ADR (~20 lines), captures the Ruv-precedent rationale already in `02_ruview_integration_strategy.md` so it doesn't get re-litigated. |
| 2 | No Tauri / SPA-only submission. | Repeatedly invoked in ADR-005 and system arch §8 but never first-classed as a decision. | ADR-013 No Tauri shell — SPA on Vercel is the submission artefact. | **Today (Day 3)** if time, else Day 4. 10-minute write. |
| 3 | Vendor RuView via cargo `--no-default-features` from `upstream/RuView/v2` (not pre-built binary). | The Day-3 build gate, the Day-6 release-binary task, and ADR-009 all assume this build path. | ADR-014 Vendor sensing-server via cargo with `--no-default-features`; ship release binary on Day 6. | **Today (Day 3)** — directly mitigates Risk Doc-02 #1 and #5. Subsumes the build-method decision implicit in ADR-009. |
| 4 | `?source=recorded` JSONL fixture path as a first-class fallback (not a debug toggle). | Demo-script integrity (G3-build Outcome B), live-vs-recorded contract identity (Sensing DDD), Day-7 video shoot logistics. | ADR-015 Recorded-CSI fixture path is a first-class demo mode. | **Day 4** — non-blocking but should land before the Day-5 implementation of `S5-B3-T1`. |
| 5 | The 5 mock-first contract tests as the V1 verification floor. | Plan §13 + §14 DoD #14 make `pnpm test` green a submission requirement. | ADR-016 5 mock-first contract tests are the V1 verification floor (London-school TDD). | **Post-buildathon** is fine — the plan binds it functionally. |
| 6 | Always-Local Mode itself (toggle behavior + default-off). | Memory DDD makes it an aggregate invariant; ADR-011 references it as part of the *stretch*; ADR-007 doesn't mention it. Three different framings, no ADR-of-record. | ADR-017 Always-Local Mode kill-switch (V1 API stub; UI deferred). | **Today (Day 3)** — clarifies the contradiction between Plan §15 and Memory DDD. 15-minute write. |

**Highest-priority writes today (Day 3):** #2 (Tauri), #3 (cargo build path), #6 (Always-Local). These are the three the plan or the DDDs already presume but have no decision-of-record for.

---

# 5. Missing DDD Content

| Context | What's missing |
|---|---|
| **Sensing** | The `?dev=1` "force morning_check" affordance (plan `S5-B3-T2`) is a Sensing-context concern (it injects synthetic frames at the contract boundary) but is not named in Sensing DDD's seam list. Add a line under "Anti-corruption layer" or "Out of scope" so a builder doesn't put `?dev=1` handling in `triggerWorker.ts`. |
| **State** | Invented "1 s evidence" invariant — see Critical Issue #3. **Also missing:** the `manualTrigger()` callable on `StateAPI` (line 78) is correctly listed but the corresponding domain event `TriggerEvent.type='manual'` is missing a payload spec — does it carry the current `breathBpm`? Doc 05 §6 implies yes; State DDD silent. |
| **Intervention** | `MorningCheckCard` is named (line 117 file map) but its `MorningCheckPayload` consumption is owned by State DDD's value object — Intervention's invariants don't restate that the card is rendered without recomputation. Recommend adding Invariant 7: "MorningCheckCard reads `MorningCheckPayload` directly from the trigger event; Intervention does not re-query Memory." |
| **Memory** | `MorningCheckQuery` is described as merging IDB + Supabase rows "by `id`" (Aggregate 3). But Supabase rows have `id uuid` and IDB rows are appended client-side. Are the IDs the same UUID? Doc 05 §8 schema implies yes (gen_random_uuid on the cloud, but inserts come from the client which mints UUIDs locally first). Make this an explicit invariant: "transition `id` is minted on the client; Supabase insert preserves the client UUID; IDB and cloud rows for the same transition share `id`." Otherwise the merge logic is undefined. |

---

# 6. Implementation-Plan Gaps

**Orphan files (named in DDDs/ADRs but not scheduled in plan):**

- `src/services/baselineTracker.ts` (Sensing DDD line 104) — no plan task creates this. The 7-day breath EWMA baseline is a Sensing aggregate but no `S{n}-B{n}-T{n}` task implements it. **Fix:** add `S5-B2-T5` "Implement `baselineTracker.ts`; rehydrate from `SessionStore` on boot" or fold into `S5-B2-T1` (sessionStore).
- `src/services/morningCheckQuery.ts` (Memory DDD line 109 file map) — plan `S4-B3-T5` writes the trigger detector but no task creates the IDB+Supabase merge module. The `morningCheck.spec.ts` test will fail without it.
- `tests/memory/sessionStore.spec.ts` — see Critical Issue #6.
- `src/components/dashboard/VitalsPanel.tsx` (system arch §7) — plan refers to a "60 s breath sparkline" in `S5-B3-T3` but doesn't name the file. Either pick a name or strike `VitalsPanel.tsx` from the source layout.

**Duplicated work (plan re-creates what swarm already produced):**

- `S3-B1-T2` (write ADR-007), `S3-B1-T3` (write ADR-008), `S6-B4-T2` (write ADR-011) — see Critical Issue #1.

**Hidden serial dependencies presented as parallel:**

- `S3-B3-T6` (App.tsx wires worker + WS client) requires `S3-B3-T4` AND `S3-B3-T5` AND a way to drive a mock socket frame end-to-end. The "smoke test" presupposes `mock-socket` (which is installed in `S3-B4-T1`). So `S3-B3-T6` is implicitly blocked by `S3-B4-T1`. **Fix:** make the dependency explicit, or move `S3-B3-T6` into Block 4 after `S3-B4-T1`.
- `S5-B3-T1` (`?source=recorded` replay) depends on `S4-B4-T4` (fixture exists) — the plan declares this. But the *fixture* depends on `S4-B2-T4` (worker emits real transitions) AND `S4-B1-T1..T3` (live signal). If the build gate falls Outcome B (Day 3), `S4-B1-*` are skipped, the fixture has to come from another source — Gate G3-build §10 says "use synthetic JSONL". This is correctly described as a fallback but the synthetic-JSONL path has no task ID. **Fix:** add `S4-B4-T5` (conditional, runs only if Outcome B) "Hand-author synthetic `recorded-csi-session.jsonl` covering one regulated→activated→recovering arc."

**Missing user-corpus handoff:** Gate G5-corpus (Day 5 09:00) names the trigger but says "swap is a one-file edit" — true. However, the *placeholder* corpus is not scheduled as a Day-3 or Day-4 deliverable. If the user's corpus arrives Day 5 09:31, `S5-B1-T1` says "Else: ship 12-entry placeholder" — but no one has authored 12 entries yet. **Fix:** add `S3-B4-T7` (or end-of-day Day 4) "Author 12-entry placeholder `affirmations-placeholder.json` (4 per state, 3 modalities each) — kept in `web-app/src/data/`; renamed to `affirmations.json` at G5-corpus if user corpus is late."

**Day-6 stretch criterion mismatch:** ADR-011 §Promotion criteria lists 4 specific gates (cross-browser pass, release binary, ≥2 h slack, morning_check live verified). Plan §10 Gate G6-stretch lists 3 criteria ("cross-browser still failing", "Supabase rows not yet inserting", "README incomplete"). The plan's criterion #4 ("security scan flagging HIGH issues") is *additional*; the plan is *missing* ADR-011's "morning_check live demo path is verified working end-to-end". **Fix:** align Gate G6-stretch text to ADR-011's four criteria verbatim.

---

# 7. Test Coverage Cross-Check

| Test file | Listed in ADR? | Listed in DDD? | Scheduled in plan (which day) | Verdict |
|---|---|---|---|---|
| `tests/sensing/wsClient.spec.ts` | ADR-005 L148, ADR-008 L125, ADR-009 L114 | Sensing DDD L111 | Plan `S3-B4-T3` (Day 3) | ✅ aligned |
| `tests/sensing/vitalsRingBuffer.spec.ts` | ADR-006 L165 (indirect) | Sensing DDD L112 | Plan `S3-B4-T2` (Day 3) | ✅ aligned |
| `tests/state/stateRules.spec.ts` | ADR-006 L161, ADR-010 L77 | State DDD L128 | Plan `S3-B4-T4` (Day 3) | ✅ aligned (modulo Critical Issue #3 — DDD's 1-s rule) |
| `tests/triggers/morningCheck.spec.ts` | ADR-005 L152, ADR-007 L161 | State DDD L129 | Plan `S3-B4-T5` (Day 3) | ✅ aligned |
| `tests/intervention/affirmationFilter.spec.ts` | (no ADR mentions; refinement test) | Intervention DDD L122 | Plan `S3-B4-T6` (Day 3) | ✅ aligned |
| `tests/memory/sessionStore.spec.ts` | (no ADR — should be ADR-007 or new ADR-017 Always-Local) | Memory DDD L113 | **Not in plan** | ❌ **orphaned** — Critical Issue #6 |
| `tests/auth/magicLinkCallback.spec.ts` | ADR-011 L89 | (n/a, gated to stretch) | Plan §7 stretch block (`S6-B4-T2..T4`) but file not named | ⚠️ conditional — fine if ADR-011 deferred. If promoted, plan must add a task ID. |
| `tests/auth/alwaysLocalToggle.spec.ts` | ADR-011 L90 | (n/a) | Not in plan | ⚠️ conditional |
| `tests/supabase/rlsPolicies.spec.ts` | ADR-011 L91 | (n/a) | Not in plan | ⚠️ conditional |

---

# 8. Privacy Promise Consistency

Tracing the privacy claim across the source-of-truth chain:

1. **`docs/01_initial/01_problem.md` (final paragraph):** "Data processed locally on user-owned hardware; raw biometric data never leaves the home; optional Local-Only Mode for users needing maximum privacy."
2. **Doc 05 §3 (canonical):** "Raw biometric signals never leave your device. Only state events sync, to enable the morning check across devices."
3. **`01_system_architecture.md` §6:** "Raw CSI never leaves the sensing-server process. Vitals frames never leave the browser."
4. **ADR-005 §Consequences (Positive):** "raw CSI lives in the sensing-server's RAM, vitals frames live in the browser's RAM, only state labels and affirmation IDs cross the cloud link."
5. **ADR-007 §Consequences (Positive):** "only state labels and affirmation IDs cross the cloud link. No raw vitals, no user-typed text, no PII."
6. **Memory DDD Invariants 1–4:** matches ADR-007 verbatim — no raw vitals, no whats_alive, hardcoded user_id, Always-Local kill switch.
7. **Plan `S6-B2-T4`:** quotes doc 05 §3 verbatim as the privacy footer.

**Drift found:**

- **Three different phrasings** of the privacy promise across docs 01-problem / 05-canonical / 01-system-architecture. This is mostly forgivable — they all say substantively the same thing. The plan correctly pins to doc-05 phrasing (canonical).
- **Doc 01 promises an "optional Local-Only Mode"** — the plan §15 explicitly excludes it; Memory DDD makes it an aggregate invariant; ADR-011 makes it a stretch upgrade; ADR-007 omits it entirely. This is the contradiction in Critical Issue #7.
- **System architecture §6 says "vitals frames never leave the browser"** but the architecture diagram (the same doc, §3) shows arrows from Browser to Cloud. This is reconciled only by the data classification table in doc 05 §3 — which the system architecture doc doesn't reference. **Fix:** in system-arch §6, either link doc 05 §3 explicitly or add the data-classification table inline.

**Net verdict:** the privacy *behaviour* is consistent across ADR-007 + Memory DDD + plan. The privacy *language* drifts. For the demo and the rubric (Problem Clarity), what matters is that the doc 05 phrasing is the verbatim site footer (`S6-B2-T4`) and the verbatim demo voice-over (doc 05 §11 line 377). Both pin to doc 05. ✅

---

# 9. Demo-Script Buildability

For each of the 6 beats in doc 05 §11, verifying the corresponding code is scheduled before Day 7:

| Beat | Doc 05 line | Code required | Plan task | Day | Verdict |
|---|---|---|---|---|---|
| 0:00–0:12 voiceover | L372 | None (voice over still room) | n/a | n/a | ✅ |
| 0:12–0:25 sensor reveal | L373 | Heltec board photo + working firmware | `S6-B3-T4` (sensor wiring photo); `S4-B1-T1` (flash) | Day 4, Day 6 | ✅ |
| 0:25–0:50 live REGULATED→ACTIVATED | L374 | StateBadge live, classifier emitting transitions, AffirmationCard with cyclic-sigh | `S4-B2-T5`, `S4-B2-T4`, `S5-B1-T3`, `S5-B1-T2` | Day 4 / 5 | ✅ |
| 0:50–1:10 recovery trace | L375 | StateBadge to RECOVERING, `recovering` affirmation, BreathGuide extended-exhale | `S4-B3-T3` (recovery detector), `S5-B1-T5` (BreathGuide) | Day 4 / 5 | ✅ |
| **1:10–1:35 MORNING CHECK** | L376 | `MorningCheckCard` rendering 3-panel comparison; pre-seeded yesterday rows; `?dev=1` force-trigger button for retake | `S5-B2-T3` (MorningCheckCard), `S5-B4-T3` (pre-seed IDB), `S5-B3-T2` (`?dev=1`), `S4-B3-T5` (morning_check detector) | Day 4 / 5 | ✅ — **but tight; this is the strongest beat and depends on 4 tasks completing on Day 5.** Day-5 EOD freeze check explicitly names this. |
| 1:35–1:55 privacy + Supabase | L377 | Privacy footer; Supabase row insert visible in DevTools | `S6-B2-T4` (footer); `S6-B1-T4` (Supabase wiring) | Day 6 | ✅ |
| 1:55–2:00 close | L378 | None | n/a | n/a | ✅ |

**Net:** all 6 beats are buildable before Day 7. The MorningCheckCard chain is the riskiest (4 tasks on Day 5, all serially dependent through `S5-B2-T3`). If Day 5 slips, Day 7 demo loses its strongest beat. **Recommendation:** front-load `S5-B2-T1..T3` (move to Block 1 of Day 5 if possible — they currently sit in Block 2 starting 11:00). This would buy a 2-hour buffer.

---

# 10. Recommended Course of Action

1. **Today, before Block 2:** patch the implementation plan §1 header (lines 9–10) and the three duplicated ADR-write tasks (`S3-B1-T2`, `S3-B1-T3`, `S6-B4-T2`). 10 minutes. Reclaims ~70 minutes today.
2. **Today, in parallel with build gate:** rename the four broken ADR-link filenames in the four DDD files. 5 minutes.
3. **Today, in parallel with build gate:** delete State DDD's "1 s evidence" rule (Ubiquitous Language line 24, Invariants §2, Aggregate §1). 5 minutes.
4. **Today, after Block 1:** add a Status banner to `01_system_architecture.md` flagging §1 and §7 as partially superseded by doc 05. 5 minutes.
5. **Today (15-min ADR):** write ADR-017 (Always-Local Mode V1 stub vs UI-deferred) to resolve the plan §15 vs Memory DDD contradiction.
6. **Day 4 morning:** write the three short missing-decision ADRs — ADR-013 (No Tauri), ADR-014 (cargo `--no-default-features`), ADR-015 (`?source=recorded` first-class). Each ≤15 lines.
7. **Day 5 morning, before Block 1:** add `S5-B2-T5` for `tests/memory/sessionStore.spec.ts`; update plan §13 + §14 DoD count to 6 tests.
8. **Day 5, end of day:** front-load `S5-B2-T1..T3` to Block 1 to buy buffer for the MorningCheckCard chain.

---

# 11. What to Do RIGHT NOW (Day 3, while build gate runs)

1. **Open `docs/plan/implementation-plan.md` and patch §1 header lines 9–10** to list ADRs 005–011 as already in `docs/adr/`. Strike `S3-B1-T2`, `S3-B1-T3`, `S6-B4-T2` re-write tasks; replace with verify-status tasks.
2. **Run a `sed`-style search-and-replace across `docs/ddd/*.md`** for the four broken ADR filenames. (Sensing→`ADR-008-port-and-path-locked.md`; State+Intervention→`ADR-010-three-state-breath-trajectory-classifier.md`; Memory→`ADR-011-stretch-auth-and-rls.md`.)
3. **Edit `docs/ddd/02_state_context.md` Invariants §2 and Ubiquitous Language `debounce` line** to remove the invented "1 s evidence" rule. Replace with: "Transitions debounced by the 5-second minimum-dwell rule plus the entry-condition window (60 s for activated, 30 s for recovering)."
4. **Add a Status banner to the top of `docs/05_architecture/01_system_architecture.md`:** "Partially superseded by `docs/02_research/05_canonical_build_plan.md` v3 (2026-04-26). §1 retains 4-state vocabulary for historical context; §7 source layout includes V0 files now cut. See doc 05 §1 v3 amendment for the V1 cut list."
5. **Write ADR-017 (Always-Local Mode, V1 stub).** Decision: V1 ships `MemoryAPI.isAlwaysLocal()` returning `false`; the toggle UI is post-buildathon. Rationale: resolves contradiction between plan §15 (excludes UI) and Memory DDD (treats it as aggregate). 15 minutes.
6. **Author the placeholder `affirmations.json`** (12 entries, 4 per state, modalities `breath`/`witness`/`anchor`) and commit it to a `web-app/src/data/affirmations.placeholder.json` so Gate G5-corpus has a non-empty fallback. 30–45 minutes — but uses no build infrastructure, so it's pure parallel work to the cargo build.

None of these six items requires the build gate's verdict; all are pure-doc or pure-data edits. Total time: ~90 minutes if done back-to-back, ~120 minutes with quality re-reads. The plan reclaims more time than this list costs.

---

*End of audit. Doc 05 remains the source of truth; everywhere this audit names a contradiction, the resolution is "doc 05 wins on the *what*, and one of the swarm-output files needs to follow."*
