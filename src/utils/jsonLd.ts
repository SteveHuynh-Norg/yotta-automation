import type { JsonLdBlock } from '../types/index.js';

/**
 * Recursively collect every @type value from a parsed JSON-LD value, handling
 * the common shapes: a single object, an array of objects, and the @graph
 * wrapper. @type itself may be a string or an array of strings.
 */
export function extractTypes(value: unknown, acc: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) extractTypes(item, acc);
    return acc;
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const t = obj['@type'];
    if (typeof t === 'string') acc.push(t);
    else if (Array.isArray(t)) for (const x of t) if (typeof x === 'string') acc.push(x);
    if (Array.isArray(obj['@graph'])) extractTypes(obj['@graph'], acc);
  }
  return acc;
}

/**
 * Parse an array of raw JSON-LD strings (the textContent of each
 * <script type="application/ld+json"> block) into structured blocks, capturing
 * parse errors rather than throwing so the test can assert on them.
 */
export function parseJsonLdBlocks(rawBlocks: string[]): JsonLdBlock[] {
  return rawBlocks.map((raw) => {
    try {
      const parsed = JSON.parse(raw);
      return { raw, parsed, types: extractTypes(parsed) };
    } catch (err) {
      return { raw, parsed: null, parseError: (err as Error).message, types: [] };
    }
  });
}

/** A JSON-LD object should declare @context and @type to be valid Schema.org. */
export function hasRequiredKeys(value: unknown): boolean {
  if (Array.isArray(value)) return value.every(hasRequiredKeys);
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj['@graph'])) {
      return '@context' in obj && obj['@graph'].every(hasRequiredKeys);
    }
    return '@context' in obj && '@type' in obj;
  }
  return false;
}
