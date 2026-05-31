import type { Page } from '@playwright/test';
import { BasePage } from './BasePage.js';

/**
 * A generic interior directory page (category, subcategory, or leaf/product).
 * These share the same content concerns as the homepage — links, JSON-LD, meta
 * description — so they reuse BasePage directly. The class exists to give those
 * pages a named, extensible home in the POM as site-specific behaviour grows.
 */
export class CategoryPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  /** Open an absolute page URL. */
  async open(url: string): Promise<void> {
    await this.goto(url);
  }

  /** The breadcrumb trail labels, if the page renders one. */
  async breadcrumbs(): Promise<string[]> {
    const crumbs = this.page.locator(
      'nav[aria-label="Breadcrumb"] a, nav.breadcrumb a, .breadcrumbs a',
    );
    if ((await crumbs.count()) === 0) return [];
    return (await crumbs.allTextContents()).map((t) => t.trim()).filter(Boolean);
  }
}
