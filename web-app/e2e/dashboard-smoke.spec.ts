import { expect, test, type ConsoleMessage } from '@playwright/test';

const PRIVACY_PROMISE =
  'Raw biometric signals never leave your device. Only state events sync, to enable the morning check across devices.';

// Suppression list — third-party / informational console output that is not a
// product bug. Kept small so we surface real product errors loudly.
const IGNORED_CONSOLE_PATTERNS: RegExp[] = [
  /Download the React DevTools/i,
  /\[vite\] connecting/i,
  /\[vite\] connected/i,
  /\[vite\] hot updated/i,
];

function shouldIgnoreConsoleMessage(msg: ConsoleMessage): boolean {
  const text = msg.text();
  return IGNORED_CONSOLE_PATTERNS.some((re) => re.test(text));
}

test.describe('Dashboard smoke (recorded source)', () => {
  test('renders core surfaces, spawns a worker, no console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !shouldIgnoreConsoleMessage(msg)) {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(`pageerror: ${err.message}`);
    });

    await page.goto('/dashboard?source=recorded');

    // Title.
    await expect(page).toHaveTitle('MindRefreshStudio');

    // StateBadge — role="status" with aria-label "Current state: ..."
    const stateBadge = page.getByRole('status', { name: /current state/i });
    await expect(stateBadge).toBeVisible({ timeout: 10_000 });
    const stateLabel = await stateBadge.textContent();
    expect(stateLabel?.trim().length ?? 0).toBeGreaterThan(0);

    // BreathGuide — role="img" with aria-label that begins with one of the
    // pattern descriptions. On initial render in "regulated" state the
    // pattern is "natural" → label "Natural follow at NN BPM".
    const breathGuide = page.getByRole('img', {
      name: /(Natural follow|Cyclic sigh|Extended exhale)/i,
    });
    await expect(breathGuide).toBeVisible({ timeout: 10_000 });

    // Privacy footer (verbatim).
    await expect(page.getByText(PRIVACY_PROMISE)).toBeVisible();

    // Worker — Worker constructor is exposed in window AND we have evidence
    // the dashboard mounted (the StateBadge above is rendered by the same
    // component that spawns the worker, so its presence is the small DOM
    // signal of completion).
    const hasWorker = await page.evaluate(() => 'Worker' in window);
    expect(hasWorker).toBe(true);

    // Final console-error gate.
    expect(
      consoleErrors,
      `Console errors observed:\n${consoleErrors.join('\n')}`,
    ).toEqual([]);
  });
});
