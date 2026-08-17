# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

This is a **QA Knowledge Crawler** — an automated system that explores web applications and builds a living knowledge base for QA teams. Think of it as a "Google Car" for web apps that discovers pages, documents UI elements with their locators, identifies user flows, and enables automated test generation and self-healing.

**Architecture:**
- **Brain:** Claude Code analyzes and orchestrates
- **Hands:** `playwright-cli` controls the browser
- **Memory:** Structured JSON knowledge base per project

---

## Project Structure

The crawler is a **generic template** that supports multiple target applications. Each target app is a "project" under the `projects/` directory.

```
qa-crawler/
├── CLAUDE.md                          # This file — generic instructions
├── run-crawl.sh                       # Crawl runner (takes project name)
├── crawl.config.template.json         # Template for new projects
├── .playwright/cli.config.json        # Browser config
├── skills/                            # Generic skill modules
│   ├── 01-playwright-cli-reference.md
│   ├── 02-crawl-skill.md
│   ├── 03-synthesize-skill.md
│   ├── 04-test-generation-skill.md
│   ├── 05-self-healing-skill.md
│   ├── 06-page-objects-skill.md
│   ├── 07-multi-role-crawl-skill.md
│   └── 08-scenario-executor-skill.md
├── scripts/
│   └── toast-interceptor.js           # Auto-injected alert watcher
└── projects/
    └── <project-name>/                # One dir per target app
        ├── crawl.config.json          # App URL, credentials, exclusions
        ├── output/                    # Crawl output
        │   ├── knowledge/
        │   │   ├── pages/*.json       # One JSON per discovered page
        │   │   ├── flows/*.json       # Identified user flows
        │   │   ├── pageIndex.json     # Route → filename mapping
        │   │   └── qa-intelligence.json # QA analysis report
        │   ├── catalog.md             # Human-readable QA catalog
        │   ├── sitemap.json           # Machine-readable sitemap
        │   └── session.json           # Saved auth session
        ├── tests/                     # Generated test files
        │   ├── pages/                 # Page object classes
        │   └── flows/                 # Flow-based tests
        └── logs/                      # Crawl logs
```

### Active Project

When working with the crawler, you always operate in the context of an **active project**. The active project is specified either:
- Via `run-crawl.sh <project-name>` (automated)
- Via the user's prompt: "crawl odc-academy" or "project: odc-academy"
- By reading the project name from context

All file paths in skills are relative to the active project directory:
- `crawl.config.json` → `projects/<project>/crawl.config.json`
- `output/` → `projects/<project>/output/`
- `tests/` → `projects/<project>/tests/`

### Creating a New Project

```bash
mkdir projects/<name>
cp crawl.config.template.json projects/<name>/crawl.config.json
# Edit the config with your app's URL, credentials, and exclude paths
./run-crawl.sh <name>
```

---

## Core Workflow

The system operates in distinct phases:

### Phase 1: Crawl
**Entry point:** Read `skills/02-crawl-skill.md`

Claude Code uses `playwright-cli` to:
1. Login using credentials from the project's `crawl.config.json` (if auth configured)
2. Visit every reachable page (breadth-first traversal)
3. For each page:
   - Capture snapshot (accessibility tree in YAML)
   - Extract UI elements with locators (`role=button[name='...']`, CSS selectors)
   - Identify forms with field types and validation rules
   - Discover modals and their triggers
   - Read ephemeral alerts/toasts (via auto-injected `scripts/toast-interceptor.js`)
   - Note QA observations (roles, risks, edge cases)
   - Find navigation links → add to queue
4. QA Intelligence Analysis — synthesize observations into domain-aware report
5. Output: page JSONs + `qa-intelligence.json` with findings and proposed next actions

### Phase 2: Synthesize
**Entry point:** Read `skills/03-synthesize-skill.md`

Claude Code (no browser needed):
1. Reads all page JSON files from Phase 1
2. Identifies user flows by analyzing page connections
3. Outputs: flow definitions, catalog, sitemap

### Phase 3: Page Objects (On Demand)
**Entry point:** Read `skills/06-page-objects-skill.md`

Generates TypeScript page object classes from the knowledge base.

### Phase 4: Test Generation (On Demand)
**Entry point:** Read `skills/04-test-generation-skill.md`

Generates Playwright tests from flow definitions, using stored locators.

### Phase 5: Self-Healing (On Demand)
**Entry point:** Read `skills/05-self-healing-skill.md`

When tests fail, re-explores failing elements, fixes locators, updates knowledge base.

### Phase 6: Scenario Execution (On Demand)
**Entry point:** Read `skills/08-scenario-executor-skill.md`

Executes user-provided test scenarios live in the browser using the knowledge base.

### Phase 7: Multi-Role Crawl (On Demand)
**Entry point:** Read `skills/07-multi-role-crawl-skill.md`

Differential crawl with additional user roles to discover permission boundaries.

---

## Key Commands

### Daily Crawl (Full Pipeline)
```bash
./run-crawl.sh odc-academy
# OR manually:
claude "Project: odc-academy. Read CLAUDE.md and execute Phase 1 (Crawl) and Phase 2 (Synthesize)"
```

### Crawl-only (Update knowledge base)
```bash
claude "Project: odc-academy. Read skills/02-crawl-skill.md and execute Phase 1 crawl"
```

### Generate Page Objects
```bash
claude "Project: odc-academy. Read skills/06-page-objects-skill.md and generate page objects for all pages"
```

### Generate Tests
```bash
claude "Project: odc-academy. Read skills/04-test-generation-skill.md and generate tests for all critical flows"
```

### Execute Test Scenarios
```bash
claude "Project: odc-academy. Read skills/08-scenario-executor-skill.md and execute:
1. Login as admin, create a new user with role Teacher, verify success
2. Go to classes page, create a class, verify it appears in the list"
```

### Multi-Role Crawl
```bash
claude "Project: odc-academy. Read skills/07-multi-role-crawl-skill.md and execute multi-role differential crawl. Credentials: teacher=teacher@example.com/Pass123, student=student@example.com/Pass123"
```

### Fix Failing Tests
```bash
claude "Project: odc-academy. Read skills/05-self-healing-skill.md and fix failing tests"
```

### Run Generated Tests
```bash
npx playwright test
npx playwright test --ui                    # interactive mode
npx playwright test tests/flows/checkout    # specific test
```

---

## Configuration

### `projects/<name>/crawl.config.json`
Defines the target application:
```json
{
  "baseUrl": "http://localhost:3000",
  "outputDir": "./output",
  "excludePaths": ["/sign-out", "/delete"],
  "auth": {
    "loginUrl": "/login",
    "usernameSelector": "#email",
    "passwordSelector": "#password",
    "username": "admin@example.com",
    "password": "your-password",
    "submitSelector": "button[type=submit]"
  }
}
```

Remove `auth` section entirely if the app has no login.

### `.playwright/cli.config.json`
Configures browser automation:
- Auto-injects `scripts/toast-interceptor.js` on every page
- Sets browser (chromium), viewport, headless mode

---

## Browser Control Reference

Always read `skills/01-playwright-cli-reference.md` before using browser commands.

**Key commands:**
```bash
playwright-cli open <url>                  # Start browser
playwright-cli snapshot                    # Capture page structure → .yml
playwright-cli click <ref>                 # Click element by ref (e.g., e15)
playwright-cli fill <ref> <text>          # Fill input field
playwright-cli eval "window.__qaReadAlerts()"  # Read captured alerts/toasts
playwright-cli state-save <project>/output/session.json  # Save login session
playwright-cli state-load <project>/output/session.json  # Restore session
```

**Element refs:** Snapshots generate refs like `e15`, `e21`. Always snapshot first, read the YAML file, find the ref, then use it.

---

## Alert/Toast Detection

`scripts/toast-interceptor.js` is automatically injected on every page via `.playwright/cli.config.json`.

It passively watches for ephemeral alerts using 3 strategies:
1. **ARIA roles** — `role=alert`, `role=status`, `aria-live` (framework-agnostic)
2. **Ephemeral DOM** — nodes that appear AND disappear within 6 seconds
3. **Console errors** — JS errors even when UI shows nothing

**IMPORTANT:** Always read alerts before navigating away:
```bash
playwright-cli eval "window.__qaReadAlerts()"
playwright-cli eval "window.__qaClearAlerts()"
```

These alerts are critical for test generation — they show exactly what feedback the app gives users after actions.

---

## Skill Modules Reference

| Skill | When to use |
|---|---|
| `skills/01-playwright-cli-reference.md` | Always — browser commands reference |
| `skills/02-crawl-skill.md` | Phase 1: Crawl pages, build knowledge base + QA intelligence |
| `skills/03-synthesize-skill.md` | Phase 2: Identify flows, generate catalog |
| `skills/04-test-generation-skill.md` | Generate Playwright tests from flows |
| `skills/05-self-healing-skill.md` | Fix failing tests, update locators |
| `skills/06-page-objects-skill.md` | Generate TypeScript page object classes |
| `skills/07-multi-role-crawl-skill.md` | Differential crawl for additional user roles |
| `skills/08-scenario-executor-skill.md` | Execute test scenarios live in the browser |

---

## Default Execution Flow

When invoked without specific instructions, execute this sequence:

1. Determine the active project (from prompt or ask the user)
2. Read `projects/<project>/crawl.config.json` for target app config
3. Read `skills/01-playwright-cli-reference.md` to learn browser control
4. Read `skills/02-crawl-skill.md` and execute **Phase 1: Crawl**
   - Login if auth configured
   - Visit every page, noting QA observations per page
   - Write `projects/<project>/output/knowledge/pages/*.json`
   - Run QA Intelligence Analysis
   - Write `projects/<project>/output/knowledge/qa-intelligence.json`
   - Present findings and proposed next actions
5. Read `skills/03-synthesize-skill.md` and execute **Phase 2: Synthesize**
   - Identify user flows
   - Write `projects/<project>/output/knowledge/flows/*.json`
   - Write `projects/<project>/output/catalog.md` and `sitemap.json`
6. Read `skills/06-page-objects-skill.md` and generate page objects
7. Print summary of pages crawled, flows identified, and output files written
