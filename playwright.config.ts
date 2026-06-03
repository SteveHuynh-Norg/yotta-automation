import { defineConfig, devices } from '@playwright/test';

// Load a local `.env` (gitignored) if present, so secrets like QA_BYPASS_SECRET
// and toggles like SITE / FORM can be set without exporting them in the shell.
// No-op when the file is absent or on a Node without loadEnvFile (CI passes
// these as real environment variables).
try {
  process.loadEnvFile?.('.env');
} catch {
  // .env is optional — ignore when missing.
}

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
  // In CI we add the built-in `github` reporter (inline error annotations) and a
  // custom reporter that writes the run summary table to the GitHub job summary.
  reporter: process.env.CI
    ? [
        ['list'],
        ['github'],
        ['./src/reporters/github-summary-reporter.ts'],
        // Posts the run summary to Slack when SLACK_WEBHOOK_URL is set;
        // otherwise a no-op. Kept after the summary reporter so it observes the
        // same final outcomes.
        ['./src/reporters/slack-reporter.ts'],
        ['html', { open: 'never' }],
      ]
    : [
        ['list'],
        // Enabled locally too, but silent unless SLACK_WEBHOOK_URL is set
        // (e.g. in your gitignored .env) — handy for verifying the integration.
        ['./src/reporters/slack-reporter.ts'],
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
    // QA bypass header for Cloudflare Bot Fight Mode (BND zones that 403 the
    // automated browser). Sent on every request when QA_BYPASS_HEADER is set;
    // sites that don't look for it simply ignore it. See dev note on Monday
    // item 2702399641 (v2.3).
    ...(process.env.QA_BYPASS_HEADER
      ? { extraHTTPHeaders: { 'X-QA-Bypass': process.env.QA_BYPASS_HEADER } }
      : {}),
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
