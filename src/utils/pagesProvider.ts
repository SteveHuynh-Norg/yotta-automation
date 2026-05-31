import type { APIRequestContext } from '@playwright/test';
import type { PageUnderTest, SiteConfig } from '../types/index.js';
import { resolveUrl } from './url.js';
import { fetchSitemapUrls } from './sitemap.js';

/** A page to test, with its absolute URL resolved. */
export interface ResolvedPage extends PageUnderTest {
  url: string;
}

/**
 * Resolve the set of pages to exercise for a site.
 *
 * Default: the curated `pagesUnderTest` (fast, one per hierarchy level).
 * When USE_SITEMAP=true: expand from the live sitemap.xml, capped by
 * SITEMAP_LIMIT, with hierarchy level inferred from URL depth.
 */
export async function resolvePages(
  site: SiteConfig,
  request?: APIRequestContext,
): Promise<ResolvedPage[]> {
  const useSitemap = process.env.USE_SITEMAP === 'true';
  if (!useSitemap || !request) {
    return site.pagesUnderTest.map((p) => ({ ...p, url: resolveUrl(site.baseURL, p.path) }));
  }

  const limit = Number(process.env.SITEMAP_LIMIT ?? 25);
  const sitemapUrl = resolveUrl(site.baseURL, site.sitemapPath);
  const urls = await fetchSitemapUrls(request, sitemapUrl);
  const capped = limit > 0 ? urls.slice(0, limit) : urls;
  return capped.map((url) => {
    const path = url.replace(site.baseURL, '');
    return { path, url, level: inferLevel(path), label: path || 'Homepage' };
  });
}

/** Infer a hierarchy level from how many path segments a URL has. */
function inferLevel(path: string): PageUnderTest['level'] {
  const segments = path.split('/').filter(Boolean);
  switch (segments.length) {
    case 0:
      return 'home';
    case 1:
      return 'category';
    case 2:
      return 'subcategory';
    default:
      return 'leaf';
  }
}
