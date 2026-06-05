import type { FormConfig, FormSelectors } from '../src/types/index.js';

/**
 * Form-submission registry (reCAPTCHA QA-bypass coverage).
 *
 * The suite proves the developer's reCAPTCHA bypass (qa_token / qa_ts — see
 * src/utils/qaBypass.ts) lets a QA submission go through server-side. Per the
 * developer's inventory (STEVE-FORMS-FOR-AUTOMATION-2026060x) the bypass is now
 * deployed across the estate, so we exercise EVERY reCAPTCHA-protected Elementor
 * form on the supplied pages — the scenario is identical (open → fill → submit →
 * expect success); only the page list grows.
 *
 * Scope (intentional):
 *   - Elementor forms with reCAPTCHA = yes and visibility = visible only.
 *   - Excluded: non-reCAPTCHA forms (Gravity Forms on bndmelbourne / most of
 *     malsmithdoors, Pirate Forms on csiclassicgd, the `?elementor_library=
 *     product-page` templates marked reCAPTCHA = no) — nothing to bypass there;
 *     Salesforce-only forms (POST to Salesforce, the WP bypass does nothing);
 *     the 3 hidden bndgaragedoorsmelbournewest forms (cannot be filled in a
 *     browser); and Canberra's Contact Form 7 forms (different system — deferred).
 *
 * The registry is data-driven: each row is just a page URL + the Elementor form's
 * editor name (its `name` attribute, used to scope selectors because a page can
 * host more than one form). `buildElementorForm` turns a row into a FormConfig.
 * Select a subset at runtime with `FORM=<key>` or `FORM=<domain-substring>`.
 */

/** One in-scope page: where the form lives and the Elementor form name to target. */
interface ElementorFormPage {
  /** Absolute URL of the page hosting the form. */
  url: string;
  /** The Elementor form's editor name (rendered as the form's `name` attribute). */
  formName: string;
}

/**
 * In-scope pages grouped by domain, mirroring the developer's inventory.
 * NOTE: pages reached via `?elementor_library=<slug>` render the form standalone.
 */
const FORM_PAGES: ElementorFormPage[] = [
  // 89s.com.au (8)
  { url: 'https://89s.com.au/', formName: 'New Form' },
  { url: 'https://89s.com.au/?elementor_library=quote-popup', formName: 'Get a free quote' },
  { url: 'https://89s.com.au/commercial-doors/', formName: 'New Form' },
  { url: 'https://89s.com.au/commercial-doors/commercial-roller-doors/', formName: 'New Form' },
  { url: 'https://89s.com.au/commercial-doors/commercial-sectional-doors/', formName: 'New Form' },
  { url: 'https://89s.com.au/commercial-doors/commercial-shutters/', formName: 'New Form' },
  { url: 'https://89s.com.au/contact-us/', formName: 'Contact Form' },
  { url: 'https://89s.com.au/services-repairs/', formName: 'Repair & service Form' },

  // alldoorstoowoomba.com.au (4)
  { url: 'https://www.alldoorstoowoomba.com.au/', formName: 'New Form' },
  { url: 'https://www.alldoorstoowoomba.com.au/?elementor_library=quote-popup', formName: 'Contact Form' },
  { url: 'https://www.alldoorstoowoomba.com.au/contact-us/', formName: 'Contact Form' },
  { url: 'https://www.alldoorstoowoomba.com.au/services-repairs/', formName: 'Contact Form' },

  // awgd.net.au (3)
  { url: 'https://awgd.net.au/?elementor_library=contact-us-form', formName: 'Contact Form' },
  { url: 'https://awgd.net.au/?elementor_library=main-footer', formName: 'Contact Form' },
  { url: 'https://awgd.net.au/contact-us/', formName: 'Contact Form' },

  // baxdoors.com.au (9)
  { url: 'https://www.baxdoors.com.au/', formName: 'Contact Form' },
  { url: 'https://www.baxdoors.com.au/?elementor_library=quote-popup', formName: 'Contact Form' },
  { url: 'https://www.baxdoors.com.au/contact-us/', formName: 'Contact Form' },
  { url: 'https://www.baxdoors.com.au/garage-doors/', formName: 'Contact Form' },
  { url: 'https://www.baxdoors.com.au/garage-doors/roller-doors/', formName: 'Contact Form' },
  { url: 'https://www.baxdoors.com.au/garage-doors/sectional-doors/', formName: 'Contact Form' },
  { url: 'https://www.baxdoors.com.au/openers-accessories-upgrades/accessories-upgrades/', formName: 'Contact Form' },
  { url: 'https://www.baxdoors.com.au/openers-accessories-upgrades/residential-openers/', formName: 'Contact Form' },
  { url: 'https://www.baxdoors.com.au/services-repairs/', formName: 'Contact Form' },

  // bndgaragedoorsgippsland.com.au (4)
  { url: 'https://bndgaragedoorsgippsland.com.au/', formName: 'New Form' },
  { url: 'https://bndgaragedoorsgippsland.com.au/?elementor_library=quote-popup', formName: 'New Form' },
  { url: 'https://bndgaragedoorsgippsland.com.au/contact-us/', formName: 'New Form' },
  { url: 'https://bndgaragedoorsgippsland.com.au/service-and-repairs/', formName: 'New Form' },

  // bndgaragedoorsnewcastleandhunter.com.au (4)
  { url: 'https://bndgaragedoorsnewcastleandhunter.com.au/', formName: 'New Form' },
  { url: 'https://bndgaragedoorsnewcastleandhunter.com.au/?elementor_library=quote-popup', formName: 'New Form' },
  { url: 'https://bndgaragedoorsnewcastleandhunter.com.au/contact-us/', formName: 'New Form' },
  { url: 'https://bndgaragedoorsnewcastleandhunter.com.au/service-repairs/', formName: 'Service Form' },

  // bndmornington.com.au (15)
  { url: 'https://bndmornington.com.au/', formName: 'New Form' },
  { url: 'https://bndmornington.com.au/?elementor_library=quote-popup', formName: 'Quote Popup – All Enquiries' },
  { url: 'https://bndmornington.com.au/contact-us/', formName: 'Main Contact Form' },
  { url: 'https://bndmornington.com.au/garage-doors-and-accessories/residential-doors/roller-doors/', formName: 'New Form' },
  { url: 'https://bndmornington.com.au/garage-doors-and-accessories/residential-doors/sectional-doors/', formName: 'New Form' },
  { url: 'https://bndmornington.com.au/garage-doors-and-accessories/residential-doors/speciality-doors/', formName: 'New Form' },
  { url: 'https://bndmornington.com.au/garage-doors-and-accessories/residential-openers/accessories/', formName: 'New Form' },
  { url: 'https://bndmornington.com.au/garage-doors-and-accessories/residential-openers/residential-openers/', formName: 'New Form' },
  { url: 'https://bndmornington.com.au/locations/blairgowrie/', formName: 'New Form' },
  { url: 'https://bndmornington.com.au/locations/flinders/', formName: 'New Form' },
  { url: 'https://bndmornington.com.au/locations/mount-martha/', formName: 'New Form' },
  { url: 'https://bndmornington.com.au/locations/portsea/', formName: 'New Form' },
  { url: 'https://bndmornington.com.au/locations/red-hill-and-main-ridge/', formName: 'New Form' },
  { url: 'https://bndmornington.com.au/locations/rosebud/', formName: 'New Form' },
  { url: 'https://bndmornington.com.au/services-and-repairs/', formName: 'Contact Form' },

  // bndsoutheastmelbourne.com.au (10 — `?elementor_library=product-page` excluded, reCAPTCHA = no)
  { url: 'https://bndsoutheastmelbourne.com.au/', formName: 'New Form' },
  { url: 'https://bndsoutheastmelbourne.com.au/?elementor_library=contact-form-simple', formName: 'Contact Form' },
  { url: 'https://bndsoutheastmelbourne.com.au/?elementor_library=quote-popup', formName: 'Contact Form' },
  { url: 'https://bndsoutheastmelbourne.com.au/contact-us/', formName: 'Contact Form' },
  { url: 'https://bndsoutheastmelbourne.com.au/garage-doors/residential/roller-doors/', formName: 'New Form' },
  { url: 'https://bndsoutheastmelbourne.com.au/garage-doors/residential/sectional-doors/', formName: 'New Form' },
  { url: 'https://bndsoutheastmelbourne.com.au/garage-doors/residential/specialty-doors/', formName: 'New Form' },
  { url: 'https://bndsoutheastmelbourne.com.au/garage-doors/service-and-repairs/', formName: 'Contact Form' },
  { url: 'https://bndsoutheastmelbourne.com.au/openers/accessories/', formName: 'New Form' },
  { url: 'https://bndsoutheastmelbourne.com.au/openers/residential-openers/', formName: 'New Form' },

  // hallingsgaragedoors.com.au (3)
  { url: 'https://www.hallingsgaragedoors.com.au/', formName: 'Contact Form' },
  { url: 'https://www.hallingsgaragedoors.com.au/?elementor_library=quote-popup', formName: 'Contact Form' },
  { url: 'https://www.hallingsgaragedoors.com.au/contact-us/', formName: 'Contact Form' },

  // kmgaragedoors.com.au (4)
  { url: 'https://kmgaragedoors.com.au/', formName: 'Contact Form' },
  { url: 'https://kmgaragedoors.com.au/?elementor_library=quote-popup', formName: 'Contact Form' },
  { url: 'https://kmgaragedoors.com.au/contact-us/', formName: 'Contact Form' },
  { url: 'https://kmgaragedoors.com.au/services-repairs/', formName: 'Contact Form' },

  // malsmithdoors.com.au (1 — only the Elementor reCAPTCHA form; the rest are Gravity / no-reCAPTCHA)
  { url: 'https://malsmithdoors.com.au/?elementor_library=contact-form-simple', formName: 'Contact Form' },

  // noosagaragedoors.com.au (1)
  { url: 'https://noosagaragedoors.com.au/?elementor_library=quote-popup', formName: 'Quote Form' },

  // ssdoors.com.au (3)
  { url: 'https://ssdoors.com.au/?elementor_library=quote-v2', formName: 'Quote Form' },
  { url: 'https://ssdoors.com.au/?elementor_library=request-a-quote', formName: 'Quote Form' },
  { url: 'https://ssdoors.com.au/contact-us/', formName: 'New Form' },

  // thedoorman.com.au (4)
  { url: 'https://thedoorman.com.au/', formName: 'Contact Form' },
  { url: 'https://thedoorman.com.au/?elementor_library=quote-popup', formName: 'Contact Form' },
  { url: 'https://thedoorman.com.au/contact-us/', formName: 'Contact Form' },
  { url: 'https://thedoorman.com.au/services-repairs/', formName: 'Services and Repairs Form' },

  // thegaragedoorguys.com.au (20)
  { url: 'https://thegaragedoorguys.com.au/', formName: 'New Form' },
  { url: 'https://thegaragedoorguys.com.au/?elementor_library=product-page', formName: 'New Form' },
  { url: 'https://thegaragedoorguys.com.au/about-us/', formName: 'New Form' },
  { url: 'https://thegaragedoorguys.com.au/accessories/', formName: 'New Form' },
  { url: 'https://thegaragedoorguys.com.au/brochures/', formName: 'New Form' },
  { url: 'https://thegaragedoorguys.com.au/contact-us/', formName: 'New Form' },
  { url: 'https://thegaragedoorguys.com.au/custom-garage-doors/', formName: 'New Form' },
  { url: 'https://thegaragedoorguys.com.au/flex-a-door/', formName: 'New Form' },
  { url: 'https://thegaragedoorguys.com.au/gallery/', formName: 'New Form' },
  { url: 'https://thegaragedoorguys.com.au/garage-doors-barossa-valley/', formName: 'New Form' },
  { url: 'https://thegaragedoorguys.com.au/garage-doors-gawler/', formName: 'New Form' },
  { url: 'https://thegaragedoorguys.com.au/gates/', formName: 'New Form' },
  { url: 'https://thegaragedoorguys.com.au/locations/', formName: 'New Form' },
  { url: 'https://thegaragedoorguys.com.au/motor-opener/', formName: 'New Form' },
  { url: 'https://thegaragedoorguys.com.au/panelift-doors/', formName: 'New Form' },
  { url: 'https://thegaragedoorguys.com.au/repairs-and-services/', formName: 'New Form' },
  { url: 'https://thegaragedoorguys.com.au/roller-doors/', formName: 'New Form' },
  { url: 'https://thegaragedoorguys.com.au/showroom/', formName: 'New Form' },
  { url: 'https://thegaragedoorguys.com.au/speciality-doors/', formName: 'New Form' },
  { url: 'https://thegaragedoorguys.com.au/testimonials/', formName: 'New Form' },
];

/** Derive a stable, unique key from a page URL, e.g. "89s-quote-popup". */
function keyForPage(url: string): string {
  const u = new URL(url);
  const host = u.hostname.replace(/^www\./, '').replace(/\.com\.au$|\.net\.au$|\.au$/, '');
  // Prefer the elementor_library template slug; otherwise the last path segment.
  const lib = u.searchParams.get('elementor_library');
  const path = u.pathname.replace(/\/$/, '').split('/').filter(Boolean).pop();
  const leaf = lib ?? path ?? 'home';
  const slugify = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `${slugify(host)}-${slugify(leaf)}`;
}

/**
 * Build the type-based Elementor selector profile, scoped to a single form by
 * its `name` attribute. Field IDs are not stable across Elementor forms, so we
 * anchor on field TYPE (email/tel/textarea) rather than the generated names;
 * the page object fills any remaining required fields generically.
 */
function elementorSelectors(formName: string): FormSelectors {
  // Escape double quotes in the attribute value just in case a form name has one.
  const f = `form.elementor-form[name="${formName.replace(/"/g, '\\"')}"]`;
  return {
    form: f,
    name: `${f} input[name="form_fields[name]"]`,
    email: `${f} input[type="email"]`,
    phone: `${f} input[type="tel"]`,
    message: `${f} textarea`,
    submit: `${f} button[type="submit"]`,
    success: `${f} .elementor-message.elementor-message-success`,
    error: `${f} .elementor-message.elementor-message-danger`,
    recaptcha: `${f} .elementor-g-recaptcha`,
  };
}

/**
 * Hostnames temporarily skipped (still listed above for when they come back).
 * Empty — thedoorman.com.au was re-enabled after the dev's Varnish purge
 * (2026-06-05, reply 111815973); its logged-out frontend now renders the
 * "Contact Form" again. Add a host substring here to skip a site again.
 */
const SKIP_HOST_SUBSTRINGS: string[] = [];

/**
 * Reason a form is marked skipped (test listed but not run), or undefined to run
 * it. Elementor popup/library template URLs (`?elementor_library=…`) can't be
 * automated directly: they redirect anonymous visitors to the homepage and the
 * redirect chain drops the qa_token/qa_ts params, so the bypass never activates
 * (dev-confirmed, no server-side fix — Monday item 2702399641, reply 111386947).
 * These popup forms must instead be reached via their parent-page button (a
 * separate enhancement). NOTE: this leaves noosagaragedoors + malsmithdoors with
 * no coverage, as their only in-scope form is a popup template.
 */
function skipReasonFor(url: string): string | undefined {
  try {
    if (new URL(url).searchParams.has('elementor_library')) {
      return 'Elementor popup/library template URL — redirect drops qa_token params; ' +
        'cover via the parent-page popup button instead (not yet implemented).';
    }
  } catch {
    /* fall through */
  }
  return undefined;
}

/**
 * Representative forms for the fast push/PR "smoke" run — one per distinct
 * server behaviour so a regression in any path is caught quickly without
 * sweeping the whole estate:
 *   - ssdoors-contact-us            reCAPTCHA v2 (baseline)
 *   - 89s-contact-us                reCAPTCHA v3 (siteverify-action fix)
 *   - awgd-contact-us               v3 + grecaptcha shim / watchdog path
 *   - bndmornington-contact-us      Cloudflare BND zone + success redirect
 * The full estate runs on schedule / manual dispatch.
 */
const SMOKE_KEYS = new Set([
  'ssdoors-contact-us',
  '89s-contact-us',
  'awgd-contact-us',
  'bndmornington-contact-us',
]);

/** Turn an in-scope page row into a full FormConfig. */
function buildElementorForm(page: ElementorFormPage): FormConfig {
  const host = new URL(page.url).hostname.replace(/^www\./, '');
  const key = keyForPage(page.url);
  return {
    key,
    name: `${host} — ${page.formName}`,
    pageURL: page.url,
    enabled: !SKIP_HOST_SUBSTRINGS.some((h) => page.url.includes(h)),
    usesRecaptchaBypass: true,
    skip: skipReasonFor(page.url),
    smoke: SMOKE_KEYS.has(key),
    selectors: elementorSelectors(page.formName),
  };
}

/** All configured forms. Keys are unique; duplicate keys would throw at startup. */
export const FORMS: FormConfig[] = (() => {
  const built = FORM_PAGES.map(buildElementorForm);
  const seen = new Map<string, string>();
  for (const f of built) {
    const prev = seen.get(f.key);
    if (prev) {
      throw new Error(
        `Duplicate form key "${f.key}" generated for ${f.pageURL} and ${prev}. ` +
          'Adjust keyForPage() to disambiguate.',
      );
    }
    seen.set(f.key, f.pageURL);
  }
  return built;
})();

/**
 * Forms participating in a run. `FORM` filters by exact key, or — for
 * convenience — by any form whose key or page URL contains the value (so
 * `FORM=ssdoors` or `FORM=89s.com.au` runs a whole site). `FORM_URL` still
 * supports an ad-hoc one-off run against a single arbitrary page.
 */
export function getActiveForms(): FormConfig[] {
  const adHocUrl = process.env.FORM_URL?.trim();
  if (adHocUrl) {
    return [buildElementorForm({ url: adHocUrl, formName: process.env.FORM_NAME?.trim() || 'New Form' })];
  }

  const pool = FORMS.filter((f) => f.enabled);
  const filter = process.env.FORM?.trim();
  if (!filter) return pool;

  const exact = pool.filter((f) => f.key === filter);
  if (exact.length > 0) return exact;

  const needle = filter.toLowerCase();
  const fuzzy = pool.filter(
    (f) => f.key.includes(needle) || f.pageURL.toLowerCase().includes(needle),
  );
  if (fuzzy.length === 0) {
    throw new Error(
      `FORM="${filter}" did not match any configured form (by key, key-substring, or URL). ` +
        `Known keys: ${FORMS.map((f) => f.key).join(', ')}`,
    );
  }
  return fuzzy;
}
