/**
 * e2e/app-entry.spec.ts
 *
 * Playwright — operator entry page at /_entry (ADR-012).
 *
 * AppEntry.tsx is the renamed pre-marketing landing page.  It must:
 *  - Render an "Open dashboard" link/button with href → /dashboard
 *  - Render a "Try recorded session" link with href → /dashboard?source=recorded
 *  - NOT show "Catch the crash" (the marketing hero h1) so we can confirm
 *    this route is NOT the marketing page.
 */

import { test, expect } from '@playwright/test';

test.describe('Operator entry page — /_entry (AppEntry.tsx)', () => {
  test('"Open dashboard" link/button exists with href containing /dashboard', async ({
    page,
  }) => {
    await page.goto('/_entry');

    const openDashboard = page
      .getByRole('link', { name: /open dashboard/i })
      .or(page.getByRole('button', { name: /open dashboard/i }))
      .first();

    await expect(openDashboard).toBeVisible();

    const href = await openDashboard.getAttribute('href');
    expect(href, '"Open dashboard" should have an href').toBeTruthy();
    expect(href).toContain('/dashboard');
  });

  test('"Try recorded session" link exists with href ending in /dashboard?source=recorded', async ({
    page,
  }) => {
    await page.goto('/_entry');

    const tryRecorded = page
      .getByRole('link', { name: /try recorded session/i })
      .first();

    await expect(tryRecorded).toBeVisible();

    const href = await tryRecorded.getAttribute('href');
    expect(href, '"Try recorded session" should have an href').toBeTruthy();
    expect(href).toContain('/dashboard?source=recorded');
  });

  test('page does NOT contain "Catch the crash" (must not be the marketing page)', async ({
    page,
  }) => {
    await page.goto('/_entry');

    const h1s = page.locator('h1');
    const count = await h1s.count();

    for (let i = 0; i < count; i++) {
      const text = await h1s.nth(i).textContent();
      expect(
        text ?? '',
        `/_entry h1 should not contain "Catch the crash" — this is the operator page, not the marketing page`,
      ).not.toContain('Catch the crash');
    }
  });
});
