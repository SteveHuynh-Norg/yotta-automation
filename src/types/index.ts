/**
 * Shared type definitions for the automation suite.
 */

/** A node level in the directory hierarchy: homepage > category > subcategory > leaf. */
export type HierarchyLevel = 'home' | 'category' | 'subcategory' | 'leaf';

/**
 * Maps the site's `data-content-type` attribute values onto our abstract
 * hierarchy levels. Centralised here so a new site only needs a mapping tweak.
 */
export const CONTENT_TYPE_TO_LEVEL: Record<string, HierarchyLevel> = {
  directoryCategory: 'category',
  directorySubcategory: 'subcategory',
  product: 'leaf',
  product_guide: 'leaf',
};

/** A single page selected to be exercised by the checks. */
export interface PageUnderTest {
  /** Path relative to the site baseURL, e.g. "adhesives/all-purpose-glues/". */
  path: string;
  /** Which hierarchy level this page represents (used for assertions/reporting). */
  level: HierarchyLevel;
  /** Human label for test titles. */
  label: string;
}

/** Per-site configuration. The suite is multi-site by design. */
export interface SiteConfig {
  /** Stable key used to select the site via the SITE env var. */
  key: string;
  /** Display name. */
  name: string;
  /** Base URL, always ending in a trailing slash. */
  baseURL: string;
  /** Whether this site participates in a default (no SITE filter) run. */
  enabled: boolean;
  /** Curated set of pages to verify (one per hierarchy level minimum). */
  pagesUnderTest: PageUnderTest[];
  /** Path to the sitemap, relative to baseURL. */
  sitemapPath: string;
  /**
   * Per-site link-check policy. Hosts listed here are treated as external;
   * everything matching the baseURL host is internal.
   */
  linkCheck: {
    /** Check links pointing off-domain too. */
    includeExternal: boolean;
    /** Hostnames/paths to never request (e.g. logout, mailto handled separately). */
    ignorePatterns: RegExp[];
  };
  /** Expected JSON-LD @type values that should appear somewhere on the homepage. */
  expectedJsonLdTypes: string[];
}

/** Result of checking a single link. */
export interface LinkResult {
  url: string;
  /** The page the link was found on. */
  foundOn: string;
  status: number | null;
  ok: boolean;
  /** "http", "anchor", "mailto", "tel", etc. */
  kind: string;
  error?: string;
}

/**
 * CSS selectors locating the fields of a contact form. Kept in config so a new
 * form only needs selector tweaks — the page object and spec stay unchanged.
 */
export interface FormSelectors {
  /** The <form> element. */
  form: string;
  /** Name field (optional on some forms). */
  name?: string;
  /** Email field (required). */
  email: string;
  /** Phone field (optional). */
  phone?: string;
  /** Message / enquiry textarea. */
  message: string;
  /** Submit button. */
  submit: string;
  /** Element shown on a successful submission. */
  success: string;
  /** Element shown when submission fails (validation / reCAPTCHA error). */
  error: string;
  /** Optional reCAPTCHA widget container (used to detect an un-bypassed challenge). */
  recaptcha?: string;
}

/** Per-form configuration for the form-submission suite. */
export interface FormConfig {
  /** Stable key used to select the form via the FORM env var. */
  key: string;
  /** Display name. */
  name: string;
  /** Absolute URL of the page hosting the form. */
  pageURL: string;
  /** Whether this form participates in a default (no FORM filter) run. */
  enabled: boolean;
  /**
   * Whether the page is protected by reCAPTCHA and requires the QA bypass URL
   * (qa_token / qa_ts) to be appended before navigating.
   */
  usesRecaptchaBypass: boolean;
  /**
   * When set, the spec marks this form's test as skipped with this reason
   * (still listed, not run) — for pages that are configured but not currently
   * automatable (e.g. Elementor popup/library template URLs that redirect and
   * drop the qa_token params).
   */
  skip?: string;
  /**
   * Hosted on a Cloudflare BND zone that rejects submissions from datacenter
   * IPs (tagged `@bnd` so CI can exclude them — they pass locally). Pending a
   * dev-side allowlist; see Monday item 2702399641 (update 111841622).
   */
  cloudflareBnd?: boolean;
  /**
   * For a form that lives in an Elementor popup (hidden until triggered): the
   * popup's Elementor id. `open()` reveals it via the Pro frontend API before
   * filling — the on-page trigger links are often hidden in collapsed nav.
   */
  openPopupId?: number;
  /** Field selectors. */
  selectors: FormSelectors;
}

/** A parsed JSON-LD block. */
export interface JsonLdBlock {
  raw: string;
  parsed: unknown;
  parseError?: string;
  /** Flattened list of @type values found (handles @graph and arrays). */
  types: string[];
}
