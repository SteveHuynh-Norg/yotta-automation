import type { Page } from '@playwright/test';
import { BasePage } from './BasePage.js';
import { NavTreeComponent } from './components/NavTreeComponent.js';

/**
 * The directory homepage. Adds access to the navigation tree component, which
 * only the homepage renders in full.
 */
export class DirectoryHomePage extends BasePage {
  readonly navTree: NavTreeComponent;

  constructor(page: Page) {
    super(page);
    this.navTree = new NavTreeComponent(page);
  }

  /** Navigate to the site root. */
  async open(baseURL: string): Promise<void> {
    await this.goto(baseURL);
  }

  /** The main heading (H1) text, used as a smoke check that the page loaded. */
  async heading(): Promise<string> {
    return (await this.page.locator('h1').first().textContent())?.trim() ?? '';
  }
}
