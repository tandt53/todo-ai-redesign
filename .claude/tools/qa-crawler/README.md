# 🎭 QA Google Car v3 — Living Knowledge Base

Claude Code is the brain. `playwright-cli` is the hands.
The output is a **living knowledge base** that gets smarter over time.

---

## The Full Loop

```
                    ┌─────────────────────────────┐
                    │         CRAWL               │  Phase 1
                    │  Claude Code + playwright-cli│
                    │  visits every page           │
                    │  records elements + locators │
                    │  writes pages/*.json         │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │        SYNTHESIZE            │  Phase 2
                    │  Claude Code (no browser)    │
                    │  reads all pages/*.json      │
                    │  identifies user flows       │
                    │  writes flows/*.json         │
                    │  writes catalog.md           │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │      GENERATE TESTS          │  On demand
                    │  reads knowledge base        │
                    │  uses stored locators        │
                    │  writes tests/*.spec.ts      │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │       RUN TESTS              │
                    │  npx playwright test         │
                    └──────────────┬──────────────┘
                          pass ✅  │  fail ❌
                                   │
                    ┌──────────────▼──────────────┐
                    │       SELF-HEALING           │  On failure
                    │  re-explores failing element │
                    │  fixes locator in test       │
                    │  updates knowledge base      │
                    └─────────────────────────────┘
```

---

## Project Structure

```
qa-crawler/
├── CLAUDE.md                            ← agent mission + skill index
├── crawl.config.json                    ← your app config
├── run-crawl.sh                         ← daily cron trigger
├── scripts/
│   └── toast-interceptor.js             ← auto-injected alert watcher
├── .playwright/
│   └── cli.config.json                  ← registers init script
├── skills/
│   ├── 01-playwright-cli-reference.md   ← how to use the browser
│   ├── 02-crawl-skill.md                ← Phase 1: crawl + record
│   ├── 03-synthesize-skill.md           ← Phase 2: flows + catalog
│   ├── 04-test-generation-skill.md      ← generate tests from KB
│   ├── 05-self-healing-skill.md         ← fix failures + update KB
│   └── 06-page-objects-skill.md         ← generate page object classes
├── tests/
│   ├── pages/                           ← generated page objects
│   │   ├── index.ts                     ← barrel export
│   │   ├── DashboardPage.ts
│   │   ├── SettingsProfilePage.ts
│   │   └── CheckoutPage.ts
│   ├── flows/                           ← flow-based tests
│   │   ├── checkout-flow.spec.ts
│   │   └── auth-flow.spec.ts
│   └── pages/                           ← page-level tests
│       └── settings-profile.spec.ts
└── output/                              ← living knowledge base
    ├── knowledge/
    │   ├── pages/                       ← one JSON per page
    │   │   ├── dashboard.json
    │   │   ├── settings-profile.json
    │   │   └── ...
    │   ├── flows/                       ← identified user flows
    │   │   ├── checkout-flow.json
    │   │   ├── auth-flow.json
    │   │   └── index.json
    │   └── pageIndex.json
    ├── catalog.md
    └── sitemap.json
```

---

## Setup

```bash
# Install tools
npm install -g @anthropic-ai/claude-code
npm install -g @playwright/cli@latest
playwright-cli install --skills
npx playwright install chromium

# Install Playwright for test running
npm init playwright@latest
```

Edit `crawl.config.json` with your app URL and credentials.

---

## Daily Crawl (Cron)

```bash
chmod +x run-crawl.sh

# Add to crontab (runs every morning at 8am)
crontab -e
0 8 * * * /full/path/to/qa-crawler/run-crawl.sh
```

---

## Generate Page Objects + Tests (On Demand)

```bash
cd qa-crawler

# Generate page objects for all pages
claude "read skills/06-page-objects-skill.md and generate page objects for all pages in output/knowledge/pages/"

# Generate tests for a specific flow
claude "read skills/04-test-generation-skill.md and generate tests for the checkout flow"

# Generate tests for a specific page
claude "generate tests for the /settings/profile page"

# Generate tests for all critical flows
claude "generate tests for all critical priority flows"
```

---

## Fix Failing Tests

```bash
cd qa-crawler
claude "read skills/05-self-healing-skill.md and fix failing tests in tests/"
```

---

## Config Reference

```json
{
  "baseUrl": "https://your-app.com",
  "outputDir": "./output",
  "excludePaths": ["/logout", "/delete", "/reset"],
  "auth": {
    "loginUrl": "/login",
    "usernameSelector": "#email",
    "passwordSelector": "#password",
    "username": "qa@yourapp.com",
    "password": "your-password",
    "submitSelector": "button[type=submit]"
  }
}
```

Remove `auth` entirely if your app has no login.
