import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration.
 *
 * The suite is read-only verification against live directory sites, so we run
 * headless Chromium with retries to absorb transient network flakiness on
 * external links. Reports are HTML + list.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 2 : undefined,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
  use: {
    // baseURL is intentionally left to per-site config so the suite can target
    // many directories; page objects navigate with absolute URLs.
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    ignoreHTTPSErrors: false,
    userAgent:
      'yotta-automation-qa/1.0 (+Playwright; link & structured-data verification)',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
