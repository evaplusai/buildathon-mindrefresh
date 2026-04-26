# ADR-005: Two-link architecture (ESP32 → sensing-server → SPA → Supabase)

**Status:** Accepted
**Date:** 2026-04-26
**Build Day:** 3 of 8
**Supersedes:** (none)
**Superseded by:** (none)

## Context

The MindRefreshStudio V1 stack must deliver a live demo by Fri May 1 with one
solo builder and four working days remaining. The product reads breath rate
from a Heltec V3 ESP32-S3 WiFi-CSI sensor, classifies a 3-state nervous-system
trajectory in the browser, and surfaces state-matched somatic affirmations.
Earlier drafts (`docs/02_research/03_research_plan.md`) sketched a multi-process
topology: ESP32 → Rust sensing-server → Node "Trigger server" → React SPA, with
optional Tauri shell and a parallel Python middleman for vector retrieval.
`docs/02_research/04_plan_review.md` flagged the Node middleman as redundant;
`docs/02_research/05_canonical_build_plan.md` §6 makes the cut official and
this ADR codifies the resulting architecture.

The forces in play:

- **Demo-day reliability.** Every additional process is one more thing that
  can fail to launch on the judge's machine. `docs/02_research/05_canonical_build_plan.md`
  §6 emphasises "a judge clicks the URL and it works — no 'is your background
  daemon running' failure mode."
- **Privacy boundary clarity.** The product's privacy promise (raw vitals
  never leave the device, only labelled events sync) is easier to defend if
  the boundary is a single browser process rather than a chain of localhost
  hops.
- **Build budget.** Days 3–6 cover scaffold, sensor integration, classifier,
  affirmation pipeline, MorningCheckCard, Supabase wiring, cross-browser pass,
  and release-binary build. There is no slack for an extra TypeScript service
  process.
- **Cloud surface for the Supabase rubric line.** The hackathon brief lists
  Supabase as a recommended Quick Link. Cutting the cloud entirely (as doc 04
  briefly proposed) sacrifices that rubric point. `docs/02_research/05_canonical_build_plan.md`
  §3 keeps Supabase but restricts what crosses the boundary to derived events.

## Decision

V1 ships with exactly two network links:

1. **Local link.** ESP32 → sensing-server over UDP (port 5005). sensing-server
   → browser over WebSocket (`ws://localhost:8765/ws/sensing`). Both endpoints
   bind to 127.0.0.1 by default. Port and path are locked by ADR-008.
2. **Cloud link.** Browser → Supabase REST over HTTPS, anon key,
   `state_transitions` and `interventions` rows only. Schema and auth posture
   locked by ADR-007.

Trigger detection, ring-buffer maintenance, the 3-state classifier, the five
trigger detectors (`acute_spike`, `slow_drift`, `recovery`, `manual`,
`morning_check`), and the per-user breath baseline all live in a Web Worker
(`src/workers/triggerWorker.ts`) inside the same browser the SPA already runs
in. The worker reaches IndexedDB directly via `self.indexedDB`. Affirmation
lookup runs on the main thread because V1 has no HNSW or WebGPU dependencies.

We do **not** ship a Node "Trigger server", a Python FastAPI middleman, a
Tauri desktop shell, or any custom browser-protocol bridge to RuView. We do
**not** add Redis, message queues, or any second cloud provider. Any future
addition of a process between sensing-server and the browser, or any second
cloud surface, requires a new ADR superseding this one.

## Consequences

### Positive

- Two processes to launch on demo day (sensing-server, browser tab) instead
  of four. Removes the dominant class of "demo blew up" failure modes.
- Privacy boundary is one process: the browser. Raw CSI lives in the
  sensing-server's RAM, vitals frames live in the browser's RAM, only state
  labels and affirmation IDs cross the cloud link. A judge opening DevTools
  Network sees a defensible story (`docs/02_research/05_canonical_build_plan.md` §3 threat model).
- Web Worker `postMessage` round-trip is sub-millisecond; a TCP localhost hop
  to a Node middleman is 1–5 ms and adds backpressure complexity.
- Smaller code surface and smaller bundle (no `ws` Node client, no extra
  dotenv layer, no second `tsconfig.json`).
- Supabase stays in the architecture, satisfying the recommended-tooling
  rubric line without bloating the local stack.

### Negative

- Cross-device coordination is impossible until auth is added. With
  hardcoded `user_id = 'demo-user-001'` (ADR-007), every browser sees the
  same demo history. Real multi-device use forces magic-link auth + RLS,
  deferred to ADR-011 (Day 6 stretch).
- The Web Worker is single-tab. Closing the tab loses the live ring buffer
  (IndexedDB-persisted state survives, but the in-flight 60-second window
  does not). Acceptable for V1; a service-worker upgrade would address it
  post-buildathon.
- All trigger logic lives in untyped JavaScript inside the user's browser.
  A motivated user can disable detection by editing the worker source. We
  treat this as a non-threat for V1 because there is no adversarial user
  in the demo model.

### Neutral

- The browser is the only place that sees both live vitals and yesterday's
  Supabase rows. Any future analytics that needs to correlate raw vitals
  with state transitions cannot be done server-side without a new ADR
  changing what crosses the cloud link.
- The sensing-server release binary becomes a hard dependency for the live
  demo path. The `?source=recorded` JSONL fixture path
  (`docs/02_research/05_canonical_build_plan.md` §10 Day 3, item 4) gives
  the demo a deterministic fallback that needs no binary at all.

## Alternatives Considered

- **Node "Trigger server" between sensing-server and browser.** Rejected:
  duplicates work the browser already does, adds a process to launch and a
  port to manage, and the Web Worker has lower latency on the same hardware.
  Doc 04's "drop the middleman" verdict (`docs/02_research/05_canonical_build_plan.md`
  §6) drives this.
- **Tauri desktop shell.** Rejected: no precedent in the surveyed Ruv React
  repos (`docs/05_architecture/01_system_architecture.md` §8); a
  Vercel-deployed SPA is the lowest-effort submission artefact and the
  judges receive a working URL not a binary download.
- **Python FastAPI middleman for vector retrieval / state classification.**
  Rejected: a Python toolchain would be a third runtime to keep alive, and
  V1's state classifier is a 50-line rule table, not a model that needs
  Python's ML ecosystem. The HNSW retrieval that motivated this option was
  cut from V1 (`docs/02_research/05_canonical_build_plan.md` §1 v3 amendment).
- **Browser-direct-from-RuView via custom protocol.** Rejected: would require
  forking the sensing-server's WebSocket layer or registering a custom URL
  scheme. The sensing-server already speaks plain WebSocket on a known port
  (ADR-008). No work to do here that is not already done upstream.
- **Drop Supabase entirely, ship local-only.** Rejected: doc 04 proposed
  this; doc 05 §1 reverses it. We keep the cloud surface to satisfy the
  hackathon's recommended-tooling expectation, but restrict what crosses
  it (data classification table, `docs/02_research/05_canonical_build_plan.md` §3).

## References

- `docs/02_research/05_canonical_build_plan.md` §2 (architecture diagram), §3
  (data classification), §6 (Web Worker rationale), §15 (final
  recommendation).
- `docs/05_architecture/01_system_architecture.md` §3 (system diagram), §6
  (privacy boundary diagram), §8 (deliberate omissions).
- `docs/01_initial/01_problem.md` (privacy framing: "raw biometric data
  never leaves the home").
- ADR-006 (HRV out of V1), ADR-007 (Supabase 2-table no-auth), ADR-008
  (port and path locked).

## Test Hooks (London-school)

- `tests/sensing/wsClient.spec.ts` — asserts the SPA opens exactly one
  WebSocket connection to `ws://localhost:8765/ws/sensing` and parses
  `SensingUpdate` JSON. No second outbound connection expected during a
  vitals-only session (`docs/02_research/05_canonical_build_plan.md` §13).
- The fact that all five trigger detectors are tested via mocked
  `postMessage` in `tests/triggers/morningCheck.spec.ts` (and siblings)
  rather than via a mocked Node IPC channel mechanically encodes the
  "Web Worker, not Node middleman" half of this ADR.
