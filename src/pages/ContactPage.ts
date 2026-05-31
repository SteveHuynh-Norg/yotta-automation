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
    await this.goto(url);
    await expect(this.form, 'contact form not found on page').toBeVisible();

    // Wait until the reCAPTCHA widget has rendered its iframe. This only happens
    // once Elementor's frontend JS and the reCAPTCHA API have initialised, so it
    // is a reliable proxy for "the form's submit handler is attached" — clicking
    // before that does a no-op instead of an AJAX submit. Best-effort: a form
    // without reCAPTCHA simply skips the wait.
    if (this.selectors.recaptcha) {
      await this.page
        .locator(`${this.selectors.recaptcha} iframe`)
        .first()
        .waitFor({ state: 'attached', timeout: 20_000 })
        .catch(() => {
          /* widget may be suppressed by a working bypass — proceed regardless */
        });
    }
  }

  private get form(): Locator {
    return this.page.locator(this.selectors.form);
  }

  /** Fill every field that the form exposes a selector for. */
  async fill(data: ContactFormData): Promise<void> {
    if (this.selectors.name && data.name !== undefined) {
      await this.page.locator(this.selectors.name).fill(data.name);
    }
    await this.page.locator(this.selectors.email).fill(data.email);
    if (this.selectors.phone && data.phone !== undefined) {
      await this.page.locator(this.selectors.phone).fill(data.phone);
    }
    await this.page.locator(this.selectors.message).fill(data.message);
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
   * (`{ success, data: { message, errors } }`), so we read that response rather
   * than racing the DOM banner — which is timing/scroll dependent and easily
   * missed. If no AJAX request fires within the timeout (e.g. client-side
   * reCAPTCHA blocked the submit), we fall back to the on-page banner text.
   */
  async submit(
    timeout = 30_000,
  ): Promise<{ outcome: 'success' | 'error'; message: string }> {
    try {
      const [response] = await Promise.all([
        this.page.waitForResponse(
          (r) => r.url().includes('admin-ajax.php') && r.request().method() === 'POST',
          { timeout },
        ),
        this.page.locator(this.selectors.submit).click(),
      ]);

      const json = (await response.json().catch(() => null)) as ElementorFormResponse | null;
      if (json?.success) {
        return { outcome: 'success', message: json.data?.message ?? 'Submitted' };
      }
      const fieldErrors = Object.values(json?.data?.errors ?? {})
        .filter((v): v is string => Boolean(v))
        .join('; ');
      const message = [json?.data?.message, fieldErrors].filter(Boolean).join(' — ');
      return { outcome: 'error', message: message || 'Submission was rejected by the server.' };
    } catch {
      // No AJAX response — surface whatever banner the form rendered, if any.
      return this.readBanner();
    }
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

/** Shape of Elementor Pro's form-submission AJAX response. */
interface ElementorFormResponse {
  success: boolean;
  data?: {
    message?: string;
    errors?: Record<string, string>;
  };
}
