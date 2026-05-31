import type { APIRequestContext } from '@playwright/test';
import type { LinkResult, SiteConfig } from '../types/index.js';
import { classifyHref, isInternal, normalizeForDedupe } from './url.js';

/** A link collected from the DOM before it has been checked. */
export interface CollectedLink {
  /** Absolute, resolved URL (or the raw href for non-http kinds). */
  url: string;
  /** Raw href as authored in the DOM. */
  raw: string;
  kind: string;
}

const concurrency = Number(process.env.LINK_CHECK_CONCURRENCY ?? 8);
const timeout = Number(process.env.LINK_CHECK_TIMEOUT_MS ?? 15000);

/**
 * Module-level cache of HTTP results keyed by normalised URL. The same link
 * (e.g. the logo, footer items) appears on every page; we only check each
 * distinct URL once per run.
 */
const httpCache = new Map<string, { status: number | null; ok: boolean; error?: string }>();

/** Should this resolved URL be skipped per the site's ignore patterns? */
function isIgnored(raw: string, site: SiteConfig): boolean {
  return site.linkCheck.ignorePatterns.some((re) => re.test(raw));
}

/**
 * Check a single HTTP(S) URL. Tries a lightweight GET (HEAD is unreliable on
 * many static hosts) and treats any status < 400 as OK. Results are cached.
 */
async function checkHttp(
  request: APIRequestContext,
  url: string,
): Promise<{ status: number | null; ok: boolean; error?: string }> {
  const key = normalizeForDedupe(url);
  const cached = httpCache.get(key);
  if (cached) return cached;

  let result: { status: number | null; ok: boolean; error?: string };
  try {
    const res = await request.get(url, { timeout, maxRedirects: 5 });
    const status = res.status();
    result = { status, ok: status < 400 };
  } catch (err) {
    result = { status: null, ok: false, error: (err as Error).message };
  }
  httpCache.set(key, result);
  return result;
}

/** Run async tasks with a fixed concurrency limit. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length || 1) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Check a batch of collected links found on a single page.
 *
 * - "http" links are HTTP-checked (internal always; external only when the
 *   site config opts in).
 * - "anchor" links are validated by the caller against the DOM, so here they
 *   are reported as ok=true with kind="anchor" and skipped from HTTP.
 * - mailto/tel/javascript are reported as ok=true (not network-checkable).
 */
export async function checkLinks(
  request: APIRequestContext,
  links: CollectedLink[],
  foundOn: string,
  site: SiteConfig,
): Promise<LinkResult[]> {
  const httpTargets = links.filter((l) => {
    if (l.kind !== 'http') return false;
    if (isIgnored(l.raw, site)) return false;
    if (!site.linkCheck.includeExternal && !isInternal(l.url, site.baseURL)) return false;
    return true;
  });

  const httpResults = await mapWithConcurrency(httpTargets, concurrency, async (link) => {
    const res = await checkHttp(request, link.url);
    return {
      url: link.url,
      foundOn,
      status: res.status,
      ok: res.ok,
      kind: 'http',
      error: res.error,
    } satisfies LinkResult;
  });

  const nonHttp: LinkResult[] = links
    .filter((l) => l.kind !== 'http' && l.kind !== 'empty')
    .map((l) => ({ url: l.raw, foundOn, status: null, ok: true, kind: l.kind }));

  return [...httpResults, ...nonHttp];
}

/** Helper to classify and resolve a raw href into a CollectedLink. */
export function toCollectedLink(raw: string, pageUrl: string): CollectedLink {
  const kind = classifyHref(raw);
  if (kind === 'http') {
    try {
      return { url: new URL(raw, pageUrl).toString(), raw, kind };
    } catch {
      return { url: raw, raw, kind: 'empty' };
    }
  }
  return { url: raw, raw, kind };
}
