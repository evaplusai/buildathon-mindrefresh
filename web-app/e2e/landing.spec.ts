/**
 * e2e/landing.spec.ts
 *
 * Playwright smoke — marketing landing page at /.
 *
 * Covered contracts (ADR-012):
 *  - Hero <h1> contains the full headline text
 *  - Banner announces early access
 *  - The live-demo card "Begin →" link navigates to /dashboard?source=recorded
 */

import { test, expect } from '@playwright/test';

test.describe('Marketing landing page — /', () => {
  test('hero h1 contains "Catch the crash", "before", and "it catches you"', async ({
    page,
  }) => {
    await page.goto('/');

    const h1 = page.locator('h1').first();
    const text = await h1.textContent();
    expect(text, 'h1 text content').toBeTruthy();
    expect(text).toContain('Catch the crash');
    expect(text).toContain('before');
    expect(text).toContain('it catches you');
  });

  test('banner with "Early access is open" is visible', async ({ page }) => {
    await page.goto('/');

    const banner = page.locator('text=/Early access is open/i').first();
    await expect(banner).toBeVisible();
  });

  test('"Begin →" link exists and navigates to /dashboard?source=recorded', async ({
    page,
  }) => {
    await page.goto('/');

    // Find the "Begin →" anchor — the only live product-entry CTA on the page
    const beginLink = page
      .locator('a')
      .filter({ hasText: /Begin\s*→/ })
      .first();

    await expect(beginLink).toBeVisible();

    const href = await beginLink.getAttribute('href');
    expect(href, '"Begin →" href').toBeTruthy();
    expect(
      href!.endsWith('/dashboard?source=recorded'),
      `"Begin →" href "${href}" should end with /dashboard?source=recorded`,
    ).toBe(true);

    // Click and confirm navigation
    await beginLink.click();
    await page.waitForURL((url) => {
      const search = url.searchParams;
      return search.get('source') === 'recorded' && url.pathname === '/dashboard';
    });
  });
});
