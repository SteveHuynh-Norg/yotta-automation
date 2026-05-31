import type { Locator, Page } from '@playwright/test';
import type { JsonLdBlock } from '../types/index.js';
import { parseJsonLdBlocks } from '../utils/jsonLd.js';
import { toCollectedLink, type CollectedLink } from '../utils/linkChecker.js';

/**
 * BasePage holds behaviour common to every page in the directory: navigation,
 * and the three content-extraction concerns the suite verifies (links,
 * JSON-LD, meta description). Concrete page objects extend this.
 */
export class BasePage {
  constructor(protected readonly page: Page) {}

  /** Navigate to an absolute URL and wait for the DOM to be ready. */
  async goto(url: string): Promise<void> {
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
  }

  /** The page's current URL. */
  url(): string {
    return this.page.url();
  }

  /** The <title> text. */
  async title(): Promise<string> {
    return this.page.title();
  }

  // --- Meta description ---------------------------------------------------

  private metaDescription(): Locator {
    return this.page.locator('head > meta[name="description"]');
  }

  /** Number of meta description tags (should be exactly 1). */
  async metaDescriptionCount(): Promise<number> {
    return this.metaDescription().count();
  }

  /** The content of the (first) meta description, or null if absent. */
  async getMetaDescription(): Promise<string | null> {
    if ((await this.metaDescriptionCount()) === 0) return null;
    return this.metaDescription().first().getAttribute('content');
  }

  // --- JSON-LD ------------------------------------------------------------

  /** All raw JSON-LD script contents on the page. */
  async getRawJsonLd(): Promise<string[]> {
    return this.page.locator('script[type="application/ld+json"]').allTextContents();
  }

  /** Parsed JSON-LD blocks (parse errors captured, not thrown). */
  async getJsonLdBlocks(): Promise<JsonLdBlock[]> {
    return parseJsonLdBlocks(await this.getRawJsonLd());
  }

  // --- Links --------------------------------------------------------------

  /**
   * Collect every <a href> on the page, resolved against the current URL and
   * classified (http / anchor / mailto / ...). Duplicates are preserved here;
   * the link checker de-duplicates when making network requests.
   */
  async collectLinks(): Promise<CollectedLink[]> {
    const hrefs = await this.page.locator('a[href]').evaluateAll((anchors) =>
      anchors.map((a) => (a as HTMLAnchorElement).getAttribute('href') ?? ''),
    );
    const current = this.page.url();
    return hrefs.filter((h) => h.trim() !== '').map((h) => toCollectedLink(h, current));
  }

  /** True if an element with the given id (from a #anchor href) exists. */
  async hasAnchorTarget(anchorId: string): Promise<boolean> {
    const id = anchorId.replace(/^#/, '');
    // Per the HTML spec, "#" and "#top" (case-insensitive) are special
    // fragments that always resolve to the top of the document, with no
    // matching element required.
    if (id === '' || id.toLowerCase() === 'top') return true;
    // Resolve in the browser so document.getElementById handles any id safely.
    return this.page.evaluate(
      (targetId) =>
        document.getElementById(targetId) !== null ||
        document.getElementsByName(targetId).length > 0,
      id,
    );
  }
}
