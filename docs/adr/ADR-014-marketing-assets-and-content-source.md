# ADR-014: Marketing assets pipeline and content provenance

**Status:** Accepted
**Date:** 2026-04-29
**Build Day:** 6 of 8 (post-feature-freeze planning)
**Implementation:** shipped 2026-04-29; 4 PNGs live at `web-app/public/marketing/`; copy centralised in `web-app/src/data/marketing-copy.ts` with the illustrative-content disclosure JSDoc; waitlist CTAs read `import.meta.env.VITE_WAITLIST_URL` at component-render time (unset → `<button disabled>`); slideshow images deferred via `loading="lazy"` on slides 1–2.
**Supersedes:** (none)
**Superseded by:** (none)

## Context

The marketing landing page (per ADR-012, ADR-013) ships with three
classes of payload that none of the four product DDDs currently handle:

1. **Bitmap images** — 4 PNGs in
   `docs/03_designs/images/`: `room-notices-v4.png` (~hero room shot),
   `01-late-night-clean.png`, `02-the-shift-clean.png`,
   `03-recovery-mode-clean.png` (the slideshow triplet).
2. **Inline SVGs** — the logo mark, the four "how it works" icons, the
   horizontal-flow arrows, the testimonial-card decorative gradients,
   the lock pictogram. These are part of the design HTML and are
   small enough to inline.
3. **Long-form copy and statistical claims** — every headline, eyebrow,
   stat ("8–12 min", "76M U.S. adults", "$9 once for a whole household"),
   testimonial quote, and bullet on the page is creative content that has
   no upstream source in the project's research notes (`docs/02_research/*`)
   and is not derived from any data the build pipeline owns. The hero
   subhead, the "Tuesday, 2:42 PM" mockup body, and the testimonials
   under "Maya R." and "Daniel K." are illustrative-not-real and must be
   labelled as such.
4. **One outbound CTA** — the design HTML's "Join the waitlist →" button
   has no implemented backend in this project. The buildathon plan
   (`docs/plan/implementation-plan.md`) has no waitlist signup task.

ADRs 012 and 013 deferred all of these to ADR-014 because the answers do
not affect routing or visual systems — they are content/operations
decisions.

## Decision

### Image pipeline

- The 4 design PNGs **move** (not copy) from
  `docs/03_designs/images/` to `web-app/public/marketing/`. Single
  source of truth; Vite serves `public/` at the root path; the
  `<img src="/marketing/01-late-night-clean.png">` form works without an
  import.
- File names are preserved verbatim (`room-notices-v4.png`,
  `01-late-night-clean.png`, `02-the-shift-clean.png`,
  `03-recovery-mode-clean.png`) so that any future re-export from the
  designer's Figma replaces the file in place without code edits.
- A README in `web-app/public/marketing/README.md` records dimensions,
  intended use (which slide), and provenance (designer, source file).
  This is the only `*.md` proactively created under `web-app/`; it is
  necessary to satisfy the asset-source traceability invariant in
  DDD-05.
- The references in `docs/03_designs/MindRefreshStudio v2.html` (lines
  413, 515, 522, 529) are not edited; the design HTML stays as-is in
  `docs/` for future ports. Code paths read from `/marketing/*`.
- No image optimisation pipeline (sharp, squoosh) for V1. The PNGs are
  shipped at source resolution. If the marketing-route Lighthouse score
  drops below 75 on a Day-A check, ADR-014 is amended with a one-line
  pre-commit `sharp` step; until that signal arrives we do nothing.

> *Future migration note.* The PNGs in `web-app/public/marketing/` are
> ~1–3 MB each and load eagerly via `<img>` tags. If a CMS or
> design-system version follows, swap to `<picture>` with WebP/AVIF
> sources in a follow-on ADR; the path naming above is stable across
> that change.

### SVG strategy

- All SVGs from the design HTML are inlined into their owning React
  component. Rationale: each SVG is < 1 KB, used in exactly one place,
  and inlining keeps the markup self-contained and trivially reviewable.
- The logo mark (a 3-circle motif at HTML lines 358–362, 889–892, and the
  footer at 908–911) is the only SVG used 3× — it is extracted to
  `web-app/src/components/marketing/MarketingLogo.tsx` exactly once.
- No `lucide-react` icons in marketing components. The dashboard already
  uses `lucide-react` per ADR-005's stack; the marketing page uses the
  hand-drawn SVGs from the design HTML (line illustrations, not glyphs)
  and that distinction is part of the visual identity.

### Copy and statistical claims

- All marketing copy (headlines, eyebrows, body, stats, testimonials,
  bullets) is moved verbatim from
  `docs/03_designs/MindRefreshStudio v2.html` into a single file
  `web-app/src/data/marketing-copy.ts` exporting a typed object tree
  named `marketingCopy`. Components destructure from it. This makes
  copy changes one-file edits (i18n-ready post-buildathon, though i18n
  itself is out of scope).
- **Illustrative content disclosure.** The "Tuesday, 2:42 PM" mockup
  copy, the "8 min", "$9", "76M U.S. adults", and "2,400+ on the
  waitlist" lines, and the Maya R. / Daniel K. testimonials are
  illustrative — the buildathon ships no waitlist, no shipping
  fulfilment, no validated user testimonials, and no pricing decision.
  `marketing-copy.ts` carries an inline JSDoc block at the top stating
  "All numerical claims and named users on this page are illustrative
  for the buildathon submission. They will be replaced or removed
  before any public, post-buildathon launch." The buildathon write-up
  (`docs/submission/writeup.md`, future) will include the same
  disclosure.
- **Stats sourcing.** When the same numbers appear in the buildathon
  write-up, they must either (a) be replaced with cited values, or (b)
  carry the same illustrative disclosure. The number `8–12 min` is
  consistent with the existing `docs/02_research/05_canonical_build_plan.md`
  framing of the activation-detection window and is acceptable; `$9` and
  `76M U.S. adults` are not in any research doc and must be flagged or
  removed in the submission text. This is documented in
  `docs/plan/landing-page-plan.md` Day-A Block 4.

### "Join the waitlist" CTA — no live signup for V1

- Every "Join the waitlist", "Reserve your spot", and "Reserve your
  sensor" link on the page resolves to a single configurable target,
  exposed via the existing Vite env mechanism:
  - `VITE_WAITLIST_URL` — if set, all waitlist CTAs link to it.
    Acceptable values: a Tally / Notion / Google Form URL, a `mailto:`
    URL, or any external endpoint.
  - **If `VITE_WAITLIST_URL` is unset, every waitlist CTA is rendered as
    a `<button disabled>` with an inline tooltip "Coming soon".**
- The default for the buildathon submission is **unset**. We are not
  going to operate a waitlist during judging.
- Demo affordance: the design HTML's mockup-card "Begin →" button (the
  one inside the live-demo card, not the waitlist) is the **only** CTA
  that resolves to a live destination —
  `/dashboard?source=recorded` (per ADR-012's CTA-wiring table). This
  gives a curious judge one clean path from the marketing page into the
  product.
- No analytics, no pixel, no tracking SDK. The marketing page makes zero
  network requests other than the Google Fonts fetch (per ADR-013) and
  the image loads.

### Image alt-text and accessibility

- Each image's `alt` attribute is the design HTML's value verbatim:
  - `room-notices-v4.png` →
    `"The room notices first — MindRefresh sensor reading breath rhythm, micro-motion, and environmental sensing"`
  - `01-late-night-clean.png` → `"Woman working late at night, 1:42am"`
  - `02-the-shift-clean.png` →
    `"Same woman the next afternoon, frozen posture"`
  - `03-recovery-mode-clean.png` →
    `"Woman near window, hand holding mug, eyes closed"`
- The slideshow exposes prev/next controls keyboard-accessible
  (the existing `<button class="ss-dot">` pattern; ported to React
  buttons). `aria-label="Slide N"` is preserved on each dot.
- `aria-hidden="true"` on every decorative SVG and on the connector
  list-items in the "How it works" `<ol>` (matches design HTML).

### Outbound links

- The design HTML's `<a href="#">` placeholders for the footer's
  Privacy / Terms / Contact links resolve to:
  - Privacy → `#` (anchors top of page) for V1, with a `title`
    attribute "Privacy policy in progress." When ADR-007's Supabase
    privacy framing is finalised in a public document, this becomes a
    link to that document.
  - Terms → same treatment; "Terms in progress."
  - Contact → `mailto:hello@mindrefresh.example` (placeholder; replace
    when a real address is provisioned post-buildathon).

## Consequences

### Positive

- One folder (`web-app/public/marketing/`) holds the bitmap payload; one
  file (`marketing-copy.ts`) holds the textual payload; one file
  (`MarketingLogo.tsx`) holds the logo SVG. Three locations to inspect
  for any copy/asset change.
- Zero new third-party SDKs, no analytics, no tracking — the marketing
  page passes a privacy-centric review trivially. This is consistent
  with the doc 05 §3 / ADR-007 privacy framing.
- The "Join the waitlist" mechanism degrades cleanly: setting
  `VITE_WAITLIST_URL` post-buildathon turns the disabled buttons live in
  one env-var change and one redeploy.
- The illustrative-content disclosure lives in code, not just in
  documentation, so any future contributor sees it before changing
  numbers.

### Negative

- The illustrative testimonials ("Maya R.", "Daniel K.") and the "$9
  one-time" claim are visible to any submission judge who reads
  carefully. Mitigation: the write-up surfaces the disclosure (see
  References). Risk that a judge marks down for unverified claims is
  accepted as a brand-shape tradeoff.
- The PNG payload (~6 MB total) on the public route is heavier than the
  dashboard's JS bundle target. We are explicitly choosing not to
  optimise for V1.
- Move-not-copy for the design assets means
  `docs/03_designs/MindRefreshStudio v2.html` becomes a *broken-image*
  static file (its `<img src="images/...">` paths no longer resolve when
  opened directly in a browser). Mitigation: the design HTML's purpose
  is reference/handoff, not running; a one-line note in
  `docs/03_designs/README.md` (created in the implementation plan) records
  this, alongside the rationale that duplicating ~6 MB of PNGs across
  two trees is worse than a stale local preview.

### Neutral

- The waitlist URL configuration via env var follows the same pattern as
  ADR-008's `VITE_SENSING_WS_URL` dev override; one consistent
  configuration story across the app.
- Footer links remaining as anchors is honest — V1 has no privacy/terms
  page yet; pretending otherwise would be worse.

## Alternatives Considered

- **Import images via Vite's `import logo from
  './assets/logo.png?url'` mechanism.** Rejected: introduces a
  build-graph dependency that does not gain anything for the public
  folder. `public/` is the right tool for "static asset, never
  bundled."
- **Use a third-party waitlist service (Tally / Sheet2API / Resend) at
  build time.** Rejected for V1: a real signup flow needs privacy
  copy, a confirmation email, an unsubscribe path, and a backing store —
  none of which are in the buildathon scope. Defer until post-
  submission.
- **Strip illustrative testimonials and stats; ship the page with
  blanks.** Rejected: the page's emotional arc depends on those
  specifics; blanks would read as unfinished. Disclosure beats
  silence.
- **Inline images as base64 in the HTML.** Rejected: blows up the
  initial HTML size and makes browser caching pointless.

## References

- `docs/03_designs/MindRefreshStudio v2.html` — content source of
  truth (lines 413, 515–533 for image references; lines 380–407,
  482–486, 496–497, 549–562, 569–593, 599–617, 623–688, 696–737,
  743–778, 786–854, 860–884, 888–903 for copy).
- `docs/03_designs/images/` — origin of the 4 PNGs.
- ADR-007 — privacy framing this ADR inherits.
- ADR-012 — route restructure; this ADR's CTA-target rules implement
  ADR-012's CTA-wiring table.
- ADR-013 — design system; this ADR is its content/asset companion.
- DDD-05 §File map and §Anti-corruption layer.
- `docs/plan/landing-page-plan.md` Day-A Block 1 (asset move) and
  Block 4 (illustrative-content disclosure pass).
- `docs/02_research/05_canonical_build_plan.md` §3 (data-classification /
  privacy framing this ADR mirrors).

## Test Hooks (London-school)

- `web-app/tests/marketing/copy.spec.ts` — pure: imports
  `marketing-copy.ts`; asserts every text node in the design HTML's
  hero, problem, how-it-works, vs, isnt, and final-cta sections appears
  verbatim in `marketingCopy`. Mechanically prevents copy drift between
  the design source and the rendered page.
- `web-app/tests/marketing/cta-targets.spec.ts` — pure: imports the
  page tree, walks every `<a>` and `<button>`, asserts:
  - every "Join waitlist" anchor's `href` equals
    `import.meta.env.VITE_WAITLIST_URL` when set, else the element is
    `disabled`;
  - the live-demo card's "Begin →" anchor's `href` equals
    `/dashboard?source=recorded`;
  - no `<a href>` points to an external domain other than
    `fonts.googleapis.com`, `fonts.gstatic.com`, the configured
    waitlist URL, and the configured contact email's `mailto:`.
- `web-app/tests/marketing/assets.spec.ts` — runs at build time;
  asserts each `<img src="/marketing/...">` path exists in
  `web-app/public/marketing/` (no broken images post-deploy).
- `web-app/tests/marketing/illustrative-disclosure.spec.ts` — asserts
  `marketing-copy.ts`'s top-of-file JSDoc contains the literal
  "illustrative" disclosure paragraph; fails if someone removes it
  while leaving the testimonial copy.
