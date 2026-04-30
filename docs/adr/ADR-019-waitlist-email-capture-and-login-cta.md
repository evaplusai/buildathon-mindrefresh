# ADR-019: Marketing surface gets clickable logo, Login CTA, and waitlist email capture

**Status:** Proposed
**Date:** 2026-04-30
**Build Day:** Post-V1 / dashboard-v2 polish
**Supersedes:** Partially supersedes ADR-014 §"Join the waitlist CTA — no live signup for V1"
**Superseded by:** (none)

## Context

After dashboard-v2 shipped, three small but load-bearing UX gaps
remain on the marketing surface:

1. **The logo is not a link.** Convention dictates that clicking the
   brand mark in the top-left navigates to the home page. Currently
   `MarketingNav` renders the logo + brand text as a plain `<div>`.
   Visitors who scroll deep into the page have no obvious way back to
   the top besides scrolling.

2. **The top-right "Join waitlist →" button competes with the body
   waitlist CTAs and lacks an entry to the live product.** The
   marketing landing has *no* path to `/dashboard` for a visitor who
   wants to see the product. The "Begin →" link inside the live-demo
   card is the only one (per ADR-012 §CTA wiring), and it requires
   scrolling to find. A nav-level **Login** CTA is the conventional
   shape — and routes to `/dashboard` because we have no real auth
   yet (ADR-007 / ADR-011 leave magic-link auth as post-buildathon).

3. **The body waitlist CTAs are dead.** Per ADR-014 §"Join the
   waitlist CTA — no live signup for V1", every waitlist CTA renders
   as `<button disabled>` when `VITE_WAITLIST_URL` is unset (the
   default) — which is the production state. Visitors who want to
   signal interest cannot. We've shipped without any conversion
   surface. The buildathon submission scoring values evidence of
   user interest; a working waitlist closes that gap and gives us
   real emails to follow up with after the demo window.

## Decision

### A. Logo is a `<Link to="/">`

The 3-circle brand mark + "MindRefresh" text in `MarketingNav` is
wrapped in a `<Link to="/">` from react-router-dom. The link is
keyboard-focusable, carries `aria-label="MindRefresh — home"`, and
renders the same component tree as before (no visual change). This
is also wired on the dashboard's nav for parity (Sprint A's
`Dashboard.tsx` already mounts a similar nav).

### B. Top-right CTA: "Login" → `/dashboard`

The marketing nav's right-hand CTA (currently the green "Join
waitlist →" pill) is replaced by a "Login" pill linking to
`/dashboard`. Same visual treatment — green-800 background, cream
text, rounded-full pill — only the label and href change.

The label is "Login" (not "Sign in" / "Open app") because:

- "Sign in" implies an authentication surface we do not have.
- "Open app" reads aspirational; "Login" reads conventional and
  confident.
- The dashboard route is a *demo experience*, not a personal
  account — clicking "Login" delivers exactly that. When magic-link
  auth ships (ADR-011 deferred), this CTA upgrades to a real auth
  flow without changing copy or position.

### C. Waitlist CTAs require an email

Every other "Join the waitlist" / "Reserve your spot" / "Reserve
your sensor" CTA on the marketing surface (banner top, hero, final
CTA) opens an email-capture modal. The modal:

- Is a single text input (`type="email"`, `required`,
  `autoComplete="email"`) + a "Reserve my spot" submit button + a
  Cancel button + an ESC dismiss.
- Validates client-side (HTML5 + a regex backstop) before submit.
- On submit: persists `(email, ts, source)` to a new Supabase table
  `waitlist_signups`. Source is one of `'banner' | 'nav' | 'hero' |
  'final-cta'` so we can later attribute conversion by surface.
- Shows a success state ("Thanks — we'll reach out the moment your
  unit ships.") then auto-dismisses after 2 s.
- Is rendered via React Portal at the same `#modal-root` mount point
  used by the BreathingModal (ADR-018) so a11y rules are inherited.

The "Login" CTA (top right) does **not** open the modal — it
navigates directly to `/dashboard`. Email capture is for visitors
who want to be notified about the product; "Login" is for visitors
who want to try it now.

### D. Persistence schema (waitlist_signups)

A new Supabase table, migration `0002_waitlist_signups.sql`:

```sql
create table if not exists public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  ts timestamptz not null default now(),
  source text not null check (source in ('banner','nav','hero','final-cta','other')),
  unique (email, source)
);
create index if not exists waitlist_signups_ts_idx
  on public.waitlist_signups(ts desc);
```

- Anon-key writes allowed (RLS disabled, matching ADR-007 pattern).
- `(email, source)` unique constraint prevents the same surface
  re-submitting on re-render or repeated clicks. Email submitted from
  multiple surfaces creates separate rows (intentional — captures
  the conversion path).
- No PII beyond the email itself; we do not capture IP, user-agent,
  or referrer at the SDK level. The Supabase client sends standard
  headers but we do not add tracking.

ADR-007 said "no new tables in V1." ADR-019 explicitly extends that
ruling for V2 with one additional table — narrowly scoped, still
RLS-disabled per the ADR-007 pattern, no auth surface. The
`raw_vitals` / `whats_alive` prohibitions from ADR-007 stand.

### E. ADR-014 amendment

ADR-014 §"Join the waitlist CTA — no live signup for V1" said:

> Every "Join the waitlist", "Reserve your spot", and "Reserve your
> sensor" link on the page resolves to a single configurable target
> via `VITE_WAITLIST_URL`. If unset, every waitlist CTA is rendered
> as a `<button disabled>`.

This is **superseded for the body CTAs only** by §C above. The
header CTA is replaced entirely (§B). `VITE_WAITLIST_URL` is no
longer read by any production code — it's deprecated.

The illustrative-content disclosure in `marketing-copy.ts` (ADR-014
§"Copy and statistical claims") still applies: testimonials,
"2,400+ on the waitlist" social-proof line, and the "$9 / 76M /
8 min" stats remain illustrative. Real waitlist signups now
populate Supabase; the public proof-line copy is unchanged for V2
and will be replaced with real numbers in a future ADR once we have
them.

## Consequences

### Positive

- The marketing surface becomes navigationally complete: home (logo),
  product entry (Login), and conversion (waitlist modal) are all one
  click away from any scroll position.
- We capture real emails for follow-up — meaningful evidence of
  interest beyond the demo window.
- No new infrastructure: reuses the existing Supabase project, the
  `@supabase/supabase-js` client already on the bundle, the
  `#modal-root` portal mount from ADR-018, and the existing isolation
  rules.
- The `(email, source)` unique constraint protects against double-
  submission on accidental double-clicks without server-side logic.

### Negative

- Adds one new Supabase table — direct extension of ADR-007's V1
  schema rule. Mitigated by: still RLS-disabled, narrowly scoped,
  no PII beyond the email, prohibition on raw_vitals / whats_alive
  stands.
- Email handling is now subject to privacy regulations (GDPR /
  CCPA). For the buildathon submission this is acceptable because
  (a) the demo window is short, (b) we explicitly state the email is
  for early-access notifications, (c) we don't share with third
  parties. A privacy/terms page is still post-buildathon (ADR-014
  §"Outbound links").
- The waitlist modal increases the marketing-route bundle by ~3 KB
  gzipped. Within budget (currently 102 KB of a 200 KB target).

### Neutral

- ADR-014's `VITE_WAITLIST_URL` env var is deprecated (no longer
  read). Existing deploys with it set are unaffected — the new code
  ignores it. Future `.env.example` updates will remove the line.
- The "Login" CTA reads as a conventional auth entry; users with
  "I don't have an account" reflex will pause before clicking. The
  dashboard mounts immediately for everyone (no auth wall in V2),
  so the pause is brief and the destination delivers. ADR-011's
  magic-link path will eventually fix this; this ADR notes the
  current label/destination mismatch as deliberate scope.

## Alternatives Considered

- **Keep the disabled-button waitlist; ship without email capture.**
  Rejected: matches the ADR-014 V1 ruling but loses the conversion
  surface in V2 when we have the cycles to ship a real one.
- **Use a third-party waitlist service (Tally / Sheet2API / Resend).**
  Rejected: adds another vendor + tracking surface; we already have
  Supabase wired and the form is 30 LOC.
- **Use `mailto:` with a pre-canned subject.** Rejected: clunky UX,
  no central capture, depends on the user's default mail client.
- **Replace "Login" with "Sign in" / "Open app" / "Try it".**
  Considered. "Login" wins on convention; we accept the slight copy
  mismatch with the no-auth dashboard until ADR-011 ships.
- **Open the waitlist modal from the header CTA too.** Rejected:
  the visitor who wants to see the product wants the dashboard, not
  another form. Two distinct intents → two distinct CTAs.
- **Capture IP / referrer / UA in `waitlist_signups`.** Rejected:
  not needed for the buildathon use case; expands GDPR surface
  unnecessarily.

## References

- ADR-007 (Supabase V1 simplified — the "RLS-disabled anon writes"
  pattern this ADR follows).
- ADR-011 (auth + RLS deferred — informs the "Login → /dashboard"
  decision).
- ADR-012 §CTA wiring (existing CTA mapping; this ADR amends).
- ADR-014 §"Join the waitlist CTA — no live signup for V1" (this
  ADR amends; `VITE_WAITLIST_URL` deprecated).
- ADR-018 §B Modal mechanics (the `#modal-root` portal pattern this
  ADR reuses).
- DDD-04 Memory context (the Supabase persistence layer).
- DDD-05 Marketing context (the surface this ADR modifies).

## Test Hooks

- `tests/marketing/cta-targets.spec.tsx` — UPDATED: top-right CTA is
  now an `<a>` with `href="/dashboard"` and label "Login" (was
  `<button disabled>` or external waitlist URL); body waitlist CTAs
  are `<button>` elements that open a modal (not anchors).
- `tests/marketing/logo-link.spec.tsx` — NEW: the logo + brand text
  in the marketing nav resolves to a `<Link>` (anchor) with
  `href="/"` and `aria-label` matching `/MindRefresh.*home/i`.
- `tests/marketing/waitlist-modal.spec.tsx` — NEW: render the modal
  in isolation; assert email field validation (empty / malformed /
  valid); on valid submit, assert `submitWaitlistEmail` was called
  with the canonical args; assert success state appears; assert ESC
  dismisses the modal.
- `tests/marketing/waitlist-service.spec.ts` — NEW: mock the
  Supabase client; assert `submitWaitlistEmail` calls
  `from('waitlist_signups').insert([{ email, source }])`; assert
  duplicate `(email, source)` is treated as a soft success (no
  error thrown to caller).
- `e2e/waitlist.spec.ts` — NEW: load `/`; click the hero waitlist
  CTA; type a test email; submit; assert success state appears.
  (The Supabase write is mocked at the network layer to avoid
  inserting test data into production.)
