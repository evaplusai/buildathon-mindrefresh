# MindRefreshStudio — Critical Review of `03_research_plan.md`

*Review date: 2026-04-25 (build Day 3 of 8). Reviewer: GOAP planner. Source-of-truth docs cross-referenced: `01_winning_strategy.md`, `02_ruview_integration_strategy.md`, `05_architecture/01_system_architecture.md`, `01_initial/01_problem.md`, and the upstream RuView source at `upstream/RuView/v2/crates/wifi-densepose-sensing-server/`.*

---

## 1. Verdict

**Re-plan.** Doc 03 is not "ship as-is" and not even "ship with surgical fixes" — it contradicts doc 02's architecture flip, breaks the product spec's load-bearing privacy promise, and is grounded on a wire-protocol description (`ws://localhost:8000`, an HRV-bearing payload) that the upstream RuView sensing-server does not emit. Three of its five components either do not exist as described (HRV) or duplicate work the React app + RuView already do (Node trigger server, Supabase). The right move on Day 3 is to supersede Doc 03 with a thin "build plan v2" that re-anchors on Doc 02's ESP32 → sensing-server → SPA chain, lifts Doc 03's good content (six-trigger taxonomy, affirmation surfaces, demo fallback path), and discards the rest.

---

## 2. Major Problems

### 2.1 — `ws://localhost:8000` is the wrong port AND the wrong path

- **Severity:** Critical.
- **What the plan says:** "WebSocket, clean health signals, ws://localhost:8000" (Component 2).
- **What's actually true:** Per `upstream/RuView/v2/crates/wifi-densepose-sensing-server/src/cli.rs` lines 16–20 and `src/main.rs` lines 4867–4877, the server defaults to `--ws-port 8765` and routes `/ws/sensing`. Default UDP CSI port 5005 is correct; default static UI/REST is 8080. The README at lines 44, 67 and the binary's own log line 4662 (`"WebSocket: ws://localhost:{}/ws/sensing"`) are unambiguous. Doc 02 §4.2 also got this right; Doc 05 §3 got this right.
- **Why it matters for the rubric:** Functionality. Every line of code that follows the doc-03 wire spec is wrong. If Claude Code starts implementing against `:8000`, every `WebSocket` constructor call, every test fixture, and the README quickstart all need to be re-edited.
- **Recommended fix:** Use `ws://localhost:8765/ws/sensing` everywhere. Add an ADR locking the port so it never drifts again.

### 2.2 — The HRV payload Doc 03 promises does not come out of the sensing-server

- **Severity:** Critical.
- **What the plan says:** The Component 2 JSON example includes `"hrv_sdnn": 52.4, "hrv_rmssd": 41.8, "motion": 0.03` and *all six trigger detectors* (Component 3) compute on HRV. The HRV math section states "SDNN = standard deviation of R-R intervals … cold-start thresholds: <30 high stress, 30–50 moderate…".
- **What's actually true:** The sensing-server `SensingUpdate` struct (`src/main.rs` lines 189–240 and the `VitalSigns` substructure) emits `breathing_rate_bpm`, `heart_rate_bpm`, `presence`, `motion_band_power`, classification info, and quality gates — **never `hrv_sdnn` or `hrv_rmssd`**. Doc 02 §6 was explicit and correct: "HRV remains out of scope … extracting reliable inter-beat intervals from CSI HR is research-frontier even on ESP32-S3." Doc 05 line 270 repeats the cut. Doc 03 silently re-introduces HRV as if RuView ships it.
- **Why it matters for the rubric:** Problem & Solution Clarity (we'd be promising clinical HRV we cannot produce), Functionality (the trigger detectors compute on a field that is always absent), and Inspiration (the "WiFi watches your heart-rate variability" pitch is a confident lie).
- **Recommended fix:** Strike HRV. Replace doc-03's six HRV-keyed triggers with triggers keyed off the actually-emitted fields: `breathing_rate_bpm`, `heart_rate_bpm`, `motion_band_power`, `presence`. The "rising / activated / shutdown" four-state polyvagal classifier from doc 02 §5 and doc 05 already does this work — doc 03 should bind to it, not invent a parallel six-trigger HRV pipeline.

### 2.3 — Supabase + HTTPS POST of trigger events breaks the "raw biometric data never leaves the home" promise

- **Severity:** Critical (this is the product's load-bearing differentiator per `01_initial/01_problem.md`).
- **What the plan says:** "When a trigger fires, posts an event to Supabase," with `events.context (jsonb — flexible payload)` mirroring user baselines including `resting_hr`, `baseline_sdnn`, `baseline_breath_rate`. Trigger events include `morning_check` carrying "overnight recovery score = overnight average HRV / personal baseline."
- **What's actually true:** Sending personal HR/HRV/breath baselines to a third-party cloud is, by any reasonable reading, exfiltrating biometric data. Doc 02 §6 privacy boundary diagram and doc 05 §6 ("Promise: raw CSI never leaves the sensing-server process. Vitals frames never leave the browser… No analytics, no telemetry, no cloud LLM calls. Privacy is structural, not policy-based") explicitly forbid this. The product spec's last bullet — "raw biometric data never leaves the home" — is the *frame* used to win Inspiration Factor and Business Potential against Apple Watch / Calm.
- **Why it matters for the rubric:** Inspiration (-2 if a judge spots `cloud-publisher.ts` POSTing HR baselines), Business (privacy is the entire moat against incumbents), Pitch (the demo's privacy line at 1:35 becomes a lie).
- **Recommended fix:** Drop Supabase. Use IndexedDB in the browser (already in doc 05 §7 source layout: `services/sessionStore.ts`) for event history; use a postMessage / BroadcastChannel between trigger logic (in a Web Worker) and the UI layer. If a cloud sync story is required for the pitch, ship it as an *opt-in roadmap slide* with a signed RVF witness chain, not a default POST.

### 2.4 — The "Trigger server (YOUR IP)" reintroduces a middle process Doc 02 already deleted

- **Severity:** High.
- **What the plan says:** Component 3 — a Node + TypeScript service that connects to the sensing-server WS, runs detectors every second, persists to SQLite, posts to Supabase.
- **What's actually true:** Doc 02 §4 ("decision flip 3") and Doc 05 §8 explicitly remove the Node bridge: "Sensing-server already speaks WebSocket." The browser is fully capable of consuming the WS, running rolling-buffer logic in a Web Worker, persisting to IndexedDB, and dispatching state events to React. Adding a separate Node process triples demo-day failure modes (port collision, restart-loop, crash in background) while delivering nothing the browser cannot do. The single legitimate excuse for a separate process — "we need persistence across browser sessions" — is solved by IndexedDB, which doc 05 already plans for.
- **Why it matters for the rubric:** Functionality (more services = more demo-day failure surface), Pitch (judges open the URL; if a localhost Node service is offline, the URL is dead), Technical Complexity (judges score *judgment*, not LOC count — running an unnecessary process is a complexity *penalty*).
- **Recommended fix:** Move the entire trigger-server logic into a browser Web Worker (`src/workers/triggerWorker.ts`) per doc 05's `services/` layout. Keep the rolling-buffer code, the per-user baseline learning, and the time-of-day rules — they are the IP. Just run them in the right place.

### 2.5 — Five components vs. Doc 02/05's three components is a regression

- **Severity:** High.
- **What the plan says:** "The five components and how they connect: ESP32 → RuView Rust → Trigger server → Supabase → React."
- **What's actually true:** Doc 02's recommended architecture (Section 4.4, Alternative A) collapses to three: ESP32 → sensing-server → React SPA. Doc 05's mermaid diagram in §3 commits to that three-link chain. Doc 03's five-component diagram is a *strict superset* with a Node hop and a Supabase hop on top. Both additions are net negatives (see 2.3, 2.4). The hackathon judges' prompt — "a simple tool that works beautifully outscores a complex tool that barely functions" — is verbatim about this kind of regression.
- **Recommended fix:** Adopt doc 02's three-component architecture; reflect it in doc 05. Doc 03 should be superseded, not merged.

### 2.6 — "Next-morning consequences of last-night choices" is unspecified scope creep

- **Severity:** Medium.
- **What the plan says:** Project summary opens with this feature; `morning_check` trigger and "Morning Report Card" UI surface flesh it out.
- **What's actually true:** `01_initial/01_problem.md` lists eight core features — none of them are "morning report" or "next-day consequences." The closest neighbours are "Pattern Mirror" (over-time reflection without judgment) and "Return-to-regulated trace" (in-the-moment trace). The morning report requires overnight presence detection + HRV baseline (see 2.2 — HRV is not in scope) + sleep-gap inference, which is a Day-7 ambition in a Day-3 plan.
- **Why it matters for the rubric:** Functionality (any half-built feature visible in the demo costs more than it gains), single-builder fatigue (Risk #11 in doc 02 register).
- **Recommended fix:** Cut the morning-report UI. Keep the polyvagal "regulated / rising / activated / shutdown" loop and the existing Pattern Mirror. Mention "tomorrow's capacity score" as a roadmap bullet in the write-up only.

### 2.7 — Vendoring "five Rust crates" instead of the one binary that actually ships

- **Severity:** Medium.
- **What the plan says:** "`vendor/ruview/ … Five crates only: wifi-densepose-core, wifi-densepose-signal, wifi-densepose-hardware, wifi-densepose-vitals, wifi-densepose-api`."
- **What's actually true:** Doc 02 §2.1 audited the workspace and concluded: build only `wifi-densepose-sensing-server` (which transitively pulls `core`, `signal`, `vitals`, `wifiscan`). The plan's named crate `wifi-densepose-api` is *not* the relevant binary — `wifi-densepose-sensing-server` is. Building the listed five crates from a vendored copy increases build risk on macOS (the workspace pulls `tch`, `ort`, `ndarray-linalg` via feature flags) and is unnecessary.
- **Why it matters for the rubric:** Functionality (Day 2 risk gate in doc 02 §8 already flagged this; doc 05 §9 inherits it). The wrong vendor list could blow Day 3 trying to compile crates we do not need.
- **Recommended fix:** Vendor nothing into `vendor/`. Run `cargo run -p wifi-densepose-sensing-server` from `upstream/RuView/v2/` (gitignored) per Doc 05's existing plan. For the submission, document the build command and ship a release binary on Day 6.

### 2.8 — The plan has zero ADRs; doc 05 §9 already locked a Day-2 risk gate that needs one

- **Severity:** Medium.
- **What the plan says:** No ADRs.
- **What's actually true:** RuV methodology requires an ADR per load-bearing decision. Doc 03 quietly reverses doc 02's "decision flip 3" (no Node bridge), reverses doc 02's "HRV cut", and adds Supabase — three load-bearing decisions, no written rationale. Doc 05 §9 explicitly anticipated `ADR-005-ruview-build-failed.md` as a fallback record.
- **Recommended fix:** Write the four ADRs listed in §6 below today.

### 2.9 — No TDD entry point on Day 3

- **Severity:** Medium.
- **What the plan says:** Build order is dependency-driven: "Repo + Supabase + Vercel skeleton → RuView with simulated data → trigger server skeleton …" — no test-first hook. The closest thing is "Demo fallback — record a clean session to JSONL."
- **What's actually true:** Doc 05 §5 lists five public contracts (`Sensing.subscribe`, `State.subscribe`, `Intervention.retrieve`, `Memory.appendSample`, `Personalization.recordFeedback`). Each is unit-testable today with a mock WebSocket and a fixture stream — no ESP32, no Rust binary needed.
- **Recommended fix:** Day 3 starts with five test files (see §8 below).

---

## 3. Course of Action — Today (Day 3, Sunday April 26, solo builder)

Time-boxed, dependency-ordered. Solo builder owns each.

1. **(45 min) Supersede doc 03.** Add a banner at the top of `03_research_plan.md` linking to `04_plan_review.md` and stating "superseded — see `02_ruview_integration_strategy.md` and `05_architecture/01_system_architecture.md` for the architecture; Trigger taxonomy salvaged into doc 05 §5/§7." This unblocks Claude Code, which will otherwise pattern-match on the most recent file.
2. **(30 min) Write the four ADRs in §6 below.** Stub form is fine — title, decision, consequence, status: accepted.
3. **(2 h) Stand up the typed WebSocket client + Web-Worker trigger pipeline skeleton.** Bind to `ws://localhost:8765/ws/sensing`, Zustand or context store, ring buffers in a Web Worker per doc 05 §3 sequence diagram. Mock the WS in tests; do **not** require the Rust binary to be running.
4. **(2 h) Write the five Day-3 unit tests in §8.** London-school: mock the WS, mock IndexedDB, mock the affirmation retriever. Get to green before lunch on Day 4.
5. **(1.5 h) Verify the Day-2 risk gate retroactively.** Run `cargo build -p wifi-densepose-sensing-server --no-default-features` from `upstream/RuView/v2/`. If it succeeds, lock it. If it fails, write `ADR-008-sensing-server-build-failure.md` and pivot to the recorded-fixture-only path.
6. **(45 min) Salvage doc 03's content into doc 05.** Lift the affirmation-surfaces table (acute_spike modal / slow_drift toast / late_push two-button) into doc 05 §7 as the actual UI inventory; lift the breath-circle widget spec; *drop* HRV math, Supabase, Node trigger server, morning report.

**Stop criterion (today):** all five tests run and fail-or-pass deterministically against an in-memory mock WS; no Rust binary, no ESP32, no cloud.

---

## 4. Course of Action — Days 4–6

Day 7 (Apr 30) locked for demo video + write-up; Day 8 morning (May 1) buffer + submit by 12 PM ET.

### Day 4 — Mon Apr 27 (state classifier + retrieval against fixture)

- (3 h) Implement state classifier rule table from doc 02 §5.2 against ring-buffer features (breath, HR, motion, dwell). **Rubric:** Functionality.
- (2 h) HNSW retrieval over 20 somatic seed affirmations from doc 02 §6.3, filtered by state, in browser. **Rubric:** Technical Complexity.
- (2 h) BreathGuide animation paced by live `breathing_rate_bpm`. **Rubric:** UI/UX.
- (1 h) Record a 5-min CSI fixture (offline replay file) by capturing the live WS feed to JSONL. **Rubric:** Functionality (Plan B).
- (30 min) `?source=recorded` query flag swaps live WS for JSONL replay — same contract. **Rubric:** Functionality.

### Day 5 — Tue Apr 28 (polish + co-working session 6 PM ET)

- (2 h) Pattern Mirror sparkline (last 6 h breath + HR), Trusted Witness button (mailto). **Rubric:** UI/UX, Inspiration.
- (1.5 h) Calibrate breath against manual count (sit still 5 min, count, compare). **Rubric:** Functionality / honesty.
- (1.5 h) Calibrate HR similarly; if error > ±5 BPM, demote HR to "experimental, shown but not pitched as clinical." **Rubric:** Problem Clarity.
- (1 h) Cross-browser pass (Chrome, Safari, Firefox; mobile viewport). **Rubric:** UI/UX.
- (1 h) Attend co-working session, collect peer feedback. **Rubric:** Pitch.

### Day 6 — Wed Apr 29 (FEATURE FREEZE EOD)

- (2 h) README with judges' quickstart: live URL, recorded-fixture URL, ESP32 wiring photo, RuView attribution. **Rubric:** Problem Clarity.
- (1 h) Privacy statement footer per doc 05 §6. **Rubric:** Inspiration.
- (1.5 h) Build sensing-server release binary (`cargo build --release -p wifi-densepose-sensing-server`); upload to GitHub Releases. **Rubric:** Functionality.
- (2 h) Bug-fix only on demo path. Both `?source=live` and `?source=recorded` must round-trip clean. **Rubric:** Functionality.
- (30 min) `npx @claude-flow/cli@latest security scan` per CLAUDE.md security rules.

---

## 5. Architecture Reconciliation

| Aspect | Doc 03 (under review) | Doc 02 + Doc 05 (current SoT) | Recommended |
|---|---|---|---|
| Component count | 5 (ESP32 / Rust / Node / Supabase / SPA) | 3 (ESP32 / Rust / SPA) | **3 — keep doc 02/05** |
| Vital fields | breath, HR, HRV (SDNN, RMSSD), motion | breath, HR, motion, presence | **Doc 02/05** (HRV not emitted by upstream) |
| Trigger logic location | Node process on user laptop | Browser Web Worker | **Browser Web Worker** |
| Persistence | Supabase Postgres + local SQLite | IndexedDB only | **IndexedDB only** |
| Cloud egress | HTTPS POST events to Supabase | None (structural privacy) | **None** |
| WS port / path | `ws://localhost:8000` (wrong) | `ws://localhost:8765/ws/sensing` | **8765 / `/ws/sensing`** |
| UDP port | 5005 | 5005 | 5005 (both correct) |
| Fixture role | Plan B fallback | Plan B fallback | Plan B fallback (agreement) |
| Affirmation home | React app, hand-written | React app, somatic seeds | React app, somatic seeds |
| State model | Six trigger events on HRV | Four-state polyvagal | **Four-state polyvagal**, with doc 03's six-event taxonomy folded in as *render rules* on top |
| Morning report | Yes | No | **No** (cut scope creep) |

**Specific edits to `docs/05_architecture/01_system_architecture.md`:** none required to revert; doc 05 already encodes the right decisions. *Add* a sub-section under §7 "Source layout" listing the six UI surface components doc 03 specced (AcuteSpikeModal, SlowDriftToast, CumulativeLoadScreen, LatePushModal, RecoveryAmbient, MorningReport — drop the last) so we don't lose doc 03's product-design work.

We are building **Doc 02 + Doc 05's architecture**.

---

## 6. ADRs to Write Today

| ADR | Title | Decision (one sentence) | Chief consequence |
|---|---|---|---|
| **ADR-005** | Two-link architecture: ESP32 → sensing-server → SPA | We adopt doc 02 Alternative A: no Node bridge, no cloud middle, browser consumes RuView's WS directly. | Trigger logic must run in a browser Web Worker; persistence is IndexedDB only. |
| **ADR-006** | HRV is out of scope for the build window | We ship breath + HR + motion + presence; HRV is roadmap-only because the sensing-server does not emit inter-beat intervals. | Doc 03's HRV-keyed trigger taxonomy is rewritten over breath/HR/motion features; pitch cannot claim HRV. |
| **ADR-007** | No third-party cloud egress in v0 | Structural privacy is the moat; no Supabase, no analytics, no telemetry; IndexedDB only; cloud sync is post-buildathon and will use signed RVF witness hashes when shipped. | Demo URL must work fully against `localhost:8765` plus a recorded fixture; no remote service may be a critical-path dependency. |
| **ADR-008** | Sensing-server upstream port + WS path locked | `ws://localhost:8765/ws/sensing` for vitals stream; UDP 5005 for CSI ingest; HTTP 8080 unused by us; verified against `upstream/RuView/v2/.../cli.rs` lines 16–20 and `main.rs` line 4662. | All client code, README, demo script, and recorded-fixture replay path use 8765/`/ws/sensing` exactly; any change requires a new ADR. |

---

## 7. Privacy Verdict

**No** — Doc 03's proposed architecture does **not** honour "raw biometric data never leaves the home." Posting trigger events whose `context` payload includes `resting_hr`, `baseline_sdnn`, `baseline_breath_rate`, and `overnight average HRV` to Supabase is biometric exfiltration by any plain-language reading. The "trigger event is just a marker" framing fails because the events transitively reveal the user's resting physiology and sleep timing. A judge or a privacy-savvy community voter will ask, and the architecture will not survive the question.

**Minimum architectural change to honour the promise:** drop Supabase entirely from v0. Persist event history and baselines in IndexedDB. Use BroadcastChannel for cross-tab sync if the user opens the app on multiple tabs. If a multi-device sync feature is required for pitch credibility, ship an opt-in roadmap slide with the Trusted Witness exception (one-tap mailto, doc 05 §6) as the *only* outbound channel; that exception is user-initiated, single-message, and does not exfiltrate baselines.

---

## 8. Testing Posture (Day 3, no hardware)

Per `CLAUDE.md`'s `/tests` rule. London-school: each test names the boundary it mocks.

| File | What it tests | Mocked dependency |
|---|---|---|
| `tests/sensing/wsClient.spec.ts` | The WS client connects to `ws://localhost:8765/ws/sensing`, parses a `SensingUpdate` JSON envelope, exposes `{breathingRateBpm, heartRateBpm, presence, motionBandPower, ts}` to subscribers. | `WebSocket` global (mock socket emits canned `SensingUpdate` frames). |
| `tests/sensing/vitalsRingBuffer.spec.ts` | A 60-second ring buffer maintains rolling mean / slope / dwell-since-last-state for each vital; oldest sample evicted at capacity. | None — pure function over arrays. |
| `tests/state/stateRules.spec.ts` | Given a fixture stream, the rule-table classifier transitions REGULATED → RISING when breath rises >2 BPM in 60 s; RISING → ACTIVATED when breath > 18 sustained 60 s; debounces at ≥ 5 s dwell. | `Date.now()` (fake timers); ring-buffer feature stub. |
| `tests/intervention/affirmationRetriever.spec.ts` | Given state = `RISING`, returns one of the 5 rising affirmations from `data/affirmations.json`; excludes last 3 shown; prefers `modality: breath` when user-text embedding similarity > 0.5 to "breath". | HNSW index (in-memory stub returning fixed top-k); embedding service (returns fixed 384-dim vectors). |
| `tests/memory/sessionStore.spec.ts` | Appending a state-transition sample persists across a simulated browser reload; query by 24 h window returns chronological order; never escapes IndexedDB. | `indexedDB` (fake-indexeddb npm pkg); confirm no `fetch` is called (assert `globalThis.fetch` is a spy that records zero calls — this is the privacy assertion as code). |

The fifth test makes the privacy promise mechanical: any future PR that adds a `fetch(...)` call to a non-mailto target fails CI. This is what doc 02 §8.3 calls "structural privacy, not promise-based."

---

## 9. Risk Register Delta (vs Doc 02 §9)

| # | Change | Reason |
|---|---|---|
| Doc 02 #1 (RuView build on macOS) | **Severity downgraded High → Medium** | The plan needs only `-p wifi-densepose-sensing-server --no-default-features`; verified `Cargo.toml` line 51 specifically supports this for non-BLAS builds. |
| Doc 02 #2 (antenna placement) | **Unchanged** | Day 5 calibration. |
| **NEW #13** | "Doc 03 contradicts doc 02; agents pattern-match the wrong file." | Likelihood medium, impact high. Mitigation: Day-3 supersede banner on doc 03. |
| **NEW #14** | "Privacy contradiction discovered by community voter or judge." | Likelihood low (if Supabase is dropped), impact catastrophic (the moat is the promise). Mitigation: ADR-007 + IndexedDB + sessionStore privacy test (§8). |
| **NEW #15** | "HRV scope-creep regression." | Likelihood medium (doc 03 already did it once), impact medium. Mitigation: ADR-006; remove HRV vocabulary from all UI strings on Day 4. |
| Doc 02 #6 (RuView beta in production demo) | **Unchanged** | Stay on the stable subset. |
| Doc 02 #11 (single-builder fatigue) | **Severity raised Medium → High** | Day 3 spent on this review; Days 4–6 are tighter than doc 02's plan. |
| **REMOVE** Doc 02 #5 (demo machine has no Rust toolchain) | **Removed by ADR-007** — recorded-fixture URL works without Rust. |

---

## 10. Demo Script Compatibility

Walking doc 02 §10's beats against doc 03's architecture:

| Beat | Doc 02 expectation | Doc 03 effect | Adjustment |
|---|---|---|---|
| 0:25–0:55 live detection (breath + HR sparklines) | Two sparklines pulled from sensing-server WS | OK if Supabase passthrough is fast enough; risks added latency | Adopt doc 02 path: browser reads WS directly, no cloud round-trip. |
| 0:55–1:20 affirmation lands | Card fade-in synced to live exhale | Affirmation is in React app; OK in both architectures | Keep. |
| 1:20–1:40 return-to-regulated trace | Both lines descend; breath first then HR | OK | Keep. |
| 1:40–1:55 privacy promise voiceover | "Raw biometric data never leaves your room" | **Falsified by doc 03** (Supabase POST visible in DevTools Network tab) | Drop Supabase per ADR-007; the voiceover becomes true again. |
| Recorded-fixture fallback | `?source=recorded` JSONL replay | Fixture cannot reach Supabase from a stranger's browser; doc 03's React app is also Supabase-coupled, so the fallback is *broken* if Supabase is offline or rate-limited | Adopt doc 02: SPA reads JSONL directly via fetch on `?source=recorded`; no cloud dep on the fallback path. |

Demo survives once §3 changes land. With doc 03 as-is, the privacy beat fails any technical judge who opens DevTools.

---

## 11. Final Recommendation

**Supersede doc 03 with a thin "build plan v2" anchored on doc 02 + doc 05.**

What that supersession contains, in order:

1. A short preamble pointing at doc 02 (architecture) and doc 05 (system diagrams) as the source of truth.
2. The four ADRs from §6, written today.
3. The salvaged content from doc 03 that survives review:
   - The six UI surface descriptions (AcuteSpikeModal, SlowDriftToast, CumulativeLoadScreen, LatePushModal, RecoveryAmbient — drop MorningReport).
   - The cyclic-sighing breath-circle widget spec.
   - The selection-with-recency-window logic for affirmations.
   - The repo structure, rewritten to drop `trigger-server/`, `vendor/ruview/`, and Supabase config; reflect doc 05 §7.
4. The Day 3–6 plan from §3 and §4 above.

Why supersede rather than edit-in-place: doc 03's load-bearing claims (HRV, Supabase, Node bridge, port 8000, five components) are not fixable as line-edits without losing the document's structural integrity. The honest move at hour-72 of an eight-day window is to keep what's good (the UI taxonomy, the affirmation scheme, the recorded-fixture instinct) and let the rest go. Editing in place would leave reviewers — and Claude Code agents — uncertain which version is canonical, which is exactly the failure mode Risk #13 names. The rubric rewards a simple thing that works; doc 02 + doc 05 + a salvaged build plan v2 is that simple thing.

*End of review.*
