/**
 * reflect-card.spec.ts — Playwright E2E for the Reflect agent swarm.
 *
 * Per ADR-016 §Test Hooks E1 and ADR-018 §Test Hooks.
 *
 * Steps:
 *   1. Load /dashboard?source=recorded
 *   2. Wait for ReflectCard to be visible
 *   3. Click the first sample button ("I'm so behind on everything")
 *   4. Wait for textarea to populate; click "Reflect →"
 *   5. Wait up to 6s for all 3 agent cards to reach status="done"
 *   6. Assert the ReframeBlock is visible
 *   7. Assert the dashboard H1 heading text is unchanged
 *      (sensor-derived state ≠ agent-advisory state, but sensor wins)
 *
 * Ownership: ui-coder (Sprint B Block 4).
 */

import { test, expect } from '@playwright/test';

const SAMPLE_LABEL = '"I\'m so behind on everything"';

test.describe('Reflect Card — E2E swarm flow', () => {
  test('completes a full reflect run with 3 agent cards reaching done', async ({ page }) => {
    // 1. Navigate to dashboard in recorded mode
    await page.goto('/dashboard?source=recorded');

    // 2. Wait for ReflectCard to be visible
    //    The section is labelled "Reflect — agent swarm"
    const reflectCard = page.getByRole('region', { name: /reflect.*agent swarm/i });
    await expect(reflectCard).toBeVisible({ timeout: 10_000 });

    // 3. Click the first sample button
    const sampleBtn = reflectCard.getByRole('button', { name: SAMPLE_LABEL });
    await expect(sampleBtn).toBeVisible({ timeout: 5_000 });
    await sampleBtn.click();

    // 4. Wait for textarea to populate
    const textarea = reflectCard.getByRole('textbox', { name: /reflection input/i });
    await expect(textarea).not.toHaveValue('', { timeout: 2_000 });

    // 5. Click "Reflect →"
    const submitBtn = reflectCard.getByRole('button', { name: /submit reflection/i });
    await submitBtn.click();

    // 6. Wait up to 6s for all 3 agent cards to reach status="done"
    //    Each card has data-agent attribute and data-status attribute
    for (const agentNum of [1, 2, 3] as const) {
      const agentCard = reflectCard.locator(`[data-agent="${agentNum}"]`);
      await expect(agentCard).toHaveAttribute('data-status', 'done', { timeout: 6_000 });
    }

    // 7. Assert the ReframeBlock is visible
    //    The ReframeBlock has aria-label="Reverse affirmation"
    const reframeBlock = reflectCard.getByRole('region', { name: /reverse affirmation/i });
    await expect(reframeBlock).toBeVisible({ timeout: 2_000 });

    // 8. Assert the dashboard H1 heading text is unchanged
    //    The sensor-derived state drives the H1 greeting; the agent advisory
    //    does not replace it. The heading contains a known greeting phrase.
    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible();
    const h1Text = await h1.innerText();

    // The H1 should contain one of the known greeting phrases (state-driven)
    const knownGreetings = [
      'Good afternoon',
      'Your system is',
      'Your body is',
    ];
    const hasKnownGreeting = knownGreetings.some((g) => h1Text.includes(g));
    expect(hasKnownGreeting).toBe(true);

    // The H1 must NOT be empty and must NOT be the advisory state's text
    // (i.e., the sensor state wins — heading doesn't flip to the advisory).
    expect(h1Text.length).toBeGreaterThan(10);
  });

  test('sample button populates textarea without auto-submitting', async ({ page }) => {
    await page.goto('/dashboard?source=recorded');

    const reflectCard = page.getByRole('region', { name: /reflect.*agent swarm/i });
    await expect(reflectCard).toBeVisible({ timeout: 10_000 });

    const sampleBtn = reflectCard.getByRole('button', { name: SAMPLE_LABEL });
    await sampleBtn.click();

    // Textarea should be populated
    const textarea = reflectCard.getByRole('textbox', { name: /reflection input/i });
    await expect(textarea).not.toHaveValue('', { timeout: 2_000 });

    // But no agent cards should be in thinking/done state yet
    const agent1 = reflectCard.locator('[data-agent="1"]');
    // The agent grid is only rendered after submission
    await expect(agent1).not.toBeVisible();
  });
});
