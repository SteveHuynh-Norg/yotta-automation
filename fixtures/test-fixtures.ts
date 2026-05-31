import { test as base } from '@playwright/test';
import { DirectoryHomePage } from '../src/pages/DirectoryHomePage.js';
import { CategoryPage } from '../src/pages/CategoryPage.js';

/**
 * Custom fixtures expose ready-to-use page objects to every test, keeping the
 * specs free of construction boilerplate (the POM convention).
 */
interface Pages {
  homePage: DirectoryHomePage;
  categoryPage: CategoryPage;
}

export const test = base.extend<Pages>({
  homePage: async ({ page }, use) => {
    await use(new DirectoryHomePage(page));
  },
  categoryPage: async ({ page }, use) => {
    await use(new CategoryPage(page));
  },
});

export { expect } from '@playwright/test';
