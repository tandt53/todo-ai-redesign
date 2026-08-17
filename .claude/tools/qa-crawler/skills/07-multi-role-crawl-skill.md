# Skill: Multi-Role Differential Crawl

This skill performs a **differential crawl** for additional user roles. It requires
that Phase 1 (skill 02) has already been completed with an admin/primary account,
and that `<project>/output/knowledge/qa-intelligence.json` exists with role observations.

**Purpose:** Discover what each role can and cannot see or do, compared to the
admin baseline. This is NOT a full re-crawl — it visits the same pages the admin
crawl already found and records differences.

---

## Path Convention

All paths are relative to the **active project directory** (`projects/<project-name>/`).
- `<project>` = `projects/<project-name>` (e.g., `projects/odc-academy`)
- `output/` = `<project>/output/`
- `tests/` = `<project>/tests/`

---

## Prerequisites

1. Phase 1 crawl completed (`<project>/output/knowledge/pages/*.json` exist)
2. `<project>/output/knowledge/qa-intelligence.json` exists with roles discovered
3. `<project>/output/knowledge/pageIndex.json` exists with route → file mapping
4. User has provided credentials for the roles to test

---

## Setup

1. Read `<project>/output/knowledge/qa-intelligence.json` — find the `roles-and-permissions`
   observation to know which roles were discovered
2. Read `<project>/output/knowledge/pageIndex.json` — get the list of all routes found during
   the admin crawl
3. Ask the user for credentials for each non-admin role (if not already provided):
   ```
   To perform a differential crawl, I need login credentials for these roles:
   - teacher
   - student
   Please provide: login URL, username, password (and selectors if different from admin)
   ```
4. Create output directories:
   ```
   <project>/output/knowledge/roles/<role>/
   ```

---

## Differential Crawl Loop

### For each role (in order provided):

**Step 1 — Login as this role**

```bash
playwright-cli open <baseUrl><loginUrl>
playwright-cli snapshot
```
- Fill credentials using the selectors from `<project>/crawl.config.json` (or role-specific ones if provided)
- Submit login form
- Verify login success via snapshot
- Read alerts: `playwright-cli eval "window.__qaReadAlerts()"`
- Save session: `playwright-cli state-save ./<project>/output/session-<role>.json`

**Step 2 — Visit every page from the admin crawl**

For each route in `pageIndex.json`:

```bash
playwright-cli goto <baseUrl><route>
playwright-cli snapshot
```

After navigating, determine the **access result**:

| What happened | Record as |
|---------------|-----------|
| Page loaded normally | `allowed` |
| Redirected to different page | `redirected` — note the destination |
| 403/401 error page shown | `forbidden` |
| 404 page shown | `not-found` |
| Redirected to login page | `auth-required` |
| Page loads but with fewer elements | `allowed-limited` |

For pages that are `allowed` or `allowed-limited`, also compare:
- **Missing elements:** Buttons/links visible to admin but not to this role
  (e.g., Delete button gone, Admin nav link missing)
- **Missing nav links:** Navigation items present for admin but absent here
- **Different content:** Dashboard showing different data, different menu structure
- **Disabled elements:** Buttons that exist but are disabled for this role

**Step 3 — Discover role-specific pages**

While visiting pages, check for navigation links that were NOT in the admin crawl:
- A student might have a "My Courses" page that admin doesn't see
- A teacher might have a "My Classes" grading view

If new links are found, visit them and record as new pages specific to this role.

**Step 4 — Read alerts before leaving each page**

```bash
playwright-cli eval "window.__qaReadAlerts()"
playwright-cli eval "window.__qaClearAlerts()"
```

Record any permission-related alerts (e.g., "You don't have permission to view this page").

**Step 5 — Save role access results**

Write `<project>/output/knowledge/roles/<role>/access.json`:

```json
{
  "role": "teacher",
  "crawledAt": "2026-04-16T14:00:00.000Z",
  "baselineRole": "admin",
  "totalPagesChecked": 15,
  "results": {
    "allowed": 8,
    "allowed-limited": 2,
    "forbidden": 3,
    "redirected": 2,
    "not-found": 0,
    "auth-required": 0
  },
  "pages": [
    {
      "route": "/dashboard/users",
      "access": "forbidden",
      "detail": "Redirected to /dashboard with alert: 'Access denied'",
      "alertsObserved": ["Access denied"]
    },
    {
      "route": "/dashboard/classes",
      "access": "allowed-limited",
      "detail": "Page loads but Create Class button is missing",
      "missingElements": [
        "Create Class button (role=button[name='Create Class'])",
        "Delete column in table"
      ],
      "missingNavLinks": ["/dashboard/users", "/dashboard/branches"]
    },
    {
      "route": "/dashboard/my-classes",
      "access": "allowed",
      "detail": "Full access — same as admin view",
      "missingElements": [],
      "missingNavLinks": []
    }
  ],
  "newPages": [
    {
      "route": "/dashboard/my-schedule",
      "detail": "Teacher-only page not visible to admin",
      "summary": "Shows teacher's weekly class schedule"
    }
  ]
}
```

---

## After All Roles Are Crawled

### Build Permission Matrix

Read all `<project>/output/knowledge/roles/<role>/access.json` files and produce
`<project>/output/knowledge/permissionMatrix.json`:

```json
{
  "generatedAt": "2026-04-16T14:30:00.000Z",
  "roles": ["admin", "teacher", "student"],
  "matrix": {
    "/dashboard": {
      "admin": "allowed",
      "teacher": "allowed",
      "student": "allowed"
    },
    "/dashboard/users": {
      "admin": "allowed",
      "teacher": "forbidden",
      "student": "forbidden"
    },
    "/dashboard/classes": {
      "admin": "allowed",
      "teacher": "allowed-limited",
      "student": "forbidden"
    },
    "/dashboard/my-schedule": {
      "admin": "not-found",
      "teacher": "allowed",
      "student": "not-found"
    }
  },
  "roleSpecificPages": {
    "teacher": ["/dashboard/my-schedule"],
    "student": ["/dashboard/my-courses"]
  },
  "elementDifferences": [
    {
      "page": "/dashboard/classes",
      "element": "Create Class button",
      "admin": "visible",
      "teacher": "missing",
      "student": "missing"
    },
    {
      "page": "/dashboard/classes",
      "element": "Delete column",
      "admin": "visible",
      "teacher": "missing",
      "student": "missing"
    }
  ]
}
```

### Print Summary

```
=== Multi-Role Differential Crawl Complete ===

Roles tested: admin (baseline), teacher, student
Pages checked per role: 15

Permission Summary:
  teacher: 8 allowed, 2 limited, 3 forbidden, 2 redirected
  student: 5 allowed, 1 limited, 6 forbidden, 3 redirected

Role-specific pages discovered:
  teacher: /dashboard/my-schedule (new)
  student: /dashboard/my-courses (new)

Key differences:
  - /dashboard/users: admin only
  - /dashboard/classes: teacher has limited access (no create/delete)
  - /dashboard/branches: admin only

Output files:
  - <project>/output/knowledge/roles/teacher/access.json
  - <project>/output/knowledge/roles/student/access.json
  - <project>/output/knowledge/permissionMatrix.json
```

---

## Safety Rules

- **Never** click destructive actions while testing access — only observe their presence/absence
- **Never** submit forms as non-admin roles — only check if forms are visible
- **Never** modify data as non-admin roles
- **If redirected to login** → record as `auth-required`, do not re-login mid-crawl
- **If page errors** → record the error type, continue to next page
- Reuse admin crawl selectors from `<project>/crawl.config.json` for login unless role-specific selectors are provided

---

## When to Use This Skill

Run this skill when:
- The QA Intelligence Report (from Phase 1) detected a role/permission system
- The user has provided credentials for additional roles
- You want to understand permission boundaries across the application

**Invoke with:**
```
Read skills/07-multi-role-crawl-skill.md and execute multi-role differential crawl
Credentials: teacher=teacher@example.com/Pass123, student=student@example.com/Pass123
```
