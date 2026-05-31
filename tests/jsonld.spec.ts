import { test, expect } from '../fixtures/test-fixtures.js';
import { getActiveSites } from '../config/sites.js';
import { hasRequiredKeys } from '../src/utils/jsonLd.js';

/**
 * Requirement: "verify JSON-LD embedded".
 *
 * For each page under test we assert that:
 *  - at least one <script type="application/ld+json"> block exists,
 *  - every block is valid JSON (no parse errors),
 *  - every block declares @context and @type (Schema.org essentials).
 *
 * Additionally, the homepage must contain the site's expected @type values.
 */
for (const site of getActiveSites()) {
  test.describe(`[${site.name}] JSON-LD`, () => {
    test.describe.configure({ mode: 'parallel' });

    for (const page of site.pagesUnderTest) {
      test(`JSON-LD present & valid: ${page.label}`, async ({ categoryPage }) => {
        const url = new URL(page.path, site.baseURL).toString();
        await categoryPage.open(url);

        const blocks = await categoryPage.getJsonLdBlocks();

        expect(
          blocks.length,
          `no JSON-LD <script> blocks found on ${url}`,
        ).toBeGreaterThan(0);

        // No parse errors.
        const broken = blocks.filter((b) => b.parseError);
        expect(
          broken,
          `invalid JSON-LD on ${url}:\n${broken.map((b) => `  ✗ ${b.parseError}`).join('\n')}`,
        ).toHaveLength(0);

        // Each block has the Schema.org essentials.
        const missingKeys = blocks.filter((b) => !hasRequiredKeys(b.parsed));
        expect(
          missingKeys,
          `JSON-LD block(s) on ${url} missing @context/@type`,
        ).toHaveLength(0);
      });
    }

    test('homepage JSON-LD declares expected @type(s)', async ({ homePage }) => {
      await homePage.open(site.baseURL);
      const blocks = await homePage.getJsonLdBlocks();
      const allTypes = new Set(blocks.flatMap((b) => b.types));

      for (const expected of site.expectedJsonLdTypes) {
        expect(
          allTypes.has(expected),
          `expected @type "${expected}" not found on homepage. Found: ${[...allTypes].join(', ') || '(none)'}`,
        ).toBe(true);
      }
    });
  });
}
