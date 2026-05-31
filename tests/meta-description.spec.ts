import { test, expect } from '../fixtures/test-fixtures.js';
import { getActiveSites } from '../config/sites.js';

/**
 * Requirement: "verify meta descriptions".
 *
 * For each page under test:
 *  - exactly one <meta name="description"> exists,
 *  - its content is non-empty (after trimming).
 *
 * Length against the SEO-recommended 50–160 char window is reported as a soft
 * warning (test annotation), not a hard failure — presence/correctness is the
 * director's requirement; length is a quality signal the team can act on.
 */
const MIN_LEN = 50;
const MAX_LEN = 160;

for (const site of getActiveSites()) {
  test.describe(`[${site.name}] Meta description`, () => {
    test.describe.configure({ mode: 'parallel' });

    for (const page of site.pagesUnderTest) {
      test(`meta description valid: ${page.label}`, async ({ categoryPage }, testInfo) => {
        const url = new URL(page.path, site.baseURL).toString();
        await categoryPage.open(url);

        // Hard: exactly one, non-empty.
        const count = await categoryPage.metaDescriptionCount();
        expect(count, `expected exactly one meta description on ${url}`).toBe(1);

        const content = (await categoryPage.getMetaDescription())?.trim() ?? '';
        expect(content, `meta description is empty on ${url}`).not.toBe('');

        // Soft: length within the SEO window — surfaced as a warning, not a fail.
        if (content.length < MIN_LEN || content.length > MAX_LEN) {
          const msg = `Meta description length ${content.length} is outside the SEO-recommended ${MIN_LEN}-${MAX_LEN} chars on ${url}`;
          testInfo.annotations.push({ type: 'warning', description: msg });
          // eslint-disable-next-line no-console
          console.warn(`⚠️  ${msg}`);
        }
      });
    }
  });
}
