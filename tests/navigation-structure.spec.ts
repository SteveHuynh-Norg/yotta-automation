import { test, expect } from '../fixtures/test-fixtures.js';
import { getActiveSites } from '../config/sites.js';
import { NavTreeComponent } from '../src/pages/components/NavTreeComponent.js';

/**
 * Requirement: "verify navigation structure matched
 * homepage > category > subcategory > leaf".
 *
 * We parse the homepage navigation tree into a typed hierarchy and assert:
 *  1. A Home (root) node exists.
 *  2. At least one Category exists directly under Home.
 *  3. At least one Category contains a Subcategory.
 *  4. At least one Subcategory contains a Leaf (product / guide).
 *  5. The deepest discovered chain is exactly home > category > subcategory >
 *     leaf, and every link in that chain resolves (HTTP < 400) and points to
 *     the matching hierarchy level (URL depth increases by one each step).
 */
for (const site of getActiveSites()) {
  test.describe(`[${site.name}] Navigation structure`, () => {
    test('hierarchy is home > category > subcategory > leaf', async ({ homePage, request }) => {
      await homePage.open(site.baseURL);

      expect(await homePage.navTree.isVisible(), 'nav.nav-tree not visible on homepage').toBe(
        true,
      );

      const tree = await homePage.navTree.parse();
      const flat = NavTreeComponent.flatten(tree);

      // 1) Home root.
      const home = tree.find((n) => n.level === 'home');
      expect(home, 'no Home/root node found in nav tree').toBeTruthy();

      // 2-4) Each level is represented somewhere in the tree.
      const byLevel = (lvl: string) => flat.filter((n) => n.level === lvl);
      expect(byLevel('category').length, 'no category nodes found').toBeGreaterThan(0);
      expect(byLevel('subcategory').length, 'no subcategory nodes found').toBeGreaterThan(0);
      expect(byLevel('leaf').length, 'no leaf nodes found').toBeGreaterThan(0);

      // 5) A complete, correctly-nested chain exists.
      const chain = NavTreeComponent.findDeepestChain(home ? home.children : tree);
      expect(
        chain.category,
        'no category directly under home',
      ).toBeTruthy();
      expect(
        chain.subcategory,
        `category "${chain.category?.label}" has no subcategory child`,
      ).toBeTruthy();
      expect(
        chain.leaf,
        `subcategory "${chain.subcategory?.label}" has no leaf child`,
      ).toBeTruthy();

      // Links in the chain must resolve and deepen by one path segment each step.
      const steps = [chain.category, chain.subcategory, chain.leaf].filter(
        (n): n is NonNullable<typeof n> => Boolean(n),
      );
      let prevDepth = 0; // home == 0 segments
      for (const node of steps) {
        expect(node.href, `nav node "${node.label}" has no href`).toBeTruthy();
        const depth = new URL(node.href!).pathname.split('/').filter(Boolean).length;
        expect(
          depth,
          `expected "${node.label}" (${node.level}) to be one level deeper than its parent`,
        ).toBe(prevDepth + 1);
        prevDepth = depth;

        const res = await request.get(node.href!, { timeout: 15000, maxRedirects: 5 });
        expect(
          res.status(),
          `nav link broken: ${node.label} -> ${node.href} (HTTP ${res.status()})`,
        ).toBeLessThan(400);
      }

      // Report the verified chain for visibility in the HTML report.
      test.info().annotations.push({
        type: 'verified-chain',
        description: `Home > ${chain.category!.label} > ${chain.subcategory!.label} > ${chain.leaf!.label}`,
      });
    });
  });
}
