# ADR-009: Sensing-server build verdict on macOS

**Status:** Proposed (pending Day-3 risk gate)
**Date:** 2026-04-26
**Build Day:** 3 of 8
**Supersedes:** none
**Superseded by:** none

> ## Edit instructions (delete this block once finalised)
>
> This ADR is a **template / stub**. It is to be filled in *today* (Build Day 3) immediately after the build gate runs:
>
> ```bash
> cd upstream/RuView/v2
> cargo build -p wifi-densepose-sensing-server --no-default-features
> ```
>
> Once the build runs:
> 1. **Pick one outcome block below** (Outcome A — PASS, or Outcome B — FAIL). Delete the other entirely.
> 2. **Change the Status line** at the top to `Accepted`.
> 3. **Fill in the timestamp** of when the build ran in the chosen outcome block.
> 4. **If Outcome B (FAIL)**: paste the actual failing crate / dependency / first 30 lines of `cargo build` error output into the "Failure detail" subsection. Be specific (which crate, which symbol, which linker error) — vague failure notes are useless for the post-buildathon retry.
> 5. **Update the "Test Hooks" section** to reflect the chosen path (live vs recorded-only).
> 6. **Delete this Edit instructions block.**

## Context

The full V1 architecture (ADR-005) assumes the user can run a Rust daemon on their own laptop that ingests UDP CSI frames from the Heltec ESP32 node on port 5005 and exposes a WebSocket on `ws://localhost:8765/ws/sensing` carrying per-second `breathing_rate_bpm`, `heart_rate_bpm`, `presence`, and `motion_band_power`. That daemon is `wifi-densepose-sensing-server` from `upstream/RuView/v2`. Per `docs/02_research/05_canonical_build_plan.md` §10 (Day 3, item 2) and §14 (Risk Doc-02 #1), building this crate on macOS with the default feature set is known to be risky — it transitively pulls OpenBLAS, `tch` (LibTorch), and `ort` (ONNX Runtime) which historically fail to link on Apple Silicon without manual intervention.

The mitigation is to build with `--no-default-features`, which strips the pose-estimation pipeline (which we do not use anyway — see `docs/05_architecture/01_system_architecture.md` §8) and keeps only the FFT vital-sign extraction we actually need. This ADR records the verdict of that build on the developer's macOS machine and locks the live-vs-recorded demo path accordingly.

The risk gate is binary. There is no halfway state: either the demo URL can serve live sensor data (`?source=live`, the default), or it cannot and we ship recorded-fixture-only mode (`?source=recorded` as the default and only path). The contract surface (`SensingUpdate` JSON shape, WebSocket route) is identical in both modes — this is by design (ADR-005), so the React app does not need to fork.

## Decision

**[CHOOSE ONE OUTCOME BLOCK BELOW. DELETE THE OTHER.]**

---

### Outcome A — PASS

The command `cargo build -p wifi-densepose-sensing-server --no-default-features` from `upstream/RuView/v2` completed successfully on the developer's macOS machine on `2026-04-26 [HH:MM TZ — fill in]`. The architecture in ADR-005 is locked. We ship live as the default demo path:

- The Vercel-hosted demo URL defaults to live (`?source=live` implicit).
- `?source=recorded` is retained as a fallback for judges who cannot or will not run the daemon locally, and as the recording path for the demo video.
- A pre-built release binary is uploaded as a GitHub Release artifact on Day 6 (per §10 Day 6 item 4) so judges do not need a Rust toolchain.
- `tests/sensing/wsClient.spec.ts` runs against the live server in CI manual mode and against a mock socket in default CI.

---

### Outcome B — FAIL

The command `cargo build -p wifi-densepose-sensing-server --no-default-features` from `upstream/RuView/v2` failed on the developer's macOS machine on `2026-04-26 [HH:MM TZ — fill in]`. We pivot to **recorded-fixture-only mode**:

- The Vercel-hosted demo URL exclusively serves `?source=recorded`. The `?source=live` flag is removed from the router or hard-redirects to recorded.
- No release binary is built or uploaded on Day 6; that line is struck from the Day-6 checklist.
- The demo video is shot entirely off the `fixtures/recorded-csi-session.jsonl` replay (still produced via Heltec → sensing-server on the developer's *Linux* machine if available, or on a Docker Linux container running the same Rust daemon, since the daemon runs fine on Linux per RuView's own CI).
- README explicitly states: "V1 ships in recorded-fixture mode on macOS. Live-sensing path is post-buildathon when the macOS build is fixed."
- `tests/sensing/wsClient.spec.ts` runs against the recorded fixture replay only.

#### Failure detail

[Fill in: which crate failed (`tch`? `ort`? `cmake-rs`? `openblas-src`?), the first 30 lines of `cargo build` output including the linker / cc / clang error, the macOS / Xcode CLT version, and the Rust toolchain version. Be specific — the post-buildathon retry depends on this.]

---

## Consequences

### Positive (PASS)
- Live demo is the headline. The "WiFi sensor reading my breath in real time" moment is preserved.
- Architecture per ADR-005 is shipped as designed; no doc rework.

### Positive (FAIL)
- Demo is still demo-able and entirely deterministic (recorded fixture). No "is your laptop running the daemon" failure mode for judges.
- All sensor-side risk is removed from the Day 7 video shoot.

### Negative (PASS)
- Live demo carries non-zero risk on demo day: room WiFi conditions, Heltec power, ESP32 firmware drift.
- Judges who try the URL without the daemon running see a connection error unless they hit `?source=recorded` manually.

### Negative (FAIL)
- Loses the "live" wow factor. The demo video has to lean harder on the morning_check moment to compensate.
- Post-buildathon, the macOS build must be fixed before any real user can run the V1 product on a Mac.

### Neutral
- `?source=recorded` is built either way (Day 5 §10 item 4); it is the demo fallback.
- The 2-table Supabase schema (ADR-007), the 3-state classifier (ADR-010), and the Web Worker (§6) are unaffected by either outcome.

## Alternatives Considered

### Build with default features (OpenBLAS + tch + ort)
Rejected: this is precisely the failure mode `--no-default-features` exists to avoid. Pose estimation is a non-goal (`docs/05_architecture/01_system_architecture.md` §8).

### Run the daemon in Docker on macOS
Rejected for live demo (latency from VM networking would distort the breath signal; UDP into a Docker bridge is fragile). Acceptable for *fixture capture* if Outcome B obtains.

### Replace sensing-server with a pure-JS FFT in the browser
Rejected: blows up the 4-day timeline. Out of scope for V1.

## Promotion / Rollback Criteria

This ADR is `Proposed` until the build runs. Promotion to `Accepted` happens by editing this file as instructed in the "Edit instructions" block above, *today*. There is no rollback — once the verdict is recorded, it is recorded. A subsequent ADR will record any retry attempts post-buildathon.

## References

- `docs/02_research/05_canonical_build_plan.md` §10 (Day 3 item 2), §14 (Risk Doc-02 #1)
- `docs/05_architecture/01_system_architecture.md` §9 (risk gate)
- ADR-005 (two-link architecture — depends on this verdict)
- ADR-008 (port lock — independent of this verdict)
- `upstream/RuView/v2/crates/wifi-densepose-sensing-server/Cargo.toml` (feature gates)

## Test Hooks (London-school)

- **If PASS:** `tests/sensing/wsClient.spec.ts` exercises the contract against (a) a mock `WebSocket` global in unit tests and (b) the live daemon at `ws://localhost:8765/ws/sensing` in a manually-gated integration test on the developer machine.
- **If FAIL:** `tests/sensing/wsClient.spec.ts` runs only the mock-socket path; a separate `tests/sensing/recordedReplay.spec.ts` verifies the JSONL replayer emits `SensingUpdate` frames matching the live contract shape.
