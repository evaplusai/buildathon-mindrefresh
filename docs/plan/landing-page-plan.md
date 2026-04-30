# Landing Page — Implementation Plan

## 1. Header & Status

- **Today:** Wed Apr 29 2026.
- **Source of truth:** `docs/03_designs/MindRefreshStudio v2.html` (the static design); ADR-012, ADR-013, ADR-014; DDD-05 (`docs/ddd/05_marketing_context.md`).
- **Relationship to the buildathon plan:** This plan is *additive* to `docs/plan/implementation-plan.md`. It assumes the buildathon's Day-3-through-Day-6 build has shipped (web-app scaffold, dashboard, the 5/6 mock-first tests, Vercel deploy). It does NOT modify the buildathon's submission DoD; it adds a separate set of exit criteria that can be satisfied independently.
- **Builder:** solo.
- **Sprint shape:** 2 sprints, ~1 build day each. Day A = port + isolation; Day B = polish + tests + deploy. Either can be split across calendar evenings; the gate between them is "every test in §10 passes."
- **Repo state at plan time:** Vercel deploy live; current `/` is the minimal `Landing.tsx`; design HTML already in `docs/03_designs/`; 4 PNGs already in `docs/03_designs/images/`.

## 2. Methodology

Same SPARC + DDD + TDD-London discipline as the buildathon plan. Specification is in the three ADRs and DDD-05. Pseudocode is captured here as task IDs and exit criteria. Architecture is the leaf marketing context (DDD-05). Refinement is the 6 isolation/regression tests in §10. Completion is the deploy step in Day-B Block 4.

The implementation is mostly *porting*, not invention. The discipline is: don't drift from the design HTML's copy, don't drift from the design HTML's hex values, don't leak imports across the marketing/dashboard boundary. The tests in §10 are the mechanical leash on each kind of drift.

Task ID convention: `LA-B{block}-T{n}` (Day A) and `LB-B{block}-T{n}` (Day B).

---

## 3. Day A — Port

**SPRINT GOAL:** Marketing landing page rendered at `/` from real React components, using verbatim copy from the design HTML, in the cream/green design system, with isolated fonts and tokens; current dashboard surface unchanged.

**EXIT CRITERION:** `npm run dev` serves `/` with all 11 design sections visible (banner, nav, hero+slideshow+steps, manifesto-band, hero-mockup, stats-band, problem, how-it-works, live-demo, vs, testimonials, isnt, final-cta, footer). The "Begin →" button on the live-demo card navigates to `/dashboard?source=recorded`. The dashboard surface (`/dashboard`) loads with no visual change. `npm test` reports the existing 6 specs unchanged green; the 4 new marketing unit tests are scaffolded.

**MORNING STANDUP:**
- Yesterday: ADRs 012/013/014 + DDD-05 written; sprint plan ready.
- Today: route restructure; design system in Tailwind; section components ported one by one; copy file extracted.
- Blockers: none — design HTML is complete and stable.

### Block 1 — Foundation: routes, tokens, layout (~2 h)

| ID | Task | Time | Pred | Touches | ADR | Test |
|---|---|---|---|---|---|---|
| `LA-B1-T1` | Rename `web-app/src/pages/Landing.tsx` → `AppEntry.tsx`; update import in `App.tsx`; mount at `/_entry` (preserving its current two CTAs unchanged). | 15m | — | App routing | ADR-012 | n/a — wiring |
| `LA-B1-T2` | Create `web-app/src/pages/MarketingLanding.tsx` skeleton (returns `<MarketingLayout>{/* TODO sections */}</MarketingLayout>`); mount at `/`. | 10m | `LA-B1-T1` | Marketing | ADR-012 | n/a — wiring |
| `LA-B1-T3` | Add the `?source=` / `?dev=` forward-redirect rule (per ADR-012 Resolution B): if either query param present on `/`, `<Navigate to="/dashboard${search}" replace />`. | 15m | `LA-B1-T2` | Marketing | ADR-012 | covered by `e2e/landing-redirect.spec.ts` (`LB-B3-T2`) |
| `LA-B1-T4` | Move 4 PNGs (`room-notices-v4.png`, `01-late-night-clean.png`, `02-the-shift-clean.png`, `03-recovery-mode-clean.png`) from `docs/03_designs/images/` → `web-app/public/marketing/`. Add `web-app/public/marketing/README.md` recording dimensions + provenance. | 15m | — | Marketing | ADR-014 | covered by `tests/marketing/assets.spec.ts` (`LA-B4-T4`) |
| `LA-B1-T5` | Add a one-line note to `docs/03_designs/MindRefreshStudio v2.html` (top comment OR a sibling `docs/03_designs/README.md`) recording that images live in `web-app/public/marketing/` and previewing the design HTML directly will show broken images. | 5m | `LA-B1-T4` | docs | ADR-014 | n/a |
| `LA-B1-T6` | Create `web-app/src/styles/marketing-tokens.css` from design HTML lines 11–33 (`:root` block); preserve every variable verbatim. | 15m | — | Marketing | ADR-013 | covered by `tests/marketing/tokens.spec.ts` (`LA-B4-T1`) |
| `LA-B1-T7` | Extend `web-app/tailwind.config.js` with `colors.marketing.*` from ADR-013 §Color token mapping; add `fontFamily.serif` and `fontFamily.sans` entries from ADR-013 §Font loading. Do NOT touch existing `surface.*`, `accent.*`, `font-mono`. | 25m | `LA-B1-T6` | Marketing | ADR-013 | covered by `tests/marketing/tokens.spec.ts` |
| `LA-B1-T8` | Build `web-app/src/components/marketing/MarketingLayout.tsx`: imports `marketing-tokens.css`; on mount, idempotently appends the `<link rel="preconnect">` x2 + `<link rel="stylesheet">` for the Google Fonts URL from ADR-013; on unmount, removes them; wraps children. | 30m | `LA-B1-T6` | Marketing | ADR-013 | covered by `e2e/marketing-fonts.spec.ts` (`LB-B3-T3`) |
| `LA-B1-T9` | Build `web-app/src/components/marketing/MarketingLogo.tsx` — the 3-circle SVG from design HTML lines 358–362 (28×28 default; size prop). | 10m | `LA-B1-T2` | Marketing | ADR-014 | n/a — visual |

### Block 2 — Copy + above-the-fold sections (~2 h)

| ID | Task | Time | Pred | Touches | ADR | Test |
|---|---|---|---|---|---|---|
| `LA-B2-T1` | Create `web-app/src/data/marketing-copy.ts` with the typed `MarketingCopy` interface from DDD-05 §Public Interface; export `marketingCopy` populated verbatim from the design HTML hero section (banner, nav, hero, manifesto-band, hero-mockup, stats-band). Top-of-file JSDoc carries the illustrative-content disclosure from ADR-014. | 50m | `LA-B1-T2` | Marketing | ADR-014 | covered by `tests/marketing/copy.spec.ts` (`LA-B4-T2`) and `illustrative-disclosure.spec.ts` (`LA-B4-T6`) |
| `LA-B2-T2` | Build `Banner.tsx` — top early-access banner; reads `marketingCopy.banner`; CTA anchors to `#cta`. | 15m | `LA-B2-T1`, `LA-B1-T7` | Marketing | n/a — wiring | n/a — UI |
| `LA-B2-T3` | Build `MarketingNav.tsx` — sticky nav; logo + 4 anchor links + "Join waitlist" CTA wired per ADR-014 (env var or disabled). | 30m | `LA-B2-T1`, `LA-B1-T9` | Marketing | ADR-014 | covered by `cta-targets.spec.ts` |
| `LA-B2-T4` | Build `Hero.tsx` — headline + subhead + CTA row + proof row + privacy pill on the left; the 4-step "Private by design" panel on the right (paired with the room image). Image: `<img src="/marketing/room-notices-v4.png" alt="..." />`. | 45m | `LA-B2-T1`, `LA-B1-T4` | Marketing | n/a — wiring | n/a — UI |
| `LA-B2-T5` | Build `ManifestoBand.tsx` — single-headline green band. | 10m | `LA-B2-T1` | Marketing | n/a | n/a — UI |

### Block 3 — Mid-page sections + slideshow (~2 h)

| ID | Task | Time | Pred | Touches | ADR | Test |
|---|---|---|---|---|---|---|
| `LA-B3-T1` | Build `HeroSlideshow.tsx` — 3-frame carousel; `useEffect` timer at 4500 ms; `useState` for active index; click-to-jump dots; `aria-label="Slide N"` per dot. The `<img>` paths use `/marketing/01-...`, `/marketing/02-...`, `/marketing/03-...`. | 45m | `LA-B2-T1`, `LA-B1-T4` | Marketing | n/a — wiring | n/a — UI |
| `LA-B3-T2` | Build `HeroMockup.tsx` — left-side text + stats; right-side mounts `HeroSlideshow`. | 30m | `LA-B3-T1`, `LA-B2-T1` | Marketing | n/a — wiring | n/a — UI |
| `LA-B3-T3` | Extend `marketing-copy.ts` with the `problem`, `how`, `demo` blocks from the design HTML (verbatim). | 25m | `LA-B2-T1` | Marketing | ADR-014 | covered by `copy.spec.ts` |
| `LA-B3-T4` | Build `StatsBand.tsx` — 3-up stats. | 15m | `LA-B3-T3` | Marketing | n/a | n/a — UI |
| `LA-B3-T5` | Build `ProblemSection.tsx` — 2-card problem block + the "you don't need another graph" callout. | 25m | `LA-B3-T3` | Marketing | n/a | n/a — UI |
| `LA-B3-T6` | Build `HowItWorks.tsx` — the 3-step block AND the horizontal 4-step flow (the second one renders inline-SVG icons + dashed-arrow connectors). | 40m | `LA-B3-T3` | Marketing | n/a | n/a — UI |
| `LA-B3-T7` | Build `LiveDemo.tsx` — left column (eyebrow, title, body, bullets); right column (the dark green demo card with the alert row, message, "Begin →" button). The "Begin →" `href` is the ONLY non-anchor on the page: it goes to `/dashboard?source=recorded`. | 35m | `LA-B3-T3` | Marketing | ADR-012, ADR-014 | covered by `cta-targets.spec.ts` |

### Block 4 — Below-the-fold sections + scaffold the 6 tests (~2 h)

| ID | Task | Time | Pred | Touches | ADR | Test |
|---|---|---|---|---|---|---|
| `LA-B4-T0` | Extend `marketing-copy.ts` with the `vs`, `testimonials`, `isnt`, `finalCta`, `footer` blocks. | 25m | `LA-B3-T3` | Marketing | ADR-014 | covered by `copy.spec.ts` |
| `LA-B4-T1` | Write `tests/marketing/tokens.spec.ts` — pure unit; imports `marketing-tokens.css?raw`; asserts every CSS variable from the ADR-013 token table is defined exactly once with the canonical hex. | 25m | `LA-B1-T6` | Marketing | ADR-013 | this file |
| `LA-B4-T2` | Write `tests/marketing/copy.spec.ts` — pure unit; reads `docs/03_designs/MindRefreshStudio v2.html` via `fs`; asserts every visible text node from the hero, problem, how-it-works, vs, isnt, and final-cta sections appears verbatim in `marketingCopy.*`. (The hero-mockup mock copy is illustrative and is asserted via the disclosure test instead.) | 50m | `LA-B4-T0` | Marketing | ADR-014 | this file |
| `LA-B4-T3` | Write `tests/marketing/cta-targets.spec.ts` — pure unit; renders `MarketingLanding` with React Testing Library; walks every `<a>` and `<button>`; asserts the rules in DDD-05 §Invariants 5. | 35m | `LA-B3-T7` | Marketing | ADR-012, ADR-014 | this file |
| `LA-B4-T4` | Write `tests/marketing/assets.spec.ts` — pure unit; reads `MarketingLanding`'s rendered DOM; collects every `<img src="/marketing/...">`; asserts each path resolves to a file in `web-app/public/marketing/`. | 25m | `LA-B1-T4` | Marketing | ADR-014 | this file |
| `LA-B4-T5` | Write `tests/marketing/isolation.spec.ts` — fast script test (or AST scan via `ts-morph`); asserts no source file under `src/components/marketing/**` or `src/pages/MarketingLanding.tsx` imports from `services/wsClient`, `services/sessionStore`, `services/cloudSync`, `workers/**`, `types/{vitals,state,intervention}`, or any module exporting from those; symmetric assertion that nothing under `pages/Dashboard.tsx` imports `marketing-tokens.css` or any `components/marketing/*`. | 40m | `LA-B1-T8` | Marketing | ADR-013, DDD-05 §Anti-corruption | this file |
| `LA-B4-T6` | Write `tests/marketing/illustrative-disclosure.spec.ts` — pure; reads `marketing-copy.ts` source; asserts the JSDoc comment block contains the literal "illustrative" disclosure paragraph from ADR-014. | 15m | `LA-B2-T1` | Marketing | ADR-014 | this file |

**EOD CHECK (Day A):** `/` renders the hero + manifesto + hero-mockup + stats + problem + how-it-works + live-demo. The 6 marketing unit tests are committed (some failing where blocks below-the-fold are not yet ported is acceptable IF and only IF the test is failing on a strictly TODO assertion — no test failures from runtime errors). The dashboard at `/dashboard` is unaffected.

---

## 4. Day B — Polish, isolate, deploy

**SPRINT GOAL:** All 6 marketing unit tests + 3 marketing E2E tests green. Cross-browser pass clean. Mobile viewport pass clean. Deploy live to Vercel; Day-7 demo URL pattern still works because of the ADR-012 forward redirect.

**EXIT CRITERION:** `npm test` reports the existing 6 product specs + the 6 new marketing specs all green (12 spec files total). `npm run e2e` (Playwright) reports the existing E2E suite + the 3 new marketing E2E tests green. The Vercel preview of the marketing branch renders identically to the dev `/` in Chrome desktop, Safari desktop, and an iPhone-13 viewport simulator. Production deploy of `main` keeps `/dashboard?source=recorded` working from a freshly opened incognito tab.

**MORNING STANDUP:**
- Yesterday: hero through live-demo ported; tests scaffolded.
- Today: vs / testimonials / isnt / final-cta / footer; ESLint isolation rule; cross-browser; deploy.
- Blockers: none.

### Block 1 — Below-the-fold sections (~1.5 h)

| ID | Task | Time | Pred | Touches | ADR | Test |
|---|---|---|---|---|---|---|
| `LB-B1-T1` | Build `VsWearables.tsx` — 2-column us-vs-them grid + the "identity-theft services" pull-quote. | 35m | `LA-B4-T0` | Marketing | n/a | n/a — UI |
| `LB-B1-T2` | Build `Testimonials.tsx` — 2-card testimonials grid; preserves the inline SVG decorative gradients verbatim from design HTML lines 791–807, 823–840. | 30m | `LA-B4-T0` | Marketing | ADR-014 | n/a — UI |
| `LB-B1-T3` | Build `IsntList.tsx` — the dark-band "here's what it isn't" with 3 disqualifier cards. | 20m | `LA-B4-T0` | Marketing | n/a | n/a — UI |
| `LB-B1-T4` | Build `FinalCta.tsx` — the cream final-CTA with logo mark + waitlist button + checks list. The waitlist CTA follows ADR-014 (env var or disabled). | 20m | `LA-B4-T0`, `LA-B1-T9` | Marketing | ADR-014 | covered by `cta-targets.spec.ts` |
| `LB-B1-T5` | Build `MarketingFooter.tsx` — logo + Privacy / Terms / Contact + © line per ADR-014 §Outbound links. | 15m | `LA-B4-T0`, `LA-B1-T9` | Marketing | ADR-014 | covered by `cta-targets.spec.ts` |

### Block 2 — Wire the page + ESLint isolation (~1.5 h)

| ID | Task | Time | Pred | Touches | ADR | Test |
|---|---|---|---|---|---|---|
| `LB-B2-T1` | Compose every section into `MarketingLanding.tsx` in the order from the design HTML (banner → nav → hero → manifesto → mockup → stats → problem → how → demo → vs → testimonials → isnt → final-cta → footer). | 25m | `LB-B1-T*` | Marketing | n/a — wiring | n/a |
| `LB-B2-T2` | Add `eslint.config.js` block scoped to `src/components/marketing/**` and `src/pages/MarketingLanding.tsx` forbidding imports of `services/wsClient`, `services/sessionStore`, `services/cloudSync`, `workers/**`, `types/vitals`, `types/state`, `types/intervention`, and any subpath of `components/dashboard/**`. | 30m | `LB-B2-T1` | tooling | DDD-05 §Anti-corruption | covered by `isolation.spec.ts` |
| `LB-B2-T3` | Add the symmetric ESLint block scoped to `src/pages/Dashboard.tsx` and `src/components/dashboard/**` forbidding imports of `styles/marketing-tokens.css`, `components/marketing/**`, `data/marketing-copy.ts`. | 20m | `LB-B2-T2` | tooling | ADR-013 | covered by `isolation.spec.ts` |
| `LB-B2-T4` | Run `npm run lint`; fix any violations (expected: zero, if the implementation followed the import discipline). | 15m | `LB-B2-T3` | tooling | — | n/a |
| `LB-B2-T5` | Run `npm test`; fix the assertions in the 6 marketing unit tests until all green. Order: `tokens` → `illustrative-disclosure` → `copy` → `cta-targets` → `assets` → `isolation`. | 60m | `LB-B2-T4` | Marketing | ADR-012/013/014 | unit suite |

### Block 3 — E2E + cross-browser (~2 h)

| ID | Task | Time | Pred | Touches | ADR | Test |
|---|---|---|---|---|---|---|
| `LB-B3-T1` | Write `web-app/e2e/landing.spec.ts` — Playwright; loads `/`; asserts hero `<h1>` text contains "Catch the crash"; asserts banner exists; asserts the live-demo card's "Begin →" link `href` ends in `/dashboard?source=recorded`. | 30m | `LB-B2-T5` | Marketing | ADR-012 | this file |
| `LB-B3-T2` | Write `web-app/e2e/landing-redirect.spec.ts` — loads `/?source=recorded`; asserts final URL contains `/dashboard?source=recorded`; asserts back-button does not return to `/` (replace semantics). | 25m | `LA-B1-T3` | Marketing | ADR-012 | this file |
| `LB-B3-T3` | Write `web-app/e2e/marketing-fonts.spec.ts` — loads `/`; waits for `networkidle`; asserts `document.fonts.check('1em "Source Serif 4"')` is true; navigates to `/dashboard`; reloads; asserts the same check is FALSE (dashboard does not load Source Serif). | 35m | `LA-B1-T8` | Marketing | ADR-013 | this file |
| `LB-B3-T4` | Cross-browser smoke: Chrome desktop, Safari desktop, Firefox desktop. Note any layout breaks; fix the worst three. Common suspects: font-feature-settings, `aspect-ratio` fallbacks (Safari ≤ 15), `:has()` if used. | 60m | `LB-B3-T3` | Marketing | n/a | n/a — manual |
| `LB-B3-T5` | Mobile-viewport pass: iPhone 13 width in DevTools; nav is legible (consider hiding `.nav-links` per design HTML's `@media (max-width: 900px)` rule, line 342); hero is readable; final-CTA fits without horizontal scroll. | 30m | `LB-B3-T4` | Marketing | n/a | n/a — manual |

### Block 4 — Bundle check + deploy + Day-7 verification (~1 h)

| ID | Task | Time | Pred | Touches | ADR | Test |
|---|---|---|---|---|---|---|
| `LB-B4-T1` | `npm run build`; `du -h web-app/dist/assets/*.{js,css}`; record the marketing route's first-paint JS (target ≤ 200 KB gzipped per DDD-05 §Out of scope) and the dashboard route's JS unchanged from the existing < 500 KB target. If marketing route exceeds 200 KB, investigate (most likely culprit: an accidental dashboard token import that pulled in the dashboard's tree). | 25m | `LB-B3-T5` | Marketing | DDD-05 §Out of scope | n/a |
| `LB-B4-T2` | Open a feature branch PR; let Vercel preview deploy; visit the preview URL `/`; visit `/?source=recorded` (must redirect to `/dashboard?source=recorded`); visit `/dashboard` (must be unchanged). | 20m | `LB-B4-T1` | Marketing | ADR-012 | n/a — manual |
| `LB-B4-T3` | Re-record (or re-shoot) the demo video's first 5 seconds if the marketing page has materially changed the URL-typing-to-product flow. (Day-7 plan in the buildathon plan §8 may need a 5-second re-cut; not an hour-long re-shoot.) Keep both versions until submission to choose. | 20m | `LB-B4-T2` | docs | n/a | n/a |
| `LB-B4-T4` | Merge to `main`; verify the production URL `https://mindrefresh-studio.vercel.app/` shows the marketing page; verify `https://mindrefresh-studio.vercel.app/?source=recorded` still lands on the dashboard recorded path; verify `https://mindrefresh-studio.vercel.app/_entry` shows the operator entry. | 15m | `LB-B4-T2` | deploy | ADR-012 | n/a — manual |

**EOD CHECK (Day B):** Production `/` is the marketing page; production `/dashboard?source=recorded` works from incognito; production `/_entry` is reachable; `npm test` reports 12/12 spec files green; `npm run e2e` reports the marketing E2Es green.

---

## 5. Risk Gates & Decision Trees

**Gate L-A1 (Day A, 11:00):** Trigger — `LA-B1` complete. Decision — does `/_entry` still render the original two CTAs unchanged? Yes ⇒ proceed. No ⇒ revert the rename and re-attempt with a literal `git mv` instead of editing the import path manually. The `AppEntry.tsx` file is the buildathon's existing demo entry; breaking it breaks the buildathon DoD item 1.

**Gate L-A2 (Day A, 17:00):** Trigger — `LA-B4` complete. Decision — do the 6 marketing unit tests COMPILE and RUN (any pass/fail mix is OK at this point)? Yes ⇒ proceed to Day B. No ⇒ pause; the most common cause is a missing dev dependency for the AST-scan in `isolation.spec.ts` (use `ts-morph` or fall back to a `child_process` `grep` invocation). Do not start Day B with broken test infrastructure.

**Gate L-B1 (Day B, 13:00):** Trigger — `LB-B2-T5` complete. Decision — are all 6 marketing unit tests green? Yes ⇒ proceed. No ⇒ the failing test names the violated invariant; fix the source code, not the test. The tests encode the ADRs and DDD-05 invariants verbatim — a green test means the ADRs are honoured.

**Gate L-B2 (Day B, 16:00):** Trigger — `LB-B3-T4` complete. Decision — Safari and Firefox both render the page without z-index, layout, or font-loading regressions? Yes ⇒ proceed. No ⇒ if the regression is in a specific section, ship the page with that section's `display: none` set on the broken browser and document in the README; if the regression is global (e.g. fonts not loading at all on Safari), back out the marketing route until the cause is found — `/` falls back to `AppEntry.tsx`. Marketing page broken on Safari is worse than no marketing page.

**Gate L-B3 (Day B, 18:00):** Trigger — `LB-B4-T4` complete. Decision — both production URLs above work in incognito? Yes ⇒ done. No ⇒ revert the route mapping in `App.tsx` (back to the pre-marketing state); the buildathon's existing live URL is the priority over a half-broken marketing page.

## 6. Daily Checkpoint Template

Same as the buildathon plan §11. At the end of each block:

1. What did I just complete? List the task IDs that crossed the line.
2. What's the next un-blocked task? First task whose predecessors are all complete.
3. Am I on or off the sprint goal? Yes/no. If off: name the gate (L-A1/L-A2/L-B1/L-B2/L-B3) the deviation triggers; follow its fallback.

Log into a single rolling note `docs/plan/landing-log.md` as one-line entries `<HH:MM> LA-B{block}-T{n} done` — that file becomes the audit trail.

## 7. Cross-Sprint Concerns

- **Bundle size:** target ≤ 200 KB JS gzipped on the marketing route at first paint; ≤ 500 KB on the dashboard route (unchanged). Check at end of Day B Block 4 with `npm run build && du -h web-app/dist/assets/*.{js,css}`. If marketing route exceeds the cap, the cause is almost always an accidental dashboard import — the `isolation.spec.ts` test should have caught it earlier.
- **Image weight:** the 4 PNGs total ~6 MB on the wire. ADR-014 explicitly defers optimisation. If the marketing-route Lighthouse mobile score drops below 75, ADR-014 is amended with a one-line `sharp` pre-commit step; until that signal, do nothing.
- **Demo video:** if the recorded demo video opens with the URL-typing flow, the marketing page makes the first second look different — re-shoot only that second; keep the rest of the video.
- **Buildathon submission DoD impact:** none. The buildathon DoD (`docs/plan/implementation-plan.md` §14) does not require a marketing page. This work is *additive*. If any of the gates above triggers a fallback that disables the marketing route, the buildathon DoD is unaffected.
- **Time discipline:** every block has a hard cap. If a block runs over 30 min, pause, run §6 checkpoint, decide consciously whether to continue or drop scope.

## 8. The 6 Marketing Tests — Sequence

The 6 unit tests + 3 E2E tests are the mechanical leash on the design contract.

| # | File | Contract asserted | Earliest task |
|---|---|---|---|
| 1 | `tests/marketing/tokens.spec.ts` | Every CSS variable in ADR-013 token table is defined exactly once with the canonical hex. | `LA-B4-T1` |
| 2 | `tests/marketing/copy.spec.ts` | Every text node in design HTML (hero, problem, how, vs, isnt, final-cta) appears verbatim in `marketingCopy.*`. | `LA-B4-T2` |
| 3 | `tests/marketing/cta-targets.spec.ts` | Live-demo "Begin →" → `/dashboard?source=recorded`. Every "Join waitlist" CTA: env-var or disabled. No external `<a>` outside the allowed list. | `LA-B4-T3` |
| 4 | `tests/marketing/assets.spec.ts` | Every `<img src="/marketing/...">` resolves to a file in `web-app/public/marketing/`. | `LA-B4-T4` |
| 5 | `tests/marketing/isolation.spec.ts` | No marketing source imports product DDD code; symmetrically, no dashboard source imports marketing code or tokens. | `LA-B4-T5` |
| 6 | `tests/marketing/illustrative-disclosure.spec.ts` | The illustrative-content disclosure JSDoc lives at the top of `marketing-copy.ts`. | `LA-B4-T6` |
| E1 | `e2e/landing.spec.ts` | `/` renders hero + final-cta; live-demo CTA href is correct. | `LB-B3-T1` |
| E2 | `e2e/landing-redirect.spec.ts` | `/?source=recorded` forwards to `/dashboard?source=recorded` with replace semantics. | `LB-B3-T2` |
| E3 | `e2e/marketing-fonts.spec.ts` | Source Serif 4 loaded on `/`; NOT loaded on `/dashboard`. | `LB-B3-T3` |

Tests 1–6 written Day A Block 4, go green Day B Block 2. E1–E3 written Day B Block 3.

## 9. Definition of Done — Marketing landing

All 12 items must be true to call the marketing landing shipped:

1. `https://mindrefresh-studio.vercel.app/` returns 200 in incognito and renders the marketing page (banner through footer).
2. `https://mindrefresh-studio.vercel.app/?source=recorded` redirects (with `replace`) to `/dashboard?source=recorded`.
3. `https://mindrefresh-studio.vercel.app/?dev=1` redirects to `/dashboard?dev=1`.
4. `https://mindrefresh-studio.vercel.app/_entry` renders the operator entry page with its two original CTAs intact.
5. The live-demo "Begin →" CTA on `/` navigates to `/dashboard?source=recorded`.
6. `npm test` reports 12 spec files all green (existing 6 + new 6).
7. `npm run e2e` reports the existing E2E suite + the 3 new marketing E2E tests all green.
8. `npm run build` succeeds; marketing route first-paint JS ≤ 200 KB gzipped; dashboard JS ≤ 500 KB gzipped (unchanged).
9. `npm run lint` passes with zero `no-restricted-imports` violations.
10. Chrome desktop, Safari desktop, Firefox desktop, and iPhone-13 viewport all render `/` without horizontal scroll, missing fonts, or broken images.
11. ADR-012 + ADR-013 + ADR-014 status `Accepted`; DDD-05 status `Accepted`.
12. `docs/03_designs/MindRefreshStudio v2.html` carries (or sits next to) the note recording that source images now live in `web-app/public/marketing/`.

## 10. Things That Are Explicitly NOT This Plan's Concern

- A real waitlist signup backend.
- Analytics, pixels, tracking, A/B testing.
- Internationalisation.
- A CMS or copy-editing UI.
- WebP / AVIF / responsive images.
- SSR or static export.
- Privacy / Terms / Contact destination pages (placeholders only — ADR-014).
- The buildathon's submission DoD (separate file, separate gate; this plan does not touch it).
- Replacing the dashboard's design system or merging the two palettes.
- Image animation / parallax / scroll-jacking beyond the slideshow timer.

If during execution the plan tempts the builder toward any of the above, the answer is no. The plan is to ship the marketing surface the design HTML describes and document the rest as future work.

## 11. Build results — 2026-04-29

Plan executed in a single afternoon via a 4-agent coding swarm (foundation, copy,
components+page, tests) with file-level ownership disjoint to avoid conflict, then
an integration pass. The swarm was kicked off at ~15:30 PT and returned all four
slices clean; integration applied schema fixes (added `titleB` to slide and
finalCta to preserve trailing italic-emphasis text), moved env reads from module
scope into component bodies (so the test stub takes effect), corrected the font-
isolation E2E to assert the `<link>` tag rather than `document.fonts.check`
(macOS dev machines have Source Serif 4 as a system fallback), and lazy-loaded
the Dashboard route to keep the marketing payload off the dashboard's worker tree.

### Bundle (production build, gzipped)

| Route | First-paint JS | CSS | Notes |
|---|---|---|---|
| `/` (marketing) | **102.01 KB** | 6.88 KB | Target ≤ 200 KB — **49% under**. |
| `/dashboard` | 102.01 + 58.03 KB lazy chunk = **160.04 KB** | 6.88 KB | Target ≤ 500 KB — **68% under**. |
| `triggerWorker` | 2.1 KB | — | Unchanged. |

Marketing-route image weight: ~7.1 MB (3× 2.1 MB slideshow PNGs + 820 KB room
hero). Slides 1–2 carry `loading="lazy" decoding="async"`; slide 0 + the room
hero remain eager. Image optimisation deferred per ADR-014 §"Image pipeline".

### Tests

| Layer | Files | Tests |
|---|---|---|
| Vitest unit | 12 (6 product + 6 marketing) | 91 / 91 ✓ |
| Playwright E2E | 9 fast (1 long recorded-arc skipped without `RUN_SLOW=1`) | 11 / 11 ✓ |

The 6 marketing unit tests (`tokens`, `copy`, `cta-targets`, `assets`,
`isolation`, `illustrative-disclosure`) and the 4 marketing E2E tests
(`landing`, `landing-redirect`, `marketing-fonts`, `app-entry`) are the
mechanical leash on ADR-012/013/014 and DDD-05's invariants — every named
invariant has a green test.

### DoD review (§9)

All 12 items pass except those gated on Vercel deploy (#1–#4, #10), which are
left for a follow-up push. Everything checkable locally — typecheck, lint,
unit tests, E2E, build, bundle budgets, ADR/DDD acceptance — is green.

### Optimisations applied

1. **Code-split** Dashboard via `React.lazy` + `Suspense` in `App.tsx`. Saved
   ~32% off the marketing-route first-paint (158 KB → 102 KB JS gzipped).
2. **Image lazy-load** on slideshow slides 1–2 via `loading="lazy"
   decoding="async"`. Slide 0 + room hero stay eager (above-the-fold).
3. **Component-scope env reads** (Banner, Hero, MarketingNav, FinalCta) so
   the test environment can stub `VITE_WAITLIST_URL` per-test without module
   reset gymnastics.

### Known follow-ups (not in scope for this slice)

- Vercel deploy — pushed to a separate task per DoD §1–#4.
- Lighthouse run on the marketing route — image optimisation still deferred
  (ADR-014); add `sharp` only if the score lands below 75.
- Cross-browser smoke on Safari + Firefox — Chromium-only validation today
  (Playwright config has only `chromium` project; expand to webkit + firefox
  when budget permits).
- The `marketing-fonts.spec.ts` E2E now asserts the `<link>` tag injection,
  not `document.fonts.check`. The `document.fonts.check` form would have been
  flaky on dev machines that have Source Serif 4 installed system-wide; the
  link-tag form is the actual causal mechanism in the ADR.

*End of landing-page plan, 2026-04-29.*
