import { test, expect } from '../fixtures/test-fixtures.js';
import { getActiveForms } from '../config/forms.js';
import { buildBypassUrlFromEnv } from '../src/utils/qaBypass.js';

/**
 * Requirement: "perform the form submission on the contact page — one test for
 * the successful submission only."
 *
 * For reCAPTCHA-protected forms we cannot solve the challenge in a browser, so
 * we navigate via the developer-supplied QA bypass URL (a fresh, HMAC-signed
 * qa_token / qa_ts pair valid for ~5 minutes). The token rides along as the
 * page URL / AJAX referrer, so the server skips the reCAPTCHA check and the
 * submission goes through.
 *
 * Per the QA team's convention, the test uses a disposable @yopmail.com address
 * and a self-identifying message so any received enquiry is obviously a test.
 */
const TEST_MESSAGE =
  'This is the test by the QA team from Yotta Digital, please ignore';

for (const form of getActiveForms()) {
  test.describe(`[${form.name}] Form submission`, () => {
    test('submits successfully', { tag: '@forms' }, async ({ contactPage }) => {
      // A unique inbox per run keeps submissions traceable and avoids dedupe.
      const email = `qa-yotta-${Date.now()}@yopmail.com`;

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
