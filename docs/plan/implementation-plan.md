# MindRefreshStudio — Implementation Plan (Days 3–8)

## 1. Header & Status

- **Today:** Sun Apr 26 2026. Build Day 3 of 8.
- **Submission deadline:** Fri May 1 @ 3:00 PM ET (hard). Personal target: 12:00 PM ET (3-hour buffer).
- **Working build days remaining:** 4 (Days 3–6). Day 7 = demo + write-up. Day 8 morning = buffer + submit.
- **Source of truth:** `docs/02_research/05_canonical_build_plan.md` (v3, post-V1-cuts). This implementation plan operationalises that doc; if the two ever disagree, doc 05 wins on *what*, this doc wins on *when*.
- **ADRs in `docs/adr/`:** ADR-005 (two-link architecture), ADR-006 (HRV out of V1), ADR-007 (Supabase V1 simplified), ADR-008 (port and path locked), ADR-009 (build verdict — **Accepted, Outcome A — PASS**), ADR-010 (3-state classifier), ADR-011 (auth + RLS — **Deferred — post-buildathon**).
- **DDD bounded contexts:** `docs/ddd/01_sensing_context.md`, `02_state_context.md`, `03_intervention_context.md`, `04_memory_context.md` — all written.
- **Builder:** solo.
- **Repo state at plan time:** scaffold not yet stood up; no `web-app/` directory; sensing-server build verified; ADRs 005–011 in `docs/adr/`.

## 2. Methodology — Ruv SPARC + DDD + TDD-London

This plan executes Ruv SPARC per feature: **S**pecification (already done in doc 05), **P**seudocode (captured here as task IDs and exit criteria), **A**rchitecture (DDD bounded contexts: `Sensing`, `State`, `Intervention`, `Memory`), **R**efinement (London-school TDD — every cross-context call mocked at the contract boundary; the 5 mock-first tests in §13 are the spine), **C**ompletion (wire and ship). Every load-bearing decision lands in an ADR; every task touches exactly one bounded context or is wiring. "1 message = all related operations" governs file reads, file edits, and any parallel sub-agent spawning. Solo builder, so no swarm spawning is required for delivery — but the discipline of batched edits and mock-first tests still applies.

## 3. Sprint Structure

Four sprints — one per build day (Days 3, 4, 5, 6). Each sprint declares **one** sprint goal, **one** measurable exit criterion, the rubric dimension(s) it moves, a morning standup, ≤ 4 work blocks of ≤ 2 hours each, and an EOD feature-freeze check. Tasks are atomic (≤ 45 min unit), verb-first, with dependencies on prior task IDs. Every task names the DDD context it touches and the ADR it implements (or `n/a — refinement` / `n/a — wiring`). Test files are co-located under `web-app/tests/` per `01_initial/02_buildathon.md` rubric and CLAUDE.md `/tests` rule.

Task ID convention: `S{day}-B{block}-T{n}` — e.g. `S3-B1-T1` is Sprint Day 3, Block 1, Task 1.

---

## 4. Day 3 — Sun Apr 26 (today, in-progress)

**SPRINT GOAL:** Foundation locked — ADRs accepted, sensing-server build gate run, scaffold deployed to Vercel, 5 mock-first contract tests scaffolded and runnable without hardware.

**EXIT CRITERION:** `https://mindrefresh-studio.vercel.app/` serves a hello-world; ADR-007 and ADR-008 in `docs/adr/` with `Status: Accepted`; ADR-009 closed with Outcome A (build passed) **or** Outcome B (recorded-fixture-only pivot logged); `pnpm test` runs and reports 5 spec files (any pass/fail mix is acceptable today, but all 5 must execute).

**RUBRIC FOCUS:** Problem & Solution Clarity (ADRs as written rationale); Functionality (build gate is the make-or-break risk).

**MORNING STANDUP:**
- Yesterday: doc 05 v3 written; doc 03 superseded; ADRs 005/006/009/010 already in `docs/adr/`.
- Today: write ADR-007 + ADR-008; run sensing-server build gate; scaffold `web-app/`; deploy hello-world; write 5 mock-first tests against typed contracts.
- Blockers: none yet — sensing-server build is the only unknown.

### Block 1 — 09:00–10:30 (ADRs + build gate, parallel where possible)

The build gate dominates the day; kick it off first because `cargo build` may take 15+ minutes on a cold workspace. Write ADRs in parallel with the build running.

| ID | Task | Time | Pred | Context | ADR | Test |
|---|---|---|---|---|---|---|
| `S3-B1-T1` | Run `cargo build -p wifi-densepose-sensing-server --no-default-features` from `upstream/RuView/v2/`; capture stdout/stderr to `docs/adr/build-gate-day3.log`. | 30m (background) | — | Sensing | implements ADR-009 | n/a — wiring |
| `S3-B1-T2` | Verify ADR-007 status `Accepted` and content matches doc 05 §8 (already written by swarm). 5 min skim. | 5m | — | n/a | ADR-007 | n/a — wiring |
| `S3-B1-T3` | Verify ADR-008 status `Accepted` and the cited `cli.rs`/`main.rs` line numbers still match upstream HEAD (already written by swarm). 5 min skim. | 5m | — | Sensing | ADR-008 | n/a — wiring |
| `S3-B1-T4` | Close ADR-009: append "Outcome A — build passed at SHA `<sha>`" or "Outcome B — pivot to recorded-fixture-only path; remove live `?source=live` from demo URL". | 10m | `S3-B1-T1` | Sensing | ADR-009 | n/a — wiring |
| `S3-B1-T5` | Banner doc 03 "superseded by doc 05" if not already done; verify no other docs reference port 8000 (grep). | 15m | — | n/a | n/a — refinement | n/a |

### Block 2 — 10:30–12:30 (scaffold + Vercel hello-world)

Scaffold uses the directory layout already specified in `docs/05_architecture/01_system_architecture.md` §7. No invention; we are populating the published shape.

| ID | Task | Time | Pred | Context | ADR | Test |
|---|---|---|---|---|---|---|
| `S3-B2-T1` | `pnpm create vite web-app -- --template react-ts` from repo root; commit. | 20m | — | n/a | n/a — wiring | n/a |
| `S3-B2-T2` | Add Tailwind + shadcn/ui + lucide-react + `@tanstack/react-query` + `react-router-dom`; verify `pnpm dev` serves localhost:5173. | 40m | `S3-B2-T1` | n/a | n/a — wiring | n/a |
| `S3-B2-T3` | Create empty directories per `docs/05_architecture/01_system_architecture.md` §7: `src/{pages,components,contexts,services,data,types,hooks,workers}` and `tests/{sensing,state,triggers,intervention,memory}`. | 15m | `S3-B2-T2` | all | n/a — wiring | n/a |
| `S3-B2-T4` | Create `src/pages/Landing.tsx` with the somatic narrative hero (title + 1 line + privacy promise from `01_initial/01_problem.md`); wire to `/` route. | 30m | `S3-B2-T3` | n/a | n/a — wiring | n/a |
| `S3-B2-T5` | Connect Vercel; deploy `main`; verify `https://mindrefresh-studio.vercel.app/` returns 200 with the hero. | 30m | `S3-B2-T4` | n/a | n/a — wiring | n/a |

### Block 3 — 13:30–15:30 (typed contracts + WS client + worker skeleton)

The five tests in §13 must be writable today. To make them writable, the contracts they assert must exist as TypeScript types (not implementations). Write the types first, then the skeleton, then the tests.

| ID | Task | Time | Pred | Context | ADR | Test |
|---|---|---|---|---|---|---|
| `S3-B3-T1` | Write `src/types/vitals.ts` (`VitalsFrame { ts, breathBpm?, hrBpm?, presence, motionBandPower, source }`); export. | 15m | `S3-B2-T3` | Sensing | implements ADR-005 | n/a — wiring |
| `S3-B3-T2` | Write `src/types/state.ts` (`State = 'regulated'\|'activated'\|'recovering'`; `StateTransition`). | 10m | `S3-B2-T3` | State | implements ADR-010 | n/a — wiring |
| `S3-B3-T3` | Write `src/types/intervention.ts` (`Affirmation`, `BreathPattern`, `TriggerEvent` per doc 05 §6 postMessage contract). | 15m | `S3-B2-T3` | Intervention | implements ADR-005 | n/a — wiring |
| `S3-B3-T4` | Write `src/services/wsClient.ts` skeleton — exports `subscribe(cb): Unsubscribe`; opens WS at `ws://localhost:8765/ws/sensing`; parses JSON to `VitalsFrame`. No reconnect logic yet. | 45m | `S3-B3-T1` | Sensing | ADR-008 | covered by `S3-B4-T1` |
| `S3-B3-T5` | Write `src/workers/triggerWorker.ts` skeleton — registers `onmessage`; echoes `{kind:'state_transition'}` on every inbound `vitals` (placeholder; classifier comes Day 4). | 30m | `S3-B3-T2`, `S3-B3-T3` | State | ADR-005 | covered by `S4-B2-T*` |
| `S3-B3-T6` | Wire `App.tsx` to construct the worker and the WS client; postMessage smoke test (mock socket emits one frame; worker echoes; main console-logs). | 30m | `S3-B3-T4`, `S3-B3-T5` | wiring | n/a | n/a |

### Block 4 — 16:00–18:00 (5 mock-first contract tests)

All 5 tests writable today because each mocks at the contract boundary. None require a running sensing-server. Order matches §13 (dependency-free → dependency-leaf).

| ID | Task | Time | Pred | Context | ADR | Test |
|---|---|---|---|---|---|---|
| `S3-B4-T1` | Install Vitest + `fake-indexeddb` + `mock-socket`; configure `vitest.config.ts` and a single CI script `pnpm test`. | 30m | `S3-B2-T2` | n/a | n/a — wiring | n/a |
| `S3-B4-T2` | Write `tests/sensing/vitalsRingBuffer.spec.ts` — pure function; rolling mean + slope; eviction at capacity. | 30m | `S3-B4-T1` | Sensing | n/a — refinement | this file |
| `S3-B4-T3` | Write `tests/sensing/wsClient.spec.ts` — mocks `WebSocket` global with `mock-socket`; asserts URL = `ws://localhost:8765/ws/sensing`; emits canned `SensingUpdate`; subscriber receives parsed `VitalsFrame`. | 45m | `S3-B4-T1`, `S3-B3-T4` | Sensing | ADR-008 | this file |
| `S3-B4-T4` | Write `tests/state/stateRules.spec.ts` — fake timers; asserts `regulated→activated` after 60 s of breath > 14 BPM rising; `activated→recovering` after 30 s descent > 0.5 BPM/min; 5 s debounce. | 45m | `S3-B4-T1` | State | ADR-010 | this file |
| `S3-B4-T5` | Write `tests/triggers/morningCheck.spec.ts` — fake-indexeddb seeded with yesterday's transitions; fake timers; `morning_check` fires when last presence > 6 h ago + new presence; payload contains `yesterdayCount`, `lastEventTs`, `todayBaseline`, `regulatedBaseline`. | 45m | `S3-B4-T1` | State + Memory | ADR-005 | this file |
| `S3-B4-T6` | Write `tests/intervention/affirmationFilter.spec.ts` — seeded `Math.random`; fixture corpus; given `state='activated'` returns one activated entry; excludes last 5 shown. | 30m | `S3-B4-T1` | Intervention | n/a — refinement | this file |

**EOD FEATURE-FREEZE CHECK (Day 3):** Hello-world live; ADR-007 + ADR-008 + ADR-009 all `Accepted`; `pnpm test` lists 5 specs and runs to completion. If any of these are not true at 19:00, work continues until they are — the rest of the plan presupposes them.

---

## 5. Day 4 — Mon Apr 27

**SPRINT GOAL:** Live signal end-to-end — ESP32 → sensing-server → SPA renders breath rate; classifier emits state transitions; 5 trigger detectors live; recorded-fixture path captured.

**EXIT CRITERION:** A judge would see breath rising on the `StateBadge` within 30 s of opening the app while a real human breathes near the sensor; calibration RMSE ≤ 2 BPM against manual count over a 5-min sit; `state_transition` events visible in React Devtools as the human relaxes; `web-app/fixtures/recorded-csi-session.jsonl` exists and ≥ 5 min long.

**RUBRIC FOCUS:** Functionality, Technical Complexity.

**MORNING STANDUP:**
- Yesterday: scaffold + ADRs + 5 tests scaffolded.
- Today: flash ESP32; bring up live WS feed; implement 3-state classifier; implement 5 detectors incl. `morning_check`; calibrate; capture fixture.
- Blockers: only the build gate's outcome — covered.

### Block 1 — 09:00–11:00 (hardware bring-up)

| ID | Task | Time | Pred | Context | ADR | Test |
|---|---|---|---|---|---|---|
| `S4-B1-T1` | Flash Heltec V3 with RuView CSI firmware via Docker `espressif/idf:v5.2`; provision against home WiFi (SSID + PSK). | 60m | `S3-B1-T4` Outcome A | Sensing | n/a — wiring | n/a |
| `S4-B1-T2` | Confirm UDP CSI frames arriving on host port 5005 via `tcpdump -i any udp port 5005`. | 20m | `S4-B1-T1` | Sensing | ADR-008 | n/a — wiring |
| `S4-B1-T3` | Run sensing-server release build (`cargo run -p wifi-densepose-sensing-server --no-default-features`); confirm WS feed at `ws://localhost:8765/ws/sensing` carries `breathing_rate_bpm`. | 30m | `S4-B1-T2` | Sensing | ADR-008 | n/a — wiring |
| `S4-B1-T4` | Wire `wsClient` to live WS in dev; confirm `VitalsFrame` updates flow into the worker; render breath rate in a 30 px debug strip on `Landing.tsx`. | 30m | `S4-B1-T3`, `S3-B3-T6` | Sensing | ADR-005 | n/a — wiring |

### Block 2 — 11:00–13:00 (3-state classifier)

| ID | Task | Time | Pred | Context | ADR | Test |
|---|---|---|---|---|---|---|
| `S4-B2-T1` | Implement `src/services/vitalsRingBuffer.ts` for 60 s window with `mean()`, `slope()`, `dwellSince(state)`; make `S3-B4-T2` go green. | 45m | `S3-B4-T2` | Sensing | n/a — refinement | `vitalsRingBuffer.spec.ts` |
| `S4-B2-T2` | Write `src/data/stateRules.json` with thresholds from doc 05 §4 (regulated 8–14 BPM flat/desc; activated > 14 rising 1 BPM/min; recovering desc 0.5 BPM/min). | 20m | — | State | ADR-010 | n/a — data |
| `S4-B2-T3` | Implement `src/workers/stateRules.ts` — pure classifier over a `VitalsRingBuffer` + `stateRules.json`; 5 s debounce; make `S3-B4-T4` go green. | 45m | `S4-B2-T1`, `S4-B2-T2` | State | ADR-010 | `stateRules.spec.ts` |
| `S4-B2-T4` | Wire classifier into `triggerWorker.ts`; replace echo-stub from `S3-B3-T5`; emit `state_transition` events on real transitions. | 30m | `S4-B2-T3` | State | ADR-005 | n/a — wiring |
| `S4-B2-T5` | Build `src/components/dashboard/StateBadge.tsx`; subscribe to worker events; render current state in dashboard view. | 30m | `S4-B2-T4` | State | n/a — refinement | n/a — UI |

### Block 3 — 14:00–16:00 (5 trigger detectors incl. morning_check)

| ID | Task | Time | Pred | Context | ADR | Test |
|---|---|---|---|---|---|---|
| `S4-B3-T1` | Implement `src/workers/triggerDetectors.ts:acuteSpike` — > 4 BPM rise in 30 s. | 25m | `S4-B2-T1` | State | n/a — refinement | unit test inline |
| `S4-B3-T2` | Implement `triggerDetectors.ts:slowDrift` — > 1 BPM/min for 10 min. | 25m | `S4-B2-T1` | State | n/a — refinement | unit test inline |
| `S4-B3-T3` | Implement `triggerDetectors.ts:recovery` — > 0.5 BPM/min descent for 30 s after `activated`. | 25m | `S4-B2-T1` | State | n/a — refinement | unit test inline |
| `S4-B3-T4` | Implement `triggerDetectors.ts:manual` — flag set by main thread on `I need a moment` tap. | 15m | — | State | n/a — refinement | n/a |
| `S4-B3-T5` | Implement `triggerDetectors.ts:morningCheck` — IndexedDB query for last presence; > 6 h gap; emit `morning_check` with `morningPayload`; make `S3-B4-T5` go green. | 45m | `S4-B2-T1` | State + Memory | ADR-005 | `morningCheck.spec.ts` |
| `S4-B3-T6` | Wire all 5 detectors into `triggerWorker.ts`; confirm each emits to main thread; console-log smoke test. | 20m | `S4-B3-T1..T5` | State | ADR-005 | n/a — wiring |

### Block 4 — 16:00–18:00 (calibration + fixture capture)

| ID | Task | Time | Pred | Context | ADR | Test |
|---|---|---|---|---|---|---|
| `S4-B4-T1` | Sit still with stopwatch, count breaths for 5 min, record sensing-server `breathing_rate_bpm` to CSV; compute RMSE. | 45m | `S4-B1-T4` | Sensing | n/a — refinement | n/a |
| `S4-B4-T2` | Decision gate: if RMSE ≤ 2 BPM, lock sensor placement and proceed; if 2 < RMSE ≤ 4 BPM, retune placement (move sensor 1–2 m closer; remove obstructions; rerun). | 30m | `S4-B4-T1` | Sensing | n/a — refinement | n/a |
| `S4-B4-T3` | Write `scripts/record-ws.mjs` — connect to WS, append every frame to `web-app/fixtures/recorded-csi-session.jsonl` for 5 min covering at least one regulated → activated → recovering arc. | 30m | `S4-B1-T3` | Sensing | n/a — wiring | n/a |
| `S4-B4-T4` | Run capture; verify ≥ 300 frames; verify at least one `state_transition` would fire when replayed. | 30m | `S4-B4-T3`, `S4-B2-T4` | Sensing + State | n/a — wiring | n/a |

**EOD FEATURE-FREEZE CHECK (Day 4):** `pnpm test` shows the 4 spec files written through today (`vitalsRingBuffer`, `wsClient`, `stateRules`, `morningCheck`) green; `affirmationFilter` still green from Day 3 fixture; live demo URL renders the StateBadge with breath driving transitions in real time; `recorded-csi-session.jsonl` committed.

---

## 6. Day 5 — Tue Apr 28

**SPRINT GOAL:** Visible product — affirmations rendered, BreathGuide animated by live breath, MorningCheckCard live, recorded fixture playback path live, IndexedDB session store wired.

**EXIT CRITERION:** A judge could open `https://mindrefresh-studio.vercel.app/?source=recorded` (no laptop, no sensor) and watch a complete arc: regulated → activated → cyclic-sigh affirmation appears → recovering → MorningCheckCard appears in a "next session" mode, all from the captured fixture.

**RUBRIC FOCUS:** UI/UX, Inspiration Factor (the morning_check moment is the single highest-leverage visual).

**MORNING STANDUP:**
- Yesterday: live signal, classifier, 5 detectors, fixture captured.
- Today: drop in `affirmations.json`; build BreathGuide + AffirmationCard + MorningCheckCard; wire IndexedDB; wire `?source=recorded` flag.
- Blockers: user-supplied corpus may not have arrived — placeholder corpus ready.

### Block 1 — 09:00–11:00 (affirmation pipeline + BreathGuide)

| ID | Task | Time | Pred | Context | ADR | Test |
|---|---|---|---|---|---|---|
| `S5-B1-T1` | If user-supplied corpus arrived: drop into `src/data/affirmations.json`. Else: ship 12-entry placeholder (4 per state) covering modalities `breath / witness / anchor`. | 30m | — | Intervention | n/a — data | seeded by `affirmationFilter.spec.ts` |
| `S5-B1-T2` | Write `src/services/affirmationFilter.ts` — pure function; filter by state, exclude last 5 shown, random pick; make `S3-B4-T6` green. | 30m | `S5-B1-T1` | Intervention | n/a — refinement | `affirmationFilter.spec.ts` |
| `S5-B1-T3` | Port `AffirmationCard.tsx` from `upstream/mind-refresh-05/src/components/result/AffirmationCard.tsx`; drop scripture/reference fields; keep opacity/translate-y/scale animation. | 45m | `S3-B2-T3` | Intervention | n/a — wiring | n/a — UI |
| `S5-B1-T4` | Write `src/data/breathPatterns.json` — `natural`, `cyclic_sigh`, `extended_exhale` per doc 05 §7. | 15m | — | Intervention | n/a — data | n/a |
| `S5-B1-T5` | Build `src/components/intervention/BreathGuide.tsx` — Tailwind keyframe circle paced by `breathing_rate_bpm` for `regulated`, fixed `cyclic_sigh` cadence for `activated`, 4-in/6-out for `recovering`. | 45m | `S5-B1-T4` | Intervention | n/a — refinement | n/a — UI |

### Block 2 — 11:00–13:00 (Memory context + MorningCheckCard)

| ID | Task | Time | Pred | Context | ADR | Test |
|---|---|---|---|---|---|---|
| `S5-B2-T1` | Write `src/services/sessionStore.ts` (IndexedDB wrapper per Memory DDD): `appendTransition()`, `appendIntervention()`, `appendWhatsAlive()`, `getTransitionsSince(ts)`, `getLastPresence()`, `recentAffirmationIds()`. | 60m | `S3-B2-T3` | Memory | implements ADR-005 | covered by `S5-B2-T5` |
| `S5-B2-T2` | Wire `sessionStore.appendTransition()` to fire on every `state_transition` from worker. | 20m | `S5-B2-T1`, `S4-B2-T4` | Memory | ADR-005 | n/a — wiring |
| `S5-B2-T3` | Write `src/services/morningCheckQuery.ts` (Memory DDD anti-corruption layer) — merges IDB rows + Supabase rows by client-minted UUID into a unified `MorningRow[]` for the State worker; canonical site that translates Supabase snake_case to internal value objects. | 45m | `S5-B2-T1`, `S6-B1-T3` (deferred wire — IDB-only fallback works without Supabase) | Memory | ADR-005, ADR-007 | covered by `S3-B4-T5` mock layer |
| `S5-B2-T4` | Build `src/components/dashboard/MorningCheckCard.tsx` — 3 panels (yesterday count, today's baseline vs. regulated, one matched affirmation); subscribes to `morning_check` trigger; reads payload directly (Intervention DDD: no re-query). | 60m | `S4-B3-T5`, `S5-B1-T2`, `S5-B2-T3` | Intervention + Memory | ADR-005 | n/a — UI |
| `S5-B2-T5` | Write `tests/memory/sessionStore.spec.ts` (Memory DDD §Tests) — structural privacy invariants — only `*.supabase.co` + `mailto:` calls; no raw vitals series; no user-typed text to Supabase. | 30m | `S5-B2-T1`, `S5-B2-T2` | Memory | ADR-007 | this file (the 6th spec) |
| `S5-B2-T6` | Add CTA "I'd like to talk about it" — opens free-form text box; write to IndexedDB only (no Supabase per ADR-007). | 25m | `S5-B2-T4` | Memory | ADR-007 | n/a — wiring |

### Block 3 — 14:00–16:00 (recorded fixture playback + dashboard polish)

| ID | Task | Time | Pred | Context | ADR | Test |
|---|---|---|---|---|---|---|
| `S5-B3-T1` | Implement `?source=recorded` query flag in `wsClient.ts` — when present, fetch `fixtures/recorded-csi-session.jsonl` and replay frames at original cadence. | 45m | `S4-B4-T4` | Sensing | n/a — refinement | extend `wsClient.spec.ts` |
| `S5-B3-T2` | Implement `?dev=1` query flag — reveal a "force morning_check" button that calls the trigger directly with a synthetic payload (for live-demo iteration on Day 7). | 25m | `S4-B3-T5` | wiring | n/a | n/a |
| `S5-B3-T3` | Build `src/pages/Dashboard.tsx` — composes `StateBadge`, `BreathGuide`, `AffirmationCard`, `MorningCheckCard`, plus a 60 s breath sparkline. | 60m | `S4-B2-T5`, `S5-B1-T3`, `S5-B1-T5`, `S5-B2-T3` | wiring | n/a | n/a — UI |
| `S5-B3-T4` | Wire main-thread orchestrator: on `state_transition` or `trigger`, call `affirmationFilter`, render `AffirmationCard`. | 30m | `S5-B1-T2`, `S5-B3-T3` | Intervention | ADR-005 | n/a — wiring |

### Block 4 — 16:00–18:00 (smoke + commit)

| ID | Task | Time | Pred | Context | ADR | Test |
|---|---|---|---|---|---|---|
| `S5-B4-T1` | End-to-end smoke (live): connect ESP32, sit, breathe, accelerate breath, watch arc render; capture screenshots for the demo write-up. | 45m | `S5-B3-T4`, `S4-B4-T2` | all | n/a | n/a |
| `S5-B4-T2` | End-to-end smoke (recorded): close laptop's sensor; open `https://mindrefresh-studio.vercel.app/?source=recorded`; verify same arc plays. | 30m | `S5-B3-T1` | Sensing | n/a | n/a |
| `S5-B4-T3` | Pre-seed IndexedDB demo data so a fresh-browser visitor sees a non-trivial `MorningCheckCard` (4 yesterday transitions, last at 23:38). | 30m | `S5-B2-T1` | Memory | ADR-007 | n/a — data |
| `S5-B4-T4` | Commit; push; verify Vercel deploy of `?source=recorded` works in incognito. | 15m | `S5-B4-T2`, `S5-B4-T3` | wiring | n/a | n/a |

**EOD FEATURE-FREEZE CHECK (Day 5):** Recorded URL works in incognito on a stranger's machine; live URL works with sensor; `MorningCheckCard` renders non-trivially on first visit; all 5 spec files green.

---

## 7. Day 6 — Wed Apr 29 (FEATURE FREEZE EOD)

**SPRINT GOAL:** Cloud + polish — Supabase persists state events, cross-browser pass clean, README + sensing-server release binary published, security scan clean.

**EXIT CRITERION:** Submission checklist (doc 05 §11, 10 items) is ≥ 80% complete; only the demo video and the final write-up remain. No new features pass midnight.

**RUBRIC FOCUS:** Functionality (cross-browser), Business Potential (Supabase architecture proof), UI/UX (polish pass).

**MORNING STANDUP:**
- Yesterday: full UX rendered live + recorded.
- Today: Supabase wiring; Trusted Witness; cross-browser pass; release binary; README; security scan; consider ADR-011 only if 2+ hours slack at 18:00.
- Blockers: Supabase project provisioning (15 min, not on critical path).

### Block 1 — 09:00–11:00 (Supabase 2-table)

| ID | Task | Time | Pred | Context | ADR | Test |
|---|---|---|---|---|---|---|
| `S6-B1-T1` | Provision Supabase project; copy `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` to `.env.local` and Vercel env. | 30m | — | Memory | ADR-007 | n/a — wiring |
| `S6-B1-T2` | Run migration `supabase/migrations/0001_v1_two_tables.sql` per doc 05 §8 (state_transitions + interventions; index by `(user_id, ts desc)`; RLS DISABLED). | 30m | `S6-B1-T1` | Memory | ADR-007 | n/a — wiring |
| `S6-B1-T3` | Write `src/services/cloudSync.ts` — supabase-js anon client; `insertTransition()`, `insertIntervention()`; hardcoded `USER_ID = 'demo-user-001'`. | 45m | `S6-B1-T2` | Memory | ADR-007 | inline mock-supabase test |
| `S6-B1-T4` | Wire `cloudSync.insertTransition()` to fire alongside `sessionStore.appendTransition()` on every state event. Wire `cloudSync.insertIntervention()` on every affirmation render. | 25m | `S6-B1-T3`, `S5-B2-T2`, `S5-B3-T4` | Memory | ADR-007 | n/a — wiring |

### Block 2 — 11:00–13:00 (Trusted Witness + cross-browser)

| ID | Task | Time | Pred | Context | ADR | Test |
|---|---|---|---|---|---|---|
| `S6-B2-T1` | Build `src/components/dashboard/TrustedWitnessButton.tsx` — `mailto:` with pre-canned subject and body; opens device's default mail handler. | 30m | `S5-B3-T3` | wiring | n/a | n/a — UI |
| `S6-B2-T2` | Cross-browser pass: Chrome desktop, Safari desktop, Firefox desktop. Note any layout breaks; fix the worst 3. | 60m | `S6-B1-T4` | wiring | n/a | n/a |
| `S6-B2-T3` | Mobile-viewport pass: iPhone 13 width in DevTools; `MorningCheckCard` legible without scroll; `BreathGuide` doesn't overflow. | 30m | `S6-B2-T2` | wiring | n/a | n/a — UI |
| `S6-B2-T4` | Add privacy footer to all pages quoting doc 05 §3 verbatim ("Raw biometric signals never leave your device. Only state events sync, to enable the morning check across devices."). | 15m | — | wiring | ADR-007 | n/a |

### Block 3 — 14:00–16:00 (release binary + README)

| ID | Task | Time | Pred | Context | ADR | Test |
|---|---|---|---|---|---|---|
| `S6-B3-T1` | `cargo build --release -p wifi-densepose-sensing-server --no-default-features` from `upstream/RuView/v2/`; tag `v0.1.0-mindrefresh`; create GitHub Release; upload `wifi-densepose-sensing-server-macos-arm64` artefact. | 45m | `S3-B1-T1` Outcome A | Sensing | n/a — wiring | n/a |
| `S6-B3-T2` | Write `README.md` quickstart: live URL, `?source=recorded` URL, sensor wiring photo, release binary URL, build command, license (MIT), RuView attribution paragraph, privacy promise; explicit "Live mode requires macOS arm64 with the released binary; all other platforms use `?source=recorded`" sub-section under §Limitations. | 60m | `S6-B3-T1`, `S6-B2-T4` | n/a | n/a — wiring | n/a |
| `S6-B3-T3` | Add `LICENSE` (MIT). | 5m | — | n/a | n/a — wiring | n/a |
| `S6-B3-T4` | Take sensor wiring photo; add to `docs/assets/sensor-wiring.jpg`; reference in README. | 20m | — | n/a | n/a — wiring | n/a |
| `S6-B3-T5` | Run `npx @claude-flow/cli@latest security scan`; address any HIGH findings; document MEDIUM findings as known. | 25m | `S6-B1-T4`, `S6-B3-T2` | n/a | n/a — refinement | n/a |

### Block 4 — 16:00–18:00 (stretch decision + freeze)

| ID | Task | Time | Pred | Context | ADR | Test |
|---|---|---|---|---|---|---|
| `S6-B4-T1` | Decision gate at 16:00: if all blocks above are green AND ≥ 2 hours of slack remain, proceed to `S6-B4-T2`; else skip to `S6-B4-T5`. | 5m | `S6-B3-T5` | n/a | n/a — refinement | n/a |
| `S6-B4-T2` | (Stretch) ADR-011 is now Deferred — do NOT mutate it. Instead, write a new `docs/adr/ADR-018-auth-rls-revival.md` superseding ADR-011 only if all 4 criteria still pass (cross-browser pass; release binary built; ≥2 h slack; morning_check live verified). Otherwise skip to `S6-B4-T5`. | 15m | `S6-B4-T1`=proceed | Memory | ADR-018 (new) | n/a |
| `S6-B4-T3` | (Stretch) Add Supabase magic-link auth UI; gate writes behind `auth.uid()`; write RLS policies. | 90m | `S6-B4-T2` | Memory | ADR-011 | n/a |
| `S6-B4-T4` | (Stretch) Re-test cross-browser; re-take Day 5 screenshots if auth UI changes the demo flow; re-pre-seed Supabase rows for `auth.uid()`. | 30m | `S6-B4-T3` | Memory | ADR-011 | n/a |
| `S6-B4-T5` | If stretch skipped: append "Status: Deferred — V1 ships with hardcoded `user_id`; see ADR-007" to ADR-011 stub. Document the choice in README. | 10m | `S6-B4-T1`=skip | Memory | ADR-011 | n/a |
| `S6-B4-T6` | Final commit; tag `feature-freeze-day6`; push. **No further feature work.** | 15m | `S6-B4-T4` or `S6-B4-T5` | n/a | n/a | n/a |

**EOD FEATURE-FREEZE (midnight Wed Apr 29):** Anything not merged by 23:59 stays out of V1. Days 7–8 are demo + submit only.

---

## 8. Day 7 — Thu Apr 30 (DEMO VIDEO + WRITE-UP — locked)

No code changes. Hour-by-hour:

- **09:00–11:00** Shoot live sensor footage. Real human breathing → activated → cyclic-sigh affirmation → recovering. Then close laptop, open recorded URL on a second device, capture the morning_check moment. Capture 3 takes minimum.
- **11:00–12:30** Rough cut in Loom (or DaVinci Resolve free). Target 90–120 s. Use the script in doc 05 §11 verbatim as voiceover skeleton.
- **12:30–13:30** Voiceover take 1. Recite the doc 05 script.
- **13:30–14:30** Edit pass: titles, fades, captions for the privacy promise at 1:35 and the Supabase note at 1:55. Second voiceover take only if the first fails listen-back.
- **14:30–15:30** Write 400-word write-up (problem / solution / architecture / novelty / RuView credit / future work — HRV, 4-state polyvagal restoration, magic-link auth, HNSW, SONA). Save as `docs/submission/writeup.md` and paste into the form.
- **15:30–17:00** README finalisation; Loom URL + YouTube unlisted backup upload; smoke test the live URL, the `?source=recorded` URL, and the `?dev=1` URL one last time. Verify Supabase rows insert. Verify Vercel deploy is on `main`.
- **EOD** Everything sitting in a `READY TO SUBMIT` folder: video URLs, write-up, GitHub repo URL, live URL, screenshots.

## 9. Day 8 — Fri May 1 (buffer + submit by 12:00 PM ET)

- **09:00–10:00** Incognito smoke test of `https://mindrefresh-studio.vercel.app/` and `?source=recorded` from a phone and a stranger's laptop if available. No code changes. If a critical bug appears, fall back to recorded-only and note it in the write-up.
- **10:00–11:00** Re-watch demo video at 1× and 2×. Caption typo fixes only — no re-shoots.
- **11:00–12:00** Submit via the official form (`form.jotform.com/260761160443047`). 3-hour buffer before 3 PM hard deadline. Screenshot the submission confirmation.
- **12:00 onward** Notify Skool community channel; rest. No further changes.

## 10. Risk Gates & Decision Trees

Each gate names a trigger condition (an observable fact at a checkpoint), a decision criterion (binary, evaluable without ambiguity), and a fallback path (with task IDs).

**Gate G3-build (Day 3, 10:30):** Trigger — `cargo build` from `S3-B1-T1` finishes. Decision — exit code 0 ⇒ Outcome A, take live path; exit code ≠ 0 ⇒ Outcome B, pivot to recorded-fixture-only. Fallback (Outcome B): close ADR-009 with "build failed: <error>"; skip `S4-B1-T1..T3`; capture fixture from a peer's working build OR use synthetic JSONL generated by hand to drive the classifier; `S5-B3-T1` becomes the ONLY ingest path; the demo video shoots `?source=recorded` exclusively; the write-up names the limitation.

**Gate G4-calibration (Day 4, 17:00):** Trigger — `S4-B4-T1` completes. Decision — RMSE ≤ 2 BPM ⇒ pass, lock placement; 2 < RMSE ≤ 4 BPM ⇒ retune once via `S4-B4-T2` and rerun; RMSE > 4 BPM after retune ⇒ degrade to recorded-only at noon Day 5 (skip `S5-B4-T1`; document in README; live demo on Day 7 uses `?source=recorded`).

**Gate G5-corpus (Day 5, 09:00):** Trigger — user-supplied `affirmations.json` arrival. Decision — file in `src/data/` by 09:30 ⇒ wire it; not in by 09:30 ⇒ ship the 12-entry placeholder; swap is a one-file edit and stays available through midnight Day 6.

**Gate G6-supabase (Day 6, 13:00):** Trigger — `S6-B1-T4` complete. Decision — Supabase row insert visible in dashboard ⇒ proceed; insert errors after 30 min of debug ⇒ disable cloudSync via env flag, leave IndexedDB-only path, document in README. Do NOT promote ADR-011 in this scenario.

**Gate G6-stretch (Day 6, 16:00):** Trigger — all of `S6-B1` through `S6-B3` green AND ≥ 2 hours remain. Decision — true ⇒ run `S6-B4-T2..T4` (auth + RLS); false ⇒ run `S6-B4-T5` (defer). Auth + RLS is post-buildathon if ANY of: cross-browser still failing, Supabase rows not yet inserting, README incomplete, security scan flagging HIGH issues.

**Gate G7-video (Day 7, 14:30):** Trigger — first edit pass complete. Decision — video readable + audible at 1×, ≤ 130 s ⇒ ship; otherwise ⇒ ship the rough Loom cut unedited; shipping a rough cut is strictly better than missing the deadline.

**Gate G8-submit (Day 8, 12:00):** Trigger — clock strikes noon ET. Decision — all 14 Definition-of-Done items (§14) true ⇒ submit; not all true ⇒ submit anyway with a 1-paragraph addendum naming the gap. **Partial submission > no submission.**

## 11. Daily Checkpoint Template

Run at the end of each work block (5 minutes max):

1. **What did I just complete?** List the task IDs that crossed the line. Anything still in flight rolls forward with a note.
2. **What's the next un-blocked task?** First task whose predecessors are all complete. If none, the day's plan is done — go to the EOD freeze check.
3. **Am I on or off the sprint goal?** Yes/no. If off: name the gate (G3/G4/G5/G6/G7/G8) the deviation triggers and follow its fallback. Do not improvise outside the gate menu.

Log into a single rolling note `docs/plan/log.md` as one-line entries `<HH:MM> S{day}-B{block}-T{n} done` — that file becomes the audit trail for the write-up.

## 12. Cross-Sprint Concerns

- **Bundle size:** target < 500 KB JS gzipped. V1 cuts (no `@ruvector/*`, no WebGPU, no embeddings) make this easy; check at end of Day 5 with `pnpm build && du -h web-app/dist/assets/*.js`. If > 500 KB, the regression is almost certainly an unused shadcn/ui bulk import.
- **Vercel free-tier:** no concern at this scale. Single project, one branch, < 100 builds.
- **Supabase free-tier auto-pause:** project pauses after 7 days inactivity. Demo window is May 1–3. Document the re-wake step in README §Limitations. Tag the project as active during judging.
- **Live demo machine prereqs (Day 7 shoot, hypothetical Day 8 if asked):** Mac with `wifi-densepose-sensing-server` release binary (from `S6-B3-T1`); ESP32 flashed and powered; Chrome ≥ v120. Keep the binary on a USB stick as a backup.
- **Time discipline:** every block has a hard cap. If a block runs over 30 min, pause, run §11 checkpoint, and decide consciously whether to continue or drop scope. Solo builders fail by stretching, not by cutting.

## 13. The 6 Mock-First Tests (TDD London) — Sequence

5 written Day 3 (Block 4); the 6th (`sessionStore.spec.ts`) written Day 5 in `S5-B2-T5` after the IDB wrapper exists. Each maps to a contract from `docs/05_architecture/01_system_architecture.md` §5 or to a Memory DDD invariant.

| # | File | Contract asserted | Mocked dependency | Earliest sprint |
|---|---|---|---|---|
| 1 | `tests/sensing/vitalsRingBuffer.spec.ts` | 60 s ring buffer; rolling mean + slope; oldest evicted at capacity. | None (pure). | Day 3 (`S3-B4-T2`) |
| 2 | `tests/sensing/wsClient.spec.ts` | `Sensing.subscribe` connects to `ws://localhost:8765/ws/sensing`, parses `SensingUpdate` JSON, exposes `VitalsFrame`. | `WebSocket` (mock-socket) emits canned frames. | Day 3 (`S3-B4-T3`) |
| 3 | `tests/state/stateRules.spec.ts` | `regulated→activated` after sustained 60 s breath > 14 BPM rising; `activated→recovering` after 30 s descent > 0.5 BPM/min; ≥ 5 s debounce. | `Date.now()` (fake timers); ring-buffer feature stub. | Day 3 (`S3-B4-T4`) |
| 4 | `tests/triggers/morningCheck.spec.ts` | `morning_check` fires when last presence > 6 h ago AND new presence; payload contains `yesterdayCount`, `lastEventTs`, `todayBaseline`, `regulatedBaseline`. | `fake-indexeddb`; fake timers; canned Supabase rows. | Day 3 (`S3-B4-T5`) |
| 5 | `tests/intervention/affirmationFilter.spec.ts` | Given `state='activated'`, returns one activated affirmation; excludes last 5 shown. | Seeded `Math.random`; `affirmations.json` fixture. | Day 3 (`S3-B4-T6`) |
| 6 | `tests/memory/sessionStore.spec.ts` | Structural privacy invariants: `globalThis.fetch` spy records only `*.supabase.co` and `mailto:` calls (never any other origin); `appendTransition` does NOT send raw vitals series; `appendWhatsAlive` does NOT call `fetch` (IDB-only). | `fake-indexeddb`; `globalThis.fetch` spy; mocked Supabase client. | Day 5 (`S5-B2-T5`) |

Tests 1, 4, 5 go green Day 5 once their implementations land. Tests 2, 3 go green Day 4 (`S4-B2-T1`, `S4-B2-T3`). Test 6 goes green Day 5 alongside `S5-B2-T1`.

## 14. Definition of Done — V1 Submission

All 14 items must be true at submission:

1. Working URL `https://mindrefresh-studio.vercel.app/` returns 200 in incognito; live path works with sensor; `?source=recorded` works without sensor; `?dev=1` exposes force-morning-check.
2. 90–120 s demo video (Loom + YouTube unlisted backup); both URLs reachable.
3. ≤ 400-word write-up covering problem / solution / architecture / novelty / RuView attribution / future work.
4. Public GitHub repo with full source, ADRs 005–010 (and 007/008/011 status set).
5. README quickstart with live URL, recorded URL, build command, sensor wiring photo, license, RuView attribution.
6. `LICENSE` (MIT) at repo root.
7. `docs/assets/sensor-wiring.jpg` (or equivalent path) referenced in README.
8. Privacy statement footer with the doc 05 §3 promise verbatim, present on every page.
9. RuView attribution paragraph in README (and credited at video 1:55).
10. Pre-built sensing-server release binary URL on a GitHub Release (tag `v0.1.0-mindrefresh`).
11. ADR-007 + ADR-008 status `Accepted` in `docs/adr/`.
12. ADR-009 closed with Outcome A or Outcome B explicit.
13. ADR-011 status `Promoted` (auth + RLS shipped) **or** `Deferred` (V1 keeps hardcoded `user_id`) — never absent.
14. `pnpm test` runs 6 spec files, all green (5 Day-3 specs + `sessionStore.spec.ts` Day-5 structural-privacy assertions).

## 15. Things That Are Explicitly NOT This Plan's Concern

The following are roadmap, not buildathon. Refusing them is the plan.

- HNSW retrieval over affirmations (`@ruvector/core`)
- WebGPU LLM rephrasing (`@ruvector/ruvllm`)
- SONA per-user MicroLoRA personalisation (`@ruvector/sona`)
- 4-state polyvagal classifier (the `shutdown` state)
- 8-dim wellness vector (the happiness-vector adaptation)
- Magic-link auth + RLS upgrade (Day 6 stretch only; otherwise post-buildathon)
- WhatsAliveInput + embeddings pipeline
- HRV computation from ESP32 CSI (per ADR-006)
- Multi-node CSI mesh
- Pose estimation (RuView's 17-keypoint capability)
- Tauri desktop shell
- PatternMirror sparkline (replaced by MorningCheckCard for V1)
- Local-Only mode toggle UI (V1's structural privacy is enough)
- Cloud LLM API of any kind

If during execution the plan tempts the builder toward any of the above, the answer is no. The plan is to ship the V1 the rubric rewards — a simple thing that works beautifully — and document the rest as future work.

*End of implementation plan, 2026-04-26.*
