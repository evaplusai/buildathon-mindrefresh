import { expect, test, type ConsoleMessage } from '@playwright/test';

const PRIVACY_FOOTER_RE = /Local processing.*Raw signals never leave/i;

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

    // Title — index.html default; MarketingLanding overrides to its own
    // title only on /, so /dashboard keeps the index.html title.
    await expect(page).toHaveTitle(/MindRefresh/);

    // StateDial — the V2 hero. Initial state is steady; the H1 greeting
    // contains "steady" in italic.
    const greetingHeading = page.locator('h1').filter({ hasText: /steady|shifting|overloaded|drained/i });
    await expect(greetingHeading.first()).toBeVisible({ timeout: 10_000 });

    // Privacy footer (V2 wording).
    await expect(page.getByText(PRIVACY_FOOTER_RE)).toBeVisible();

    // Worker — Worker constructor is exposed in window. Dashboard.tsx
    // spawns one when not in demo mode.
    const hasWorker = await page.evaluate(() => 'Worker' in window);
    expect(hasWorker).toBe(true);

    // Final console-error gate.
    expect(
      consoleErrors,
      `Console errors observed:\n${consoleErrors.join('\n')}`,
    ).toEqual([]);
  });
});
