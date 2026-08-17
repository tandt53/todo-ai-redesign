# Skill: Phase 1 — Crawl & Build Knowledge Base

This skill covers the crawling phase. You visit every reachable page of the app,
understand what you see, record structured knowledge including locators, and save
one JSON file per page into the project's output directory.

---

## Path Convention

All paths are relative to the **active project directory** (`projects/<project-name>/`).
The active project is determined from the user's prompt or `run-crawl.sh` argument.

Throughout this skill:
- `<project>` = `projects/<project-name>` (e.g., `projects/odc-academy`)
- `crawl.config.json` = `<project>/crawl.config.json`
- `output/` = `<project>/output/`
- `tests/` = `<project>/tests/`

---

## Setup

Read `<project>/crawl.config.json`:
- `baseUrl` — starting URL
- `outputDir` — where to write (default `./output`)
- `excludePaths` — never visit these
- `auth` — login credentials if present

Initialize:
- `visited = {}` — URLs already processed
- `queue = [ baseUrl ]` — URLs to process
- `pageIndex = {}` — route → filename mapping (used by synthesize phase)

Create directories:
```
<project>/output/knowledge/pages/
<project>/output/knowledge/flows/
```

---

## Alert Interceptor

The file `scripts/toast-interceptor.js` is auto-injected on every page via
`.playwright/cli.config.json`. It passively watches for ephemeral alerts using
3 strategies simultaneously:

- **ARIA roles** — `role=alert`, `role=status`, `aria-live` (framework-agnostic)
- **Ephemeral DOM** — any node that appears AND disappears within 6 seconds
- **Console errors** — JS errors even when UI shows nothing

You never need to set it up manually. It runs silently in the background.

**Read alerts before navigating away from any page:**
```bash
playwright-cli eval "window.__qaReadAlerts()"
playwright-cli eval "window.__qaClearAlerts()"  # clear after reading
```

---

## Login (if auth configured)

1. `playwright-cli open <baseUrl><auth.loginUrl>`
2. `playwright-cli snapshot` → find username + password field refs
3. `playwright-cli fill <usernameRef> <username>`
4. `playwright-cli fill <passwordRef> <password>`
5. `playwright-cli click <submitRef>`
6. `playwright-cli snapshot` → verify success
7. `playwright-cli eval "window.__qaReadAlerts()"` → check for login errors
8. `playwright-cli state-save <project>/output/session.json`

---

## Crawl Loop

### For each URL in queue:

**Step 1 — Navigate**
```bash
playwright-cli goto <url>
playwright-cli snapshot   # read this file carefully
```

**Step 2 — Understand the page**

Read the snapshot deeply. Think about:
- What is the **purpose** of this page? What does a user do here?
- What is the **layout pattern**? (sidebar nav, wizard steps, dashboard grid, settings panel, modal overlay, etc.)
- Are there **modals or drawers** triggered by buttons? Note their triggers.
- What is the **user intent** when landing here?

Write a 1-2 sentence `summary` capturing this understanding.

**Step 2b — QA observations (think while crawling)**

As you understand the page, note anything a QA engineer would find interesting.
Don't just record what's on the page — think about what it *means* for the app:

- **Data model clues:** Does this page reveal entities and relationships?
  (e.g., a class detail page showing teacher name + student list = Class → Teacher,
  Class → Students relationships)
- **Role/permission signals:** Role selectors, role filters, user type columns,
  different dashboard variants, admin-only navigation
- **Business logic signals:** Workflows, status fields, state transitions,
  conditional buttons (e.g., "Approve" only on pending items)
- **Risk signals:** Destructive actions, missing confirmations, cascade-prone
  relationships (e.g., delete button on an entity referenced by others)
- **Edge case signals:** Lists that could be empty, optional fields, date/time
  inputs, file uploads, search with no results

Save observations in each page's JSON under `qaObservations`:
```json
{
  "qaObservations": [
    "Role filter dropdown with options: Teacher, Student — indicates role-based access system",
    "Delete button exists but no confirmation modal was observed — potential data loss risk",
    "Class references both a Teacher and enrolled Students — cascade risk if teacher is deleted"
  ]
}
```

These per-page observations accumulate across the crawl and feed into the final
QA Intelligence Analysis (Step 9).

**Step 3 — Extract elements WITH locators**

For every interactive element, capture:

```json
{
  "name": "human readable name",
  "type": "button | input | select | checkbox | link | tab | accordion",
  "locator": "role=button[name='Save Changes']",
  "fallback": "#save-btn",
  "destructive": false,
  "description": "saves changes to the user profile"
}
```

**Locator priority** (use the first one that uniquely identifies the element):
1. `role=` + accessible name → `role=button[name='Export']`
2. `label=` for inputs → `label='Email address'`
3. `placeholder=` for inputs → `placeholder='Search...'`
4. `data-testid` → `[data-testid='submit-btn']`
5. CSS id → `#email`
6. CSS class (only if stable-looking) → `.submit-primary`

Always record both `locator` (preferred) and `fallback` (CSS backup).

**Step 4 — Extract forms**

For each form:
```json
{
  "name": "Login form",
  "description": "authenticates the user with email and password",
  "fields": [
    {
      "name": "Email",
      "type": "email",
      "locator": "label='Email address'",
      "fallback": "#email",
      "required": true,
      "validations": ["required", "email format"]
    },
    {
      "name": "Password",
      "type": "password",
      "locator": "label='Password'",
      "fallback": "#password",
      "required": true
    }
  ],
  "submitLocator": "role=button[name='Sign In']",
  "submitFallback": "button[type=submit]"
}
```

**Step 5 — Extract modals**

For each button/trigger that opens a modal or drawer:
```json
{
  "name": "Delete Account modal",
  "trigger": "role=button[name='Delete Account']",
  "summary": "Confirms permanent account deletion. Requires typing DELETE to confirm.",
  "elements": [
    {
      "name": "Confirmation input",
      "type": "input",
      "locator": "placeholder='Type DELETE to confirm'",
      "fallback": "#confirm-delete-input"
    },
    {
      "name": "Confirm Delete button",
      "type": "button",
      "locator": "role=button[name='Confirm Delete']",
      "destructive": true
    }
  ]
}
```

> You do NOT need to click destructive buttons to explore modals.
> If you can safely open and close a modal (non-destructive trigger), do it and snapshot inside.
> For destructive modals, infer from context what they likely contain.

**Step 6 — Read alerts before leaving the page**

Before navigating to the next URL, always read the alert log:
```bash
playwright-cli eval "window.__qaReadAlerts()"
playwright-cli eval "window.__qaClearAlerts()"
```

Record anything found in the page knowledge file under `alertsObserved`.
These are extremely valuable for test generation — they tell you exactly
what feedback the app gives users after actions.

**Step 7 — Discover new links**

Collect all internal links → add new ones to queue.
Deduplicate dynamic routes (`/users/123` → `/users/:id`).

**Step 7 — Save page knowledge file**

Filename: slugify the route. Examples:
- `/dashboard` → `pages/dashboard.json`
- `/settings/profile` → `pages/settings-profile.json`
- `/users/:id` → `pages/users-id.json`

```json
{
  "route": "/settings/profile",
  "templateRoute": "/settings/profile",
  "url": "https://app.com/settings/profile",
  "title": "Profile Settings",
  "crawledAt": "2026-04-08T08:00:00.000Z",
  "summary": "Allows users to update their personal information including name, email, avatar, and password. Changes require confirmation via Save button.",
  "layout": "settings-panel",
  "elements": [ ... ],
  "forms": [ ... ],
  "modals": [ ... ],
  "navLinks": [
    { "text": "Billing", "href": "/settings/billing", "locator": "role=link[name='Billing']" }
  ],
  "leadsTo": ["/settings/billing", "/settings/security", "/dashboard"],
  "alertsObserved": [
    {
      "text": "Profile saved successfully",
      "type": "success",
      "reason": "ephemeral-dom",
      "trigger": "Save Changes button",
      "timestamp": "2026-04-08T08:01:23.000Z"
    },
    {
      "text": "Email address is already in use",
      "type": "error",
      "reason": "aria-role",
      "trigger": "Save Changes button",
      "timestamp": "2026-04-08T08:01:45.000Z"
    }
  ],
  "testPriority": "high",
  "qaObservations": [
    "Profile page has avatar upload — test file type/size restrictions",
    "Email uniqueness enforced (observed 'already in use' error) — test with duplicate emails",
    "Password change requires current password — test with wrong current password"
  ],
  "notes": ""
}
```

**testPriority** — set based on:
- `critical` → auth pages, checkout, payment
- `high` → forms, destructive actions, core features
- `medium` → read-only pages, settings
- `low` → static/informational pages

**Step 8 — Update page index**

Append to `<project>/output/knowledge/pageIndex.json`:
```json
{
  "/settings/profile": "pages/settings-profile.json",
  "/dashboard": "pages/dashboard.json"
}
```

---

## Safety Rules

- **Never** click: Delete, Remove, Logout, Sign out, Deactivate, Cancel account
- **Never** follow external links
- **Never** visit `excludePaths`
- **Never** visit same URL twice
- **Always** deduplicate dynamic routes
- **Always** dismiss cookie banners / popups before recording
- **If redirected to login** → `playwright-cli state-load <project>/output/session.json` then retry
- **If page errors (404/500)** → save with `"status": "error"`, continue

---

## Step 9 — QA Intelligence Synthesis

By now you have visited every page and accumulated `qaObservations` throughout
the crawl. You already have a growing understanding of the app. This step is
where you **synthesize** that understanding into a structured report.

Read all files in `<project>/output/knowledge/pages/`, paying special attention to the
`qaObservations` you recorded on each page. Then connect the dots across pages.

**Goal:** Produce an intelligence report that demonstrates real understanding of the
app's domain, data model, business flows, and testing gaps — and proposes concrete
next actions. This is not a UI checklist — it's the analysis a senior QA engineer
would write after spending a day exploring the app.

### Phase A — Synthesize your understanding

Review all page files and your accumulated observations. Answer these questions:

1. **What is this application?** What domain does it serve? (e-commerce, education,
   healthcare, SaaS admin, etc.)
2. **What are the core entities?** (Users, Products, Orders, Classes, etc.) How do
   they relate to each other? Build a mental data model.
3. **Who are the actors?** What types of users exist? What are their goals? How do
   their journeys differ? (Don't just look for role dropdowns — infer from navigation
   structure, page names, dashboard variants, and the data model itself.)
4. **What are the critical business flows?** Not just page-to-page navigation, but
   the meaningful user journeys (e.g., "Teacher creates a class → assigns students →
   grades assignments → students view results").
5. **What data states matter?** Think about what happens when:
   - An entity has zero related items (empty class, user with no orders)
   - An entity is at capacity or limit
   - An entity is referenced by others and then deleted (cascade effects)
   - Data is in a transitional state (pending, processing, expired)

### Phase B — Reason about what needs testing

Based on your understanding, reason about testing gaps. Think about:

**Business logic risks:**
- What happens when entities are connected and one is modified/deleted?
  (e.g., delete a teacher who is assigned to active classes)
- What are the boundary conditions for business rules?
  (e.g., maximum students per class, enrollment deadlines)
- Where could race conditions or conflicting actions occur?
  (e.g., two users editing the same entity, concurrent enrollments)

**Data state edge cases:**
- What does each list/table page look like with zero items?
- What happens when required relationships are missing?
  (e.g., a student not enrolled in any class, a class with no teacher)
- Are there time-sensitive states? (expired subscriptions, past-due dates)

**Permission boundaries:**
- If you detected a role/permission system, what should each role be able to do
  vs. not do? Reason about this from the business logic, not just what buttons
  you saw.
- Are there actions that should require elevated permissions that you saw available
  without restriction?

**User journey completeness:**
- Can you trace each critical flow from start to finish?
- Are there flows where you can see the start but not the end? (might indicate
  missing pages or flows gated behind conditions)
- What happens when a user abandons a multi-step flow midway?

### Phase C — Write the intelligence report

Write `<project>/output/knowledge/qa-intelligence.json`:

```json
{
  "analyzedAt": "2026-04-16T10:00:00.000Z",
  "totalPages": 15,
  "appUnderstanding": {
    "domain": "Education platform for English language learning",
    "description": "A multi-tenant academy management system where admins manage branches, teachers, and students. Teachers create and manage classes with practice exercises. Students enroll in classes and complete practices.",
    "coreEntities": [
      {
        "name": "User",
        "types": ["Admin", "Teacher", "Student"],
        "managedAt": ["/dashboard/users"],
        "relationships": "Teachers are assigned to Classes. Students enroll in Classes."
      },
      {
        "name": "Class",
        "managedAt": ["/dashboard/classes"],
        "relationships": "Belongs to a Branch. Has one Teacher. Has many Students. Contains Practices."
      }
    ],
    "actors": [
      {
        "role": "Admin",
        "goals": "Manages the entire platform — users, branches, classes, content",
        "journeyScope": "Full access to all pages"
      },
      {
        "role": "Teacher",
        "goals": "Manages their assigned classes, creates practices, views student progress",
        "journeyScope": "Likely limited to class management and student-facing features"
      },
      {
        "role": "Student",
        "goals": "Enrolls in classes, completes practices, views their progress",
        "journeyScope": "Likely limited to their enrolled classes and practice content"
      }
    ],
    "criticalFlows": [
      "Admin creates branch → creates class in branch → assigns teacher → students enroll",
      "Teacher creates practice → assigns to class → students complete it",
      "Admin creates user with role → user can login and access role-appropriate features"
    ]
  },
  "observations": [
    {
      "category": "permission-boundaries",
      "severity": "high",
      "finding": "3 distinct user roles detected. Currently crawled as admin only — teacher and student experiences are unknown.",
      "reasoning": "User management pages show role assignment. Navigation likely differs per role. Teachers probably cannot manage users or branches. Students probably cannot manage classes.",
      "recommendation": "Provide teacher and student credentials to run differential crawl (skills/07-multi-role-crawl-skill.md). This will reveal what each role can and cannot access.",
      "pagesInvolved": ["/dashboard/users", "/dashboard/users/create"]
    },
    {
      "category": "data-integrity",
      "severity": "high",
      "finding": "Deleting a teacher who is assigned to active classes could orphan those classes.",
      "reasoning": "Classes reference teachers. Delete button exists on user edit page. No evidence of cascade protection or reassignment flow.",
      "recommendation": "Test: create teacher → assign to class → delete teacher. Verify class handles missing teacher gracefully.",
      "pagesInvolved": ["/dashboard/users/:id/edit", "/dashboard/classes/:id"]
    },
    {
      "category": "empty-state",
      "severity": "medium",
      "finding": "Class detail page may break or show confusing UI when class has zero enrolled students.",
      "reasoning": "Class page shows student list. If no students are enrolled, the page might show an empty table, an error, or no feedback at all.",
      "recommendation": "Test: create a new class with no students and verify the page renders correctly with helpful empty state messaging.",
      "pagesInvolved": ["/dashboard/classes/:id"]
    }
  ],
  "summary": {
    "totalObservations": 12,
    "bySeverity": { "critical": 1, "high": 4, "medium": 5, "low": 2 }
  },
  "nextActions": [
    {
      "priority": 1,
      "action": "Multi-role differential crawl",
      "why": "3 user roles detected but only admin perspective crawled. Teacher and student experiences are completely unknown.",
      "requiresUserInput": true,
      "userInputNeeded": "Credentials for teacher and student accounts",
      "command": "Read skills/07-multi-role-crawl-skill.md and execute multi-role differential crawl. Credentials: teacher=<email>/<password>, student=<email>/<password>"
    },
    {
      "priority": 2,
      "action": "Generate tests for critical flows",
      "why": "Core business flows identified (user creation, class management, enrollment). Tests should be generated while knowledge is fresh.",
      "requiresUserInput": false,
      "command": "Read skills/04-test-generation-skill.md and generate tests for all critical flows"
    },
    {
      "priority": 3,
      "action": "Generate page objects",
      "why": "15 pages crawled with locators. Page objects enable maintainable test code.",
      "requiresUserInput": false,
      "command": "Read skills/06-page-objects-skill.md and generate page objects for all pages"
    }
  ]
}
```

### Phase D — Propose next actions

Based on your analysis, think about what should happen next. Consider:

- What testing gaps are most critical to close?
- What actions can be taken immediately vs. what needs user input?
- What is the logical order of next steps?

Populate the `nextActions` array with concrete, prioritized steps. Each action should have:
- A clear description of what to do
- **Why** it matters (tied to your observations)
- Whether it needs user input (e.g., credentials, confirmation)
- The exact command to run it

**Think freely.** The patterns table and examples above are just starting points. Every
app is different. A healthcare app needs HIPAA-related observations. An e-commerce app
needs payment flow analysis. A social platform needs content moderation observations.
Reason from the domain, not from a checklist.

### Console output

After writing the file, print a human-readable summary:

```
=== QA Intelligence Report ===

App: Education platform — academy management with branches, classes, practices
Entities: Users (Admin/Teacher/Student), Branches, Classes, Practices, Lessons
Actors: Admin (full access), Teacher (class management), Student (learning)
Pages analyzed: 15

Key findings:
  HIGH: 3 user roles detected — only admin perspective crawled so far
  HIGH: Cascade risk — deleting teacher/branch may orphan related classes
  HIGH: Student enrollment flow not fully traced
  MEDIUM: 5 list pages need empty state testing
  MEDIUM: 8 forms need validation boundary testing

Proposed next actions:
  1. [NEEDS INPUT] Multi-role crawl — provide teacher/student credentials
     → Run: Read skills/07-multi-role-crawl-skill.md ...
  2. Generate tests for critical flows
     → Run: Read skills/04-test-generation-skill.md ...
  3. Generate page objects for all pages
     → Run: Read skills/06-page-objects-skill.md ...

Full report: <project>/output/knowledge/qa-intelligence.json
```

---

## End of Phase 1

When queue is empty:
- Execute Step 9 (QA Intelligence Analysis)
- Print: `Phase 1 complete — X pages crawled, Y observations found`
- Present next actions and wait for user to choose which to execute
- If user says "continue" or "proceed", execute Phase 2 (synthesize-skill.md)
