# Skill: Test Generation from Knowledge Base

Use this skill when asked to generate Playwright tests.
Tests ALWAYS use page objects — never raw locators inline.
The knowledge base already has everything: locators, alerts, flows.

---

## Path Convention

All paths are relative to the **active project directory** (`projects/<project-name>/`).
- `<project>` = `projects/<project-name>` (e.g., `projects/odc-academy`)
- `output/` = `<project>/output/`
- `tests/` = `<project>/tests/`

---

## Step 1 — Check if Page Objects Exist

Before generating tests, check `<project>/tests/pages/` for existing page objects.

- If page objects exist → use them directly
- If missing → read `skills/06-page-objects-skill.md` and generate them first, then write tests

---

## Step 2 — Read the Knowledge

For a **flow-based test** (recommended):
```
Read <project>/output/knowledge/flows/<flow-name>.json
For each step, read <project>/output/knowledge/pages/<page-file>.json
Check <project>/tests/pages/<PageName>Page.ts exists for each page
```

For a **page-based test**:
```
Read <project>/output/knowledge/pages/<page-file>.json
Check <project>/tests/pages/<PageName>Page.ts exists
```

---

## Step 3 — Write the Test

Tests import from page objects. Never use raw `page.locator()` in test files.

**Flow test template:**
```typescript
import { test, expect } from '@playwright/test';
import { LoginPage, DashboardPage, CheckoutPage } from './pages';

test.describe('Checkout Flow', () => {

  test.use({ storageState: '<project>/output/session.json' });

  test('happy path — complete purchase successfully', async ({ page }) => {
    const checkout = new CheckoutPage(page);
    const confirm = new CheckoutConfirmPage(page);

    await checkout.goto();
    await checkout.fillShippingAddress({
      name: 'John Doe',
      address: '123 Main St',
      city: 'Sydney'
    });
    await checkout.proceedToPayment();
    await checkout.fillPaymentDetails({
      card: '4242424242424242',
      expiry: '12/28',
      cvv: '123'
    });
    await checkout.placeOrder();

    // Assert from knowledge base alertsObserved
    await confirm.expectOrderConfirmed();
    await confirm.expectSuccessAlert();
  });

  test('negative — invalid card shows error', async ({ page }) => {
    const checkout = new CheckoutPage(page);

    await checkout.goto();
    await checkout.fillPaymentDetails({ card: '0000000000000000' });
    await checkout.placeOrder();

    // From alertsObserved: { text: "Your card was declined", type: "error" }
    await checkout.expectCardDeclinedError();
  });

  test('negative — empty fields show validation errors', async ({ page }) => {
    const checkout = new CheckoutPage(page);

    await checkout.goto();
    await checkout.placeOrder(); // submit without filling

    await checkout.expectValidationErrors();
  });

});
```

**Page test template:**
```typescript
import { test } from '@playwright/test';
import { SettingsProfilePage } from './pages';

test.describe('Settings — Profile Page', () => {

  test.use({ storageState: '<project>/output/session.json' });

  test('happy path — update email successfully', async ({ page }) => {
    const settingsPage = new SettingsProfilePage(page);

    await settingsPage.goto();
    await settingsPage.expectPageLoaded();
    await settingsPage.updateProfile({ email: 'new@example.com' });
    await settingsPage.expectSaveSuccess();
  });

  test('negative — duplicate email shows error', async ({ page }) => {
    const settingsPage = new SettingsProfilePage(page);

    await settingsPage.goto();
    await settingsPage.updateProfile({ email: 'existing@example.com' });
    await settingsPage.expectEmailAlreadyInUse();
  });

});
```

---

## Step 4 — Scenarios to Generate per Flow/Page

Always generate at minimum:
1. **Happy path** — everything works, assert success alert
2. **Validation errors** — empty/invalid inputs, assert error alerts
3. **Edge cases** — from `alternativePaths` in flow knowledge

Use `alertsObserved` from knowledge base for all alert assertions:
- `success` type → happy path assertions
- `error` type → negative scenario assertions
- `warning` type → conditional scenario assertions

---

## File Naming

| Scope | Test file |
|---|---|
| Checkout Flow | `<project>/tests/flows/checkout-flow.spec.ts` |
| Auth Flow | `<project>/tests/flows/auth-flow.spec.ts` |
| /settings/profile page | `<project>/tests/pages/settings-profile.spec.ts` |
| /dashboard page | `<project>/tests/pages/dashboard.spec.ts` |

---

## After Generating

```
✅ Generated:
   <project>/tests/pages/SettingsProfilePage.ts   ← page object
   <project>/tests/flows/checkout-flow.spec.ts    ← 3 scenarios
   <project>/tests/pages/settings-profile.spec.ts ← 2 scenarios

Run with:
  npx playwright test <project>/tests/flows/checkout-flow.spec.ts

If tests fail:
  "fix failing tests in <project>/tests/flows/checkout-flow.spec.ts"
```
