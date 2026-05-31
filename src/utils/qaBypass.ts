import { createHmac } from 'node:crypto';

/**
 * reCAPTCHA QA-bypass URL generator.
 *
 * Mirrors the developer-supplied `qa-bypass-url.sh` exactly so the suite can
 * mint a fresh, time-limited bypass URL on every run instead of shelling out to
 * the script. The server side validates the token, so loading the form page at
 * the returned URL lets a QA submission skip the reCAPTCHA challenge.
 *
 *   TS    = current unix time (seconds)
 *   TOKEN = HMAC-SHA256(TS, SECRET)            (hex)
 *   URL   = <pageUrl>[?|&]qa_token=TOKEN&qa_ts=TS
 *
 * The shared secret is NEVER committed — it is read from the QA_BYPASS_SECRET
 * environment variable (a local `.env` value or a CI secret). This matches the
 * script's own guidance to keep the secret readable only by QA staff.
 *
 * The generated token is valid for ~5 minutes server-side, so a URL must be
 * built immediately before the navigation that uses it.
 */

/** Name of the env var holding the shared HMAC secret. */
export const QA_BYPASS_SECRET_ENV = 'QA_BYPASS_SECRET';

export interface BypassUrlOptions {
  /** Override the unix timestamp (seconds). Defaults to "now". For tests. */
  tsSeconds?: number;
}

/**
 * Build a reCAPTCHA bypass URL for `pageUrl` signed with `secret`.
 * Throws if the secret is empty so misconfiguration fails loudly.
 */
export function buildBypassUrl(
  pageUrl: string,
  secret: string,
  options: BypassUrlOptions = {},
): string {
  if (!secret || secret.trim() === '') {
    throw new Error(
      `Missing reCAPTCHA bypass secret. Set the ${QA_BYPASS_SECRET_ENV} ` +
        `environment variable (value supplied by the developer's qa-bypass-url.sh).`,
    );
  }

  const ts = String(options.tsSeconds ?? Math.floor(Date.now() / 1000));
  // openssl `dgst -sha256 -hmac <secret>` over the raw timestamp string → hex.
  const token = createHmac('sha256', secret).update(ts).digest('hex');

  const sep = pageUrl.includes('?') ? '&' : '?';
  return `${pageUrl}${sep}qa_token=${token}&qa_ts=${ts}`;
}

/**
 * Convenience wrapper that reads the secret from QA_BYPASS_SECRET and builds the
 * bypass URL for `pageUrl`. Throws a clear error if the env var is unset.
 */
export function buildBypassUrlFromEnv(
  pageUrl: string,
  options: BypassUrlOptions = {},
): string {
  return buildBypassUrl(pageUrl, process.env[QA_BYPASS_SECRET_ENV] ?? '', options);
}
