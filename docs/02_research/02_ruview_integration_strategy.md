# MindRefreshStudio — RuView Integration Strategy & Re-Plan

*Internal research memo. Companion to `01_winning_strategy.md`. Buildathon window unchanged: April 24 – May 1, 2026. Submission: May 1 @ 3 PM ET.*

---

## 1. Abstract

Doc 01 was written under the assumption that we would have to build ESP32-S3 CSI extraction, signal processing, and breath-rate estimation from scratch in eight days, leading to a deliberately conservative scope cut: ship breath-only, defer heart rate, defer HRV, and default the demo URL to a recorded-CSI fixture so the live URL never depends on hardware. The clone of `upstream/RuView/` invalidates the first premise. RuView ships a production-stable ESP32-S3 firmware (`firmware/esp32-csi-node/`, ~943 KB binary, ADR-018 binary frame format over UDP at ~20 Hz) and a Rust sensing server (`crates/wifi-densepose-sensing-server`) whose tier-2 firmware and server-side FFT pipeline already extracts breath rate (0.1–0.5 Hz band, 6–30 BPM) and heart rate (0.67–2.0 Hz band, 40–120 BPM) on the same hardware class we already have. Heart rate flips back into scope. HRV remains out of scope but for a different reason than doc 01 stated. The recorded-CSI fixture is no longer the recommended default for the demo URL; it becomes a fallback. The recommended architecture replaces the user's three-link chain with a two-link one — RuView's sensing server already does the work doc 01 assigned to a separate Node bridge. The single biggest threat to this plan is build risk on macOS for a Rust workspace with native dependencies (OpenBLAS, ONNX Runtime, candle, optionally torch); we mitigate by gating on a single binary, `wifi-densepose-sensing-server`, and isolating it from the rest of the workspace. The pitch narrative gets stronger, not just the feature list.

---

## 2. What RuView Actually Provides — Component Audit

Audit basis: direct reads of `README.md`, `CLAUDE.md`, `Makefile`, `install.sh`, `firmware/esp32-csi-node/README.md`, `v2/Cargo.toml`, and `v2/crates/wifi-densepose-sensing-server/README.md`. Note: upstream renamed `rust-port/wifi-densepose-rs/` → `v2/` after this audit; paths below have been updated to the new layout. Maturity calls reflect what the upstream README/CHANGELOG actually claims; "1463 tests passing" is shown in the README badge but the README also self-labels the project as **Beta**.

### 2.1 Per-asset Audit

| Asset | What it does (one sentence) | Maturity | macOS-buildable in 8 days | Estimated integration cost | Recommendation |
|-------|-----------------------------|----------|---------------------------|----------------------------|----------------|
| `firmware/esp32-csi-node/` | ESP-IDF v5.2 C firmware that streams ADR-018 binary CSI frames over UDP at ~20 Hz, with optional on-device tier-1/2 DSP, hot-swappable WASM modules, and OTA at port 8032. | Production-stable per README ("Stable" tier-0/1 baseline); listed as the canonical CSI-streaming firmware for the project. | Yes via Docker (`espressif/idf:v5.2`), no native ESP-IDF toolchain install needed. Flash via `esptool` (works on macOS). Target chip is ESP32-S3 (matches our Heltec V3). | 4–8 hours: build, flash, provision WiFi credentials, confirm UDP frames on port 5005. | **Vendor as-is.** Use a pre-built binary if release artifacts exist; otherwise one Docker build. |
| `v2/` (full workspace, 21 crates; renamed from `rust-port/wifi-densepose-rs/`) | Workspace of 21 crates covering core types, signal processing, RuVector ML, training pipeline, mat (mass-casualty assistance), point-cloud fusion, desktop (Tauri WIP), WASM bindings. | Mixed: core + signal + sensing-server are stable; desktop is **WIP per upstream README**; pose-fusion + pointcloud are recent (v0.7.0) and likely beta. | **Whole workspace: no.** The workspace pulls in `tch` (libtorch C++), `ort` (ONNX Runtime), `ndarray-linalg` with `openblas-static`, `pcap`, `serialport`, `candle`. Building all of it on macOS in our window is high-risk. | Whole-workspace build: 1–3 days of yak-shaving with non-zero failure probability. Single-crate build (`-p wifi-densepose-sensing-server` only): 2–4 hours. | **Skip whole workspace. Build only `sensing-server`.** |
| `v2/crates/wifi-densepose-sensing-server` | Lightweight Axum server: UDP CSI ingest on port 5005, pure-Rust FFT vital-sign extraction (BR + HR), WebSocket broadcast on `ws://localhost:8765/ws/sensing`, static-file server on port 8080 with CORS. | Stable (own README, dedicated tests directory). Pure-Rust FFT means no native deps for vital-signs path. | Yes — Axum + tokio + serde + rustfft are all pure Rust on macOS. Avoid the optional `--features torch`/`onnx` paths. | 4–8 hours to build and wire to a custom WebSocket consumer. | **Vendor / use as our middle layer.** |
| `v2/crates/wifi-densepose-vitals` | ESP32 CSI-grade vital-sign extraction crate (ADR-021). Pulled in by sensing-server; usable standalone. | Stable. | Yes — pure Rust. | 0 hours if we just use sensing-server; 4 hours if we want to extract this and use it from our own Rust binary. | **Borrow transitively** through sensing-server. |
| `ui/components/` | 17 vanilla-JS files (Three.js scene, dashboard HUD, pose-detection canvas at 48 KB, training panel at 21 KB, etc.) targeting the RuView "observatory" cinematic dashboard. | Stable but heavy. Aesthetic mismatch — Three.js holographic panels are visually loud, the opposite of a calming somatic UI. | Yes (vanilla JS, no build). | Large files, vanilla JS, not React — adapting any component-by-component is more work than rebuilding our own. | **Skip.** Doc 01's call to skip the Three.js dashboard holds. |
| `ui/services/` | 11 vanilla-JS services: `websocket.service.js` (22 KB), `pose.service.js` (22 KB), `data-processor.js` (14 KB), `sensing.service.js` (13 KB), api/health/model/stream/training services. | Stable but vanilla JS. | Yes. | The websocket-client service is the only one we'd genuinely save work by reading; even then it's quicker to write 30 lines of typed React code that connects to `ws://localhost:8765/ws/sensing` and parses JSON payloads. | **Borrow patterns from `websocket.service.js` and `data-processor.js` (read for protocol shape); do not vendor.** |
| `ui/mobile/` | React Native (Expo) app with own `package.json`, `App.tsx`, `e2e` tests, EAS build config. | Beta / experimental. | Building an Expo app in 8 days is a separate project. | High; not a fit. | **Skip.** |
| `ui/pose-fusion/` | Camera + WiFi pose-fusion demo with its own WASM build script (v0.7.0+, 92.9% PCK@20 with camera ground truth). | Recent (v0.7.0), beta. | Possibly. Requires the WASM build (`make build-wasm`), which itself depends on a working Rust workspace. | High and orthogonal to somatic regulation. | **Skip.** |
| `ui/observatory/` | Static-served observatory dashboard (the "live demo" page on the GitHub Pages site). | Stable but again cinematic / Three.js–heavy. | Yes. | Visual mismatch. | **Skip for the wellness app.** Useful as a reference for "what NOT to build" — judges who watch our demo right after the RuView observatory will value our restraint. |
| `examples/` (most relevant 2) | (a) `examples/sleep/` — overnight sleep monitor pipeline, BR + HR + sleep-stage classification. (b) `examples/stress/` — CSI-based stress monitor using HRV / LF–HF ratio. | Beta. The stress example is the closest match to our use case but its HRV claims should be treated with caution; HRV from CSI is research-frontier. | Sleep example is mostly Node scripts that consume `.csi.jsonl` recordings — easy to read offline. The stress example is similarly Node + `.jsonl`. | 2 hours each to read and lift the windowing / state-classification logic. | **Borrow algorithmic patterns; do not vendor scripts.** |
| Edge-intelligence modules (firmware tier-2/3, ADR-041) | On-ESP32 vital-sign and presence detection, hot-swappable WASM modules. | Listed as stable for tier-2 vitals; tier-3 WASM is experimental per `wasm_runtime.c` / `wasm_upload.c` in firmware. | Tier-2 yes (already on by default). Tier-3 WASM hot-swap is a fun demo flourish but high risk. | Tier-2 is free with the firmware. | **Use tier-2 vitals on-device. Skip tier-3 WASM hot-swap.** |

### 2.2 Vendor / borrow / skip summary

- **Vendor (use as-is):** `firmware/esp32-csi-node/` binary, `wifi-densepose-sensing-server` Rust binary.
- **Borrow patterns from:** `ui/services/websocket.service.js` (protocol shape), `ui/services/data-processor.js` (binning of state updates), `examples/sleep/` and `examples/stress/` (windowing logic), and the firmware's tier-1/tier-2 algorithm descriptions in `firmware/esp32-csi-node/README.md`.
- **Skip:** `ui/components/`, `ui/mobile/`, `ui/pose-fusion/`, `ui/observatory/`, `wifi_densepose/` Python reference, the Tauri desktop crate, the whole 21-crate workspace except `sensing-server`.

---

## 3. The Hardware Compatibility Question — Resolved

Doc 01 hedged that the Heltec V3 board (ESP32-S3FN8) "exposes" CSI but worried that gap between "exposes" and "produces clinical breath rate" could swallow the build window. RuView's README closes the gap explicitly:

> "ESP32-C3 and original ESP32 are not supported (single-core, insufficient for CSI DSP)" — RuView README (`upstream/RuView/README.md`, lines 9–13).

> "Recommended boards: ESP32-S3-DevKitC-1, XIAO ESP32-S3 — Any ESP32-S3 with 8 MB flash works." — `firmware/esp32-csi-node/README.md`.

The Heltec V3 is an ESP32-S3FN8 with 8 MB flash and 8 MB PSRAM — it sits inside the supported envelope. Two caveats from the upstream README that we must not silently ignore:

1. **Single-node spatial resolution is limited.** The README says "Single ESP32 deployments have limited spatial resolution — use 2+ nodes or add a Cognitum Seed for best results." We have one Heltec V3 board. This is fine for breath, OK-with-care for heart rate, and disqualifying for through-wall pose / multi-person counting / high-PCK pose estimation. None of those are our target features. Single-node is sufficient for the somatic-regulation use case (one user, one room, one body).
2. **Antenna placement matters.** The Heltec V3 has a u.FL antenna connector and a small PCB antenna; the RuView firmware was developed against ESP32-S3-DevKitC-1 boards with a chip antenna. Performance variance comes from the position of the user relative to the line-of-sight between the AP and the sensor. For demo: place the sensor 1.5–2 m from the user, AP 3–5 m away on the opposite side, sensor at chest height. This is the same setup that the Cordeiro et al. 2024 paper used to hit RMSE ≈ 1.04 brpm.

Conclusion: hardware compatibility is **not** a blocker. The risk is calibration-and-placement, not silicon.

---

## 4. The Proposed Architecture — Evaluated

The user's proposed chain:

```
ESP32-S3 sensor → RuView Rust binary → local Node server → React app
```

### 4.1 Per-link reality check

**Link 1 — ESP32 → RuView Rust.** Filled by `wifi-densepose-sensing-server`. Wire protocol is **UDP** on port 5005 carrying ADR-018 binary CSI frames (20-byte header + I/Q pairs, ~5 KB/s per node at 20 Hz). The ESP32 is the producer; the Rust server is the consumer. Latency budget: <50 ms ingest-to-FFT-window, plus the 30-second rolling FFT window itself for breath. Failure mode: ESP32 not transmitting (loose USB power, WiFi credentials wrong) or Rust server not bound to UDP 5005 (port collision, firewall). Detection: sensing-server logs "no CSI frames in last 5 s"; UI shows a "sensor offline" pill.

**Link 2 — RuView Rust → ???** Already filled by sensing-server itself: it serves a **WebSocket** at `ws://localhost:8765/ws/sensing` and broadcasts processed updates (vital signs, presence, etc.) as JSON. The Rust server *is* the local server. The user's separate "Node server" is **redundant** if the Rust server already exposes WS + static file hosting, which it does (`README.md`: "Static file serving — Hosts the sensing UI on port 8080 with CORS headers").

**Link 3 — Node server → React app.** Doc 01 spec'd a separate 50-line Node bridge for USB-CDC. RuView's design uses **UDP**, not USB-CDC, because the ESP32 is on WiFi anyway (it has to be — CSI comes from the WiFi radio). This eliminates the USB-CDC bridge entirely. The browser talks WebSocket directly to the Rust server.

**The user's proposed three-link chain collapses to two links.** ESP32 → Rust server (UDP) → browser (WS). This is a strict simplification, lower latency, fewer demo-day failure modes.

### 4.2 Per-link latency, protocol, failure-mode summary

| Link | Wire protocol | Realistic latency | Failure mode | Detection |
|------|---------------|--------------------|---------------|-----------|
| ESP32 → sensing-server | UDP/IP on port 5005, ADR-018 binary frames | < 5 ms LAN-local | ESP32 not powered / WiFi creds wrong / firewall blocks UDP 5005 | sensing-server log + UI "sensor offline" pill after 5 s of silence |
| sensing-server (vital-sign FFT) | in-process | 30 s for first BR estimate (FFT window), updated every 5 s | numerical instability on degenerate signal; tier-2 firmware fallback exists | NaN check on output, replay-fixture fallback |
| sensing-server → browser | WebSocket JSON on port 8765 | < 50 ms LAN-local | Browser blocked by mixed-content if app served https; localhost is fine | onerror/onclose handler, auto-reconnect with backoff |

### 4.3 Three alternative architectures

**Alternative A — skip Node, browser ↔ RuView Rust directly.** This is functionally what we just derived. Build complexity: lowest. Demo reliability: highest (one fewer process). Technical Complexity rubric: same Rust crate, same ESP-IDF firmware, same on-device DSP — no scoring loss versus user's three-link plan. Privacy: Rust server is loopback-only by default per `point-cloud` README (`The HTTP/viewer server defaults to loopback (127.0.0.1)`); raw CSI never leaves the LAN. Score: **8/10 build, 9/10 reliability, 9/10 tech complexity, 10/10 privacy**.

**Alternative B — collapse RuView Rust + browser into a single Tauri app.** The RuView workspace ships `wifi-densepose-desktop` (Tauri v2 — explicitly **WIP** per the README's documentation table). Building Tauri on macOS is feasible but adds a code-signing / notarization story for binary distribution — the submission form takes a URL, not a desktop binary. Build complexity: highest (we'd be the first Tauri integrator on this codebase). Demo reliability: medium (works locally but defeats the "judges open URL" community-vote path). Tech complexity: scores the same on the rubric. Privacy: same. Score: **3/10 build, 6/10 reliability, 8/10 tech complexity, 10/10 privacy.** Doc 01 already rejected Tauri for the same reasons; nothing about RuView changes that.

**Alternative C — Python `wifi_densepose/` reference + FastAPI.** RuView's `wifi_densepose/` directory holds the original Python reference implementation (the one the Rust port replaces). It was not designed for production demos, has no dedicated WS endpoint matching the sensing-server's, and would re-introduce the heavy Python ML dep tree (`tch`, `ort`, etc., possibly via `pip` instead of cargo). Build complexity: medium (Python is friendly on macOS, but the deps aren't). Demo reliability: medium (Python startup time + native ML deps). Tech complexity: scoring is hit by leaning on Python in 2026 when a Rust port exists in the same repo. Privacy: same. Score: **5/10 build, 6/10 reliability, 5/10 tech complexity, 10/10 privacy**.

### 4.4 Recommendation

**Adopt Alternative A.** ESP32 → `wifi-densepose-sensing-server` (UDP 5005 → FFT → WS 8765) → React app (WS client + state classifier + affirmation routing). Drop the separate Node bridge from doc 01. The user's proposed chain is one link too long.

A subtlety worth flagging: the **state classifier** and the **affirmation router** still belong in the React app (browser-side), not in the Rust server. Reason: (1) it keeps the privacy story clean — the sensing-server emits anonymous numeric vital signs, never user-typed text; (2) it preserves doc 01's `@ruvector/sona` MicroLoRA personalization plan, which runs in the browser against IndexedDB; (3) it isolates blast radius — a buggy classifier change is a frontend redeploy, not a Rust rebuild.

---

## 5. mind-refresh-05 Reuse Plan

### 5.1 Affirmations corpus — *rewrite, don't reuse*

The 20-affirmation corpus in `upstream/mind-refresh-05/src/data/affirmations.json` is built from Florence Scovel Shinn's *The Game of Life and How to Play It* (1925), a New Thought / prosperity-gospel text. Every affirmation has a `scripture` field and a `reference` field (e.g. "Proverbs 4:23", "Matthew 8:26"). The voice is metaphysical-religious: "Infinite Spirit opens the way," "Divine selection," "Kingdom of right ideas."

This is the wrong register for our product. Our user is at 3 AM in nervous-system dysregulation. Trauma-informed somatic practice (Levine, Dana, Porges) deliberately avoids language that asks the user to *believe* anything; it offers *embodied invitations*. The schema, however, is good. We keep the schema, drop the religious frame, and replace the body of each entry with a polyvagal-framed somatic affirmation.

Doc 01 already authored 20 such affirmations (Section 6.3); we adopt those verbatim with the schema below. The replacement schema drops `scripture`/`reference`/`countersPatterns` (the last because cognitive-pattern matching is replaced by polyvagal-state matching), and adds `state`, `modality`, `somaticAnchor`, `intensity`, `contraindication`, and `citationFrame`. The 20 seed affirmations from doc 01 Section 6.3 cover all four states (5 regulated, 5 rising, 5 activated, 5 shutdown) and all five modalities (breath / orient / touch / movement / witness). They are the canonical seed corpus; doc 02 does not duplicate them.

### 5.2 patternDetection.ts / patternService.ts / patterns.json — *layer above, do not replace*

Read of `upstream/mind-refresh-05/src/services/patternDetection.ts` confirms what was unclear from the file name: this is **cognitive-pattern detection on free text**, not time-series pattern detection on CSI. The 6 patterns (`negative-imaging`, `fear-thinking`, `destructive-words`, `doubt-worry`, `lack-consciousness`, `wrong-attachment`) are drawn from Shinn's framework but the *abstraction* is durable — they're really six rule-based + embedding-based classifiers over user typed input.

This is **complementary** to the polyvagal state classifier, not a competitor. Concretely:

- **Polyvagal state classifier** (CSI-driven): "Where is your nervous system right now?" — emits `regulated | rising | activated | shutdown`.
- **Cognitive-pattern detector** (text-driven): "What's the *shape* of the thought?" — emits one of N cognitive patterns.

A retrieval pipeline that uses both is strictly more discriminating than either alone:

```
state ∈ {regulated, rising, activated, shutdown}      ← from CSI
patterns ⊆ {fear, doubt, lack, ...} (top-k by score)  ← from typed text
↓
filter affirmations by state
↓
boost by pattern overlap (countersPatterns ∩ detected patterns)
↓
boost by semantic similarity to typed text (vector search)
↓
top-1 with diversification
```

This is exactly the structure already implemented in `affirmationService.ts` (read in full): semantic + pattern + principle weighted combination with recency-window diversification. The weights are 0.5/0.3/0.2 — sensible defaults; we keep them and rebind `principle` → `modality` (so we don't lose the third channel).

**Decision: vendor the pattern abstraction; rewrite the patterns.** Replace the six Shinn-derived patterns with six somatic-coded patterns appropriate for nervous-system dysregulation. Examples (not in the doc-01 corpus): `catastrophizing`, `body-disconnection`, `freeze-numbness`, `looping-rumination`, `hypervigilance`, `self-blame`. Keep the rule-based + embedding hybrid, keep the cache, keep the parallel `Promise.all` execution. The `MIN_CONFIDENCE_THRESHOLD = 0.15` and `MAX_PATTERNS = 3` constants are good defaults.

### 5.3 affirmationService.ts — *vendor and re-bind embedding model*

The retrieval logic is reusable as-is. The only swap is:

- Replace `embeddingService.embed(input)` (calls `@ruvector/edge-full`) with the same call but on the somatic affirmation index.
- Replace `vectorSearchService.searchAffirmations(embedding, 20)` with the same call against an HNSW index of the new 20 somatic seed affirmations.
- Add a `state` filter before the scoring loop: only score affirmations whose `state` matches the current polyvagal state.

The diversification window (`recentAffirmations`, length 10) is exactly what we want for the somatic context too — repeated identical affirmations break the somatic-regulation experience.

### 5.4 React components — copy these five

In priority order:

1. `src/components/result/AffirmationCard.tsx` — 70 lines, Tailwind, opacity/translate-y/scale animation gated on `isVisible`, `motion-reduce` aware. Drop the scripture/reference block, keep the rest.
2. `src/components/result/ObservationText.tsx` — for the "I'm noticing your body is starting to..." gentle-observation line that precedes the affirmation.
3. `src/components/result/ActionButtons.tsx` — Save to favorites, new refresh, play again. Maps cleanly to "Save this state-trace, start new session, replay this practice."
4. `src/components/result/CalmingBackground.tsx` — animation wrapper.
5. `src/components/result/ResultScreen.tsx` — composition root that orchestrates the four above. Cleaner than rebuilding from scratch.

Skip: `src/components/sensory/` (audio is a Day-2 risk we don't need), `src/components/settings/` (no settings screen in MVP), `src/components/navigation/` (one-screen app).

### 5.5 Type system — vendor these five

From `upstream/mind-refresh-05/src/types/index.ts`:

1. `Affirmation` (lines 24–32) — keep fields `id`, `text`, `embedding`; replace `countersPatterns` with `patterns: string[]`, drop `scripture`/`reference`, add `state`, `modality`, `somaticAnchor`, `intensity`, `contraindication`.
2. `Pattern` (lines 13–22) — keep `id`, `name`, `description`, `observation`, `sampleDescriptions`, `embedding`; drop `violates`, `antidoteMood`.
3. `PatternMatch` (lines 34–38) — verbatim.
4. `AffirmationCardProps` (lines 152–156) — verbatim.
5. `AnimationConfig` + `AnimationType` (lines 235–251) — verbatim.

Drop: `Principle`, `Settings`, `Favorite`, `Entry`'s `affirmationId`/`moodBefore`/`moodAfter` fields (we'll model entries as state traces, not affirmation interactions).

### 5.6 Stack alignment with our app

`upstream/mind-refresh-05/package.json` shows: React 19, Vite 7, TypeScript 5.9, Tailwind 4.1, Vitest 4. This is **newer** than doc 01's React 18 / Vite 5 assumption. Adopt React 19 / Tailwind 4. The dep stack also shows `@ruvector/edge-full ^0.1.0` and `ruvector ^0.1.96`, which is the ONNX-MiniLM + HNSW pair we want. Vendor `tailwind.config.ts`, `vite.config.ts`, `tsconfig.app.json`, `eslint.config.js` from this repo unchanged.

---

## 6. Updated Capability Matrix — What's Now In Scope

| Capability | Doc 01 Decision | Doc 02 Decision | Justification |
|------------|-----------------|------------------|---------------|
| Breath rate | In scope (RMSE ~1 brpm) | **In scope, higher confidence** | Sensing-server's tier-2 + server-side FFT in 0.1–0.5 Hz band is a known-good implementation. We were going to build this; now we vendor it. |
| Heart rate | Out of scope | **In scope** | RuView documents 0.67–2.0 Hz / 40–120 BPM HR via the same pipeline. We must validate accuracy on our hardware (Day 3 calibration) but the *implementation risk* is gone. Pitch language must remain honest: HR is a research-grade signal even with RuView. |
| HRV | Out of scope | **Still out of scope** | RuView's `examples/stress/` references LF/HF ratio, but extracting reliable inter-beat intervals from CSI HR (let alone HF-band HRV) is research-frontier even on ESP32-S3. The `examples/stress/` script is not a clinical guarantee. Cutting HRV protects us from a "confident lie" moment in the demo. |
| Presence detection | Implicit (motion variance) | **In scope, explicit** | RuView's pre-trained presence head ships at 100% accuracy on overnight data per the README v0.6.0 section. Not a critical-path feature for somatic regulation, but valuable as a "did the user actually leave the room?" signal for session boundaries. |
| Activity recognition (sit/lie/move) | Out of scope | **Out of scope** | Movement variance is enough for our use case; full activity classifiers (gait, fall detection) are hardware-mesh-dependent and add scope without serving the core story. |
| Sleep stage | Out of scope | **Out of scope for MVP, on roadmap slide** | RuView's `examples/sleep/` is impressive and on-message for the "3 AM" framing — but a 2-minute demo cannot convincingly show sleep-stage transitions. Cite it in the write-up's "future work". |
| Fall detection | Out of scope | **Out of scope** | Wrong demographic; not on critical path. |
| Pattern Mirror (24 h trace) | In scope | **In scope** | Same as doc 01. Sparkline of breath rate + state-pill timeline. With HR back in scope, the trace can show two lines (breath + heart). |
| Return-to-regulated trace | In scope | **In scope, stronger** | The HR drop post-intervention is a more persuasive visual than breath alone. |
| Trusted Witness (one-tap mailto) | In scope | **In scope** | Unchanged. |

**Net change:** heart rate flips from cut to in-scope; everything else holds. HRV stays cut. Presence becomes a session-boundary signal. Sleep / activity / fall / pose / through-wall / multi-person all stay cut — the rule "RuView shipping it doesn't mean it serves the somatic-regulation story" is enforced.

---

## 7. Updated Rubric Score Projection

Same eight dimensions as doc 01, same 1–10 scale. Recommendation column is **Strategy C′** — "CSI-real with RuView, breath + heart rate, recorded fixture as fallback only."

| Dimension | Doc 01 (Strategy C) | Doc 02 (Strategy C′) | Δ | Rationale |
|-----------|---------------------|----------------------|----|-----------|
| Functionality | 8 | 9 | +1 | Sensing-server is a more battle-tested pipeline than what we'd have built in 8 days; live demo is more reliable, and the recorded fixture stays as Plan B. |
| UI/UX | 9 | 9 | 0 | Same React app, same calm aesthetic. RuView's UI is not adopted. |
| Creativity & Innovation | 9 | 9 | 0 | Contactless + state-matched is still the wedge. RuView's existence doesn't change novelty for the consumer-wellness pitch — RuView is research-domain, our framing is somatic-regulation. |
| Problem & Solution Clarity | 9 | 9 | 0 | The 3 AM story is the same. |
| Pitch & Presentation | 9 | 9 | 0 | The script is unchanged in shape; small wins from showing two vital signs instead of one. |
| Technical Complexity | 8 | 9 | +1 | Vendoring a 1463-test crate **is** legitimate complexity to a fair judge — the rubric measures the artifact, not the keystrokes. We must explicitly credit RuView in README + write-up; "stood on shoulders honestly" reads as adult engineering, not as cheating. Pretending we wrote it would fail. |
| Business Potential | 8 | 9 | +1 | Open-source ESP32-S3 stack + somatic intervention layer is **more** defensible against Apple Watch/Calm/Oura than a single closed sensor: hardware story is "$9 of silicon you already trust" vs Apple's $400 wrist commitment. The OSS upstream gives us a community-developer surface area no one else has. |
| Inspiration Factor | 9 | 10 | +1 | "See through walls with WiFi" + somatic regulation is materially more arresting than just "WiFi sensor for breath." With HR back, the demo has *two* contactless physiological signals — closer to a tricorder than a thermometer. |
| **Total** | **69** | **73** | +4 | All deltas are upside; no dimension gets worse. |

**Functionality risk to call out honestly:** vendoring adds dependencies that fail on demo day. The mitigation is the recorded-fixture fallback URL (`?source=recorded`), which now becomes a **secondary**, not primary, demo path. Day 6 (feature freeze) must verify both paths still work.

**Technical-complexity risk to call out honestly:** judges who skim might score "complexity = lines of code we wrote." The defense is the write-up's architecture diagram and the README's RuView attribution paragraph — the *judgment* of what to vendor and what to build is the legible engineering signal.

---

## 8. Updated 8-Day Plan

Day 7 (April 30) and Day 8 morning (May 1) are still locked for demo + write-up + submit — non-negotiable. Days 1–6 are re-planned around three changes from doc 01: (a) we no longer write our own ESP32 firmware, (b) we no longer write a USB-CDC Node bridge, (c) we run a Rust binary alongside the React app.

### Day 1 — Friday April 24 (build window opens 3 PM ET)

- Scaffold Vite + React 19 + TS + Tailwind 4 + shadcn project; deploy hello-world to Vercel.
- Vendor `@ruvector/edge-full` and `ruvector` deps from `upstream/mind-refresh-05/package.json`.
- Vendor `affirmationService.ts`, `patternDetection.ts`, `affirmationService.ts` retrieval pipeline; rewrite `affirmations.json` with the 20 doc-01 somatic seeds and `patterns.json` with 6 somatic-coded cognitive patterns.
- Vendor 5 React components (`AffirmationCard`, `ObservationText`, `ActionButtons`, `CalmingBackground`, `ResultScreen`).
- **Stop criterion:** `https://mindrefresh-studio.vercel.app/` rotates the somatic seed affirmations through a stub state machine (no real CSI yet).
- **Risk gate:** none — this day is independent of RuView.

### Day 2 — Saturday April 25

- Clone & build `wifi-densepose-sensing-server` only (`cargo run -p wifi-densepose-sensing-server` from `upstream/RuView/v2/`).
- Build the firmware via Docker (`docker run --rm -v ... espressif/idf:v5.2 ...`); flash to the Heltec V3.
- Provision WiFi creds with `firmware/esp32-csi-node/provision.py`.
- Confirm UDP frames hitting the sensing-server on port 5005.
- Open the sensing-server's bundled UI on `http://localhost:8080`; confirm a vital-sign reading exists.
- **Stop criterion:** breath rate appears in the sensing-server's WS stream while the developer breathes near the sensor.
- **Risk gate (HARD):** if `wifi-densepose-sensing-server` does not compile on macOS by EOD, fall back to **doc 01's strategy** — write our own minimal Node bridge over USB-CDC and our own breath-rate FFT. Time cost of fallback: ~1 day. Day 3 absorbs the slip.

### Day 3 — Sunday April 26

- Write a typed React WebSocket client that connects to `ws://localhost:8765/ws/sensing`, parses the JSON payload, and exposes `{ breathRate, heartRate, presence }` via Zustand.
- Calibrate breath rate against a manually-counted ground truth for 5 minutes (sit still, count breaths, compare).
- Calibrate HR against a chest-strap or wrist-pulse manual count for 5 minutes — *do not skip this*; if HR error > ±5 BPM at rest, demote HR to "experimental — shown but not pitched as clinical."
- Record `fixtures/recorded-csi.jsonl` — capture 5 min of clean session by replaying the WS feed to disk.
- Implement state classifier v0 (rule table from doc 01 Section 5.2) using the live `{breathRate, heartRate}` features.
- **Stop criterion:** state pill in the UI changes correctly when developer breathes calmly vs. holds breath vs. hyperventilates.

### Day 4 — Monday April 27

- Wire HNSW affirmation retrieval to state changes; add the "what's alive" textarea + embedding query.
- Implement breath-paced animation on the affirmation card (uses live breath rate to drive a fade pulse).
- Add Pattern Mirror (24 h breath + HR trace) as two sparklines.
- Add Trusted Witness button (one-tap `mailto:` with pre-canned message).
- Implement `?source=recorded` flag — replays `fixtures/recorded-csi.jsonl` deterministically through the same WS contract.
- **Stop criterion:** end-to-end happy path works on both live sensor and recorded fixture.

### Day 5 — Tuesday April 28 (Co-Working session 6 PM ET — attend)

- Add `@ruvector/ruvllm` WebGPU LLM rephrasing tier (lazy-loaded, optional).
- Add `@ruvector/sona` MicroLoRA per-user adapter with IndexedDB persistence.
- Polish: low-contrast typography, soft transitions, one accent color, no chrome.
- Cross-browser test: Chrome, Safari, Firefox; mobile viewport.
- Add the privacy-statement footer ("CSI never leaves the LAN; sensing-server runs on `127.0.0.1` by default — confirmed in RuView's pointcloud README").
- **Stop criterion:** app is presentable to a peer; co-working feedback collected.
- **Risk gate (SOFT):** if SONA + MicroLoRA breaks the bundle, ship without them — the seed corpus alone is the v0 product.

### Day 6 — Wednesday April 29 (FEATURE FREEZE EOD)

- Bug-fixing only.
- Write README — judges' quickstart (one-line live, one-line recorded, RuView attribution paragraph, license note: RuView is MIT, our app inherits).
- Capture the sensor wiring photo (Heltec V3 + USB-C to laptop).
- Draft the 1-page write-up.
- Run security scan: `npx @claude-flow/cli@latest security scan`.
- Verify both demo paths from a clean browser profile.
- **Stop criterion:** zero open bugs on either demo path.

### Day 7 — Thursday April 30 (DEMO VIDEO + WRITE-UP DAY — locked)

- Record the 2-minute demo video (script in Section 10). Multiple takes.
- Edit, render, upload to Loom + YouTube backup.
- Finalize the write-up (≤ 400 words: problem, solution, architecture, novelty, RuView attribution, future work).
- Capture demo screenshots for the README.
- **Stop criterion:** video uploaded, write-up final, README ready.

### Day 8 — Friday May 1 (Submission 3 PM ET — buffer + submit)

- Final smoke test in incognito.
- Submit form by 12 PM ET (3-hour buffer).
- Notify community channels.

### Critical-path summary

```
Day 1 ─────────────────► (UI scaffold, somatic seeds, vendored components)
Day 2 ─────RISK GATE────► (RuView build + flash + UDP + WS confirmed)
Day 3 ────────────────► (state classifier + calibration + recorded fixture)
Day 4 ────────────────► (HNSW retrieval + animation + Pattern Mirror)
Day 5 ────────────────► (SONA polish + cross-browser)
Day 6 ───FEATURE FREEZE►
Day 7 ────VIDEO + WRITE-UP─►
Day 8 ────SUBMIT────►
```

Day 2 is the single highest-information-content day in the plan. If it succeeds we ship Strategy C′ (HR + breath + RuView). If it fails we fall back to doc 01's Strategy C (breath only, custom firmware) and absorb a 1-day slip into Day 3. Either way the demo ships.

---

## 9. Risk Register — Updated

| # | Risk | Likelihood | Impact | Mitigation | Fallback |
|---|------|-----------|--------|------------|----------|
| 1 | RuView Rust workspace fails to build on macOS (OpenBLAS, candle, ort native deps) | **Medium** | High | Build only `-p wifi-densepose-sensing-server` (avoids the heavy-ML feature flags); stay on stable Rust 1.85+; install OpenBLAS via Homebrew before invoking cargo. | If sensing-server alone won't build by Day 2 EOD, fall back to doc-01 custom Node bridge + our own FFT (loses HR; preserves breath). |
| 2 | Heltec V3 antenna placement gives bad SNR; breath RMSE > 2 brpm | Medium | Medium | Day 2 calibration; relocate AP and sensor to 1.5–2 m / 3–5 m setup; switch antenna position. | Demo defaults to recorded-CSI fixture; live shown in supplementary photo. |
| 3 | RuView README warns single-node has limited spatial resolution; we have one board | High (true today) | Low | Our use case is single-user single-room — single-node is sufficient for breath + HR, which is all we ship. | None needed; we don't promise pose, occupancy, multi-person. |
| 4 | License compatibility | Low | High if missed | RuView is MIT OR Apache-2.0 (workspace `Cargo.toml` line 35); mind-refresh-05 is unlicensed in repo metadata but the existing `package.json` shows no license restrictions on its services. | Add LICENSE to our repo (MIT); attribute both upstreams in README + write-up. |
| 5 | Demo machine doesn't have Rust toolchain | Medium | Medium | Build sensing-server release binary on Day 6 (`cargo build --release -p wifi-densepose-sensing-server`); ship the binary in a release artifact; demo machine just runs the binary. | Recorded fixture demo path runs in browser only — zero Rust needed. |
| 6 | "Beta" maturity of RuView in production demo | Medium | Medium | Stay on the stable subset: ESP32 firmware tier-0/1, sensing-server vital-signs path, no Tauri, no pose-fusion, no WASM tier-3 hot-swap. | Recorded fixture. |
| 7 | sensing-server ports collide on demo machine (5005 / 8080 / 8765) | Low | Medium | Document port flags in README; have a fallback port set documented. | `--http-port` / `--udp-port` flags (per `README.md`). |
| 8 | ESP32 firmware build via Docker fails on Apple Silicon | Medium | High | Use `--platform linux/amd64` if needed; the `espressif/idf:v5.2` image is multi-arch but emulation may slow build. | Use a pre-built binary if release artifacts exist in `firmware/esp32-csi-node/release_bins/`; we already have that directory cloned. |
| 9 | Heart-rate calibration reveals > ±5 BPM error at rest | Medium | Medium | Day 3 calibration; if poor, demote HR to "experimental signal" in pitch and showcase only breath in the live demo. | Same as doc 01 — breath-only narrative still works. |
| 10 | "Beta software" RuView README label is read by a judge as risk-marker | Low | Low | Pre-empt in write-up: "We vendored RuView's stable subset (firmware + sensing-server). The 'beta' label refers to ongoing API churn in the broader workspace, not the modules we use." | None; this is a framing risk, not a functional one. |
| 11 | Single-builder fatigue (carried from doc 01) | Medium | High | Day 7 locked for video; no new features after Day 6 EOD. | Day 8 morning buffer. |
| 12 | Hackathon judge can't run live URL | Low | Medium | Embed demo video in README; URL has zero-config landing page that defaults to recorded fixture if `localhost:8765` is unreachable. | Video alone suffices for community vote. |

Risks #1, #2, and #6 are the new RuView-introduced ones; #3 is RuView-disclosed but harmless for our use; #5 and #7 are operational; #4 is a documentation hygiene item.

---

## 10. Demo Script — Updated 2-Minute Outline

The narrative shape is unchanged from doc 01 — the body knows first; the sensor catches it; the right intervention shows up — but with HR back in scope the live segment can show **two** vital signs. The recorded-fixture segment is now Plan B for the URL submission only, not the primary demo.

### 0:00 – 0:12 — the pain (voiceover, dim room)

> "Most of us don't notice we're getting stressed until we're already in it. By then, the body has been shifting for 20 minutes. The mind names it last. At 3 AM, alone, no therapist, no app meets you where you actually are."

### 0:12 – 0:25 — the sensor reveal (close-up of Heltec V3 on shelf)

> "MindRefreshStudio is a small WiFi sensor that lives in your room. No camera. No watch on your wrist. It reads your breath and heart rate through the WiFi signals already in the air."

### 0:25 – 0:55 — the live detection (split screen: breath sparkline + HR sparkline + state pill)

Show breath rising on screen; HR rising in parallel; state pill flips REGULATED → RISING.

> "Here, the sensor is catching me starting to spiral. Breath is climbing. So is my heart rate. The state changes from regulated to rising. The intervention surfaces."

### 0:55 – 1:20 — the affirmation lands (close-up of card fade-in synced to exhale)

Card displays: "Two short inhales through the nose, one long exhale through the mouth. Let the exhale be longer than feels necessary."

> "Not the same generic 4-7-8 every meditation app gives. The polyvagal literature says *cyclic sighing* is the practice for this state — it was peer-reviewed in *Cell Reports Medicine* in 2023, and it works in 30 seconds caught early."

### 1:20 – 1:40 — the return-to-regulated trace

Both sparklines descend. Breath drops first; HR follows.

> "Two minutes later, the trace shows me coming back. Not because I told it I felt better — because the data shows my breath actually slowing, and my heart rate following."

### 1:40 – 1:55 — the privacy promise (architecture diagram for 5 s, then back to UI)

> "All of this runs on your hardware. Raw biometric data never leaves your room. The sensing server is bound to localhost; the only thing that ever syncs is a cryptographic witness chain that proves nothing was exfiltrated."

### 1:55 – 2:00 — close

> "MindRefreshStudio. The body knows first. We just listen."

### Production notes (carried from doc 01)

- Warm 3000 K lamp; not bright daylight.
- 1080p, MP4, H.264, ≤ 100 MB.
- Test on phone speakers — judges watch on phones.
- Render local backup with OBS on Day 7 morning.
- Record an extra cut-down with **only the recorded fixture** running, in case live hardware misbehaves on shoot day.

---

## 11. Submission Checklist — Updated

The original eight items from doc 01 plus four RuView-specific ones.

1. **Working URL** — `https://mindrefresh-studio.vercel.app/` connects to live sensing-server when localhost is reachable; falls back to `?source=recorded` when not. Adds graceful "no sensor connected" copy.
2. **2-minute demo video** — Loom (primary) + YouTube unlisted (backup).
3. **1-page write-up** — ≤ 400 words; includes RuView attribution paragraph.
4. **GitHub repo public** — includes our React app, our state classifier, our affirmation corpus, our React components; **does not** vendor the RuView source tree (we link it as a submodule or a documented build dependency).
5. **README with judges' quickstart** — three paths: (a) live URL, (b) live URL with hardware (sensor wiring photo + sensing-server build instructions or pre-built binary URL), (c) `?source=recorded` no-hardware demo.
6. **Affirmation seed data** — `src/data/affirmations.json` with the 20 somatic seeds from doc 01, schema documented; `src/data/patterns.json` with 6 somatic-coded cognitive patterns.
7. **Sensor wiring photo** — Heltec V3 + USB-C cable + AP + room shot.
8. **Privacy statement** — one paragraph in README and app footer; cite the localhost-binding default in RuView's pointcloud README.
9. **(NEW) RuView attribution in README** — a one-paragraph credit naming the upstream repo (`github.com/ruvnet/RuView`), the firmware crate vendored (`firmware/esp32-csi-node`), and the Rust crate vendored (`wifi-densepose-sensing-server`). State that RuView is MIT/Apache-2.0 and our app inherits compatibly.
10. **(NEW) License compliance** — LICENSE file in repo (MIT). Verify mind-refresh-05's unlicensed status with the upstream author or treat its code as "by-permission" per the existing CLAUDE.md acknowledgment in that repo. Same for any code copied from RuView's UI services (we are reading patterns, not copying files, so this is precautionary).
11. **(NEW) Pre-built sensing-server binary** — Day 6 `cargo build --release -p wifi-densepose-sensing-server` artifact uploaded to a GitHub Release on our repo; README links to it. Removes Rust-toolchain dependency from demo-day judges.
12. **(NEW) ESP32 wiring video or photo + provisioning script** — short clip (15–20 s) showing the firmware flash + WiFi provisioning, or a still photo of the sensor in place plus a copy of `provision.py` invocation in the README.

---

## 12. Decision Summary — What Changed From Doc 01

- **Doc 01:** Cut HR and HRV from scope. **Doc 02:** HR back in scope; HRV stays cut. *Why:* RuView ships a stable HR pipeline on the same hardware class; HRV remains research-frontier.
- **Doc 01:** Default the demo URL to `?source=recorded`. **Doc 02:** Default to live; recorded is fallback. *Why:* sensing-server makes live demo materially more reliable than building from scratch.
- **Doc 01:** Architecture is ESP32 → custom Node USB-CDC bridge → React. **Doc 02:** ESP32 → `wifi-densepose-sensing-server` (UDP + WS) → React. *Why:* the Node bridge is redundant once the Rust sensing-server is in the picture; UDP over WiFi is what the firmware speaks anyway.
- **Doc 01:** Fork ESP32-CSI-Tool for firmware. **Doc 02:** Use RuView's `firmware/esp32-csi-node` directly. *Why:* it's specifically designed for the same ESP32-S3 + the same vital-signs goal; ESP32-CSI-Tool would be a downgrade.
- **Doc 01:** Strategy C scored 69 / 80. **Doc 02:** Strategy C′ scores 73 / 80. *Why:* +1 each on Functionality, Technical Complexity, Business Potential, Inspiration Factor; no dimension drops.
- **Doc 01:** Affirmation corpus is rewritten from Shinn to somatic. **Doc 02:** Same conclusion, schema enriched (state, modality, somaticAnchor, intensity, contraindication, citationFrame); 20 seed affirmations from doc 01 Section 6.3 stand as canonical. *Why:* nothing in RuView changes the affirmation register decision.
- **Doc 01:** patternDetection.ts unaddressed. **Doc 02:** Vendor as a *complementary* layer above the polyvagal state classifier. *Why:* read of `patternDetection.ts` confirms it operates on free text, not CSI time-series — orthogonal to state classification, not duplicative.
- **Doc 01:** Tauri rejected. **Doc 02:** Tauri still rejected. *Why:* RuView does ship a Tauri desktop crate, but it's WIP; submission is a URL anyway.
- **Doc 01:** Day 2 "fork ESP32-CSI-Tool, write Node bridge." **Doc 02:** Day 2 "build sensing-server, flash firmware, confirm WS feed." *Why:* same calendar day, less novel code, more verifiable progress; new explicit risk gate at end of Day 2.
- **Doc 01:** Submission checklist had 8 items. **Doc 02:** 12 items (added RuView attribution, license compliance, pre-built binary, wiring video/photo). *Why:* vendoring upstream creates obligations.

---

## 13. References

1. Cordeiro, J. et al. (2024). *Wi-Fi CSI-based human respiration monitoring on commodity ESP32 devices.* MDPI Sensors. <https://www.mdpi.com/1424-8220/25/19/6220>
2. Dana, D. (2018). *The Polyvagal Theory in Therapy: Engaging the Rhythm of Regulation.* W. W. Norton.
3. Espressif Systems (2025). *ESP-IDF Programming Guide v5.5: Wi-Fi Driver — CSI APIs.* <https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-guides/wifi.html>
4. Hernandez, S. M. & Bulut, E. (2020). *Performing WiFi Sensing with Off-the-shelf Smartphones.* PerCom Demos 2020.
5. Kim, H.-G. et al. (2018). *Stress and Heart Rate Variability: A Meta-Analysis.* Psychiatry Investigation. <https://pmc.ncbi.nlm.nih.gov/articles/PMC5900369/>
6. Kreibig, S. D. (2010). *Autonomic nervous system activity in emotion: A review.* Biological Psychology, 84, 394–421.
7. Levine, P. A. (1997). *Waking the Tiger: Healing Trauma.* North Atlantic Books.
8. Porges, S. W. (2011). *The Polyvagal Theory: Neurophysiological Foundations of Emotions, Attachment, Communication, and Self-regulation.* W. W. Norton.
9. ruvnet (2026). *RuView — WiFi DensePose & WiFi sensing platform.* <https://github.com/ruvnet/RuView>. README accessed at `upstream/RuView/README.md`. Beta-software disclosure on lines 9–13. ESP32-S3 supported / ESP32-C3 + original ESP32 not supported, same lines.
10. ruvnet (2026). *wifi-densepose-sensing-server crate README.* `upstream/RuView/v2/crates/wifi-densepose-sensing-server/README.md`. Documents UDP 5005 ingest, FFT-based BR (0.1–0.5 Hz) and HR (0.67–2.0 Hz), and WebSocket broadcast on `ws://localhost:8765/ws/sensing`.
11. ruvnet (2026). *ESP32-CSI-Node firmware README.* `upstream/RuView/firmware/esp32-csi-node/README.md`. ADR-018 binary frame format, 20-byte header + I/Q pairs, ~5 KB/s per node. Tier-0/1/2/3 architecture; tier-2 vital-sign extraction stable.
12. mind-refresh-05 (2026). *Mind Refresh Studio service implementation.* `upstream/mind-refresh-05/src/services/`. `affirmationService.ts` retrieval pipeline (semantic 0.5 + pattern 0.3 + principle 0.2 weighted scoring with 10-window diversification); `patternDetection.ts` rule + embedding hybrid pattern detection (rules 0.4 + embedding 0.6, MIN_CONFIDENCE 0.15, MAX_PATTERNS 3).
13. Schmidt, P. et al. (2018). *Introducing WESAD.* ICMI '18. <https://dl.acm.org/doi/10.1145/3242969.3242985>
14. Yilmaz Balban, M. et al. (2023). *Brief structured respiration practices enhance mood and reduce physiological arousal.* Cell Reports Medicine. <https://www.cell.com/cell-reports-medicine/pdf/S2666-3791(22)00474-8.pdf>
15. Zeng, Y. et al. (2018). *FullBreathe: Full Human Respiration Detection Exploiting Complementarity of CSI Phase and Amplitude of WiFi Signals.* Proc. ACM IMWUT. <https://dl.acm.org/doi/10.1145/3264958>
16. Doc 01 — *MindRefreshStudio Winning Strategy & Engineering Research Plan* — `docs/02_research/01_winning_strategy.md` in this repo. All section references in Doc 02 (e.g. "Section 6.3 of Doc 01") refer to this file. Strategy-C scoring matrix, 20 somatic seed affirmations, polyvagal cold-start rules, and original 8-day plan are inherited where this memo does not explicitly update them.

*End of memo.*
