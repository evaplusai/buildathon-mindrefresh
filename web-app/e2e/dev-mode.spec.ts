import { expect, test } from '@playwright/test';

test.describe('Dev mode (?dev=1)', () => {
  test('Force morning check button surfaces MorningCheckCard', async ({ page }) => {
    await page.goto('/dashboard?dev=1&source=recorded');

    const forceBtn = page.getByRole('button', { name: /force morning check/i });
    await expect(forceBtn).toBeVisible();

    await forceBtn.click();

    // The MorningCheckCard's <section aria-label="Morning check comparison">
    // appears once the synthetic trigger fires.
    const morningCard = page.getByRole('region', { name: /morning check comparison/i });
    await expect(morningCard).toBeVisible({ timeout: 5_000 });

    // CTA inside the card.
    const talkCta = page.getByRole('button', { name: /i.?d like to talk about it/i });
    await expect(talkCta).toBeVisible();
  });
});
