import type { SiteConfig } from '../src/types/index.js';

/**
 * Multi-site registry.
 *
 * The suite is built to run against many directory sites; today we target
 * Selleys first. To add a site, append a new SiteConfig object below — no test
 * code needs to change. Select a single site at runtime with `SITE=<key>`.
 */
export const SITES: SiteConfig[] = [
  {
    key: 'selleys',
    name: 'Selleys Directory',
    baseURL: process.env.BASE_URL ?? 'https://directory.selleys.com.au/',
    enabled: true,
    sitemapPath: 'sitemap.xml',
    // A curated sample covering every hierarchy level. The navigation-structure
    // test discovers the full tree dynamically; this list keeps the links /
    // JSON-LD / meta checks fast and deterministic while still touching each
    // level. Expand via USE_SITEMAP=true for full coverage.
    pagesUnderTest: [
      { path: '', level: 'home', label: 'Homepage' },
      { path: 'adhesives/', level: 'category', label: 'Category: Adhesives' },
      { path: 'accessories/', level: 'category', label: 'Category: Accessories' },
      {
        path: 'adhesives/all-purpose-glues/',
        level: 'subcategory',
        label: 'Subcategory: All Purpose Glues',
      },
      {
        path: 'accessories/guns/',
        level: 'subcategory',
        label: 'Subcategory: Guns',
      },
      {
        path: 'adhesives/all-purpose-glues/selleys-power-grip-cyanoacrylate-super-glue/',
        level: 'leaf',
        label: 'Leaf: Selleys Power Grip Super Glue',
      },
      {
        path: 'accessories/guns/selleys-sausage-gun/',
        level: 'leaf',
        label: 'Leaf: Selleys Sausage Gun',
      },
    ],
    linkCheck: {
      includeExternal: true,
      ignorePatterns: [
        /^mailto:/i,
        /^tel:/i,
        /^javascript:/i,
      ],
    },
    expectedJsonLdTypes: ['Organization'],
  },
];

/** All sites that participate in a default run, honouring the SITE filter. */
export function getActiveSites(): SiteConfig[] {
  const filter = process.env.SITE?.trim();
  const pool = SITES.filter((s) => s.enabled);
  if (!filter) return pool;
  const selected = SITES.filter((s) => s.key === filter);
  if (selected.length === 0) {
    throw new Error(
      `SITE="${filter}" did not match any configured site. Known keys: ${SITES.map((s) => s.key).join(', ')}`,
    );
  }
  return selected;
}
