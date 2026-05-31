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

/** A parsed JSON-LD block. */
export interface JsonLdBlock {
  raw: string;
  parsed: unknown;
  parseError?: string;
  /** Flattened list of @type values found (handles @graph and arrays). */
  types: string[];
}
