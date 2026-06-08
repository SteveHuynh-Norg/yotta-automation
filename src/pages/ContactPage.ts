import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage.js';
import type { FormConfig, FormSelectors } from '../types/index.js';

/** Values used to fill a contact form. Fields without a selector are skipped. */
export interface ContactFormData {
  name?: string;
  email: string;
  phone?: string;
  message: string;
}

/**
 * Page object for a contact form (first target: the SS Doors Elementor Pro
 * form). Selectors are supplied per-form from `config/forms.ts`, so this object
 * is form-agnostic — the spec only ever talks to these methods (POM principle).
 *
 * reCAPTCHA is handled out-of-band: the spec navigates here via the QA bypass
 * URL, so the challenge is satisfied server-side and the page object never has
 * to solve it.
 */
export class ContactPage extends BasePage {
  private selectors!: FormSelectors;

  constructor(page: Page) {
    super(page);
  }

  /** Bind this object to a form's selectors and navigate to `url`. */
  async open(form: FormConfig, url: string): Promise<void> {
    this.selectors = form.selectors;
    await this.applyBypassHeader(url);
    await this.goto(url);

    // If the form lives in an Elementor popup, open it (it's hidden until then).
    if (form.openPopupId !== undefined) {
      await this.openElementorPopup(form.openPopupId);
    }

    // A page may host more than one Elementor form; scope to the target by name
    // (selectors.form already does) and take the first match defensively.
    await expect(this.form.first(), 'contact form not found on page').toBeVisible();

    // Wait until the reCAPTCHA v2 widget has rendered its iframe. This only
    // happens once Elementor's frontend JS and the reCAPTCHA API have
    // initialised, so it is a reliable proxy for "the form's submit handler is
    // attached" — clicking before that does a no-op instead of an AJAX submit.
    // Best-effort and short: reCAPTCHA v3 forms (and any form without a checkbox
    // widget) have no such iframe, so we don't want to block long here.
    if (this.selectors.recaptcha) {
      await this.page
        .locator(`${this.selectors.recaptcha} iframe`)
        .first()
        .waitFor({ state: 'attached', timeout: 8_000 })
        .catch(() => {
          /* no v2 widget (v3 form, or bypass suppressed it) — proceed regardless */
        });
    }
  }

  /**
   * Add the `X-QA-Bypass` header (Cloudflare Bot Fight Mode allowlist for the
   * BND zones) to FIRST-PARTY requests only — i.e. requests to the form page's
   * own host (the document, its assets, and admin-ajax). Sending it cross-origin
   * (e.g. to Google's reCAPTCHA script) trips a CORS preflight rejection, so we
   * scope it by host. No-op when QA_BYPASS_HEADER is unset.
   */
  private async applyBypassHeader(url: string): Promise<void> {
    const token = process.env.QA_BYPASS_HEADER;
    if (!token) return;
    let host: string;
    try {
      host = new URL(url).hostname;
    } catch {
      return;
    }
    await this.page.route(
      (reqUrl) => {
        try {
          return new URL(reqUrl).hostname === host;
        } catch {
          return false;
        }
      },
      (route) =>
        route.continue({ headers: { ...route.request().headers(), 'x-qa-bypass': token } }),
    );
  }

  /**
   * Reveal an Elementor Pro popup by id via the frontend API, then wait for the
   * target form to become visible. We use the API rather than clicking a trigger
   * because the trigger links are often hidden (collapsed nav), and the
   * `?elementor_library=` template URL drops the qa_token on its redirect.
   */
  private async openElementorPopup(popupId: number): Promise<void> {
    // Wait for the Pro popup API. Note Elementor detaches popup content from the
    // DOM after init and re-attaches it on showPopup, so the form may be absent
    // until we open it.
    await this.page
      .waitForFunction(
        () =>
          Boolean(
            (window as unknown as {
              elementorProFrontend?: { modules?: { popup?: { showPopup?: unknown } } };
            }).elementorProFrontend?.modules?.popup?.showPopup,
          ),
        { timeout: 15_000 },
      )
      .catch(() => {
        /* Pro frontend not ready — the visibility assertion will surface it */
      });

    // showPopup is a no-op until the popup is registered, so retry until the
    // form actually appears (re-issuing the open each attempt).
    const target = this.form.first();
    for (let attempt = 0; attempt < 5; attempt++) {
      await this.page
        .evaluate((id) => {
          (window as unknown as {
            elementorProFrontend?: {
              modules?: { popup?: { showPopup?: (a: { id: number }) => void } };
            };
          }).elementorProFrontend?.modules?.popup?.showPopup?.({ id });
        }, popupId)
        .catch(() => {});
      try {
        await target.waitFor({ state: 'visible', timeout: 3_000 });
        return;
      } catch {
        /* not open yet — retry */
      }
    }
  }

  private get form(): Locator {
    return this.page.locator(this.selectors.form);
  }

  /**
   * Fill the form for a successful submission.
   *
   * Across the estate the forms are heterogeneous: Elementor auto-generates most
   * field IDs (only `email` is consistently named) and many forms carry extra
   * required fields beyond name/email/phone/message — Suburb, Postcode, Street
   * Address, First/Last Name, a consent checkbox, etc. Leaving any required field
   * blank fails server-side validation, so rather than target a fixed set of
   * selectors we sweep every visible field in the form and fill it by type +
   * label heuristic. Hidden fields (incl. Elementor's `display:none` honeypot)
   * are skipped, which also keeps the submission from being flagged as spam.
   */
  async fill(data: ContactFormData): Promise<void> {
    const form = this.form.first();

    // Text-like inputs and textareas.
    const fields = form.locator(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]), textarea',
    );
    const fieldCount = await fields.count();
    for (let i = 0; i < fieldCount; i++) {
      const field = fields.nth(i);
      if (!(await field.isVisible().catch(() => false))) continue;
      const value = await this.valueForField(field, data);
      if (value === null) continue;
      await field.fill(value).catch(() => {
        /* a field we cannot fill (readonly/disabled) is not fatal — skip it */
      });
    }

    // Tick any required consent checkbox (e.g. the B&D privacy acknowledgement).
    const checkboxes = form.locator('input[type="checkbox"]');
    const cbCount = await checkboxes.count();
    for (let i = 0; i < cbCount; i++) {
      const box = checkboxes.nth(i);
      if (!(await box.isVisible().catch(() => false))) continue;
      if ((await isRequired(box)) && !(await box.isChecked().catch(() => false))) {
        await box.check().catch(() => {});
      }
    }

    // For any required <select>, choose the first option with a real value.
    const selects = form.locator('select');
    const selCount = await selects.count();
    for (let i = 0; i < selCount; i++) {
      const sel = selects.nth(i);
      if (!(await sel.isVisible().catch(() => false))) continue;
      if (!(await isRequired(sel))) continue;
      const optionValue = await sel
        .locator('option')
        .evaluateAll((opts) => {
          const first = (opts as HTMLOptionElement[]).find((o) => o.value.trim() !== '');
          return first ? first.value : null;
        })
        .catch(() => null);
      if (optionValue) await sel.selectOption(optionValue).catch(() => {});
    }
  }

  /**
   * Decide what to type into a single field, from its type then placeholder /
   * name / aria-label keywords. Returns null to leave the field untouched.
   */
  private async valueForField(field: Locator, data: ContactFormData): Promise<string | null> {
    const meta = await field.evaluate((el) => ({
      tag: el.tagName.toLowerCase(),
      type: (el.getAttribute('type') ?? '').toLowerCase(),
      hint: `${el.getAttribute('placeholder') ?? ''} ${el.getAttribute('name') ?? ''} ${el.getAttribute('aria-label') ?? ''}`.toLowerCase(),
    }));
    const { tag, type, hint } = meta;
    const phone = data.phone ?? '0400000000';

    if (tag === 'textarea') return data.message;
    if (type === 'email' || /e-?mail/.test(hint)) return data.email;
    if (type === 'tel' || /phone|mobile/.test(hint)) return phone;
    if (/post.?code|zip/.test(hint)) return '3000';
    if (/suburb|city|town/.test(hint)) return 'Melbourne';
    if (/\bstate\b/.test(hint)) return 'VIC';
    if (/address|street/.test(hint)) return '1 Test Street';
    if (/last\s*name|surname|family\s*name/.test(hint)) return 'QA';
    if (/first\s*name|given\s*name/.test(hint)) return 'Yotta';
    // Any remaining text field (incl. a plain "Name") gets the generic name —
    // filling optional fields is harmless and covers unlabelled required ones.
    return data.name ?? 'Yotta QA';
  }

  /**
   * True if a reCAPTCHA widget is actually rendered and visible. With a valid
   * bypass token the server typically suppresses the widget; if it is still
   * visible the bypass did not take effect, which the spec surfaces clearly.
   */
  async isRecaptchaVisible(): Promise<boolean> {
    if (!this.selectors.recaptcha) return false;
    const widget = this.page.locator(this.selectors.recaptcha);
    if ((await widget.count()) === 0) return false;
    return widget.first().isVisible();
  }

  /**
   * Submit the form and return the authoritative outcome.
   *
   * Elementor Pro posts to `admin-ajax.php` and returns JSON
   * (`{ success, data: { message, errors } }`). We capture that response via a
   * route intercept rather than `waitForResponse(...).text()`: on a successful
   * submission Elementor follows the response with a redirect to a thank-you
   * page (`data.redirect_url`), and the navigation evicts the response body
   * before a deferred `.text()` can read it — surfacing a real success as a
   * false "empty response". Inside the route handler we fetch the response and
   * read its body in-flight (before the page navigates), then fulfil the page
   * with it. If no admin-ajax fires (e.g. client-side reCAPTCHA blocked the
   * submit), we fall back to the on-page banner text.
   */
  async submit(
    timeout = 30_000,
  ): Promise<{ outcome: 'success' | 'error'; message: string }> {
    const token = process.env.QA_BYPASS_HEADER;
    let resolveCaptured!: (v: { status: number; body: string }) => void;
    const capturedReady = new Promise<{ status: number; body: string }>((resolve) => {
      resolveCaptured = resolve;
    });

    const handler = async (route: import('@playwright/test').Route) => {
      const req = route.request();
      if (req.method() !== 'POST') return route.continue();
      try {
        // Re-issue the (single) submission ourselves so we own the body read.
        // Re-add the Cloudflare bypass header (this route pre-empts open()'s).
        const resp = await route.fetch(
          token ? { headers: { ...req.headers(), 'x-qa-bypass': token } } : undefined,
        );
        const body = (await resp.body()).toString('utf8');
        // Resolve on the form-submission response (Elementor always includes
        // `success`), ignoring any unrelated admin-ajax traffic. Resolving more
        // than once is a no-op.
        if (/"success"\s*:/.test(body)) {
          resolveCaptured({ status: resp.status(), body });
        }
        await route.fulfill({ response: resp });
      } catch {
        await route.continue().catch(() => {});
      }
    };

    await this.page.route('**/admin-ajax.php', handler);
    let result: { status: number; body: string } | null = null;
    try {
      await this.page.locator(this.selectors.submit).first().click();
      result = await Promise.race([
        capturedReady,
        this.page.waitForTimeout(timeout).then(() => null),
      ]);
    } catch {
      /* click failed — fall through to banner/empty handling below */
    } finally {
      await this.page.unroute('**/admin-ajax.php', handler).catch(() => {});
    }

    if (result) {
      const bodyText = result.body;
      let json: ElementorFormResponse | null = null;
      try {
        json = bodyText ? (JSON.parse(bodyText) as ElementorFormResponse) : null;
      } catch {
        json = null;
      }
      if (json?.success) {
        return { outcome: 'success', message: json.data?.message ?? 'Submitted' };
      }
      const fieldErrors = Object.values(json?.data?.errors ?? {})
        .filter((v): v is string => Boolean(v))
        .join('; ');
      const message = [json?.data?.message, fieldErrors].filter(Boolean).join(' — ');
      if (message) {
        return { outcome: 'error', message };
      }
      const raw = bodyText.replace(/\s+/g, ' ').trim().slice(0, 500);
      return {
        outcome: 'error',
        message: raw
          ? `Submission was rejected by the server — raw response: ${raw}`
          : 'Submission was rejected by the server (empty response).',
      };
    }

    // No admin-ajax response captured — surface whatever banner rendered.
    return this.readBanner();
  }

  /** Read the on-page success/error banner as a fallback when no AJAX fired. */
  private async readBanner(): Promise<{ outcome: 'success' | 'error'; message: string }> {
    const success = this.page.locator(this.selectors.success).first();
    if (await success.isVisible().catch(() => false)) {
      return { outcome: 'success', message: (await success.innerText()).trim() };
    }
    const errors = await this.page.locator(this.selectors.error).allInnerTexts();
    const message = errors.map((t) => t.trim()).filter(Boolean).join(' — ');
    return {
      outcome: 'error',
      message:
        message ||
        'Form did not submit — no admin-ajax response and no banner (client-side reCAPTCHA likely blocked it).',
    };
  }
}

/** True if the control is marked required (HTML `required` or `aria-required`). */
function isRequired(field: Locator): Promise<boolean> {
  return field.evaluate(
    (el) => el.hasAttribute('required') || el.getAttribute('aria-required') === 'true',
  );
}

/** Shape of Elementor Pro's form-submission AJAX response. */
interface ElementorFormResponse {
  success: boolean;
  data?: {
    message?: string;
    errors?: Record<string, string>;
  };
}
