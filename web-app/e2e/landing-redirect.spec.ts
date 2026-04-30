/**
 * e2e/landing-redirect.spec.ts
 *
 * Playwright — tests ADR-012 Resolution B:
 * If `?source=` or `?dev=1` is present on the marketing landing page (/),
 * a <Navigate replace> forwards the visitor to /dashboard with the same
 * query string.  "replace" semantics mean pressing Back does NOT return to
 * the original marketing URL — it goes to wherever was before /.
 */

import { test, expect } from '@playwright/test';

test.describe('Landing query-param forwarding (ADR-012 Resolution B)', () => {
  test('/?source=recorded → /dashboard?source=recorded (replace semantics)', async ({
    page,
  }) => {
    await page.goto('/?source=recorded');

    // Should land on dashboard with the query param
    await page.waitForURL((url) =>
      url.pathname === '/dashboard' && url.searchParams.get('source') === 'recorded',
    );
    expect(page.url()).toContain('/dashboard?source=recorded');

    // Go back — replace semantics means the browser history entry for
    // /?source=recorded was replaced, so Back should NOT land there.
    await page.goBack();

    const backUrl = page.url();
    expect(
      backUrl,
      'After pressing Back from /dashboard?source=recorded, the browser should NOT return to /?source=recorded because the redirect used replace semantics',
    ).not.toMatch(/\/\?source=recorded/);
  });

  test('/?dev=1 → /dashboard?dev=1 (replace semantics)', async ({ page }) => {
    await page.goto('/?dev=1');

    await page.waitForURL((url) =>
      url.pathname === '/dashboard' && url.searchParams.get('dev') === '1',
    );
    expect(page.url()).toContain('/dashboard?dev=1');

    await page.goBack();

    const backUrl = page.url();
    expect(
      backUrl,
      'After pressing Back from /dashboard?dev=1, browser should NOT return to /?dev=1',
    ).not.toMatch(/\/\?dev=1/);
  });
});
