# ADR-013: Marketing surface uses an isolated cream/green design system

**Status:** Accepted
**Date:** 2026-04-29
**Build Day:** 6 of 8 (post-feature-freeze planning)
**Implementation:** shipped 2026-04-29; `web-app/src/styles/marketing-tokens.css` + `tailwind.config.js` `marketing.*` palette + `font-serif` / `font-sans` aliases; MarketingLayout idempotently injects the Google Fonts `<link>` on mount; ESLint `no-restricted-imports` blocks enforce isolation in both directions.
**Supersedes:** (none)
**Superseded by:** (none)

## Context

The dashboard surface (`web-app/src/pages/Dashboard.tsx`,
`web-app/tailwind.config.js`) ships a dark palette: `surface.900` =
`#0f172a` (slate-900), `accent.cyan` = `#22d3ee`, `accent.violet` =
`#8b5cf6`, mono font JetBrains Mono. The visual register is "operator
console / nervous-system instrument."

The marketing landing page in
`docs/03_designs/MindRefreshStudio v2.html` ships a completely different
register: cream backgrounds (`#FBF9F2`, `#F5F1E4`), a green ladder from
`#EAF3DE` to `#173404`, a serif headline face (Source Serif 4 with italic
emphasis), and Source Sans 3 for body. The visual register is "wellness
brand / quiet authority."

Both registers are correct for their respective audiences. The question is
how to ship them in one Vite/React/Tailwind app without (a) the marketing
page leaking dark slate styles, (b) the dashboard leaking cream warmth,
(c) doubling the bundle size with two complete design tokens, or (d)
hand-porting 943 lines of design HTML into Tailwind utility classes that
nobody can later cross-reference back to the source.

ADR-012 establishes that the marketing surface lives at `/` and the
dashboard at `/dashboard`; this ADR establishes how their visual systems
coexist.

## Decision

The marketing surface gets its own scoped design system, expressed as a
**Tailwind theme extension keyed by a CSS prefix** (`marketing-`) plus a
**single root `<MarketingLayout>` component that gates the surface**.
Implementation summary, with the full sequencing in
`docs/plan/landing-page-plan.md`:

1. Extract the design HTML's `:root` CSS variables (lines 11–33) into
   `web-app/src/styles/marketing-tokens.css`; load it once in
   `MarketingLayout.tsx`.
2. Extend `tailwind.config.js` with `colors.marketing.{cream, cream2,
   warmWhite, ink, inkSoft, inkMuted, rose, line, lineSoft, green: {50, 100,
   200, 300, 400, 600, 700, 800, 900}}` mapped to those variables. The
   existing `surface` and `accent` palettes are NOT touched.
3. Add `fontFamily.serif: ['"Source Serif 4"', 'Georgia', '"Iowan Old
   Style"', 'serif']` and `fontFamily.sans: ['"Source Sans 3"',
   '-apple-system', 'BlinkMacSystemFont', 'sans-serif']` and
   `fontFamily.marketingMono: ['ui-monospace', '"SF Mono"', '"JetBrains
   Mono"', 'Menlo', 'monospace']`. The dashboard's existing `font-mono`
   alias remains exactly JetBrains Mono.
4. Load the two Google Fonts (`Source Serif 4`, `Source Sans 3`) **only
   on routes that mount `MarketingLayout`** via a `<link>` injected by
   `MarketingLayout` on mount and removed on unmount. The dashboard
   never pays the font-fetch cost.
5. Express section-level styles as React components per DDD-05 §File map
   (`MarketingHero`, `ManifestoBand`, `HeroMockup`, `StatsBand`,
   `ProblemSection`, `HowItWorks`, `LiveDemo`, `VsWearables`,
   `Testimonials`, `IsntList`, `FinalCta`, `MarketingFooter`). Inside
   each component, prefer Tailwind utility classes
   (`bg-marketing-cream`, `font-serif`, `text-marketing-green-900`) over
   raw CSS. Components that depend on long-form custom CSS (the hero
   slideshow, the device mockup) keep a co-located `.module.css` for
   the parts Tailwind cannot express compactly.
6. Section-level animations (the slideshow auto-rotate, the `live` keyframe,
   the breathing dots) are re-expressed as React state + Tailwind
   `animate-` classes via `tailwind.config.js` `theme.extend.keyframes`
   and `theme.extend.animation`. The original HTML's inline `<script>`
   at lines 924–940 is NOT shipped; it becomes a `useEffect` in
   `HeroSlideshow.tsx`.

### Isolation rules (load-bearing)

- **No marketing token referenced from anywhere outside
  `web-app/src/components/marketing/**` and `web-app/src/pages/MarketingLanding.tsx`.**
  Enforcement: an ESLint `no-restricted-imports` rule plus the
  DDD-05 `Anti-corruption layer` text.
- **No dashboard token (`surface.*`, `accent.*`) referenced from the
  marketing tree.** Same enforcement.
- **No global CSS reset added or modified.** The design HTML's
  `* { box-sizing: border-box; margin: 0; padding: 0 }` reset is already
  effectively in place via Tailwind's preflight. Do not duplicate it.

### Color token mapping

| HTML CSS variable | Tailwind name | Hex |
|---|---|---|
| `--green-50` | `marketing.green.50` | `#EAF3DE` |
| `--green-100` | `marketing.green.100` | `#C0DD97` |
| `--green-200` | `marketing.green.200` | `#97C459` |
| `--green-300` | `marketing.green.300` | `#7FB13C` |
| `--green-400` | `marketing.green.400` | `#639922` |
| `--green-600` | `marketing.green.600` | `#3B6D11` |
| `--green-700` | `marketing.green.700` | `#2F5A0D` |
| `--green-800` | `marketing.green.800` | `#27500A` |
| `--green-900` | `marketing.green.900` | `#173404` |
| `--cream` | `marketing.cream` | `#FBF9F2` |
| `--cream-2` | `marketing.cream2` | `#F5F1E4` |
| `--warm-white` | `marketing.warmWhite` | `#FFFEFA` |
| `--ink` | `marketing.ink` | `#1A2310` |
| `--ink-soft` | `marketing.inkSoft` | `#3D4A2E` |
| `--ink-muted` | `marketing.inkMuted` | `#6B7558` |
| `--rose` | `marketing.rose` | `#C97A6B` |
| `--line` | `marketing.line` | `rgba(39,80,10,0.12)` |
| `--line-soft` | `marketing.lineSoft` | `rgba(39,80,10,0.06)` |

The hex values are copied verbatim from the design file; this table is
the canonical source for both the Tailwind config and any code review.

### Font loading

The Google Fonts URL from the design HTML (line 9) is preserved exactly:

```
https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,500;0,8..60,600;1,8..60,400;1,8..60,500&family=Source+Sans+3:wght@400;500;600;700&display=swap
```

`<MarketingLayout>` injects the `<link rel="preconnect">` pair plus the
`<link rel="stylesheet">` on mount; injection is idempotent so multiple
mounts (dev HMR, route navigation) don't duplicate `<link>` tags.

## Consequences

### Positive

- The marketing page renders with the design HTML's actual typography and
  colour, which is the only way the surface looks like the source. No
  approximation drift.
- The dashboard's bundle is unchanged: it never imports
  `marketing-tokens.css`, never fetches Source Serif/Sans, never sees the
  cream tokens. Code-splitting at the route boundary keeps marketing
  CSS + fonts off the dashboard's first paint.
- Future visual changes to the marketing page (a new section, a hue
  tweak) touch only `marketing-tokens.css`, the `marketing` Tailwind
  branch, and the marketing components. The four product contexts stay
  insulated.
- The token-mapping table in this ADR plus DDD-05's file map make the
  port mechanical: a reviewer can grep the design HTML for a hex value
  and find its Tailwind equivalent in O(1).

### Negative

- Bundle size grows by the marketing CSS (~6 KB minified, before the JS
  port) plus the two Google Fonts (~80 KB woff2 total for the latin
  subset, fetched lazily on `/`). The bundle target in the existing plan
  (`docs/plan/implementation-plan.md` §12, "< 500 KB JS gzipped") is for
  the dashboard; the marketing route is checked separately at
  `landing-page-plan.md` Day-A Block 4.
- Tailwind config grows ~40 lines. Acceptable; one-time cost.
- The two design systems mean a developer has to know which palette they
  are inside. The route boundary makes this unambiguous in practice — but
  the ESLint rule above is the mechanical enforcement when humans drift.

### Neutral

- The slideshow auto-rotate becomes a `useEffect`; the only behavioural
  change is React's StrictMode double-mount in dev causing the timer to
  fire twice (cleared by the cleanup return). Dev-only artefact.
- The cream/green tokens are aesthetically warmer than the existing dark
  dashboard. Tonal contrast across `/` → `/dashboard` is *intended*: the
  marketing page is the brand; the dashboard is the instrument. The
  contrast is the point.

## Alternatives Considered

- **Single unified palette across both surfaces.** Rejected: the
  dashboard's dark/cyan register is what makes the operator UI legible
  during real-time use; the marketing page's cream/green register is
  what makes the brand feel calm. Forcing one to match the other guts
  whichever surface loses.
- **Ship the marketing page as the static design HTML, served by Vercel
  next to the SPA.** Rejected in ADR-012; reiterated here because the
  port is the proximate cause of this ADR — a static-HTML choice would
  bypass Tailwind entirely, but at the cost of the routing and assets
  decisions in ADR-012/-014.
- **Use a CSS-in-JS solution scoped to marketing.** Rejected: introduces
  a runtime style engine the rest of the app does not use. Tailwind +
  `marketing.*` namespace has the same isolation property at zero
  runtime cost.
- **Inline the design HTML's CSS as a single `<style>` block on the
  marketing route.** Rejected: works for V1, but every future tweak
  becomes a CSS string edit in a TSX file. The tokens-plus-Tailwind
  approach makes section components readable as "structure + classes,"
  which is what every other page in this repo already looks like.

## References

- `docs/03_designs/MindRefreshStudio v2.html` — visual source of truth.
- `web-app/tailwind.config.js` — file to extend.
- `web-app/src/index.css` — entry point; do NOT add marketing tokens
  here. Marketing tokens live in `web-app/src/styles/marketing-tokens.css`
  and are imported from `MarketingLayout.tsx` only.
- ADR-012 (route restructure — paired decision).
- ADR-014 (assets pipeline — paired decision).
- DDD-05 §File map.
- `docs/plan/landing-page-plan.md` Day A — sequencing.
- [Source Serif 4](https://fonts.google.com/specimen/Source+Serif+4)
- [Source Sans 3](https://fonts.google.com/specimen/Source+Sans+3)

## Test Hooks (London-school)

- `web-app/tests/marketing/tokens.spec.ts` — pure: imports
  `marketing-tokens.css` raw via `?raw` and asserts every CSS variable
  in the table above is defined exactly once with the canonical hex.
  Regression check; fails if a hex value drifts.
- `web-app/tests/marketing/isolation.spec.ts` — static AST check (or a
  fast `grep` script invoked from the test): asserts no source file
  outside `web-app/src/components/marketing/**` or
  `web-app/src/pages/MarketingLanding.tsx` references a class beginning
  `marketing-` or imports `marketing-tokens.css`.
- `web-app/e2e/marketing-fonts.spec.ts` — Playwright; loads `/`; asserts
  `document.fonts.check('1em "Source Serif 4"')` is true after
  `networkidle`; asserts the same is FALSE after navigating to
  `/dashboard` and reloading (the dashboard never fetches Source
  Serif).
