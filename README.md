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
│   └── sites.ts                # Multi-site registry. Selleys is configured first.
├── fixtures/
│   └── test-fixtures.ts        # Injects page objects into every test
├── src/
│   ├── pages/                  # === Page Objects ===
│   │   ├── BasePage.ts         #   common: goto, meta, JSON-LD, link collection
│   │   ├── DirectoryHomePage.ts#   homepage + nav tree
│   │   ├── CategoryPage.ts     #   interior pages (category/subcategory/leaf)
│   │   └── components/
│   │       └── NavTreeComponent.ts  # parses the hierarchy widget
│   ├── utils/                  # link checker, JSON-LD, sitemap, URL, page provider
│   └── types/                  # shared types + content-type → level mapping
└── tests/                      # one spec per requirement
    ├── links.spec.ts
    ├── jsonld.spec.ts
    ├── meta-description.spec.ts
    └── navigation-structure.spec.ts
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
npm run test:ui            # interactive Playwright UI
npm run report             # open the last HTML report
```

### Targeting / tuning (env vars — see `.env.example`)

| Variable | Purpose | Default |
|---|---|---|
| `SITE` | Run only one site by key (e.g. `selleys`) | all enabled |
| `BASE_URL` | Override the primary site's base URL | config value |
| `USE_SITEMAP` | Expand pages-under-test from `sitemap.xml` | `false` |
| `SITEMAP_LIMIT` | Cap sitemap URLs when expanding (`0` = no cap) | `25` |
| `LINK_CHECK_CONCURRENCY` | Parallel link requests | `8` |
| `LINK_CHECK_TIMEOUT_MS` | Per-link timeout | `15000` |

```bash
SITE=selleys npm test                    # just Selleys
USE_SITEMAP=true SITEMAP_LIMIT=50 npm test   # broader coverage from the sitemap
```

## Adding a new site

Append a `SiteConfig` to `SITES` in `config/sites.ts` — set `baseURL`,
`pagesUnderTest` (one path per hierarchy level), `expectedJsonLdTypes`, and the
link-check policy. If the new site labels its hierarchy differently, extend
`CONTENT_TYPE_TO_LEVEL` in `src/types/index.ts`. No test code changes required.
