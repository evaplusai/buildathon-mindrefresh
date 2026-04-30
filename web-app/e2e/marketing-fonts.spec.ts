/**
 * e2e/marketing-fonts.spec.ts
 *
 * Playwright — font isolation test (ADR-013 §Font loading).
 *
 * Source Serif 4 must be loaded on / (MarketingLayout injects the
 * Google Fonts <link> on mount) but must NOT be loaded on /dashboard
 * (MarketingLayout never mounts on the dashboard route, so the font
 * fetch never fires).
 *
 * Uses document.fonts.check() which returns true only if the font is
 * already in the browser's FontFaceSet — i.e., it was fetched and parsed.
 *
 * Note: If the Chromium test runner caches the font across navigation in
 * the same page context, the second check might return true even though
 * the dashboard never requested it.  We guard against this by reloading
 * the dashboard page so it starts fresh within the same browser context.
 */

import { test, expect } from '@playwright/test';

// Notes:
// - Use `domcontentloaded` (not `networkidle`) — the dashboard opens a
//   long-lived WebSocket to the sensing-server; networkidle never resolves.
// - Use a fresh browser context for /dashboard so the prior FontFaceSet
//   from the marketing route doesn't leak across pages.

// We assert the SOURCE OF FONT LOADING — the Google Fonts <link> tag —
// rather than `document.fonts.check`. The check API can return true on
// systems where Source Serif 4 is installed system-wide (macOS dev
// machines often have it), giving false positives. The link tag is the
// causal mechanism MarketingLayout adds; checking it directly is the
// invariant ADR-013 §"Font loading" actually states.

const FONT_LINK_HREF_RE = /fonts\.googleapis\.com.*Source\+Serif\+4/;

// V2 — Dashboard v2 ships the same cream/green design system as the marketing
// surface (per ADR-015 / ADR-017), and the index.html ships a single
// Source Serif 4 + Source Sans 3 <link> globally. The original ADR-013
// "marketing-only fonts" invariant is amended for V2: both routes share
// fonts via index.html. MarketingLayout's runtime <link> injection is now
// a redundant no-op when the index.html link is present (idempotency:
// it skips when one already exists with `data-marketing-font`).
//
// What this test STILL verifies: the Google Fonts link is present on
// the marketing route AND on the dashboard route — exactly once each
// (no duplicate injection).

test.describe('Source Serif 4 fonts available on both routes', () => {
  for (const path of ['/', '/dashboard?source=recorded']) {
    test(`Source Serif 4 link present exactly once on ${path}`, async ({ browser }) => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.goto(path);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForFunction(
        () =>
          Array.from(document.head.querySelectorAll('link[rel="stylesheet"]'))
            .some((l) => /fonts\.googleapis\.com.*Source\+Serif\+4/.test((l as HTMLLinkElement).href)),
        undefined,
        { timeout: 10_000 },
      );
      const count = await page.evaluate(() => {
        const links = Array.from(document.head.querySelectorAll('link[rel="stylesheet"]'));
        return links.filter((l) =>
          /fonts\.googleapis\.com.*Source\+Serif\+4/.test((l as HTMLLinkElement).href),
        ).length;
      });
      expect(count, 'Source Serif 4 link should be loaded exactly once').toBe(1);
      await ctx.close();
    });
  }
});

// Eslint hint: regex declared at module scope but the evaluate() callbacks
// must use string-literal regex (function bodies execute in browser context
// where the outer `FONT_LINK_HREF_RE` is not in scope). We keep the named
// constant for documentation only.
void FONT_LINK_HREF_RE;
