import { test, expect } from '../fixtures/test-fixtures.js';
import { getActiveForms } from '../config/forms.js';
import { buildBypassUrlFromEnv } from '../src/utils/qaBypass.js';

/**
 * Requirement: confirm the developer's reCAPTCHA QA bypass lets us fill and
 * submit every listed WordPress (Elementor) form successfully. One success-path
 * test is generated per in-scope page (see config/forms.ts) — the scenario is
 * identical across the estate; only the page list grows.
 *
 * For reCAPTCHA-protected forms we cannot solve the challenge in a browser, so
 * we navigate via the developer-supplied QA bypass URL (a fresh, HMAC-signed
 * qa_token / qa_ts pair valid for ~5 minutes). The token rides along as the
 * page URL / AJAX referrer, so the server skips the reCAPTCHA check and the
 * submission goes through.
 *
 * Per the QA team's convention, each test uses a disposable @yopmail.com address
 * (unique per form/run) and a self-identifying message so any received enquiry
 * is obviously a test.
 */
const TEST_MESSAGE =
  'This is the test by the QA team from Yotta Digital, please ignore';

for (const form of getActiveForms()) {
  // `form.key` is unique per page; multiple pages can share a display name
  // (e.g. several "New Form" pages on one site), so the key keeps test titles
  // distinct as Playwright requires.
  // Representative forms also carry @smoke so push/PR can run a fast subset
  // (the full estate runs on schedule / manual dispatch).
  const tags = form.smoke ? ['@forms', '@smoke'] : ['@forms'];
  test.describe(`[${form.key}] ${form.name}`, () => {
    test('submits successfully', { tag: tags }, async ({ contactPage }) => {
      // Some configured pages aren't automatable yet (e.g. popup/library
      // template URLs that drop the bypass token on redirect) — list them but
      // skip with the reason rather than fail the run.
      test.skip(Boolean(form.skip), form.skip ?? '');

      // A unique inbox per form+run keeps submissions traceable and avoids
      // dedupe/collisions when forms run in parallel.
      const email = `qa-yotta-${form.key}-${Date.now()}@yopmail.com`;

      // Build the navigation URL. reCAPTCHA-protected forms get a fresh bypass
      // token appended right before navigating (the token is short-lived).
      const targetUrl = form.usesRecaptchaBypass
        ? buildBypassUrlFromEnv(form.pageURL)
        : form.pageURL;

      await contactPage.open(form, targetUrl);

      await contactPage.fill({
        name: 'Yotta QA',
        email,
        phone: '0400000000',
        message: TEST_MESSAGE,
      });

      // Note: this bypass keeps the reCAPTCHA widget on the page and instead
      // forwards a signed qa_token/qa_ts so the server skips verification, so we
      // do not assert on the widget — the source of truth is the AJAX response.
      const result = await contactPage.submit();
      expect(
        result.outcome,
        `form submission did not succeed — server said: "${result.message}". ` +
          'If this is a Captcha error, the reCAPTCHA QA bypass is not being ' +
          'honoured server-side (check the QA_BYPASS_SECRET value and that the ' +
          'bypass handler is deployed for this site).',
      ).toBe('success');

      test.info().annotations.push({
        type: 'submission',
        description: `Submitted as ${email} → "${result.message}"`,
      });
    });
  });
}
