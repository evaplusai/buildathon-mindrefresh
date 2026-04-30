/**
 * breathing-modal.spec.ts — DC-B1-T8
 *
 * Playwright E2E. ADR-018 §Test Hooks E2E.
 *
 * Strategy: use ?demo=1 to drive the dashboard through a scripted 44s arc that
 * reliably cycles through shifting/overloaded states. The DemoArcRunner fires:
 *   t=0  → steady   (ResetCard hidden)
 *   t=4s → shifting  (ResetCard visible)
 *   t=14s→ overloaded
 *
 * We wait until the dashboard reaches a non-steady state (shifting or
 * overloaded), then click "Begin reset →" on the ResetCard, assert the
 * BreathingModal renders, press ESC, assert modal closes, and assert no
 * console errors fired.
 *
 * Note: asserting the persisted Intervention row requires DB introspection
 * (IDB inside the browser), which is outside E2E scope. The unit tests in
 * breathingDismiss.spec.ts cover the onClose(false) contract; the Dashboard
 * handler is the persistence path. This test validates the DOM signal contract:
 * modal opens → ESC → modal closes → no errors.
 */

import { expect, test, type ConsoleMessage } from '@playwright/test';

const IGNORED_CONSOLE_PATTERNS: RegExp[] = [
  /Download the React DevTools/i,
  /\[vite\] connecting/i,
  /\[vite\] connected/i,
  /\[vite\] hot updated/i,
  /WebSocket connection/i,
];

function shouldIgnore(msg: ConsoleMessage): boolean {
  const text = msg.text();
  return IGNORED_CONSOLE_PATTERNS.some((re) => re.test(text));
}

test.describe('BreathingModal E2E (demo mode)', () => {
  test('opens modal via Begin reset, ESC closes it, no console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !shouldIgnore(msg)) {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(`pageerror: ${err.message}`);
    });

    // Demo mode bypasses wsClient and drives the 44s arc deterministically.
    await page.goto('/dashboard?demo=1');

    // Wait for the page to render the V2 dashboard (greeting heading present).
    await expect(
      page.locator('h1').filter({ hasText: /steady|shifting|overloaded|drained/i }).first(),
    ).toBeVisible({ timeout: 10_000 });

    // Wait for the state to cycle to a non-steady state. The DemoArcRunner
    // fires 'shifting' at t=4s. We wait for the ResetCard's "Begin reset" button
    // to become visible (it is rendered only when dashboardState !== 'steady').
    // The button has aria-label "Begin breathing reset for {state} state".
    const beginResetBtn = page.getByRole('button', { name: /begin breathing reset/i });
    await expect(beginResetBtn).toBeVisible({ timeout: 12_000 });

    // Click "Begin reset" to open the BreathingModal.
    await beginResetBtn.click();

    // Assert the modal dialog is now visible. The BreathingModal renders
    // role="dialog" inside #modal-root.
    const dialog = page.locator('[role="dialog"][aria-modal="true"]');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Assert the orb is rendered (the breathing animation container).
    // The orb has a radial-gradient background — locate by its aria-hidden sibling.
    // The modal content has the protocol title visible.
    await expect(page.getByText(/PHYSIOLOGICAL SIGH|BOX BREATH|4-7-8 BREATH/i).first()).toBeVisible();

    // Press ESC to dismiss mid-protocol.
    await page.keyboard.press('Escape');

    // Assert the dialog is no longer visible.
    await expect(dialog).not.toBeVisible({ timeout: 3_000 });

    // Assert no console errors fired during the entire test.
    expect(consoleErrors).toHaveLength(0);
  });

  test('modal can be opened and closed via close button', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !shouldIgnore(msg)) {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(`pageerror: ${err.message}`);
    });

    await page.goto('/dashboard?demo=1');

    await expect(
      page.locator('h1').filter({ hasText: /steady|shifting|overloaded|drained/i }).first(),
    ).toBeVisible({ timeout: 10_000 });

    const beginResetBtn = page.getByRole('button', { name: /begin breathing reset/i });
    await expect(beginResetBtn).toBeVisible({ timeout: 12_000 });
    await beginResetBtn.click();

    const dialog = page.locator('[role="dialog"][aria-modal="true"]');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Click the CLOSE button (top-right of modal)
    const closeBtn = page.getByRole('button', { name: /close breathing modal/i });
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();

    await expect(dialog).not.toBeVisible({ timeout: 3_000 });

    expect(consoleErrors).toHaveLength(0);
  });
});
