import type { Page } from '@playwright/test';
import { CONTENT_TYPE_TO_LEVEL, type HierarchyLevel } from '../../types/index.js';

/** A single node parsed from the site's navigation tree. */
export interface NavNode {
  label: string;
  /** Resolved absolute href, or null for the current/home node (a <span>). */
  href: string | null;
  level: HierarchyLevel;
  /** data-content-type as authored, for diagnostics. */
  contentType: string | null;
  children: NavNode[];
}

/**
 * Page component wrapping `nav.nav-tree` — the directory's hierarchy widget.
 *
 * The tree encodes the homepage > category > subcategory > leaf structure via
 * `data-content-type` on each <li>. This component parses that DOM into a typed
 * tree the navigation-structure test asserts against.
 */
export class NavTreeComponent {
  constructor(private readonly page: Page) {}

  private root() {
    return this.page.locator('nav.nav-tree');
  }

  async isVisible(): Promise<boolean> {
    return this.root().isVisible();
  }

  /**
   * Parse the nav tree into a hierarchy of NavNodes. Runs in the browser to
   * walk the nested <ul>/<li> structure, then maps data-content-type onto our
   * abstract levels in Node.
   */
  async parse(): Promise<NavNode[]> {
    const base = this.page.url();
    const raw = await this.root().evaluate((nav) => {
      // Walk one <ul> level into an array of node descriptors.
      function walk(ul: Element): any[] {
        const items = Array.from(ul.children).filter(
          (el) => el.tagName === 'LI',
        ) as HTMLElement[];
        return items
          .map((li) => {
            const contentType = li.getAttribute('data-content-type');
            // The label/link lives in the first <a> (within <summary> for
            // branches) or a <span> for the current node.
            const anchor = li.querySelector(':scope > details > summary > a, :scope > a') as
              | HTMLAnchorElement
              | null;
            const span = li.querySelector(':scope > span') as HTMLElement | null;
            const label = (anchor?.textContent ?? span?.textContent ?? '').trim();
            const href = anchor ? anchor.getAttribute('href') : null;
            // Children live in a nested <ul> inside this li's <details>.
            const childUl = li.querySelector(':scope > details > ul');
            const children = childUl ? walk(childUl) : [];
            // Skip purely structural wrappers that carry no label and no type.
            if (!label && !contentType && children.length === 0) return null;
            return { label, href, contentType, children };
          })
          .filter((n): n is NonNullable<typeof n> => n !== null);
      }
      const topUl = nav.querySelector('ul.tree-list') ?? nav.querySelector('ul');
      return topUl ? walk(topUl) : [];
    });

    // Map raw descriptors -> typed NavNodes, resolving hrefs and levels.
    const toNode = (n: any): NavNode => {
      const isHomeSpan = n.href === null && n.children.length > 0;
      const level: HierarchyLevel = isHomeSpan
        ? 'home'
        : (CONTENT_TYPE_TO_LEVEL[n.contentType as string] ?? 'leaf');
      return {
        label: n.label,
        href: n.href ? new URL(n.href, base).toString() : null,
        level,
        contentType: n.contentType,
        children: (n.children as any[]).map(toNode),
      };
    };
    return (raw as any[]).map(toNode);
  }

  /** Flatten the tree into a single list (depth-first). */
  static flatten(nodes: NavNode[]): NavNode[] {
    const out: NavNode[] = [];
    const visit = (n: NavNode) => {
      out.push(n);
      n.children.forEach(visit);
    };
    nodes.forEach(visit);
    return out;
  }

  /**
   * Find the first complete home > category > subcategory > leaf chain in the
   * tree, returning the node at each level (or null if the chain is broken).
   */
  static findDeepestChain(nodes: NavNode[]): {
    category: NavNode | null;
    subcategory: NavNode | null;
    leaf: NavNode | null;
  } {
    const all = NavTreeComponent.flatten(nodes);
    const category = all.find((n) => n.level === 'category') ?? null;
    const subcategory = category?.children.find((n) => n.level === 'subcategory') ?? null;
    const leaf = subcategory?.children.find((n) => n.level === 'leaf') ?? null;
    return { category, subcategory, leaf };
  }
}
