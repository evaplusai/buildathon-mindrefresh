# ADR-012: Public marketing landing replaces app-entry as root route

**Status:** Accepted
**Date:** 2026-04-29
**Build Day:** 6 of 8 (post-feature-freeze planning)
**Implementation:** shipped 2026-04-29; routes `/` (MarketingRoot → MarketingLanding), `/_entry` (AppEntry), `/dashboard` (lazy-loaded) live; `?source=` and `?dev=` query-param forward to `/dashboard${search}` with `replace` semantics.
**Supersedes:** (none — extends ADR-005's two-link architecture surface inventory)
**Superseded by:** (none)

## Context

The current SPA root (`web-app/src/pages/Landing.tsx`, mounted at `/` in
`web-app/src/App.tsx`) is a 37-line "app entry" placeholder: title, one
sentence of positioning, two CTAs (`Open dashboard`, `Try recorded session →
/dashboard?source=recorded`). It exists because Day 3 of the buildathon plan
(`docs/plan/implementation-plan.md` §4 Block 2 task `S3-B2-T4`) only
required "the somatic narrative hero" so that the Vercel hello-world had
something on it.

The user has now produced a complete marketing landing page at
`docs/03_designs/MindRefreshStudio v2.html` — 943 lines, 11 sections
(banner, nav, hero, manifesto band, hero mockup, stats, problem, how-it-
works, live demo, vs wearables, testimonials, isn't-this, final CTA,
footer), 4 hero/storytelling images already in
`docs/03_designs/images/`, plus a slideshow script. The intent is for this
page to be the public face of the product — what someone sees when they
type the URL — and for the dashboard (the live-sensor product surface) to
sit one click away.

This ADR resolves the route restructure. It does NOT design the marketing
context internals (see DDD-05 in `docs/ddd/05_marketing_context.md`), nor
the visual system (ADR-013), nor the asset pipeline (ADR-014).

The decision is forced by two observable facts:

1. The current `/` route's two CTAs ("Open dashboard", "Try recorded
   session") are *operator-facing*, not visitor-facing. A judge or user
   landing on the production URL would see a debug entry page, not a
   product. The new landing page is the entire marketing pitch and ends
   in a single "Reserve your sensor" CTA — that is the public root.
2. The buildathon plan (`docs/plan/implementation-plan.md` §14 Definition
   of Done item 1) requires *both* `?source=recorded` (no sensor) and
   `?dev=1` (force-morning-check) to be reachable from the live URL.
   Those are *internal demo affordances* and must remain reachable, but
   not from a CTA on the public landing page.

## Decision

The marketing landing page becomes the `/` route. The current app-entry
behaviour does not disappear — it is decomposed into navigational links
and demo-mode query parameters preserved on the dashboard route.

### Route map (V1, post-landing)

| Path | Purpose | Visibility |
|---|---|---|
| `/` | Marketing landing page (`MarketingLanding.tsx`). | Public. |
| `/dashboard` | Live-sensor product surface (`Dashboard.tsx`). | Public-but-deep. |
| `/dashboard?source=recorded` | Recorded-fixture playback. | Public, demo URL. |
| `/dashboard?dev=1` | Force-morning-check + dev affordances. | Operator-only, undocumented. |
| `*` | `NotFound.tsx`. | (unchanged) |

### CTA wiring

| Source CTA in design | New target |
|---|---|
| Top-banner "Reserve your spot" | Anchors to `#cta` on the same page. |
| Nav `Join waitlist →` | Anchors to `#cta`. |
| Hero `Join the waitlist →` | Anchors to `#cta`. |
| Hero `See how it works` | Anchors to `#how`. |
| Final-CTA `Join the waitlist →` | Mailto or noop in V1 — see ADR-014. |
| Final-CTA `Begin →` (in demo card) | **Re-routed to `/dashboard?source=recorded`** so a curious judge can click into the live product. The card's existing visual treatment is preserved. |

The current `Landing.tsx` file is NOT deleted; it is renamed to
`web-app/src/pages/AppEntry.tsx` (operator-only) and wired to a path the
production user never sees — recommended `/_entry` — and its contents are
left otherwise unchanged. The buildathon's existing E2E suite
(`web-app/e2e/`) that targets `/` is updated to target `/_entry` for the
two operator-CTA assertions; the new `/` E2E covers the marketing surface
(see `docs/plan/landing-page-plan.md` Day-A Block 4).

> Why preserve `AppEntry.tsx` instead of inlining its CTAs into the
> dashboard?  Two reasons. First, the buildathon demo flow (Day 7 in
> `docs/plan/implementation-plan.md`) opens `/?source=recorded` in
> incognito on a stranger's laptop; if `?source=recorded` lands on the
> *marketing page* instead of the *dashboard*, the demo flow breaks. The
> simplest fix is to keep `?source=recorded` on `/dashboard` and route
> the marketing CTA there explicitly. Second, `AppEntry.tsx` is the
> single place an operator can see "is everything wired" without
> scrolling through marketing content.

### Forwarding rules for the demo URL

The Day-7 / Day-8 demo URL pattern in `docs/plan/implementation-plan.md`
§8 was `https://mindrefresh-studio.vercel.app/?source=recorded`. After
this ADR, that exact URL goes to the *marketing page* with a query
parameter the marketing page does not consume. Two acceptable resolutions:

- **A (preferred).** Update the demo URL in the README, the demo video
  script, and the submission form to
  `https://mindrefresh-studio.vercel.app/dashboard?source=recorded`. One
  edit per surface; documented.
- **B (compatibility).** Add a one-line redirect in `MarketingLanding.tsx`:
  if `URLSearchParams.has('source')` or `URLSearchParams.has('dev')`,
  `<Navigate to="/dashboard${search}" replace />`. Costs ~5 LOC; no other
  surface needs editing.

**Resolution (default for the implementation plan): B.** It is cheaper to
change the code once than to remember to update three external surfaces,
and it preserves any links a judge has already saved.

## Consequences

### Positive

- The production URL shows the product to a stranger, not a debug entry.
  The DoD item 1 (`pnpm test` + working URL) is unchanged because the
  query-parameter forwarding rule keeps every existing demo flow alive.
- The marketing page and the dashboard each have a single, evident
  responsibility. The existing four DDDs (`Sensing`, `State`,
  `Intervention`, `Memory`) remain untouched — the marketing page
  imports nothing from them. (See DDD-05.)
- A judge typing the bare URL gets the strongest possible first impression
  (the design HTML's hero); a judge who has been pointed at the demo URL
  is forwarded transparently into the dashboard.

### Negative

- One additional route + one additional E2E test path. Negligible.
- The Day-3 plan task `S3-B2-T4` ("create Landing.tsx with somatic
  narrative hero") becomes a renamed `AppEntry.tsx`, so the buildathon
  plan's existing language drifts slightly. Resolution: this ADR + the
  landing-page plan supersede that single task; the canonical plan is not
  rewritten.
- Anyone bookmarking the old `/` (which only operators have done) ends up
  on the marketing page instead of the operator entry. Mitigation: the
  redirect is cheap; `/_entry` is documented in the README's
  "Operator/dev URLs" subsection.

### Neutral

- `?source=recorded` and `?dev=1` semantics on `/dashboard` are
  unchanged (per ADR-005's two-link architecture and ADR-008's locked
  WS URL). This ADR only relocates the *root* route, not the WebSocket
  contract.
- The marketing surface has no runtime dependency on the sensing-server,
  the worker pool, or IndexedDB. A user with no LAN sensor still sees
  the full landing page — the page is fully static.

## Alternatives Considered

- **Keep `/` as `AppEntry.tsx`; mount marketing at `/about`.** Rejected:
  the URL a stranger types is `/`, and the strongest pitch belongs there.
  `/about` would be reached by zero strangers in a 90-second demo.
- **Inline marketing into `AppEntry.tsx`; wire CTAs from inside.**
  Rejected: the marketing page is 11 sections + a slideshow + a
  testimonials grid + a 4-step "how it works"; bundling that into the
  app-entry file violates `CLAUDE.md`'s 500-LOC file cap and conflates
  two purposes.
- **Use Vercel rewrites to serve the static design HTML at `/` and
  proxy `/dashboard` to the React app.** Rejected: the design HTML
  has interactive bits (slideshow auto-rotate; the existing
  `<button class="ss-dot">` handlers) that are easier to re-express in
  React than to hand-port the inline `<script>`; mixed delivery
  (static HTML + SPA) doubles the deploy story without reducing the
  porting budget.
- **Server-render the marketing page (Next.js or RR loader).** Rejected
  for V1: introduces SSR machinery for one route; Vercel + Vite SPA is
  the established pipeline (`docs/plan/implementation-plan.md` §4 Block
  2 task `S3-B2-T5`); SSR is a post-buildathon concern.

## References

- `docs/03_designs/MindRefreshStudio v2.html` — source of truth for the
  marketing surface.
- `docs/plan/implementation-plan.md` §4 (S3-B2-T4 — current Landing.tsx
  origin), §8 (Day 7 demo URL), §14 (Definition of Done item 1).
- `docs/plan/landing-page-plan.md` — operationalises this ADR.
- `docs/05_architecture/01_system_architecture.md` §5, §7 (route layout
  in `src/pages/`).
- ADR-005 (two-link architecture; this ADR adds `/` as a third
  *visibility* surface, not a third link).
- ADR-008 (WS URL locked; not affected).
- ADR-013 (visual system — paired decision).
- ADR-014 (assets pipeline — paired decision).
- DDD-05 (`docs/ddd/05_marketing_context.md`).

## Test Hooks (London-school)

- `web-app/e2e/landing.spec.ts` — Playwright; loads `/`; asserts the
  hero `<h1>` text "Catch the crash before it catches you."; asserts the
  banner CTA exists; asserts the final-CTA "Begin →" link's `href`
  ends in `/dashboard?source=recorded`.
- `web-app/e2e/landing-redirect.spec.ts` — loads
  `/?source=recorded`; asserts final URL is `/dashboard?source=recorded`
  with `replace` semantics (back button does not return to `/`).
- `web-app/e2e/app-entry.spec.ts` — loads `/_entry`; asserts both
  operator CTAs render (assertions ported from current `/` E2E).
- The marketing page contains zero references to `wsClient`, `sessionStore`,
  `triggerWorker`, or any of the four product DDDs. Static-import grep is
  the enforcement (`docs/ddd/05_marketing_context.md` §Anti-corruption
  layer).
