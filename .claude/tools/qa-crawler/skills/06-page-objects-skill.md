# Skill: Page Object Generation

Use this skill to generate Page Object classes from the knowledge base.
Page objects are the single source of truth for locators.
Tests never hardcode locators — they always use page objects.

---

## Path Convention

All paths are relative to the **active project directory** (`projects/<project-name>/`).
- `<project>` = `projects/<project-name>` (e.g., `projects/odc-academy`)
- `output/` = `<project>/output/`
- `tests/` = `<project>/tests/`

---

## When to Run

- After Phase 1 + 2 (crawl + synthesize) completes
- When a new page is added to the knowledge base
- When the knowledge base is updated after self-healing

---

## Output Location

```
<project>/tests/pages/<PageName>Page.ts
```

One file per page in the knowledge base.

---

## Naming Convention

| Route | Class Name | File |
|---|---|---|
| `/dashboard` | `DashboardPage` | `<project>/tests/pages/DashboardPage.ts` |
| `/settings/profile` | `SettingsProfilePage` | `<project>/tests/pages/SettingsProfilePage.ts` |
| `/users/:id` | `UserDetailPage` | `<project>/tests/pages/UserDetailPage.ts` |
| `/checkout/payment` | `CheckoutPaymentPage` | `<project>/tests/pages/CheckoutPaymentPage.ts` |

---

## Page Object Template

For each `<project>/output/knowledge/pages/<page>.json`, generate:

```typescript
import { Page, Locator, expect } from '@playwright/test';

/**
 * <Page Title>
 * <summary from knowledge base>
 *
 * Route: <route>
 * Priority: <testPriority>
 * Last crawled: <crawledAt>
 */
export class <PageName>Page {
  readonly page: Page;
  readonly url = '<route>';

  // ── Locators ──────────────────────────────────────────

  // <element description>
  readonly <camelCaseName>: Locator;

  // Forms
  readonly <formFieldName>: Locator;

  // Alerts (observed during crawl)
  readonly successAlert: Locator;
  readonly errorAlert: Locator;

  constructor(page: Page) {
    this.page = page;

    // Elements
    this.<camelCaseName> = page.locator('<locator>');

    // Form fields
    this.<formFieldName> = page.locator('<locator>');

    // Alerts — using ARIA roles (framework-agnostic)
    this.successAlert = page.locator('[role="status"], [role="alert"]');
    this.errorAlert = page.locator('[role="alert"]');
  }

  // ── Navigation ────────────────────────────────────────

  async goto() {
    await this.page.goto(this.url);
  }

  // ── Actions ───────────────────────────────────────────

  // One method per meaningful user action on this page
  async <actionName>(<params>) {
    // steps
  }

  // ── Assertions ────────────────────────────────────────

  // One method per observed alert or expected state
  async expect<StateName>() {
    // assertion
  }
}
```

---

## Full Example

Given `<project>/output/knowledge/pages/settings-profile.json`:
```json
{
  "route": "/settings/profile",
  "title": "Profile Settings",
  "summary": "Allows users to update personal info, avatar, and password.",
  "testPriority": "high",
  "elements": [
    { "name": "Save Changes button", "locator": "role=button[name='Save Changes']", "fallback": "#save-btn", "destructive": false },
    { "name": "Delete Account button", "locator": "role=button[name='Delete Account']", "fallback": "#delete-account", "destructive": true }
  ],
  "forms": [
    {
      "name": "Profile form",
      "fields": [
        { "name": "Full Name", "type": "text", "locator": "label='Full Name'", "fallback": "#full-name" },
        { "name": "Email address", "type": "email", "locator": "label='Email address'", "fallback": "#email" }
      ],
      "submitLocator": "role=button[name='Save Changes']"
    }
  ],
  "alertsObserved": [
    { "text": "Profile saved successfully", "type": "success" },
    { "text": "Email address is already in use", "type": "error" }
  ]
}
```

Generate:

```typescript
import { Page, Locator, expect } from '@playwright/test';

/**
 * Profile Settings Page
 * Allows users to update personal info, avatar, and password.
 *
 * Route: /settings/profile
 * Priority: high
 * Last crawled: 2026-04-08
 */
export class SettingsProfilePage {
  readonly page: Page;
  readonly url = '/settings/profile';

  // ── Locators ──────────────────────────────────────────

  // Profile form fields
  readonly fullNameField: Locator;
  readonly emailField: Locator;

  // Actions
  readonly saveButton: Locator;
  readonly deleteAccountButton: Locator; // ⚠️ destructive

  // Alerts (observed during crawl)
  readonly successAlert: Locator;
  readonly errorAlert: Locator;

  constructor(page: Page) {
    this.page = page;

    // Form fields
    this.fullNameField = page.locator("label='Full Name'");
    this.emailField = page.locator("label='Email address'");

    // Buttons
    this.saveButton = page.locator("role=button[name='Save Changes']");
    this.deleteAccountButton = page.locator("role=button[name='Delete Account']");

    // Alerts — ARIA roles, framework-agnostic
    this.successAlert = page.locator('[role="status"], [role="alert"]');
    this.errorAlert = page.locator('[role="alert"]');
  }

  // ── Navigation ────────────────────────────────────────

  async goto() {
    await this.page.goto(this.url);
  }

  // ── Actions ───────────────────────────────────────────

  async updateProfile({ name, email }: { name?: string; email?: string }) {
    if (name) await this.fullNameField.fill(name);
    if (email) await this.emailField.fill(email);
    await this.saveButton.click();
  }

  // ── Assertions ────────────────────────────────────────

  async expectSaveSuccess() {
    await expect(this.successAlert).toContainText('Profile saved successfully');
  }

  async expectEmailAlreadyInUse() {
    await expect(this.errorAlert).toContainText('Email address is already in use');
  }

  async expectPageLoaded() {
    await expect(this.page).toHaveURL(this.url);
    await expect(this.saveButton).toBeVisible();
  }
}
```

---

## Index File

After generating all page objects, create `<project>/tests/pages/index.ts`:

```typescript
export { DashboardPage } from './DashboardPage';
export { SettingsProfilePage } from './SettingsProfilePage';
export { CheckoutPaymentPage } from './CheckoutPaymentPage';
// ... all pages
```

This lets tests import cleanly:
```typescript
import { SettingsProfilePage, DashboardPage } from '../pages';
```

---

## Rules

- **One locator per property** — never duplicate locators in methods
- **Fallback as comment only** — `// fallback: #save-btn`
- **Mark destructive elements** with `// ⚠️ destructive` comment
- **Never put assertions in constructors**
- **Actions = what users do** — named from user perspective, not technical
- **Assertions = what users expect** — named `expect<State>()`
- **Never use raw `page.locator()` in test files** — always go through page object
