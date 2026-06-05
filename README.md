# Yotta Automation — Directory Verification Suite

Playwright + TypeScript automation testing suite built on the **Page Object Model
(POM)**. It verifies directory-style sites against four requirements:

1. **All links work** — every `<a href>` on each tested page is HTTP-checked
   (internal always; external per site policy); in-page `#anchor` links are
   validated against the DOM.
2. **JSON-LD embedded** — each page exposes valid `application/ld+json` blocks
   with the Schema.org essentials (`@context` / `@type`); the homepage carries
   the expected types.
3. **Meta descriptions** — exactly one non-empty `<meta name="description">` per
   page (length vs. the 50–160 SEO window is reported as a soft warning).
4. **Navigation structure** — the homepage nav tree matches
   **homepage > category > subcategory > leaf**, with each link resolving and
   deepening by exactly one level.

The suite is **multi-site by design**. The first target is
`https://directory.selleys.com.au/`; adding another site is a config-only change.

## Project structure (POM)

```
yotta-automation/
├── playwright.config.ts        # Runner config (headless Chromium, retries, reports)
├── tsconfig.json
├── config/
│   ├── sites.ts                # Multi-site registry. Selleys is configured first.
│   └── forms.ts                # Multi-form registry. SS Doors contact form first.
├── fixtures/
│   └── test-fixtures.ts        # Injects page objects into every test
├── src/
│   ├── pages/                  # === Page Objects ===
│   │   ├── BasePage.ts         #   common: goto, meta, JSON-LD, link collection
│   │   ├── DirectoryHomePage.ts#   homepage + nav tree
│   │   ├── CategoryPage.ts     #   interior pages (category/subcategory/leaf)
│   │   ├── ContactPage.ts      #   contact form: fill + submit (reads AJAX result)
│   │   └── components/
│   │       └── NavTreeComponent.ts  # parses the hierarchy widget
│   ├── utils/                  # link checker, JSON-LD, sitemap, URL, qaBypass (reCAPTCHA)
│   └── types/                  # shared types + content-type → level mapping
└── tests/                      # one spec per requirement
    ├── links.spec.ts
    ├── jsonld.spec.ts
    ├── meta-description.spec.ts
    ├── navigation-structure.spec.ts
    └── form-submission.spec.ts # contact-form submission (tagged @forms)
```

**POM principle:** specs contain *assertions only*; all DOM access, locators,
and navigation live in page objects under `src/pages/`. Tests touch the page
exclusively through those objects (provided as fixtures).

## Setup

```bash
npm install
npm run install:browsers   # downloads Chromium
```

## Running

```bash
npm test                   # all four suites, all enabled sites
npm run test:links         # broken-link scan
npm run test:jsonld        # JSON-LD verification
npm run test:meta          # meta description verification
npm run test:nav           # navigation hierarchy
npm run test:forms         # contact-form submission (separate suite, see below)
npm run test:ui            # interactive Playwright UI
npm run report             # open the last HTML report
```

> `npm test` runs the directory suites only — it excludes the form-submission
> test (tagged `@forms`), which sends a real enquiry and needs a secret. Run
> that one explicitly with `npm run test:forms`.

### Targeting / tuning (env vars — see `.env.example`)

| Variable | Purpose | Default |
|---|---|---|
| `SITE` | Run only one site by key (e.g. `selleys`) | all enabled |
| `BASE_URL` | Override the primary site's base URL | config value |
| `USE_SITEMAP` | Expand pages-under-test from `sitemap.xml` | `false` |
| `SITEMAP_LIMIT` | Cap sitemap URLs when expanding (`0` = no cap) | `25` |
| `LINK_CHECK_CONCURRENCY` | Parallel link requests (kept low to avoid CDN/WAF rate-limiting) | `4` |
| `LINK_CHECK_TIMEOUT_MS` | Per-link timeout | `15000` |
| `LINK_CHECK_MAX_RETRIES` | Retries on transient `429`/`503`/network errors (backoff honours `Retry-After`) | `3` |

```bash
SITE=selleys npm test                    # just Selleys
USE_SITEMAP=true SITEMAP_LIMIT=50 npm test   # broader coverage from the sitemap
```

## CI / CD (GitHub Actions)

`.github/workflows/ci.yml` runs the full suite on GitHub-hosted runners:

| Trigger | When |
|---|---|
| `push` / `pull_request` | On every change to `main` |
| `schedule` | **Mon, Wed, Fri at 07:00 ICT (GMT+7)** — `cron: '0 0 * * 1,3,5'` (00:00 UTC) |
| `workflow_dispatch` | Manual run; optional `site` and `use_sitemap` inputs |

Each run posts a **job summary** ("Run Playwright tests summary") with a
`Status / Test / Duration` table of failed & flaky tests, plus inline error
**annotations** (Playwright's `github` reporter) and an uploaded HTML report
artifact. The summary table is produced by `src/reporters/github-summary-reporter.ts`,
which is enabled only when `CI` is set (no effect on local runs).

### Slack notifications

A run summary can also be posted to a Slack channel via an **Incoming Webhook**,
produced by `src/reporters/slack-reporter.ts`. The message shows the overall
status, the pass/fail/flaky/skipped tally, the list of failed & flaky tests, and
(in CI) a link back to the GitHub Actions run.

It is driven entirely by env vars and is a **no-op when unconfigured**, so it is
safe to keep enabled both locally and in CI:

| Var | Purpose |
|---|---|
| `SLACK_WEBHOOK_URL` | Incoming-webhook URL. Unset → reporter does nothing. |
| `SLACK_NOTIFY_ON` | `always` (default) posts every run; `failure` posts only on failed/flaky runs. |

The webhook URL is a **secret** (anyone holding it can post to the channel) — it
is **never committed**. Set it in a local `.env` (gitignored) and store it as the
**`SLACK_WEBHOOK_URL`** GitHub Actions secret for CI (wired into both `ci.yml`
and `forms-submission.yml`).

## Form-submission suite (contact forms)

A separate suite verifies that a contact form accepts a submission end-to-end.
It is data-driven (`config/forms.ts`): one success-path test per in-scope page,
covering every **reCAPTCHA-protected Elementor** form across the dealer estate
(both reCAPTCHA **v2** and **v3**). Adding a form is a config-only change.

```bash
QA_BYPASS_SECRET=… npm run test:forms                  # all configured forms
FORM=ssdoors-contact-us QA_BYPASS_SECRET=… npm run test:forms   # one form by key
FORM=89s.com.au QA_BYPASS_SECRET=… npm run test:forms           # a whole site (key/URL substring)
```

**What the test does** — fills the form generically (sweeps and fills every
required field — name/email/phone/message plus extras like suburb/postcode and
consent — using a disposable `@yopmail.com` address and a self-identifying
message so any received enquiry is clearly a test) and asserts the Elementor
`admin-ajax.php` response is `success: true`.

**reCAPTCHA bypass.** reCAPTCHA cannot be solved in automation, so the suite
uses the developer-supplied bypass: `src/utils/qaBypass.ts` mints a fresh,
time-limited URL (`?qa_token=<HMAC-SHA256(unix_ts, secret)>&qa_ts=<unix_ts>`,
valid ~5 min) — an exact port of `qa-bypass-url.sh`. A page snippet forwards the
token into the form POST so the server can skip verification.

- The shared HMAC secret is **never committed** — set `QA_BYPASS_SECRET` in a
  local `.env` (gitignored) and as the **`QA_BYPASS_SECRET`** GitHub Actions
  secret for CI. The value comes from the developer's `qa-bypass-url.sh`.
- The bypass also requires the **server-side** half (a handler that validates
  the token and skips reCAPTCHA) to be live for the targeted site. If the server
  still returns *"The Captcha field cannot be blank"*, the token is not being
  honoured server-side — confirm the secret and that the handler is deployed.
- Some dealer zones sit behind **Cloudflare Bot Fight Mode** and 403 the
  automated browser. Set **`QA_BYPASS_HEADER`** (local `.env` + GitHub Actions
  secret) to the developer-supplied token; it is sent as the `X-QA-Bypass`
  request header on every request to clear those zones (no-op elsewhere).

This suite has its **own** pipeline, **`.github/workflows/forms-submission.yml`**:

| Trigger | When |
|---|---|
| `push` / `pull_request` | Changes touching the form-submission code paths (the directory `ci.yml` ignores those same paths, so form changes are verified here, not there) |
| `workflow_dispatch` | Manual run; optional `form` input |
| `schedule` | **Mondays 07:30 ICT (GMT+7)** — `cron: '30 0 * * 1'` (00:30 UTC) |

Runs the full estate **serially** (`--workers=1`; the estate is flaky under
parallel load) and **excludes the `@bnd`-tagged Cloudflare zones**, which reject
the GitHub runner's datacenter IP (they pass on a local run, which applies no
such exclusion — pending a dev-side allowlist). It is separate from `ci.yml`
because it sends real, self-identified submissions.

### Adding a new form

Append a `FormConfig` to `FORMS` in `config/forms.ts` — set `pageURL`, the field
`selectors`, and `usesRecaptchaBypass`. No test code changes required.

## Adding a new site

Append a `SiteConfig` to `SITES` in `config/sites.ts` — set `baseURL`,
`pagesUnderTest` (one path per hierarchy level), `expectedJsonLdTypes`, and the
link-check policy. If the new site labels its hierarchy differently, extend
`CONTENT_TYPE_TO_LEVEL` in `src/types/index.ts`. No test code changes required.
