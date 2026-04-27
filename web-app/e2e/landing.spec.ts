import { expect, test } from '@playwright/test';

const PRIVACY_PROMISE =
  'Raw biometric signals never leave your device. Only state events sync, to enable the morning check across devices.';

test.describe('Landing page', () => {
  test('renders heading, privacy promise, and dashboard links', async ({ page }) => {
    await page.goto('/');

    // Heading containing brand name. The h1 is "MindRefreshStudio".
    const heading = page.getByRole('heading', { level: 1, name: /MindRefreshStudio/ });
    await expect(heading).toBeVisible();

    // Privacy promise verbatim.
    await expect(page.getByText(PRIVACY_PROMISE)).toBeVisible();

    // "Open dashboard" link → /dashboard
    const openDashboard = page.getByRole('link', { name: /open dashboard/i });
    await expect(openDashboard).toBeVisible();
    const openHref = await openDashboard.getAttribute('href');
    expect(openHref).toContain('/dashboard');

    // "Try recorded session" link → /dashboard?source=recorded
    const tryRecorded = page.getByRole('link', { name: /try recorded session/i });
    await expect(tryRecorded).toBeVisible();
    const recordedHref = await tryRecorded.getAttribute('href');
    expect(recordedHref).toContain('/dashboard?source=recorded');
  });
});
