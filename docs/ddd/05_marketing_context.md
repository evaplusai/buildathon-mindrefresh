# DDD — Marketing / Acquisition Bounded Context

**Status:** Accepted (V1 add-on)
**Source of truth:** `docs/03_designs/MindRefreshStudio v2.html` and ADR-012/013/014
**Build Day:** 6 of 8 (post-feature-freeze)
**Implementation:** shipped 2026-04-29; 15 section components + MarketingLanding compose the page; isolation invariants 1, 2, 3, 5, 6, 7 enforced by tests in `web-app/tests/marketing/` (all passing); invariant 4 enforced by `illustrative-disclosure.spec.ts`; invariant 8 (static rendering) holds — page has no runtime data dependencies.

## Purpose

The Marketing context owns the public-facing pitch — the surface a
stranger sees when they type the bare URL. Given a visitor with no prior
session, no sensor on LAN, and possibly no idea what the product is, it
renders the brand story (problem → solution → how-it-works → social
proof → final CTA), preserves a single demo path into the live product
(`/dashboard?source=recorded`), and exposes one outbound conversion CTA
("Join the waitlist"). It does not classify states, sense vitals,
intervene, or persist anything about the visitor.

This context is fully **leaf** with respect to the four product DDDs
(`Sensing`, `State`, `Intervention`, `Memory`): it imports from none of
them, and they import from none of it. The marketing surface is the only
surface a visitor can reach without an active sensor — the four product
contexts continue to assume the dashboard's runtime stack.

## Boundary

Inside: every component under `web-app/src/components/marketing/**`, the
single page `web-app/src/pages/MarketingLanding.tsx`, the styles file
`web-app/src/styles/marketing-tokens.css`, the copy file
`web-app/src/data/marketing-copy.ts`, the static assets in
`web-app/public/marketing/**`. Outside: the dashboard surface
(`web-app/src/pages/Dashboard.tsx`), the worker pool
(`web-app/src/workers/**`), the WS client (`web-app/src/services/wsClient.ts`),
the IndexedDB layer (`web-app/src/services/sessionStore.ts`), Supabase
(`web-app/src/services/cloudSync.ts`), the affirmation/breath corpora,
and every type under `web-app/src/types/{vitals,state,intervention}.ts`.
The seam is the React Router boundary — `/` mounts `MarketingLanding`;
`/dashboard` mounts `Dashboard`. Reference: ADR-012 §Route map; ADR-013
§Isolation rules.

## Ubiquitous Language

| Term | Definition |
|---|---|
| **MarketingLanding** | The single page mounted at `/`; composes all marketing sections. |
| **MarketingLayout** | The wrapper that injects Source Serif 4 / Source Sans 3 fonts and the marketing CSS tokens; the only place those side-effects happen. |
| **section** | One of the 11 narrative blocks in the design HTML — banner, nav, hero, manifesto-band, hero-mockup, stats-band, problem, how-it-works, live-demo, vs-wearables, testimonials, isnt-list, final-cta, footer. Each maps 1:1 to a React component. |
| **eyebrow** | A small monospace label above a section title; design-system primitive. |
| **slideshow** | The 3-frame storytelling carousel inside the hero mockup; auto-rotates every 4.5 s with click-to-jump dots. |
| **design token** | One of the cream/green CSS variables enumerated in ADR-013. Every marketing component references tokens, never raw hex. |
| **CTA** | A primary action button on the marketing surface. V1 has three: "Join the waitlist" (anchors / disabled-or-external — ADR-014), "See how it works" (`#how`), "Begin →" (`/dashboard?source=recorded` — the only product entry from marketing). |
| **illustrative content** | Numerical claims, stats, and testimonial quotes that are *not* derived from research data and must carry the disclosure in `marketing-copy.ts` (ADR-014). |
| **operator entry** | The renamed `AppEntry.tsx` at `/_entry` — operator-only debug page; not part of this context's surface. |

## Public Interface

The marketing context exposes **no programmatic interface**. It is a
leaf surface: nothing in the rest of the app imports from it. Its
"interface" is the rendered HTML at `/`.

The only contracts that cross the marketing boundary are:

```ts
// web-app/src/data/marketing-copy.ts
/**
 * All numerical claims and named users on this page are illustrative for
 * the buildathon submission and will be replaced or removed before any
 * public, post-buildathon launch. (ADR-014.)
 */
export interface MarketingCopy {
  banner: { eyebrow: string; ctaLabel: string };
  nav: { brand: string; links: { label: string; href: string }[]; ctaLabel: string; ctaHref: string };
  hero: { eyebrow: string; titleA: string; titleEm: string; subhead: string; primaryCta: string; secondaryCta: string; proofText: string; privacyPill: string };
  heroSteps: { eyebrow: string; steps: { num: string; title: string; body: string }[] };
  manifesto: { headline: string };
  heroMockup: { badgeLabel: string; headlineA: string; headlineEm: string; headlineB: string; body: string; stats: { num: string; label: string }[]; slides: { caption: string; titleA: string; titleEm: string; img: string; alt: string }[] };
  stats: { num: string; desc: string }[];
  problem: { eyebrow: string; titleA: string; titleEm: string; lead: string; cards: { tag: string; titleA: string; titleEm: string; body: string; stat: string }[]; callout: { textA: string; textEm: string; sub: string } };
  how: { titleA: string; titleEm: string; lead: string; steps: { num: string; title: string; body: string; iconRow: string }[]; flowTitleA: string; flowTitleEm: string; flowSteps: { num: string; title: string; body: string }[] };
  demo: { eyebrow: string; titleA: string; titleEm: string; body: string[]; bullets: { titleA: string; bodyA: string }[]; card: { tagLabel: string; tagText: string; messageA: string; messageEm: string; practiceName: string; practiceMeta: string; ctaLabel: string; footerInfo: string } };
  vs: { eyebrow: string; titleA: string; titleEm: string; lead: string; them: { label: string; titleA: string; titleEm: string; sub: string; bullets: string[] }; us: { label: string; titleA: string; titleEm: string; sub: string; bullets: string[] }; pullA: string; pullEm: string };
  testimonials: { eyebrow: string; titleA: string; titleEm: string; lead: string; cards: { quote: string; name: string; meta: string }[] };
  isnt: { eyebrow: string; titleA: string; titleEm: string; body: string; items: { label: string; title: string; body: string }[] };
  finalCta: { titleA: string; titleEm: string; body: string; ctaLabel: string; checks: string[] };
  footer: { brand: string; links: { label: string; href: string }[]; copyright: string };
}

export const marketingCopy: MarketingCopy;
```

The design intentionally splits headline strings into "A" + "em" pairs so
that the italic emphasis from the design HTML (`<em>before</em>`,
`<em>not a dashboard.</em>`) is structural, not regex'd at render time.

```ts
// MarketingLanding never imports these — boundary check
import {} from '../services/wsClient';      // ❌ forbidden
import {} from '../services/sessionStore';  // ❌ forbidden
import {} from '../workers/triggerWorker';  // ❌ forbidden
import {} from '../types/vitals';           // ❌ forbidden
import {} from '../types/state';            // ❌ forbidden
import {} from '../types/intervention';     // ❌ forbidden
```

## Domain Events

This context **emits and consumes no events**. It has no producer, no
consumer, no callable. The only "domain event" it participates in is the
React Router transition from `/` to `/dashboard?source=recorded` when the
visitor clicks the live-demo card's "Begin →" — and that transition is
React Router's, not a domain event in the sense the other DDDs use.

## Aggregates / Entities / Value Objects

1. **`MarketingCopy` (aggregate root, immutable).** The single typed
   tree of strings. Loaded once at module scope. Invariant: every
   field's text is a verbatim copy of the corresponding HTML in the
   design source (ADR-014 enforcement test).
2. **`MarketingTokens` (value object).** The CSS variable set in
   `marketing-tokens.css`. Invariant: hex values match ADR-013's
   token table exactly.
3. **`SectionComponent` (entity per section).** One per design block,
   stateless except where the design specifies behaviour
   (`HeroSlideshow` has timer state; the rest are pure).
4. **`MarketingLayout` (aggregate root for side-effects).** The single
   place that injects fonts and CSS-variable scope. Invariant: idempotent
   mount/unmount; HMR re-mounts do not duplicate `<link>` tags.
5. **`MarketingLogo` (value object).** The 3-circle SVG, used 3× — nav,
   final-cta, footer. Single source.

## Invariants

1. **Leaf isolation.** No file under `src/components/marketing/**`,
   `src/pages/MarketingLanding.tsx`, `src/styles/marketing-tokens.css`, or
   `src/data/marketing-copy.ts` imports from any of `wsClient`,
   `sessionStore`, `cloudSync`, `triggerWorker`, `stateRules`, `vitals*`,
   `state*`, `intervention*`, or any of the four product DDDs' files.
   Mechanically enforced (ADR-013 §Isolation, the `isolation.spec.ts`
   test).
2. **No external network.** The marketing page makes exactly two classes
   of network request: image GETs to `/marketing/*` and the Google Fonts
   CSS + woff2 fetches. No third-party SDK, no analytics, no tracking.
3. **Copy provenance.** Every visible string on `/` resolves to a
   `marketingCopy.*` field. No string literals embedded in JSX in the
   `components/marketing/**` tree. Mechanically enforced
   (`copy.spec.ts`).
4. **Illustrative-content disclosure.** `marketing-copy.ts`'s top-of-file
   JSDoc contains the literal disclosure paragraph (ADR-014).
5. **CTA targets.** "Begin →" in the live-demo card resolves to
   `/dashboard?source=recorded`. Every "Join the waitlist" / "Reserve
   your spot" CTA resolves to `import.meta.env.VITE_WAITLIST_URL` when
   set, else `<button disabled>`. Mechanically enforced
   (`cta-targets.spec.ts`).
6. **One layout, one token scope.** Exactly one component
   (`MarketingLayout`) loads fonts and CSS tokens; nothing else does.
   Marketing tokens never reach `Dashboard` (ADR-013).
7. **Asset paths.** Every `<img src="/marketing/...">` resolves to a file
   present in `web-app/public/marketing/`. Mechanically enforced
   (`assets.spec.ts`).
8. **Static rendering.** The marketing page is fully renderable at build
   time — no runtime data dependency, no fetch on mount, no hydration
   bug surface. (V1 ships SPA; this invariant guarantees a future SSR or
   static-export migration is mechanical.)

## Anti-corruption layer

The marketing context's anti-corruption layer is import policy: a single
ESLint `no-restricted-imports` rule scoped to the
`components/marketing/**` and `pages/MarketingLanding.tsx` paths blocks
imports from any of the four product DDDs' source files. The rule lives
in `eslint.config.js` under a `files: ['src/components/marketing/**',
'src/pages/MarketingLanding.tsx']` block. The same block forbids
importing dashboard tokens (`surface.*`, `accent.*`) from the marketing
tree, and the inverse — `Dashboard.tsx` and the four product DDDs cannot
import `marketing-tokens.css` or `marketing.*` Tailwind classes — is
enforced by the symmetric ESLint block on the dashboard side.

The marketing copy file is also an ACL: when the design HTML is
re-exported with new strings, only `marketing-copy.ts` changes and the
`copy.spec.ts` regression test enforces verbatim equality with the
design source. This means the design HTML can drift in *layout* (the
designer can move sections around) without breaking the copy contract.

## File map

| File | Description |
|---|---|
| `web-app/src/pages/MarketingLanding.tsx` | The single page; composes all sections inside `MarketingLayout`. |
| `web-app/src/components/marketing/MarketingLayout.tsx` | Font + CSS-token scope; idempotent mount. |
| `web-app/src/components/marketing/MarketingLogo.tsx` | The 3-circle logo SVG (used 3×). |
| `web-app/src/components/marketing/Banner.tsx` | Top early-access banner (HTML §banner). |
| `web-app/src/components/marketing/MarketingNav.tsx` | Sticky nav with logo + section anchors + waitlist CTA. |
| `web-app/src/components/marketing/Hero.tsx` | The 2-column hero with headline + room image + 4-step "private by design" panel. |
| `web-app/src/components/marketing/HeroSlideshow.tsx` | The 3-frame carousel with timer + click-to-jump dots. |
| `web-app/src/components/marketing/ManifestoBand.tsx` | Single-headline green band. |
| `web-app/src/components/marketing/HeroMockup.tsx` | The "Tuesday 2:42 PM" mockup card with stats + slideshow. |
| `web-app/src/components/marketing/StatsBand.tsx` | The 3-up stats band ("8–12 min", "76M", "$9"). |
| `web-app/src/components/marketing/ProblemSection.tsx` | The 2-card problem block + the "you don't need another graph" callout. |
| `web-app/src/components/marketing/HowItWorks.tsx` | The 3-step block + the horizontal 4-step "From signal to support" flow. |
| `web-app/src/components/marketing/LiveDemo.tsx` | The "A response, not a dashboard" two-column with the demo card + the "Begin →" button. |
| `web-app/src/components/marketing/VsWearables.tsx` | The us-vs-them grid + the "identity-theft services" pull-quote. |
| `web-app/src/components/marketing/Testimonials.tsx` | The 2-card testimonials grid. |
| `web-app/src/components/marketing/IsntList.tsx` | The dark-band "here's what it isn't" with 3 disqualifier cards. |
| `web-app/src/components/marketing/FinalCta.tsx` | The cream final-CTA with logo mark + waitlist button + checks list. |
| `web-app/src/components/marketing/MarketingFooter.tsx` | Footer with logo + Privacy / Terms / Contact + © line. |
| `web-app/src/data/marketing-copy.ts` | All copy strings; typed; carries illustrative-content disclosure. |
| `web-app/src/styles/marketing-tokens.css` | The CSS variables from the design HTML's `:root`. |
| `web-app/public/marketing/` | The 4 PNG assets + a README documenting their provenance. |
| `web-app/src/pages/AppEntry.tsx` | The renamed pre-marketing app-entry page (operator-only at `/_entry`). |

## Tests

- `tests/marketing/tokens.spec.ts` — token-table regression (ADR-013).
- `tests/marketing/isolation.spec.ts` — import-boundary check (this DDD §Anti-corruption).
- `tests/marketing/copy.spec.ts` — design-HTML vs `marketing-copy.ts` parity (ADR-014).
- `tests/marketing/cta-targets.spec.ts` — CTA wiring assertion (ADR-012, ADR-014).
- `tests/marketing/assets.spec.ts` — image existence check (ADR-014).
- `tests/marketing/illustrative-disclosure.spec.ts` — disclosure JSDoc presence (ADR-014).
- `e2e/landing.spec.ts` — Playwright smoke (ADR-012).
- `e2e/landing-redirect.spec.ts` — `?source=` forward (ADR-012).
- `e2e/marketing-fonts.spec.ts` — font fetch isolation (ADR-013).

The four pure unit tests (`tokens`, `isolation`, `copy`,
`cta-targets`) run in the standard `pnpm test` Vitest pass; the three
Playwright tests run in the existing `web-app/e2e/` suite.

## Out of scope (V1)

- Internationalisation. `marketing-copy.ts` is structured to support
  i18n later, but V1 ships English only.
- A real waitlist signup. ADR-014 forbids this.
- Analytics / tracking. ADR-014 forbids this.
- Image optimisation pipeline (sharp / WebP / AVIF). ADR-014 defers.
- SSR / static export. The marketing page is renderable statically by
  invariant 8, but V1 ships SPA.
- A CMS or copy-editing UI. Strings live in source.
- Privacy / Terms / Contact destination pages. ADR-014 §Outbound links.
- Per-route bundle size budget gate. The existing < 500 KB gzipped JS
  budget (`docs/plan/implementation-plan.md` §12) was set for the
  dashboard; the marketing route's budget is checked once on Day-A
  Block 4 and only enforced if it exceeds 200 KB JS gzipped at first
  paint.

## References

- ADR-012 (route restructure).
- ADR-013 (design system extension).
- ADR-014 (assets + content provenance).
- `docs/03_designs/MindRefreshStudio v2.html` (visual + copy source).
- `docs/03_designs/images/` (asset origin).
- `docs/05_architecture/01_system_architecture.md` §5, §7 (the four
  product contexts the marketing context is leaf-isolated from).
- `docs/plan/landing-page-plan.md` (operationalises this context).
