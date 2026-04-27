import { expect, test } from '@playwright/test';

const PRIVACY_PROMISE =
  'Raw biometric signals never leave your device. Only state events sync, to enable the morning check across devices.';

// Slow, full-arc test. Skipped by default to keep the smoke set fast.
// Enable with `RUN_SLOW=1 npx playwright test`.
const SHOULD_RUN = !!process.env.RUN_SLOW;

test.describe.serial('Dashboard recorded arc (full demo)', () => {
  test.skip(!SHOULD_RUN, 'Set RUN_SLOW=1 to run the ~130s arc test.');

  test('regulated → activated → recovering with affirmation surfaces', async ({ page }) => {
    await page.goto('/dashboard?source=recorded');

    // Privacy footer should remain visible throughout the arc.
    const privacy = page.getByText(PRIVACY_PROMISE);
    await expect(privacy).toBeVisible();

    const stateBadge = page.getByRole('status', { name: /current state/i });

    // Phase 1 — Regulated (initial state).
    await expect(stateBadge).toContainText(/regulated/i, { timeout: 30_000 });
    await expect(privacy).toBeVisible();

    // Phase 2 — Activated (fixture transition at t≈68s).
    await expect(stateBadge).toContainText(/activated/i, { timeout: 90_000 });

    // While activated, an AffirmationCard becomes visible.
    const affirmationCard = page.getByRole('region', { name: /somatic affirmation/i });
    await expect(affirmationCard).toBeVisible({ timeout: 30_000 });
    const activatedQuote = await affirmationCard
      .locator('blockquote')
      .first()
      .innerText();
    expect(activatedQuote.trim().length).toBeGreaterThan(0);

    // Privacy footer still visible mid-arc.
    await expect(privacy).toBeVisible();

    // Phase 3 — Recovering (fixture transition at t≈79s).
    await expect(stateBadge).toContainText(/recovering/i, { timeout: 130_000 });

    // A new AffirmationCard appears — text should differ from the activated one.
    // The card may re-mount; wait for it to be visible again, then read the
    // current quote.
    await expect(affirmationCard).toBeVisible();
    // Allow a beat for the next pickAffirmation() to land.
    await expect
      .poll(
        async () => {
          const text = await affirmationCard
            .locator('blockquote')
            .first()
            .innerText();
          return text.trim();
        },
        { timeout: 30_000, intervals: [500, 1_000, 2_000] },
      )
      .not.toBe(activatedQuote.trim());

    // Privacy footer still visible at the end.
    await expect(privacy).toBeVisible();
  });
});
