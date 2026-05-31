import type { APIRequestContext } from '@playwright/test';

/**
 * Fetch and parse a sitemap.xml, returning the list of <loc> URLs.
 * Uses a tolerant regex parser (no XML dependency) since sitemaps are flat and
 * well-formed in practice.
 */
export async function fetchSitemapUrls(
  request: APIRequestContext,
  sitemapUrl: string,
): Promise<string[]> {
  const res = await request.get(sitemapUrl, { timeout: 20000 });
  if (res.status() >= 400) {
    throw new Error(`Sitemap fetch failed: ${sitemapUrl} -> HTTP ${res.status()}`);
  }
  const xml = await res.text();
  const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1].trim());
  return [...new Set(locs)];
}
