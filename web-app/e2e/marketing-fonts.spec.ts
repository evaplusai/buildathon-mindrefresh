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

test.describe('Font isolation — Source Serif 4 link only on marketing route (ADR-013)', () => {
  test('marketing route injects the Google Fonts <link>; dashboard does not', async ({
    browser,
  }) => {
    // --- marketing landing ---
    const marketingCtx = await browser.newContext();
    const marketingPage = await marketingCtx.newPage();
    await marketingPage.goto('/');
    await marketingPage.waitForLoadState('domcontentloaded');
    // MarketingLayout injects via useEffect; give it a beat.
    await marketingPage.waitForFunction(
      () =>
        Array.from(document.head.querySelectorAll('link[rel="stylesheet"]'))
          .some((l) => /fonts\.googleapis\.com.*Source\+Serif\+4/.test((l as HTMLLinkElement).href)),
      undefined,
      { timeout: 10_000 },
    );
    const marketingLinkCount = await marketingPage.evaluate(() => {
      const links = Array.from(document.head.querySelectorAll('link[rel="stylesheet"]'));
      return links.filter((l) =>
        /fonts\.googleapis\.com.*Source\+Serif\+4/.test((l as HTMLLinkElement).href),
      ).length;
    });
    expect(
      marketingLinkCount,
      'Marketing route should inject exactly one Source Serif 4 stylesheet link',
    ).toBe(1);
    await marketingCtx.close();

    // --- dashboard in a fresh context ---
    const dashCtx = await browser.newContext();
    const dashPage = await dashCtx.newPage();
    await dashPage.goto('/dashboard');
    await dashPage.waitForLoadState('domcontentloaded');
    await dashPage.waitForTimeout(1000);
    const dashLinkCount = await dashPage.evaluate(() => {
      const links = Array.from(document.head.querySelectorAll('link[rel="stylesheet"]'));
      return links.filter((l) =>
        /fonts\.googleapis\.com.*Source\+Serif\+4/.test((l as HTMLLinkElement).href),
      ).length;
    });
    expect(
      dashLinkCount,
      'Dashboard route MUST NOT inject the Source Serif 4 stylesheet link',
    ).toBe(0);
    await dashCtx.close();
  });
});

// Eslint hint: regex declared at module scope but the evaluate() callbacks
// must use string-literal regex (function bodies execute in browser context
// where the outer `FONT_LINK_HREF_RE` is not in scope). We keep the named
// constant for documentation only.
void FONT_LINK_HREF_RE;
