# ADR-009: Sensing-server build verdict on macOS

**Status:** Accepted (Outcome A — PASS)
**Date:** 2026-04-26
**Build Day:** 3 of 8
**Supersedes:** none
**Superseded by:** none
**Build log:** `docs/adr/build-gate-day3.log` (362 lines; final line `Finished dev profile [unoptimized + debuginfo] target(s) in 21.46s`).

## Context

The full V1 architecture (ADR-005) assumes the user can run a Rust daemon on their own laptop that ingests UDP CSI frames from the Heltec ESP32 node on port 5005 and exposes a WebSocket on `ws://localhost:8765/ws/sensing` carrying per-second `breathing_rate_bpm`, `heart_rate_bpm`, `presence`, and `motion_band_power`. That daemon is `wifi-densepose-sensing-server` from `upstream/RuView/v2`. Per `docs/02_research/05_canonical_build_plan.md` §10 (Day 3, item 2) and §14 (Risk Doc-02 #1), building this crate on macOS with the default feature set is known to be risky — it transitively pulls OpenBLAS, `tch` (LibTorch), and `ort` (ONNX Runtime) which historically fail to link on Apple Silicon without manual intervention.

The mitigation is to build with `--no-default-features`, which strips the pose-estimation pipeline (which we do not use anyway — see `docs/05_architecture/01_system_architecture.md` §8) and keeps only the FFT vital-sign extraction we actually need. This ADR records the verdict of that build on the developer's macOS machine and locks the live-vs-recorded demo path accordingly.

The risk gate is binary. There is no halfway state: either the demo URL can serve live sensor data (`?source=live`, the default), or it cannot and we ship recorded-fixture-only mode (`?source=recorded` as the default and only path). The contract surface (`SensingUpdate` JSON shape, WebSocket route) is identical in both modes — this is by design (ADR-005), so the React app does not need to fork.

## Decision

**Outcome A — PASS.** The command `cargo build -p wifi-densepose-sensing-server --no-default-features` from `upstream/RuView/v2` completed successfully on the developer's macOS machine on **2026-04-26**, finishing in **21.46 s** with one (non-blocking) compiler warning. The architecture in ADR-005 is locked. We ship live as the default demo path:

- The Vercel-hosted demo URL defaults to live (`?source=live` implicit).
- `?source=recorded` is retained as a fallback for judges who cannot or will not run the daemon locally, and as the recording path for the demo video.
- A pre-built release binary is uploaded as a GitHub Release artifact on Day 6 (per `docs/plan/implementation-plan.md` task `S6-B3-T1`) so judges do not need a Rust toolchain.
- `tests/sensing/wsClient.spec.ts` runs against the live server in CI manual mode and against a mock socket in default CI.

## Consequences

### Positive
- Live demo is the headline. The "WiFi sensor reading my breath in real time" moment is preserved.
- Architecture per ADR-005 is shipped as designed; no doc rework.
- Build is fast (21.46 s) so re-builds during Day-4 hardware bring-up are cheap.

### Negative
- Live demo carries non-zero risk on demo day: room WiFi conditions, Heltec power, ESP32 firmware drift.
- Judges who try the URL without the daemon running see a connection error unless they hit `?source=recorded` manually.
- One compiler warning was emitted; left unaddressed for V1 (out of scope; post-buildathon `cargo fix` pass).

### Neutral
- `?source=recorded` is built anyway as the deterministic demo fallback (`docs/plan/implementation-plan.md` `S5-B3-T1`).
- The 2-table Supabase schema (ADR-007), the 3-state classifier (ADR-010), and the Web Worker (ADR-005 §6) are unaffected by this verdict.

## Alternatives Considered

### Build with default features (OpenBLAS + tch + ort)
Rejected: this is precisely the failure mode `--no-default-features` exists to avoid. Pose estimation is a non-goal (`docs/05_architecture/01_system_architecture.md` §8).

### Run the daemon in Docker on macOS
Rejected for live demo (latency from VM networking would distort the breath signal; UDP into a Docker bridge is fragile). Acceptable for *fixture capture* if Outcome B obtains.

### Replace sensing-server with a pure-JS FFT in the browser
Rejected: blows up the 4-day timeline. Out of scope for V1.

## Promotion / Rollback Criteria

This ADR was Proposed at the start of Build Day 3 and Accepted the same day after `cargo build -p wifi-densepose-sensing-server --no-default-features` from `upstream/RuView/v2` finished in 21.46 s with exit code 0 (Outcome A). There is no rollback — the verdict is recorded. Any retry attempts post-buildathon will be tracked in a successor ADR rather than mutating this one.

## References

- `docs/02_research/05_canonical_build_plan.md` §10 (Day 3 item 2), §14 (Risk Doc-02 #1)
- `docs/05_architecture/01_system_architecture.md` §9 (risk gate)
- ADR-005 (two-link architecture — depends on this verdict)
- ADR-008 (port lock — independent of this verdict)
- `upstream/RuView/v2/crates/wifi-densepose-sensing-server/Cargo.toml` (feature gates)

## Test Hooks (London-school)

- `tests/sensing/wsClient.spec.ts` exercises the contract against (a) a mock `WebSocket` global in unit tests (default CI) and (b) the live daemon at `ws://localhost:8765/ws/sensing` in a manually-gated integration test on the developer machine.
- `tests/sensing/recordedReplay.spec.ts` (or extension of `wsClient.spec.ts` per `S5-B3-T1`) verifies the JSONL replayer emits `SensingUpdate` frames matching the live contract shape — keeps the recorded fallback path honest.
