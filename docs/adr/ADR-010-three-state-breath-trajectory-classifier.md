# ADR-010: 3-state breath-trajectory classifier (V1)

**Status:** Accepted
**Date:** 2026-04-26
**Build Day:** 3 of 8
**Supersedes:** none (the 4-state polyvagal classifier described in `docs/05_architecture/01_system_architecture.md` §1 was a draft, never an accepted ADR)
**Superseded by:** none

## Context

The original product brief (`docs/01_initial/01_problem.md`) and the draft system architecture (`docs/05_architecture/01_system_architecture.md` §1) committed to a four-state polyvagal classifier — `regulated / rising / activated / shutdown` — drawn from Porges' polyvagal theory and Dana's clinical adaptation. This is the gold-standard somatic frame and the one a clinician would expect to see. It is also the frame that does the most narrative work on the landing page: stress is not a single dimension, and `shutdown` (the dorsal-vagal collapse / freeze response) is a population we explicitly want to meet.

The canonical build plan (`docs/02_research/05_canonical_build_plan.md` §4) reverses that commitment for V1. The reason is honest: with a single reliable input — `breathing_rate_bpm` from the sensing server's FFT, refreshed at 1 Hz — we cannot distinguish `shutdown` from `regulated` from breath rate alone. A user in dorsal-vagal collapse and a user in calm rest both present low, slow, flat breath. The discriminators that the literature uses — postural micro-collapse, dwell-without-movement, gaze-fixation, presence quality — require motion-band features and dwell-window logic we are not implementing inside the 4-day runway. Claiming `shutdown` detection without those tie-breakers would be a false positive engine; in a live demo it would label any judge sitting still as "shutdown" and immediately trigger the wrong intervention. That is intellectually dishonest, loses Problem Clarity points, and would lose more in Functionality (false-positive interventions) than it would gain in Tech Complexity.

The replacement is a 3-state classifier built from breath rate plus a 60-second trend slope over the ring buffer. It loses the dorsal-vagal arm of the polyvagal map but it is honest, demoable, and unambiguously testable. It also matches the strongest piece of demo-day storytelling — the cyclic-sigh intervention from Yilmaz Balban et al. 2023 — which is keyed to `activated` and to the descent that follows.

## Decision

V1 ships a 3-state classifier that emits exactly one of `{ regulated, activated, recovering }` at any time, transitions debounced by 5 seconds, thresholds codified literally in `src/data/stateRules.json`.

States and entry conditions (from `docs/02_research/05_canonical_build_plan.md` §4):

- **regulated**: breath rate 8–14 BPM AND trend flat or descending over 60 s.
- **activated**: breath rate > 14 BPM AND trend rising > 1 BPM/min, sustained 60 s.
- **recovering**: descending from `activated` at > 0.5 BPM/min, sustained 30 s. Returns to `regulated` after 30 s within the regulated band with flat trend; allows direct re-entry to `activated` if the descent reverses.

A 5-second minimum dwell on every transition prevents flicker. SONA per-user personalisation is cut from V1; thresholds remain literal. Cold-start values come from doc 05 §4. The classifier is implemented in `src/workers/triggerWorker.ts` as a pure function over the 60-second breath ring buffer, with rules separated into `src/workers/stateRules.ts` for testability. `tests/state/stateRules.spec.ts` mechanically enforces the entry/exit conditions and the debounce.

The 4-state polyvagal map remains the post-buildathon roadmap. The README's "Future work" section names it explicitly. A future ADR (placeholder: ADR-NNN-four-state-polyvagal-restoration) will reintroduce `shutdown` once motion-band power, dwell-window detectors, and presence-quality heuristics are validated against a held-out labelled fixture.

## Consequences

### Positive
- Honest. Every state we emit is one we can defend from breath alone.
- Demoable. The state badge transitions on camera in under a minute given a willing breath.
- Testable. `stateRules.spec.ts` is a pure-function test over fake-timed ring-buffer features; no ESP32, no daemon.
- Maps cleanly to the three breath-pattern interventions we ship (natural follow / cyclic sigh / extended exhale, per §7 of the build plan).
- Codified-as-data thresholds (`stateRules.json`) make the post-buildathon SONA personalisation a data-edit, not a code-edit.

### Negative
- Cuts the dorsal-vagal / freeze population. Users in shutdown will currently be labelled `regulated` and offered a reinforcing affirmation, which is the opposite of what they need. This is a real harm and is mitigated only by the README "future work" paragraph and the fact that V1 is a buildathon submission, not a clinical product.
- Underclaims the polyvagal frame the landing page leans on. The narrative says "the body knows first" — the classifier cannot fully back that without `shutdown`. Mitigated by phrasing the landing page in terms of "rising and recovery" rather than full polyvagal language.
- The 3-state model is sensitive to breath-only artefacts (talking, laughing, holding breath for swallowing). Mitigation: the 5-second debounce and the 60-second trend window absorb most short transients.

### Neutral
- The state vocabulary changes from `{ regulated, rising, activated, shutdown }` (draft architecture doc §1) to `{ regulated, activated, recovering }`. The Supabase `state_transitions` table check-constraint in §8 of the build plan reflects the V1 vocabulary; the column type is plain `text` so a future migration to add `shutdown` is additive (drop and recreate the check constraint, no row rewrite).
- Affirmation corpus is shipped by the user keyed to the V1 vocabulary; the post-buildathon expansion to 4 states is a corpus addition, not a re-keying.

## Alternatives Considered

### Keep the 4-state polyvagal classifier with low-confidence shutdown
Rejected. Shipping `shutdown` detection from breath alone would be intellectually dishonest under buildathon conditions. The Problem Clarity rubric rewards clean problem framing; the Functionality rubric punishes false-positive interventions. This option loses on both.

### ML classifier on labelled data
Rejected. There is no labelled corpus of CSI-derived breath traces with polyvagal-state labels. Producing one would require a 100+ user study with synchronised gold-standard sensors (chest-strap respirometry + ECG + behaviorally-coded video) and ethics review. That is a research programme, not a 4-day build.

### Single-state "activated / not"
Rejected. Collapses the recovery storyline that drives the demo's emotional arc — the "two minutes later, the sensor witnesses the return" beat (build plan §11, demo script 0:50–1:10). Without `recovering` as a distinct state, there is nothing to surface a witness affirmation against.

### Threshold values from a published study (e.g. WESAD bands)
Considered. WESAD's stress vs. amusement vs. baseline labels are at minute granularity over wrist-PPG-derived HR, not over CSI-derived breath. Direct port of thresholds is unsafe. Cold-start values in `stateRules.json` are anchored in Porges 2009 and Yilmaz Balban et al. 2023 (cyclic sigh threshold), not WESAD.

## References

- `docs/02_research/05_canonical_build_plan.md` §4 (state classifier), §7 (breath patterns), §13 (test plan)
- `docs/05_architecture/01_system_architecture.md` §1 (original 4-state commitment, now superseded by this ADR)
- `docs/01_initial/01_problem.md` (four-state detection in the original brief)
- Porges 2009 — polyvagal theory adaptive reactions, [PMC3108032](https://pmc.ncbi.nlm.nih.gov/articles/PMC3108032/)
- Dana 2018 — *The Polyvagal Theory in Therapy*, W. W. Norton
- Yilmaz Balban et al. 2023 — cyclic sighing, [Cell Reports Medicine](https://www.cell.com/cell-reports-medicine/pdf/S2666-3791(22)00474-8.pdf)
- Schmidt et al. 2018 — WESAD, [ICMI '18](https://dl.acm.org/doi/10.1145/3242969.3242985)
- ADR-005 (two-link architecture; the classifier lives in the Web Worker)
- ADR-006 (HRV out of V1 — same honesty principle applied to a different signal)

## Test Hooks (London-school)

- `tests/state/stateRules.spec.ts` — REGULATED → ACTIVATED at sustained > 14 BPM rising for 60 s; ACTIVATED → RECOVERING at descent > 0.5 BPM/min for 30 s; RECOVERING → REGULATED at 30 s within band with flat trend; ≥ 5 s debounce. Mocks `Date.now()` via fake timers and stubs the ring-buffer feature object. Pure function under test, no I/O.
- `tests/sensing/vitalsRingBuffer.spec.ts` — verifies the rolling mean and slope features the classifier consumes; pure function, no mocks.
