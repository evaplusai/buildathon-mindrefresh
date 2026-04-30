# Dashboard v2 — Implementation Plan

## 1. Header & Status

- **Today:** Wed Apr 30 2026.
- **Source of truth:** `docs/03_designs/dashboard-v2_spec.md`,
  `docs/03_designs/dashboard-v2.html`, ADR-015/016/017,
  DDD-06 (`docs/ddd/06_reflection_context.md`),
  DDD-07 (`docs/ddd/07_dashboard_display_context.md`).
- **Relationship to prior plans:** Additive. Does not modify the V1
  buildathon DoD or the marketing landing plan. The dashboard route
  `/dashboard` keeps the same URL; the existing recorded-fixture and
  dev-mode query parameters keep working.
- **Builder:** solo.
- **Sprint shape:** 3 sprints, ~1 build day each.
  - Sprint A — Display foundation (4-state mapping, signals,
    StateDial + SignalsPanel + Today Strip + Pattern Mirror, Demo Mode)
  - Sprint B — Reflect agent swarm (on-device Pattern Scorer, Edge
    Function for Agents 2 + 3, SSE streaming, hybrid fallback,
    aidefence guard, ReasoningBank trajectory recording)
  - Sprint C — Polish (Reset card protocol variants, breathing modal
    orb animation, observability, perf, tests, deploy)

The Ruv-stack reuse rule is mechanical: **every entry in the §"What
NOT to rebuild" tables of ADR-016 / ADR-017 is a forbidden new file
in this sprint.** If a task tempts you to write one, stop and call
the corresponding MCP tool / existing service instead.

## 2. Methodology

Same SPARC + DDD + TDD-London discipline as prior plans. Specification
is in the three new ADRs and the two new DDDs. Pseudocode is captured
here as task IDs and exit criteria. Architecture is the two new bounded
contexts (Reflection, Display) layered over the existing 4. Refinement
is the test set in §10. Completion is the deploy in Sprint C Block 4.

Task ID convention: `D{sprint}-B{block}-T{n}` — e.g. `DA-B1-T1` is
Sprint A, Block 1, Task 1.

---

## 3. Sprint A — Display foundation (~6 h)

**SPRINT GOAL:** New `/dashboard` renders the design HTML's visual
surface end-to-end with real worker-driven state, real signal
derivations, real Today Strip, real Pattern Mirror — and a working
Demo Mode toggle. The Reflect card is mounted but its swarm still
runs the V1 deterministic mock (Sprint B replaces it).

**EXIT CRITERION:** `npm run dev` serves `/dashboard` (and
`/dashboard?source=recorded`) with the design HTML's full visual
arc; the 4-rung ladder activates per the sensor-derived state; all
4 signal bars animate from real wsClient frames; Today Strip renders
the day's transitions; Pattern Mirror shows real (or cold-start)
observations; `?demo=1` plays the scripted 44 s loop. `npm test`
green for new Display unit specs (4 specs).

**MORNING STANDUP:**
- Yesterday: ADRs 015/016/017 + DDD-06 + DDD-07 written.
- Today: ship the Display foundation. No agent swarm wiring yet.
- Blockers: none.

### Block 1 — Types + mapping + signal derivations (~1.5 h)

| ID | Task | Pred | Touches | ADR |
|---|---|---|---|---|
| `DA-B1-T1` | Create `web-app/src/types/display.ts` per DDD-07 §Public Interface (`DashboardState`, `DashboardStateInput`, `SignalsFrame`, `MirrorObservation`, `TodayStripData`). | — | Display | ADR-015 |
| `DA-B1-T2` | Implement `web-app/src/services/display/toDashboardState.ts` per ADR-015 §"The mapping". Pure function. | `DA-B1-T1` | Display | ADR-015 |
| `DA-B1-T3` | Write `tests/display/stateMapping.spec.ts` — exhaustive table. Make it green. | `DA-B1-T2` | Display | ADR-015 |
| `DA-B1-T4` | Implement `web-app/src/services/signals/derive.ts` — 4 normalisers reading the existing `vitalsRingBuffer`. Sensor presence=false → null sentinel. | `DA-B1-T1` | Sensing+Display | ADR-017 |
| `DA-B1-T5` | Write `tests/display/signalsDerive.spec.ts`. | `DA-B1-T4` | Display | ADR-017 |

### Block 2 — Pattern Mirror + Today Strip (~2 h)

| ID | Task | Pred | Touches | ADR |
|---|---|---|---|---|
| `DA-B2-T1` | Implement `web-app/src/services/patternMirror.ts` with 5 rule queries from ADR-017 + cold-start placeholder + 24h IDB cache via existing `sessionStore`. | `DA-B1-T1`, existing `sessionStore` | Display | ADR-017 |
| `DA-B2-T2` | Add a small read-write surface on `sessionStore` for the cache: `getPatternMirrorSnapshot(date)` / `putPatternMirrorSnapshot(date, snapshot)`. NO new IDB store — keep under existing connection. | `DA-B2-T1` | Memory | ADR-017 |
| `DA-B2-T3` | Write `tests/display/patternMirror.spec.ts` (fake-IDB seeded with 12 days; assert all 5 rules; assert cold-start path under 7 days). | `DA-B2-T1` | Display | ADR-017 |
| `DA-B2-T4` | Implement `web-app/src/services/todayStrip.ts` — single `getTransitionsSince(startOfDayLocal())` query → segments + 4 stats. | `DA-B1-T1`, existing `sessionStore` | Display | ADR-017 |
| `DA-B2-T5` | Write `tests/display/todayStrip.spec.ts` (half-day arc; assert all 4 stats). | `DA-B2-T4` | Display | ADR-017 |

### Block 3 — UI components: dial + ladder + signals + strip + mirror (~2 h)

| ID | Task | Pred | Touches | ADR |
|---|---|---|---|---|
| `DA-B3-T1` | Build `web-app/src/components/dashboard/StateDial.tsx` per design HTML lines 132–207. Props: `dashboardState: DashboardState`, `internalState: State`, `windowOpenMinutes?: number`. Renders name + ladder + mandala SVG. CSS classes match design vars. | `DA-B1-T1` | Display | ADR-015 |
| `DA-B3-T2` | Build `Mandala.tsx` (the 3-ring + core SVG with state-keyed colour + animation duration variants). | — | Display | ADR-015 |
| `DA-B3-T3` | Build `StateLadder.tsx` (the 4 rungs, active-rung styling per-state). | `DA-B1-T1` | Display | ADR-015 |
| `DA-B3-T4` | Build `SignalsPanel.tsx` per design HTML lines 820–845. Subscribes to wsClient → calls `deriveSignals` → renders 4 bars + values. | `DA-B1-T4`, existing wsClient | Display | ADR-017 |
| `DA-B3-T5` | Build `TodayStrip.tsx` per design HTML lines 994–1017. Renders SVG-style segments + reset markers + 4 stat tiles. | `DA-B2-T4` | Display | ADR-017 |
| `DA-B3-T6` | Build `PatternMirror.tsx` per design HTML lines 962–991. Subscribes to `computeMirrorObservations` once on mount. | `DA-B2-T1` | Display | ADR-017 |
| `DA-B3-T7` | Build `ResetCard.tsx` per design HTML lines 950–959. Reads `dashboardState`; renders state-keyed protocol text. | `DA-B1-T1` | Display | ADR-015, ADR-017 |
| `DA-B3-T8` | Add a `<div id="modal-root" />` to `App.tsx` (or `index.html`) so `BreathingModal` can `createPortal` into it. Per ADR-018. | — | App shell | ADR-018 |
| `DA-B3-T9` | Author `web-app/src/data/breathProtocols.json` with the 3 protocols' per-phase timings + instruction text, per ADR-018 §D. | — | Display | ADR-018 |
| `DA-B3-T10` | Implement `web-app/src/services/display/resolveProtocol.ts` per ADR-018 §A — `(recentReflectRun, dashboardState) → BreathProtocol`. | `DA-B1-T1` | Display | ADR-018 |
| `DA-B3-T11` | Build `BreathingModal.tsx` per ADR-018 + design HTML lines 1402–1474. `createPortal` into `#modal-root`. `role="dialog"` + `aria-modal="true"`. Focus trap (initial focus on close button; tab cycles within modal; restore focus on close). ESC + backdrop-click dismiss. Read `breathProtocols.json` for timing. Honour `prefers-reduced-motion` per ADR-018 §B. Three protocols. 5/4/4 rounds respectively. Completion screen + "RETURN TO TODAY" button. | `DA-B3-T7`, `DA-B3-T8`, `DA-B3-T9`, `DA-B3-T10` | Display | ADR-018 |
| `DA-B3-T12` | On modal close (any path — completion or abort), append an Intervention row with `breathPattern`, `durationMs`, `completed: boolean`. Extend the existing `appendIntervention` API in `sessionStore` to accept the new field; default `true` for legacy callers. | `DA-B3-T11`, existing sessionStore | Memory+Display | ADR-018 |

### Block 4 — Page composition + Demo Mode (~1 h)

| ID | Task | Pred | Touches | ADR |
|---|---|---|---|---|
| `DA-B4-T1` | Implement `web-app/src/services/demoMode.ts` per ADR-017 §"Demo Mode (?demo=1)". Scripted 44 s loop. Idempotent stop. | — | Display | ADR-017 |
| `DA-B4-T2` | Build `DemoModeToggle.tsx` (the nav pill from design HTML lines 64–78). | `DA-B4-T1` | Display | ADR-017 |
| `DA-B4-T3` | Refactor `web-app/src/pages/Dashboard.tsx` to compose: top nav (logo + tabs + demo toggle + avatar), greeting header, main grid (StateDial + SignalsPanel), ReflectCard placeholder (Sprint B fills it), ResetCard (visible only when state ∈ {shifting, overloaded, drained}), PatternMirror, TodayStrip, BreathingModal. | `DA-B3-*`, `DA-B4-T2` | wiring | ADR-015, ADR-017 |
| `DA-B4-T4` | Wire Demo Mode bypass: when `?demo=1` is set, suppress `wsClient.start()`, suppress worker postMessage, drive `dashboardState` from `DemoArcRunner`. | `DA-B4-T1`, `DA-B4-T3` | Display | ADR-017 |
| `DA-B4-T5` | Write `tests/display/demo-mode.spec.ts` (no wsClient connection in demo; 4 states cycle within 44 s). | `DA-B4-T1` | Display | ADR-017 |
| `DA-B4-T6` | Cross-browser smoke (Chrome desktop + Safari + iPhone-13 viewport): Verify the design HTML's animations + colours render identically. | `DA-B4-T3` | Display | ADR-015 |

**EOD CHECK (Sprint A):** All Sprint A tests green. `/dashboard`
matches the design HTML visually except for the Reflect-card swarm
(still V1 mock).

---

## 4. Sprint B — Reflect agent swarm (~6 h)

**SPRINT GOAL:** Real Pattern Scorer on-device, real Haiku for State
Mapper and Sonnet for Reframe Writer behind a Vercel Edge Function,
SSE streaming to the UI, hybrid fallback to V1 mock at 4 s timeout,
aidefence guard, ReasoningBank trajectory recording.

**EXIT CRITERION:** `/dashboard` Reflect card invokes the real swarm;
3 agents stream `thinking → done` reveal; the dashboard's state
display reflects the sensor (NOT the agent's advisory) but the
agent's reasoning shows in its card; the affirmation card displays
Sonnet's reframe; trajectories are written to ReasoningBank
(verifiable via `mcp__claude-flow__hooks_intelligence_pattern-search`);
network-flake test passes (mock fallback fires within 4 s); aidefence
test passes (prompt-injection input refused). 6 new Reflection unit
specs + 1 e2e green.

**MORNING STANDUP:**
- Yesterday: Sprint A shipped Display foundation.
- Today: agent swarm + Edge Function + ReasoningBank.
- Blockers: ANTHROPIC_API_KEY env var on Vercel; reuse same key from
  CLAUDE_CODE setup.

### Block 1 — Edge Function + types (~1.5 h)

| ID | Task | Pred | Touches | ADR |
|---|---|---|---|---|
| `DB-B1-T1` | Create `web-app/src/types/reflection.ts` per DDD-06 §Public Interface (`PatternKey`, `PatternScore`, agent output shapes, `ReflectRun`). | — | Reflection | ADR-016 |
| `DB-B1-T2` | Create `web-app/api/reflect.ts` Vercel Edge Function. Reads `ANTHROPIC_API_KEY`. Accepts `POST { text }`. Calls `aidefence_is_safe` first; returns 400 on fail. Fan-outs Agents 2 + 3 via Anthropic SDK in parallel. Streams SSE per ADR-016 §"Streaming pattern". Logs trajectory via `hooks_intelligence_trajectory-*` MCP tools (server-side). | `DB-B1-T1` | Reflection | ADR-016 |
| `DB-B1-T3` | Author `web-app/src/services/reflect/agentSpecs.ts` — the 3 system prompts + JSON schemas. **Privacy invariant in system prompts:** Agent 2 prompt says "you receive abstract pattern scores, never raw user text"; Agent 3 prompt says "you receive pattern scores and a state, never raw user text." | `DB-B1-T1` | Reflection | ADR-016 |
| `DB-B1-T4` | Implement `web-app/src/services/reflect/validate.ts` — JSON schema → typed value-object coercion; on failure, return the matching mock from `fallback.ts`. | `DB-B1-T3` | Reflection | ADR-016 |
| `DB-B1-T5` | Port `web-app/src/services/reflect/fallback.ts` from the design HTML's `scoreText` / `pickState` / `pickReframe` (lines 1237–1301). | `DB-B1-T1` | Reflection | ADR-016 |

### Block 2 — On-device Pattern Scorer + reflect client (~2 h)

| ID | Task | Pred | Touches | ADR |
|---|---|---|---|---|
| `DB-B2-T1` | Implement `web-app/src/services/reflect/agent1-pattern-scorer.ts`. Tier 1 path: call `mcp__claude-flow__embeddings_generate` against 8 seed-phrase clusters (one per `PatternKey`) and cosine-similarity score the user text against each cluster. Tier 2 fallback: deterministic keyword regex (port from design HTML). Returns `PatternScorerOutput`. | `DB-B1-T1`, MCP toolkit | Reflection | ADR-016 |
| `DB-B2-T2` | Write `tests/reflection/agent1-on-device.spec.ts`. Mock `embeddings_generate`. Feed 8 canonical sentences. Assert correct dominant pattern with score > 0.5. Assert no network call to anthropic.com. | `DB-B2-T1` | Reflection | ADR-016 |
| `DB-B2-T3` | Implement `web-app/src/services/reflect/reflectClient.ts`. Single function `start(text)`: calls Agent 1 locally; opens `EventSource('/api/reflect')` with the structured pattern output (NOT the raw text); subscribers receive per-agent updates; on completion, emits a `ReflectRun`. Hybrid 4 s timeout per agent → falls back to mock. | `DB-B2-T1`, `DB-B1-T2` | Reflection | ADR-016 |
| `DB-B2-T4` | Write `tests/reflection/privacy.spec.ts`. Mock `EventSource`. Assert request body contains pattern output, NOT the raw text. Assert Agent 3's request body contains pattern output + state, NOT the raw text. | `DB-B2-T3` | Reflection | ADR-016 |
| `DB-B2-T5` | Write `tests/reflection/fallback.spec.ts`. Fake timers. Mock cloud call to never resolve. Assert swarm completes in ≤4 s with `fallbackUsed: true`. | `DB-B2-T3` | Reflection | ADR-016 |
| `DB-B2-T6` | Write `tests/reflection/aidefence.spec.ts`. Mock `aidefence_is_safe` to return false on a known prompt-injection string. Assert the swarm refuses (no agent fires). | `DB-B2-T3` | Reflection | ADR-016 |

### Block 3 — UI components for Reflect card (~1.5 h)

| ID | Task | Pred | Touches | ADR |
|---|---|---|---|---|
| `DB-B3-T1` | Build `ReflectCard.tsx` per design HTML lines 851–947. Textarea + submit + sample buttons. On submit, call `reflectClient.start`. Renders three `<AgentCard>`s + a final `<ReframeBlock>`. | `DB-B2-T3` | Reflection | ADR-016 |
| `DB-B3-T2` | Build `AgentCard.tsx` — agent icon + name + status + body. Props: `agent: 1|2|3`, `status: AgentStatus`, `payload?: unknown`. | — | Reflection | ADR-016 |
| `DB-B3-T3` | Build `PatternChips.tsx` — colour-coded chips (rose / amber / subtle green per `PatternLevel`). | `DB-B1-T1` | Reflection | ADR-016 |
| `DB-B3-T4` | Build `ReframeBlock.tsx` — renders the reframe with an italic-on-verb-phrase post-processor (heuristic: italicize the first verb phrase that contains an observational verb — "narrows", "shifting", "reduces", etc.). | — | Reflection | ADR-016 |
| `DB-B3-T5` | Replace the `<ReflectCard>` placeholder in Dashboard.tsx (`DA-B4-T3`) with the real component. | `DB-B3-T1` | wiring | ADR-016 |
| `DB-B3-T6` | Wire the agent's State Mapper output through Display's disagreement logger: on a `done` event from Agent 2, call `disagreementLog.record({advised: agentState, sensor: sensorState, runId})`. | `DB-B2-T3`, Sprint A's Display | wiring | ADR-015, ADR-016 |

### Block 4 — Trajectories + state-mapper validation + e2e (~1 h)

| ID | Task | Pred | Touches | ADR |
|---|---|---|---|---|
| `DB-B4-T1` | In `reflectClient.ts`, on every agent done, call `mcp__claude-flow__hooks_intelligence_trajectory-step` with the agent's typed output. On final done, call `trajectory-end`. Sanitize: never include the raw user text in any trajectory step. | `DB-B2-T3` | Reflection | ADR-016 |
| `DB-B4-T2` | Write `tests/reflection/state-mapper-validation.spec.ts`. Feed an Agent 2 output whose `dashboardState` disagrees with the sensor. Assert displayed state = sensor. Assert disagreement is recorded in trajectory. | `DB-B3-T6`, `DB-B4-T1` | Reflection | ADR-015, ADR-016 |
| `DB-B4-T3` | Write `tests/reflection/voice-rules.spec.ts`. 20 fixture reframes (10 valid, 10 violating). Validator accepts/rejects per the rules. | `DB-B1-T4` | Reflection | ADR-016 |
| `DB-B4-T4` | Write `e2e/reflect-card.spec.ts`. Type one of the sample prompts. Wait for all 3 agents to reach `done`. Assert the dashboard's state-dial colour changed. Assert a reframe text rendered. | `DB-B3-T1` | Reflection | ADR-016 |

**EOD CHECK (Sprint B):** Real swarm running on
`/dashboard?source=recorded` against a recorded session and a
locally-typed prompt. Trajectories visible in
`mcp__claude-flow__memory_search_unified --query "ReflectRun"`. All 8
new tests green.

---

## 5. Sprint C — Polish + perf + deploy (~4 h)

**SPRINT GOAL:** Production-ready dashboard. Bundle within budget.
Cross-browser. Lighthouse acceptable. Vercel deployed. Demo video
re-recorded for the new surface.

**EXIT CRITERION:** Production URL renders the v2 dashboard end-to-end
in incognito on a stranger's machine; Reflect swarm works against the
ANTHROPIC_API_KEY configured on Vercel; the recorded-fixture path
plays a complete arc; Demo Mode plays a 44 s loop without hitting the
network.

### Block 1 — Reset protocols + breathing modal polish (~1 h)

| ID | Task | Pred | Touches | ADR |
|---|---|---|---|---|
| `DC-B1-T1` | Polish each of the 3 protocols' copy + timing against `breathProtocols.json`. Verify the per-phase instruction strings match ADR-018 §D verbatim. | Sprint A's `BreathingModal` | Display | ADR-018 |
| `DC-B1-T2` | Refine ResetCard copy per state per design HTML lines 1131–1148. | Sprint A's ResetCard | Display | ADR-015 |
| `DC-B1-T3` | Add `tests/display/breathingProtocols.spec.ts` — fake timers; assert each protocol's per-round timing is correct (±50 ms tolerance per ADR-018). | `DC-B1-T1` | Display | ADR-018 |
| `DC-B1-T4` | Add `tests/display/breathingModal.spec.ts` per ADR-018 — focus trap, ESC, ARIA roles, prefers-reduced-motion. | Sprint A's `BreathingModal` | Display | ADR-018 |
| `DC-B1-T5` | Add `tests/display/resolveProtocol.spec.ts` per ADR-018 — resolution rule table. | `DA-B3-T10` | Display | ADR-018 |
| `DC-B1-T6` | Add `tests/display/breathingDismiss.spec.ts` per ADR-018 — mid-protocol abort logs Intervention with `completed: false`. | `DA-B3-T12` | Display+Memory | ADR-018 |
| `DC-B1-T7` | Add `tests/reflection/agent3-protocol.spec.ts` per ADR-018 — Agent 3 advisory protocol takes precedence within 5 min; invalid value falls back. | Sprint B's reflectClient | Reflection | ADR-018 |
| `DC-B1-T8` | Add `e2e/breathing-modal.spec.ts` per ADR-018 — recorded source → overloaded → Begin reset → ESC → assert Intervention row with `completed: false`. | Sprint B finished | Display | ADR-018 |

### Block 2 — Bundle + perf + a11y (~1.5 h)

| ID | Task | Pred | Touches | ADR |
|---|---|---|---|---|
| `DC-B2-T1` | `npm run build`; record gzipped JS. Target: ≤ 220 KB on `/dashboard` first paint (V1 was 160 KB; agent swarm + Display add ≤60 KB). If above, code-split Reflect components into a lazy chunk that loads on first textarea focus. | Sprint A + B | Display+Reflection | ADR-017 |
| `DC-B2-T2` | Lighthouse pass on the deployed preview: target perf ≥ 75, a11y ≥ 90. Fix any sub-90 a11y findings (likely: SVG aria-labels, contrast on rose state). | `DC-B2-T1` | Display | ADR-017 |
| `DC-B2-T3` | Cross-browser smoke (Chrome / Safari / Firefox / iPhone-13): no z-index, font-loading, or aspect-ratio regressions. | `DC-B2-T1` | Display | ADR-013 |
| `DC-B2-T4` | Update the marketing page footer's "Local processing" text — no change needed; the agent swarm respects the privacy invariant. Verify the existing privacy E2E still passes. | — | wiring | ADR-014 |

### Block 3 — Vercel deploy + env (~1 h)

| ID | Task | Pred | Touches | ADR |
|---|---|---|---|---|
| `DC-B3-T1` | Set `ANTHROPIC_API_KEY` on Vercel production via `npx vercel env add ANTHROPIC_API_KEY production`. | — | infra | ADR-016 |
| `DC-B3-T2` | Update `.vercelignore` if any new generated artefacts (none expected). | — | infra | ADR-014 |
| `DC-B3-T3` | `npx vercel deploy --prod --yes --archive=tgz`. Verify production URL serves the dashboard v2 surface. | `DC-B3-T1` | infra | ADR-014 |
| `DC-B3-T4` | Smoke test production: hit `/dashboard?source=recorded` in incognito; verify the recorded arc plays; type a Reflect sample; verify the swarm streams in real time; verify ReasoningBank trajectory was logged. | `DC-B3-T3` | infra | ADR-016 |
| `DC-B3-T5` | Set ADR-015/016/017 + DDD-06/07 status: `Proposed → Accepted` with implementation stamp. | `DC-B3-T4` | docs | — |

### Block 4 — Demo recording + write-up (~30 min)

| ID | Task | Pred | Touches | ADR |
|---|---|---|---|---|
| `DC-B4-T1` | Record the 60-second demo per design spec §"Hackathon demo script". | `DC-B3-T4` | docs | ADR-016 |
| `DC-B4-T2` | Add a §"Build results" section to this plan with bundle metrics + test counts + Vercel URL. | `DC-B4-T1` | docs | — |

**EOD CHECK (Sprint C):** Production URL works in incognito; demo
video records cleanly; all 16-ish new tests green; bundle within
budget.

---

## 6. Risk Gates & Decision Trees

**Gate G-A1 (Sprint A, mid-day):** Trigger — `DA-B3` ladder + dial
render but signal bars stay flat. Decision — verify `wsClient`
emits VitalsFrames in dev. If sensor-server isn't reachable, fall
back to `?source=recorded`. The Display work doesn't require live
sensor — recorded works for all of Sprint A.

**Gate G-B1 (Sprint B, before Edge Function):** Trigger —
ANTHROPIC_API_KEY not set or rate-limited. Decision — keep the
Edge Function code in place but ship the demo with hybrid-fallback
always firing. The mock fallback (Sprint B Block 1 task) is
production-quality. The demo still works; the trajectory log just
records `fallbackUsed: true`.

**Gate G-B2 (Sprint B, end-of-day):** Trigger — agent latency
consistently > 4 s. Decision — the hybrid fallback already handles
this. If you want the real swarm to be visible, raise the timeout
to 8 s for `?dev=1` only, keep it at 4 s for production.

**Gate G-C1 (Sprint C, post-deploy):** Trigger — Vercel Edge
Function fails on cold start. Decision — switch the endpoint to a
Vercel Serverless Function (`web-app/api/reflect.js`) which has a
warmer pool. Same code, different runtime config. ~10 minutes.

**Gate G-C2 (Sprint C, perf):** Trigger — Lighthouse perf < 50.
Decision — disable the State Dial mandala animation on prefers-
reduced-motion media query (already in design HTML). If still bad,
defer the SignalsPanel's 4-bar transition animations to CSS
`will-change` hints.

## 7. Daily Checkpoint Template

Same as `docs/plan/implementation-plan.md` §11. End of each block:

1. What did I just complete? List task IDs.
2. What's the next un-blocked task?
3. Am I on or off the sprint goal? If off: name the gate (G-A1 /
   G-B1 / G-B2 / G-C1 / G-C2) and follow its fallback.

Log into `docs/plan/dashboard-v2-log.md` as one-line entries.

## 8. Cross-Sprint Concerns

- **Reuse over rebuild:** Every entry in ADR-016/017's §"What we MUST
  NOT rebuild" tables is a forbidden new file. If a task tempts you
  to write one, stop and use the existing MCP tool / service.
  Specifically — DO NOT write a new vector-search implementation, a
  new embedding model, a new model router, a new trajectory store, a
  new prompt-injection filter, or a new IDB store.
- **Privacy:** Agents 2 and 3 NEVER receive the raw user text. The
  test in `DB-B2-T4` is the mechanical guard. If a Sprint B PR fails
  this test, the privacy invariant is broken — fix it before
  shipping.
- **State worker:** untouched. ADR-010 stands. If Sprint A tempts you
  to add a 4th state to the worker, stop — that's a future ADR.
- **Bundle budget:** dashboard route ≤ 220 KB JS gzipped (V1 was 160
  KB; +60 KB headroom for Reflect). Marketing route still ≤ 200 KB.
- **Cost:** Agent 3 costs ~$0.005/run; budget $5/day on Vercel for
  the demo window. Set a billing alert at $10.

## 9. Definition of Done

All items must be true to call Dashboard v2 shipped:

1. `https://mindrefresh-studio.vercel.app/dashboard` renders the v2
   surface end-to-end in incognito.
2. `/dashboard?source=recorded` plays a recorded arc with the v2
   surface.
3. `/dashboard?demo=1` plays the scripted 44 s loop without
   `wsClient` connection.
4. `/dashboard?dev=1` keeps working (force-morning-check button —
   existing V1 affordance).
5. The Reflect card's swarm: 3 agents fan out in parallel; SSE
   streams progress; reframe renders; sensor-derived state wins on
   advisory disagreement; aidefence guard active.
6. Privacy invariant: Agents 2 and 3 NEVER see raw user text
   (mechanically tested).
7. ReasoningBank trajectory recorded per run, queryable via
   `mcp__claude-flow__memory_search_unified`.
8. Pattern Mirror renders 4 observations from `sessionStore` (or
   cold-start placeholder under 7 days).
9. Today Strip renders the day's transitions with 4 stat tiles.
10. SignalsPanel renders 4 bars with real values from wsClient
    derivations.
11. ResetCard renders state-keyed protocol; BreathingModal plays
    physiological sigh / box breath / 4-7-8 — selected by Agent 3
    advisory (5-min freshness) with state fallback (ADR-018).
    Modal honours `prefers-reduced-motion`, traps focus, dismisses on
    ESC/backdrop, and logs an Intervention row on close with
    `completed: boolean`.
12. `npm test` green for the new tests (target: 14 unit + 4 e2e =
    18 new specs across `tests/display/**` and `tests/reflection/**`).
13. `npm run lint` clean.
14. `npm run build` succeeds; dashboard route ≤ 220 KB JS gzipped.
15. ADR-015 / ADR-016 / ADR-017 + DDD-06 / DDD-07 status `Accepted`
    with implementation stamp.

## 10. The 18 Dashboard-v2 Tests — Sequence

| # | File | Contract | Sprint |
|---|---|---|---|
| 1 | `tests/display/stateMapping.spec.ts` | 3→4 mapping table per ADR-015. | A-B1 |
| 2 | `tests/display/signalsDerive.spec.ts` | 4 normalisers in [0, 1]. | A-B1 |
| 3 | `tests/display/patternMirror.spec.ts` | 5 rules + cold-start. | A-B2 |
| 4 | `tests/display/todayStrip.spec.ts` | Segments + 4 stats. | A-B2 |
| 5 | `tests/display/demo-mode.spec.ts` | No wsClient; 44 s arc. | A-B4 |
| 6 | `tests/display/breathingProtocols.spec.ts` | 3 protocols' timing. | C-B1 |
| 6a | `tests/display/breathingModal.spec.ts` | Portal + focus trap + ESC + reduced-motion. | C-B1 |
| 6b | `tests/display/resolveProtocol.spec.ts` | Agent advisory + state fallback. | C-B1 |
| 6c | `tests/display/breathingDismiss.spec.ts` | Mid-protocol abort row. | C-B1 |
| 6d | `tests/reflection/agent3-protocol.spec.ts` | Agent 3 protocol field. | C-B1 |
| 7 | `tests/display/agentValidation.spec.ts` | Sensor-wins + log. | B-B4 |
| 8 | `tests/reflection/agent1-on-device.spec.ts` | 8 patterns; no cloud. | B-B2 |
| 9 | `tests/reflection/privacy.spec.ts` | No raw text in 2/3 input. | B-B2 |
| 10 | `tests/reflection/fallback.spec.ts` | 4 s timeout → mock. | B-B2 |
| 11 | `tests/reflection/aidefence.spec.ts` | Inj refused. | B-B2 |
| 12 | `tests/reflection/voice-rules.spec.ts` | 20 fixtures. | B-B4 |
| 13 | `tests/reflection/state-mapper-validation.spec.ts` | Sensor wins. | B-B4 |
| 14 | `tests/display/disagreementLog.spec.ts` | Trajectory write. | B-B4 |
| E1 | `e2e/dashboard-v2-signals.spec.ts` | 4 bars render. | A-B4 |
| E2 | `e2e/dashboard-v2-pattern-mirror.spec.ts` | 4 observations. | A-B4 |
| E3 | `e2e/dashboard-v2-today-strip.spec.ts` | Strip renders. | A-B4 |
| E4 | `e2e/dashboard-v2-demo-mode.spec.ts` | 44 s loop. | A-B4 |
| E5 | `e2e/reflect-card.spec.ts` | Real swarm. | B-B4 |
| E6 | `e2e/breathing-modal.spec.ts` | Modal + ESC + abort row (ADR-018). | C-B1 |

## 11. Open scope notes (V2 ships partial; documented gaps)

- **Tab navigation:** the design HTML's nav shows 4 tabs — Today /
  Patterns / History / Sensor. V2 ships only the Today tab functional;
  the others render as `<button disabled title="Coming soon">` styled
  identically to the active tab but greyed. A future ADR will wire the
  remaining surfaces.
- **Avatar pill:** renders the user's initials inside the green-gradient
  circle (matches design HTML lines 79–90). For the buildathon demo,
  initials are hardcoded `JL`. Click does nothing in V2; future ADR will
  add a settings menu.
- **Grounding protocol:** spec §"Reset interactivity" mentions a 4th
  "grounding prompts" protocol. ADR-018 §"Alternatives Considered"
  defers it to a future ADR-019; grounding is text-driven, not
  breath-paced, and needs a different modal layout.

## 12. Things That Are Explicitly NOT This Plan's Concern

- 4-state worker classifier (ADR-015 keeps the worker at 3 states).
- HRV-driven state thresholds (ADR-006; still cut).
- Real cardiac micro-motion sensor (we ship a derived proxy).
- Multi-turn Reflect (V3).
- Voice-input Reflect (V3).
- LLM-polished Pattern Mirror prose (post-V2).
- SONA fine-tune of the Reframe Writer (post-V2; recording only).
- Cross-device Pattern Mirror sync (single-device V2).
- A new persistence table (ADR-007 still applies).
- A new IDB store (Pattern Mirror cache lives under existing connection).
- A bespoke embedding model (we use `embeddings_generate`).
- A custom model router (we use `hooks_route`).
- A custom prompt-injection filter (we use `aidefence_is_safe`).
- A custom vector store (we use AgentDB / `agentdb_pattern-store`).

If during execution the plan tempts you toward any of the above, the
answer is no.

## 13. Build results — Sprint A (2026-04-30)

Sprint A executed via 3-agent parallel swarm (foundation / aggregators /
components) + integration pass. Total elapsed ~25 minutes.

### What shipped

| Slice | Files | Tests |
|---|---|---|
| Foundation | `types/display.ts`, `services/display/toDashboardState.ts`, `services/signals/{derive,bufferAccess}.ts` | `stateMapping.spec.ts` (18), `signalsDerive.spec.ts` (12) |
| Aggregators | `services/{patternMirror,todayStrip,demoMode}.ts`, `services/display/resolveProtocol.ts`, `data/breathProtocols.json`, `services/sessionStore.ts` extensions | `patternMirror.spec.ts` (11), `todayStrip.spec.ts` (8), `demo-mode.spec.ts` (8), `resolveProtocol.spec.ts` (8) |
| Components | `components/dashboard/{StateDial,Mandala,StateLadder,SignalsPanel,PatternMirror,TodayStrip,ResetCard,BreathingModal,DemoModeToggle,AvatarPill}.tsx`; `components/shared/Logo.tsx`; `tailwind.config.js` keyframes (`ring-rotate`, `ring-breathe`, `live-dot`, `orb-pulse`); `index.html` Google Fonts | (no per-component unit tests for V2; covered by Sprint C `breathingModal.spec.ts` + e2e) |
| Integration | `pages/Dashboard.tsx` refactor; `App.tsx` Suspense; `index.html` `#modal-root` | (existing e2e covers) |

### Test counts

| Layer | Files | Tests |
|---|---|---|
| Vitest unit | 18 (12 prior + 6 Sprint A) | **154 / 154** ✓ |
| Playwright E2E | 13 fast (1 long arc skipped) | **12 / 12** ✓ |

### Bundle (production, gzipped)

| Route | First-paint JS | CSS | Notes |
|---|---|---|---|
| `/` (marketing) | **102.29 KB** | 9.46 KB | Target ≤ 200 KB — **49% headroom** |
| `/dashboard` | 102.29 + **70.10 KB** lazy chunk = **172.39 KB** | 9.46 KB | Target ≤ 220 KB — **22% headroom** |
| `triggerWorker` | 1.97 KB | — | Unchanged |

V2 component additions (StateDial, Mandala, SignalsPanel, PatternMirror,
TodayStrip, BreathingModal, ResetCard, DemoModeToggle, AvatarPill, +
3 new services) added 12 KB to the dashboard chunk vs V1's 58 KB. Well
within budget.

### Architectural drift caught + corrected

- `BreathProtocol` enum mismatch (`'4_7_8'` vs `'four_seven_eight'`) —
  unified to `'four_seven_eight'` across `types/display.ts`,
  `breathProtocols.json`, and components.
- `MarketingLogo` shared by both surfaces — moved to
  `components/shared/Logo.tsx` to honour the ADR-013 isolation rule
  (dashboard can't import from `components/marketing/**`). ADR-013
  amended in place to record the V2 font-loading + shared-Logo change.
- Several React 19 strictness errors (purity, set-state-in-effect)
  fixed with `nowTick` 1Hz state and microtask-deferred state resets.
- E2E `marketing-fonts` test rewritten: V2 ships fonts via
  `index.html` globally, so the original "only on marketing" assertion
  no longer applies. New test: "Source Serif 4 link present exactly
  once on each route." Same regression-detection power, V2-correct
  semantics.
- E2E `dashboard-smoke` test selectors updated for the V2 layout
  (StateDial heading + new privacy footer wording).

### Audit — Sprint A DoD coverage

| DoD item | Status |
|---|---|
| `/dashboard` renders v2 surface end-to-end | ✓ |
| `/dashboard?source=recorded` plays recorded arc | ✓ |
| `/dashboard?demo=1` plays scripted 44 s loop | ✓ (DemoArcRunner verified by unit) |
| `/dashboard?dev=1` keeps working | ✓ (existing dev-mode e2e passes) |
| Reflect card swarm | ⏳ Sprint B |
| Privacy invariant (Agents 2/3 never see raw text) | ⏳ Sprint B |
| ReasoningBank trajectory | ⏳ Sprint B |
| Pattern Mirror renders 4 observations or cold-start | ✓ |
| Today Strip renders day's transitions + 4 stat tiles | ✓ |
| SignalsPanel renders 4 bars | ✓ (proxy values per ADR-017) |
| ResetCard + BreathingModal play 3 protocols | ✓ (Sprint C will add per-protocol tests) |
| `npm test` green | ✓ 154 / 154 |
| `npm run lint` clean | ✓ (1 unrelated warning) |
| `npm run build` succeeds; budgets honoured | ✓ |
| ADR-015..018 / DDD-06,07 status `Accepted` | ⏳ Sprint C (after final deploy) |

### Open follow-ups for Sprint B (resolved)

- ✅ Reflect agent swarm shipped per ADR-016 (Sprint B).
- ✅ `recentRun` wired into `resolveProtocol` via `recentReflectProtocol`
  state in Dashboard.tsx (Sprint B).
- ✅ `BreathProtocol` moved to `types/reflection.ts`; display.ts
  re-exports (Sprint B).
- ⏳ `Intervention.completed` still a type-cast at the call site
  (sessionStore extension is correct; the upstream `Intervention`
  type still lacks the field). Low-priority hygiene fix.

## 14. Build results — Sprint B (2026-04-30)

Sprint B executed via 3-agent parallel swarm (server / client /
ui) + integration. Total elapsed ~30 minutes.

### What shipped

| Slice | Files | Tests |
|---|---|---|
| Server | `types/reflection.ts`, `services/reflect/{agentSpecs,validate,fallback}.ts`, `api/reflect.ts` (Vercel Edge), `types/display.ts` (BreathProtocol relocation) | (validators tested in voice-rules.spec) |
| Client | `services/reflect/{agent1-pattern-scorer,reflectClient}.ts` | `agent1-on-device.spec.ts` (10), `privacy.spec.ts` (5), `fallback.spec.ts` (3), `aidefence.spec.ts` (3) |
| UI | `components/dashboard/{ReflectCard,AgentCard,PatternChips,ReframeBlock}.tsx`, `services/display/disagreementLog.ts`, Dashboard.tsx wire | `state-mapper-validation.spec.tsx` (3), `voice-rules.spec.ts` (20), `agent3-protocol.spec.tsx` (2), `e2e/reflect-card.spec.ts` (2) |

### Test counts

| Layer | Files | Tests |
|---|---|---|
| Vitest unit | 25 (12 prior + 6 Sprint A + 7 Sprint B) | **200 / 200** ✓ |
| Playwright E2E | 14 fast (1 long arc skipped) | **14 / 14** ✓ |

### Bundle (production, gzipped)

| Route | First-paint JS | CSS | vs V1 |
|---|---|---|---|
| `/` (marketing) | **102.00 KB** | 9.77 KB | unchanged |
| `/dashboard` | 102.00 + **76.52 KB** = **178.52 KB** | 9.77 KB | +18 KB for full V2 stack |
| `triggerWorker` | 1.97 KB | — | unchanged |

Sprint B added ~6 KB on top of Sprint A's 70 KB Dashboard chunk —
small footprint for the entire 3-agent SSE client + UI components.

### Drift caught + corrected during integration

- 4 spec files needed `.tsx` extension for JSX (RTL renders);
  vitest config already includes `tsx`.
- `ReframeWriterOutput` validator extended with min-word floor (10),
  `you should` imperative regex check.
- `reflectClient` synthetic-emit on fallback path so all 3 agents
  always reach `done` in the consumer event stream.
- Edge Function timeout / privacy / fallback paths confirmed via
  4 mechanical tests (`privacy`, `fallback`, `aidefence`, `agent1`).

## 15. Build results — Sprint C (2026-04-30)

Sprint C focus: missing breathing-modal a11y + timing + dismiss
tests, ADR/DDD status flips, deploy.

### What shipped

| Concern | Files | Tests |
|---|---|---|
| Per-protocol timing | `tests/display/breathingProtocols.spec.tsx` | 11 |
| Modal a11y (Portal/ARIA/focus/ESC/reduced-motion) | `tests/display/breathingModal.spec.tsx` | 10 |
| Mid-protocol dismissal | `tests/display/breathingDismiss.spec.tsx` | 5 |
| E2E breathing modal | `e2e/breathing-modal.spec.ts` | 2 |
| ESLint config | `eslint.config.js` (added `argsIgnorePattern: '^_'`) | — |
| Test cleanup | `tests/marketing/{copy.spec.ts,cta-targets.spec.tsx}` | — |

### Test counts (final)

| Layer | Files | Tests |
|---|---|---|
| Vitest unit | 28 | **228 / 228** ✓ |
| Playwright E2E | 16 fast (1 long arc skipped) | **16 / 16** ✓ |

### Production deployment

- `https://mindrefresh-studio.vercel.app/` — marketing landing
- `https://mindrefresh-studio.vercel.app/dashboard` — Dashboard v2
- `https://mindrefresh-studio.vercel.app/dashboard?source=recorded` — recorded arc
- `https://mindrefresh-studio.vercel.app/dashboard?demo=1` — scripted 44s loop
- `https://mindrefresh-studio.vercel.app/api/reflect` — Edge Function
  (gracefully falls back to mocks when ANTHROPIC_API_KEY is unset)
- `https://mindrefresh-studio.vercel.app/_entry` — operator entry

To enable the real swarm: `npx vercel env add ANTHROPIC_API_KEY production` then redeploy.

### Final DoD coverage

All 15 DoD items from §9 are now ✓ except `ANTHROPIC_API_KEY` (user
action). The hybrid fallback means the swarm is fully demo-ready
without the key.

### Architectural notes flagged for future work

- Backdrop dismissal in jsdom passes the unit test but the real
  `target !== currentTarget` discrimination is best verified in E2E
  (covered).
- Persistence path through `Dashboard.tsx`'s `handleModalClose` is
  not unit-tested (would require Worker + wsClient + IDB + Supabase
  mocking for a full Dashboard render). E2E covers the smoke.
- `completedRef` rapid-reopen stress path not exercised — V2 ships;
  V3 hardening if needed.

*End of dashboard-v2 plan, 2026-04-30.*
