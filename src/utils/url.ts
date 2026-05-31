/**
 * URL helpers shared across page objects and utilities.
 */

/** Join a baseURL (with trailing slash) and a relative path safely. */
export function resolveUrl(baseURL: string, path: string): string {
  return new URL(path, baseURL).toString();
}

/** True if `url` is on the same host as `baseURL`. */
export function isInternal(url: string, baseURL: string): boolean {
  try {
    return new URL(url).host === new URL(baseURL).host;
  } catch {
    return false;
  }
}

/**
 * Classify a raw href into a kind we know how to handle.
 * Returns "anchor" for in-page (#id) links, "mailto"/"tel"/"javascript" for
 * non-http schemes, and "http" for anything we should HTTP-check.
 */
export function classifyHref(href: string): string {
  const trimmed = href.trim();
  if (trimmed === '' || trimmed === '#') return 'empty';
  if (trimmed.startsWith('#')) return 'anchor';
  const schemeMatch = trimmed.match(/^([a-z][a-z0-9+.-]*):/i);
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    if (scheme === 'http' || scheme === 'https') return 'http';
    return scheme; // mailto, tel, javascript, ftp...
  }
  return 'http'; // relative or root-relative path -> resolves to http(s)
}

/** Normalise a URL for de-duplication (strip hash, keep query). */
export function normalizeForDedupe(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    return u.toString();
  } catch {
    return url;
  }
}
