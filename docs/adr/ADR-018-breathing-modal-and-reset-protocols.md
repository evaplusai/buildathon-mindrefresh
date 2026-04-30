# ADR-018: Breathing Modal — accessible full-screen overlay with 3 reset protocols, agent-advisory selection

**Status:** Accepted
**Date:** 2026-04-30
**Build Day:** Post-V1 / Dashboard v2 sprint
**Implementation:** shipped across Sprints A–C (2026-04-30); `BreathingModal.tsx` with createPortal into `#modal-root`, ARIA dialog, focus trap, ESC/backdrop dismissal, prefers-reduced-motion fallback; 3 protocols in `data/breathProtocols.json`; `services/display/resolveProtocol.ts` (Agent 3 advisory + state fallback); `appendIntervention` extended with `completed?: boolean`; 26 dedicated tests (Sprint C added 28 a11y/timing/dismiss/e2e specs).
**Supersedes:** (none — extends ADR-016, ADR-017)
**Superseded by:** (none)

## Context

The Dashboard v2 spec describes a **full-screen breathing modal** that
runs a 5-round physiological sigh protocol with an animated orb
(`docs/03_designs/dashboard-v2_spec.md` §"What's in the reference file"
item 7; `docs/03_designs/dashboard-v2.html` lines 533–599 styles, lines
1025–1046 markup, lines 1402–1474 logic).

Two pieces of the spec collided in the previous planning round:

1. ADR-017 §"Demo Mode" gave the modal one passing mention, and DDD-07's
   file map listed `BreathingModal.tsx`, but no document covers the
   modal's actual architectural decisions — Portal, focus trap, ESC /
   backdrop-click dismissal, mid-protocol abort, completion persistence,
   `prefers-reduced-motion`, or the per-phase orb timing.
2. Spec §"How to extend this" item 5 commits the project to **3 reset
   protocols** (physiological sigh + box breath + 4-7-8) and says
   protocols are *"picked by Agent 3."* ADR-016's `ReframeWriterOutput`
   schema has no `protocol` field, and the dashboard-v2 plan
   (`DC-B1-T1`) picks the protocol by state, not by Agent 3.

This ADR closes both gaps.

## Decision

### A. Protocol selection — Agent 3 advisory + state fallback

Agent 3's output schema is extended with a `protocol` field:

```ts
export type BreathProtocol =
  | 'physiological_sigh'   // 5 rounds × (2s inhale + 1s top-up + 5s exhale)
  | 'box_breath'           // 4 rounds × (4s inhale + 4s hold + 4s exhale + 4s hold)
  | 'four_seven_eight';    // 4 rounds × (4s inhale + 7s hold + 8s exhale)

export interface ReframeWriterOutput {
  reframe: string;
  voiceCheck: string;
  lengthWords: number;
  protocol: BreathProtocol;       // NEW — Agent 3's advisory selection
  protocolReason: string;          // NEW — 1-line rationale shown in agent card
}
```

The modal's protocol resolution rule (single source of truth, encoded
in `web-app/src/services/display/resolveProtocol.ts`):

```
if there is a recent ReflectRun (within 5 min) with non-empty Agent 3 output:
    use ReflectRun.reframe.protocol
else:
    fall back to state-based default:
      shifting → physiological_sigh
      overloaded → physiological_sigh
      drained → box_breath
      steady → physiological_sigh   // user invoked "I need a moment"
```

The fallback table is intentionally simple: **physiological sigh is the
default for everything except `drained`**, where box-breath-with-movement
matches the spec's "needs activation, not more rest" language. Agent 3
overrides this default with reasoning the user can read in the agent
card.

### B. Modal mechanics — Portal + focus trap + dismissal

The modal is rendered via **`react-dom` `createPortal`** into a single
`<div id="modal-root">` mounted once at app startup (in `App.tsx`). This
keeps z-index sane and prevents the dashboard's CSS transforms from
becoming a containing block for the modal.

Dismissal paths (all behavioural-equivalent — they all call
`closeModal()`):
- ESC key (global keydown listener installed on mount)
- Click on `.modal-backdrop` outside the orb
- Click the close button in the top-left
- Mid-protocol dismissal — also fires `incomplete` on the parent
- Completion screen's "RETURN TO TODAY" button

**Focus trap:** the modal is rendered with `role="dialog"` and
`aria-modal="true"`. On open, focus moves to the close button. Tab
cycles through {close button, "RETURN TO TODAY" if visible}. Shift-Tab
reverses. Focus is restored to the original "Begin reset" button on
close (per WCAG 2.4.3 / 2.4.7).

**`prefers-reduced-motion`:** the design HTML has motion-heavy
animations (mandala rings, breathing orb scale, dot pulse). When
`window.matchMedia('(prefers-reduced-motion: reduce)').matches`, the
modal:
- Replaces the orb's `scale()` keyframe animation with discrete static
  scales per phase (inhale: scale 1.4, hold: 1.4, exhale: 1.0) — no
  interpolation
- Removes the `breathe` and `glow` keyframes from the orb
- Replaces dot pulse animation with steady opacity
- Keeps the protocol's timing (the user still inhales for 2s) — only
  the visual interpolation is removed

### C. Mid-protocol dismissal — log incomplete attempts

If the user dismisses the modal before the final round completes, the
session is logged as an `Intervention` row with:

```ts
{
  transitionId: <linked transition or 'manual'>,
  affirmationId: 'breath-' + protocolName,
  breathPattern: protocolName,
  ts: <open ts>,
  durationMs: <ts of dismissal - ts of open>,
  completed: false,                 // NEW — extends Intervention type
}
```

This lets future Pattern Mirror queries differentiate "user opened a
reset and stayed" from "user opened and bailed" — useful signal for
which protocols actually serve which states. The `completed` field is a
new optional column; ADR-007 §"No new tables" still holds (we're
extending an existing column set, not adding a table).

### D. Per-protocol timing reference

| Protocol | Phases per round | Total duration |
|---|---|---|
| `physiological_sigh` | inhale 2s + top-up 1s + exhale 5s | 5 × 8s = **40s** |
| `box_breath` | inhale 4s + hold 4s + exhale 4s + hold 4s | 4 × 16s = **64s** |
| `four_seven_eight` | inhale 4s + hold 7s + exhale 8s | 4 × 19s = **76s** |

These constants live in `web-app/src/data/breathProtocols.json`
(extends the existing `breathPatterns.json` from V1). The 5-round
physiological-sigh timing is preserved verbatim from the design HTML
(`runBreathSequence` lines 1430–1468).

The per-phase instruction text:

| Protocol | Phase 1 (inhale) | Phase 2 | Phase 3 | Phase 4 |
|---|---|---|---|---|
| `physiological_sigh` | "Breathe in *through your nose.*" | "A second small *top-up.*" | "Long, slow exhale *through your mouth.*" | — |
| `box_breath` | "Breathe in *for four counts.*" | "Hold *four counts.*" | "Exhale *four counts.*" | "Hold *four counts.*" |
| `four_seven_eight` | "Breathe in *for four counts.*" | "Hold *for seven counts.*" | "Slow exhale *for eight counts.*" | — |

### E. Completion state

After the final round, the orb fades; a checkmark + `<em>"You're back in the
window."</em>` + a calm 2-line summary + "RETURN TO TODAY" button appear
(matches design HTML `bm-complete` block, lines 1040–1045). Clicking the
button or ESC dismisses with `completed: true`.

If the user has the Reflect card open with an active reframe, returning
to the dashboard preserves the reframe's text — closing the modal does
not reset the page.

## Consequences

### Positive

- The modal becomes accessible-by-construction: focus trap, ESC, ARIA
  roles, `prefers-reduced-motion`. WCAG 2.1 AA passes by default.
- The 3 protocols are real and selected by domain logic, not just
  hardcoded by state. Agent 3's reasoning is visible — users see *why*
  this protocol.
- Mid-protocol abort is captured as data, enabling post-V2 analysis of
  which protocols actually retain users.
- The Portal pattern means future fullscreen experiences (e.g.
  onboarding, post-session reflection) reuse the same `#modal-root`
  mount point.

### Negative

- One additional column (`completed: boolean`) on the `interventions`
  row. Migration is a Supabase ALTER TABLE; existing rows default to
  `true` (legacy data is treated as completed). ADR-007 spirit is
  intact — no new table.
- Agent 3 now produces two extra fields, increasing the JSON schema
  surface. The `validate.ts` from DDD-06 is the single guard.
- `prefers-reduced-motion` discrete scales lose some of the
  brand-smooth feel. Acceptable a11y tradeoff.

### Neutral

- The protocol JSON file is small (~3 KB). No bundle concern.
- Agent 3's `protocolReason` field is shown in the agent card next to
  the reframe — no separate UI surface to design.

## Alternatives Considered

- **Pick protocol by state only (no agent involvement).** Rejected:
  spec §"How to extend this" item 5 explicitly assigns this to Agent 3,
  and it's the more interesting demo story. Falling back to state when
  no recent agent run exists is the right hybrid.
- **Run the modal as a route, not a modal.** Rejected: design intent is
  full-screen overlay that returns to the same dashboard state. A route
  break loses the "back to where you were" affordance.
- **Use a third-party modal library.** Rejected: 3rd-party adds bundle
  weight; the modal is ~80 LOC of JSX. Build it.
- **Skip `prefers-reduced-motion` for V2.** Rejected: the design has
  enough motion that ignoring this fails an a11y review; `matchMedia`
  is 2 lines and saves an audit cycle.
- **Add a 4th protocol (grounding) per spec §"Reset interactivity."**
  Considered. Spec mentions "grounding prompts" alongside box breath
  and 4-7-8. Rejected for V2 because grounding is text-driven, not
  breath-paced — it would need a different modal layout. ADR-019
  (post-V2) introduces a `grounding` modal variant with an "I see / I
  hear / I feel" 3-step prompt.
- **Persist completion via a separate `breath_sessions` table.**
  Rejected: an Intervention row already captures the relationship to a
  transition + the chosen pattern; a new table doubles the join cost
  for Pattern Mirror queries.

## References

- `docs/03_designs/dashboard-v2_spec.md` §"What's in the reference file"
  item 7 (modal description), §"How to extend this" item 5 (3 protocols
  picked by Agent 3)
- `docs/03_designs/dashboard-v2.html` lines 533–599 (modal styles), lines
  1025–1046 (modal markup), lines 1402–1474 (`runBreathSequence` logic)
- ADR-007 (no new tables; this ADR adds one column, intent preserved)
- ADR-015 (4-state mapping — protocol fallback table mirrors)
- ADR-016 (Agent 3 = Reframe Writer; this ADR extends its output schema)
- ADR-017 (Reset card; this ADR clarifies the modal that the Reset
  card opens)
- DDD-06 §Public Interface (the `ReframeWriterOutput` extension)
- DDD-07 §File map (`BreathingModal.tsx` — this ADR fills in the
  architectural detail)
- WCAG 2.1 AA — 2.4.3 Focus Order, 2.4.7 Focus Visible, 2.3.3
  Animation from Interactions

## Test Hooks (London-school)

- `tests/display/breathingModal.spec.ts`
  - opens the modal; asserts focus moves to the close button
  - presses ESC; asserts modal closes; asserts focus returns to
    `Begin reset`
  - asserts `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
    pointing at the protocol title
  - mocks `matchMedia('(prefers-reduced-motion: reduce)')`; asserts the
    orb has no `animation` style and uses discrete scale per phase
- `tests/display/breathingProtocols.spec.ts`
  - fake timers; for each of the 3 protocols, asserts every phase
    fires at the documented timing within ±50 ms tolerance
  - asserts on the final round, the completion screen renders
- `tests/display/resolveProtocol.spec.ts`
  - feeds (recent ReflectRun, dashboardState) tuples; asserts the
    resolution rule from §A
- `tests/display/breathingDismiss.spec.ts`
  - opens modal; dismisses at round 2; asserts an
    `Intervention` row was appended with `completed: false`,
    `durationMs ≈ 16 s` (for sigh), and the right `breathPattern`
- `tests/reflection/agent3-protocol.spec.ts`
  - mocks Agent 3 returning `{protocol: 'box_breath', protocolReason:
    "..."}`; asserts the modal opens with box-breath when invoked
    within 5 minutes of the run
  - asserts agent's `protocol` is validated against the
    `BreathProtocol` enum; an invalid value falls back to state default
- E2E: `e2e/breathing-modal.spec.ts`
  - in `?source=recorded`, drives the dashboard to `overloaded`;
    clicks "Begin reset"; waits for the orb to scale; presses ESC;
    asserts dashboard returns and an Intervention row with
    `completed: false` was logged
