import type { FormConfig } from '../src/types/index.js';

/**
 * Form-submission registry.
 *
 * Mirrors the multi-site design of `sites.ts`: the form-submission spec is
 * data-driven, so adding another contact form is a config-only change. Select a
 * single form at runtime with `FORM=<key>`.
 *
 * First target: the SS Doors "Contact Us" page, an Elementor Pro form guarded
 * by reCAPTCHA v2. Submissions are unblocked via the developer's QA bypass URL
 * (see src/utils/qaBypass.ts), so `usesRecaptchaBypass` is true.
 */
export const FORMS: FormConfig[] = [
  {
    key: 'ssdoors',
    name: 'SS Doors — Contact Us',
    pageURL: process.env.FORM_URL ?? 'https://ssdoors.com.au/contact-us/',
    enabled: true,
    usesRecaptchaBypass: true,
    selectors: {
      // The page hosts two Elementor forms (the contact "New Form" and a
      // separate "Quote Form"); scope everything to the contact form by name.
      form: 'form.elementor-form[name="New Form"]',
      name: 'form.elementor-form[name="New Form"] input[name="form_fields[name]"]',
      email: 'form.elementor-form[name="New Form"] input[name="form_fields[email]"]',
      // Elementor auto-generates the phone field id; it is the only "Phone"
      // placeholder textual field on the contact form.
      phone: 'form.elementor-form[name="New Form"] input[name="form_fields[field_33f3381]"]',
      message: 'form.elementor-form[name="New Form"] textarea[name="form_fields[message]"]',
      submit: 'form.elementor-form[name="New Form"] button[type="submit"]',
      success: 'form.elementor-form[name="New Form"] .elementor-message.elementor-message-success',
      error: 'form.elementor-form[name="New Form"] .elementor-message.elementor-message-danger',
      recaptcha: 'form.elementor-form[name="New Form"] .elementor-g-recaptcha',
    },
  },
];

/** All forms that participate in a default run, honouring the FORM filter. */
export function getActiveForms(): FormConfig[] {
  const filter = process.env.FORM?.trim();
  const pool = FORMS.filter((f) => f.enabled);
  if (!filter) return pool;
  const selected = FORMS.filter((f) => f.key === filter);
  if (selected.length === 0) {
    throw new Error(
      `FORM="${filter}" did not match any configured form. Known keys: ${FORMS.map((f) => f.key).join(', ')}`,
    );
  }
  return selected;
}
