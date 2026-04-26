# ADR-006: HRV out of V1

**Status:** Accepted
**Date:** 2026-04-26
**Build Day:** 3 of 8
**Supersedes:** (none)
**Superseded by:** (none — V2 will add an HRV ADR rather than supersede this one)

## Context

The product spec (`docs/01_initial/01_problem.md`) lists "HRV" as a core
sensing feature alongside breath rate, heart rate, and micro-motion. HRV
(heart-rate variability) is the gold-standard physiological proxy for
autonomic balance, and the buildathon literature is full of well-validated
SDNN-based stress bands. The temptation, in scoring terms, is to claim HRV
detection because it sounds more clinically credible than breath-rate alone.

This ADR refuses that temptation. HRV — specifically the standard
time-domain metrics SDNN and RMSSD — is computed over **RR intervals**: the
millisecond-resolution time between consecutive R-peaks of the cardiac
cycle. The MindRefreshStudio sensing-server does not emit RR intervals. It
emits a smoothed `heart_rate_bpm` at 1 Hz.

Verifiable in the upstream code:
`upstream/RuView/v2/crates/wifi-densepose-sensing-server/src/main.rs` line 191
declares `struct SensingUpdate`, the JSON envelope broadcast over the
WebSocket. Lines 1419–1473 implement `fn smooth_vitals`, which feeds raw
HR/BR through a median-filter outlier rejector (lines 1424–1435), a trimmed
mean (lines 1438–1440), and an exponentially-weighted moving average with a
dead-band (lines 1445–1461). Lines 1468–1469 then write the result back into
the broadcast as `breathing_rate_bpm` and `heart_rate_bpm`. The output is a
heavily smoothed scalar at the sensing-server's tick interval, not a stream
of RR intervals.

SDNN computed over a 1 Hz HR series is not HRV. It is the standard deviation
of a smoothed average. It compresses out exactly the beat-to-beat variation
that SDNN is designed to measure, and it picks up smoothing-filter ringing
that has nothing to do with autonomic state. Reporting it as "HRV" would be
intellectually dishonest and would lose Functionality and Problem Clarity
rubric points more than it gains in Tech Complexity
(`docs/02_research/05_canonical_build_plan.md` §4).

## Decision

V1 does not compute, display, store, or sync HRV. The sensing-server's
`heart_rate_bpm` field is treated as a smoothed display value only. It is
shown on the dashboard, written to the `state_transitions.hr_bpm` column at
the moment of transition (one sample, not a series), and otherwise ignored
by the classifier. The 3-state breath-trajectory classifier
(`docs/02_research/05_canonical_build_plan.md` §4) drives all state
decisions from breath rate alone.

We do not estimate RR intervals from peak detection on `motion_band_power`,
nor from any inferred chest-wall motion signal. Such estimation is feasible
in principle (the literature exists) but is not feasible to validate in
eight days, and an unvalidated HRV claim is worse than no HRV claim.

The roadmap, codified here so the team does not lose it: V2 will pair the
ESP32 WiFi-CSI sensor with a 60-GHz mmWave radar (e.g. the Seeed MR60BHA2
already supported by RuView, see `upstream/RuView/CLAUDE.md` hardware
table). That radar emits real RR intervals. The reference script
`upstream/RuView/examples/stress/hrv_stress_monitor.py` already implements
SDNN-based stress bands against that hardware:

| SDNN (ms) | Band |
|---|---|
| < 30 | HIGH STRESS |
| 30–50 | Moderate |
| 50–80 | Mild |
| 80–100 | Relaxed |
| > 100 | Very Relaxed |

When the radar pairing ships, V2 will adopt those bands verbatim. The
MindRefreshStudio classifier will gain a fourth signal (HRV-band) alongside
breath trajectory, and the cut `shutdown` polyvagal state will be reconsidered
because shutdown detection benefits substantially from low HRV combined with
low motion.

## Consequences

### Positive

- The product's stated capabilities match what the sensor actually
  produces. A judge who reads the source and follows the WebSocket envelope
  will not find a contradiction.
- The classifier is simple enough to test (`tests/state/stateRules.spec.ts`,
  `docs/02_research/05_canonical_build_plan.md` §13) and to debug live during
  Day-7 demo recording.
- The roadmap is concrete: pair a specific radar, adopt a specific
  reference script's specific bands. There is no design work to redo.
- Privacy story stays simple: HR is shown but not stored as a series, so
  there is nothing HRV-shaped to leak.

### Negative

- The product spec line "Tracks breath rate, heart rate, HRV, and
  micro-motion in real time" (`docs/01_initial/01_problem.md`) is overstated
  for V1. The README and write-up must walk this back explicitly: "V1 reads
  breath; HRV ships when the radar pairing lands." If we hide this behind
  fine print we lose Problem Clarity points.
- We forgo a clinically familiar metric that judges from health-tech
  backgrounds may expect. The compensating story is the breath-trajectory
  classifier and the morning_check, which together carry the demo without
  HRV.
- Some affirmation interventions in the somatic literature are HRV-keyed
  (e.g. resonance breathing at ~6 BPM as a proxy for HRV biofeedback). V1
  cannot pace those interventions to live HRV; it can only pace them to
  breath. This is acceptable because the V1 affirmation corpus is matched
  to the 3-state classifier, not to HRV bands.

### Neutral

- The schema field `state_transitions.hr_bpm` (one sample at the moment of
  transition) is kept because it costs almost nothing and gives V2 a
  migration path if we want HRV-keyed affirmation analytics later. It is
  not used by V1 logic.

  Cross-ref: ADR-007 §Decision documents the `hr_bpm` column as a forward-compatible storage field; V1 writes one display sample but never consumes it.

## Alternatives Considered

- **Estimate RR intervals from peak detection on `motion_band_power`.**
  Rejected: chest-wall micro-motion is dominated by breath at the
  amplitudes WiFi-CSI can resolve; the cardiac component is a small
  high-frequency rider that vanishes at typical seating distances. Building
  and validating a peak detector in eight days, against ground truth we do
  not have on the demo machine, is unrealistic and the failure mode
  (silently bad HRV) is worse than the success mode (claim landed but never
  re-validated).
- **Ship HRV as displayed but not used by the classifier, with a fine-print
  caveat.** Rejected: the rubric rewards clarity, not hedging. Showing a
  number we cannot defend invites exactly the dismissive question we cannot
  answer. The "HRV" label on a smoothed-HR-series standard deviation is the
  classic example of buildathon trim that loses points instead of gaining
  them.
- **Compute HRV over the smoothed `heart_rate_bpm` series and rename it
  "HR variability proxy".** Rejected: marginally more honest but still
  noisy and still meaningless as an autonomic indicator. The smoothing
  pipeline (`main.rs` lines 1419–1473) is designed to suppress exactly the
  variation that HRV measures.
- **Defer the entire HR readout to V2.** Rejected: HR is useful as a
  display field even when not used for HRV — judges expect to see it on
  the vitals panel. Storing one HR sample at each state transition is
  cheap and aids future analytics.

## References

- `docs/02_research/05_canonical_build_plan.md` §1 (V1 cuts), §4
  (classifier rationale, "HRV thresholds NOT V1" note), §8 (schema
  `hr_bpm` field).
- `docs/01_initial/01_problem.md` (the overstated-claim source).
- `upstream/RuView/v2/crates/wifi-densepose-sensing-server/src/main.rs`
  line 191 (`struct SensingUpdate`), lines 1419–1473 (`fn smooth_vitals`,
  the smoothing pipeline), lines 1468–1469 (smoothed BR/HR written to the
  broadcast).
- `upstream/RuView/examples/stress/hrv_stress_monitor.py` (reference SDNN
  bands, V2 roadmap source).
- `upstream/RuView/CLAUDE.md` hardware table (Seeed MR60BHA2 radar entry).
- ADR-005 (two-link architecture; ADR-006 is the honesty pillar of that
  architecture).

## Test Hooks (London-school)

n/a — this is a design-time decision about what V1 *does not* compute.
The closest mechanical assertion is in `tests/state/stateRules.spec.ts`
(`docs/02_research/05_canonical_build_plan.md` §13), which verifies the
classifier consumes only breath rate and never reads `hrBpm` from the
ring-buffer interface. The presence of `hrBpm` as an optional field in
the `Inbound.vitals` postMessage type (`docs/02_research/05_canonical_build_plan.md`
§6) is the type-system manifestation that HR is plumbed but not load-bearing.
