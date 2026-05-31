import { test, expect } from '../fixtures/test-fixtures.js';
import { getActiveSites } from '../config/sites.js';
import { checkLinks } from '../src/utils/linkChecker.js';
import type { LinkResult } from '../src/types/index.js';

/**
 * Requirement: "verify all links work".
 *
 * For every page under test we collect every <a href>, then:
 *  - HTTP-check http(s) links (internal always; external per site policy),
 *    asserting status < 400.
 *  - Validate in-page #anchor links resolve to an element on the page.
 *  - mailto/tel/javascript links are reported but not network-checked.
 */
for (const site of getActiveSites()) {
  test.describe(`[${site.name}] Links`, () => {
    test.describe.configure({ mode: 'parallel' });

    // Cases are enumerated from the curated config at collection time so each
    // page gets its own reported test. (Sitemap-driven expansion lives in the
    // dedicated sitemap run; see resolvePages / USE_SITEMAP.)
    for (const page of site.pagesUnderTest) {
      test(`broken-link scan: ${page.label}`, async ({ categoryPage, request }) => {
        const url = new URL(page.path, site.baseURL).toString();
        await categoryPage.open(url);

        const links = await categoryPage.collectLinks();
        expect(links.length, `expected to find links on ${url}`).toBeGreaterThan(0);

        // 1) HTTP + scheme links via the link checker.
        const results = await checkLinks(request, links, url, site);

        // 2) Anchor links: validate targets exist in the DOM.
        const anchorResults: LinkResult[] = [];
        for (const link of links.filter((l) => l.kind === 'anchor')) {
          const ok = await categoryPage.hasAnchorTarget(link.raw);
          anchorResults.push({
            url: link.raw,
            foundOn: url,
            status: null,
            ok,
            kind: 'anchor',
            error: ok ? undefined : 'anchor target not found in DOM',
          });
        }

        const all = [...results, ...anchorResults];
        const broken = all.filter((r) => !r.ok);

        const summary = broken
          .map((b) => `  ✗ [${b.kind}] ${b.url} -> ${b.status ?? 'ERR'} ${b.error ?? ''}`)
          .join('\n');

        expect(
          broken,
          `Found ${broken.length} broken link(s) on ${url}:\n${summary}\n(checked ${all.length} links total)`,
        ).toHaveLength(0);
      });
    }
  });
}
