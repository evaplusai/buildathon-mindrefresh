import { defineConfig } from '@playwright/test';

// E2E config — Chromium only for V1 (sufficient for buildathon).
// The dashboard-recorded-arc.spec.ts test plays the full ~150s fixture, so
// we set per-test timeout generously. The smoke + landing + dev-mode specs
// are fast.
export default defineConfig({
  testDir: './e2e',
  timeout: 180_000,
  expect: {
    timeout: 30_000,
  },
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
