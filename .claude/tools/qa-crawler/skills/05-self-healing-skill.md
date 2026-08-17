# Skill: Self-Healing — Fix Failing Tests & Update Knowledge Base

Use this skill when tests fail. Claude Code reads the failure,
re-explores the broken element, fixes the test, and updates the
knowledge base so the same error doesn't happen again.

---

## Path Convention

All paths are relative to the **active project directory** (`projects/<project-name>/`).
- `<project>` = `projects/<project-name>` (e.g., `projects/odc-academy`)
- `output/` = `<project>/output/`
- `tests/` = `<project>/tests/`

---

## Trigger

User says something like:
- "fix failing tests"
- "tests are failing, fix them"
- "playwright test failed, here's the error"

---

## Step 1 — Read the Failure

Run or read the test output:
```bash
npx playwright test --reporter=list 2>&1
```

Identify:
- Which test file failed
- Which line failed
- What the error message says (element not found, timeout, wrong assertion...)

Common failure types:

| Error | Likely Cause |
|---|---|
| `locator not found` | UI changed, element moved or renamed |
| `timeout waiting for element` | Page loads slower, or element is now behind interaction |
| `expected X to have URL Y` | Redirect flow changed |
| `expected visible, got hidden` | Element now conditionally shown |

---

## Step 2 — Re-explore the Failing Element

Open the browser and navigate to the failing page:

```bash
playwright-cli open <failing-page-url>
playwright-cli snapshot
```

Read the snapshot. Find the element that the test was trying to interact with.

Questions to answer:
- Is the element still there? (renamed, moved, removed?)
- Has its accessible name changed?
- Is it now inside a modal or behind a click?
- Has a `data-testid` been added or changed?

---

## Step 3 — Find the New Locator

From the snapshot, identify the best new locator using priority order:
1. `role=` + accessible name
2. `label=` for inputs
3. `[data-testid=]`
4. CSS id
5. CSS class (stable-looking only)

Test the locator works:
```bash
playwright-cli click "role=button[name='New Label']"
playwright-cli snapshot  # verify it worked
```

---

## Step 4 — Fix the Locator in the Page Object

Find the page object file in `<project>/tests/pages/<PageName>Page.ts`.
Update the broken locator property — **one change fixes all tests using it**:

```typescript
// Before (broken):
this.saveButton = page.locator("role=button[name='Save']");

// After (fixed):
// Updated 2026-04-08: label changed from 'Save' to 'Save Changes'
this.saveButton = page.locator("role=button[name='Save Changes']");
// fallback: #save-btn
```

Never fix locators inside test files directly.
If a test file has a raw `page.locator()` call that broke → move it to the page object first, then fix it there.

---

## Step 5 — Update the Knowledge Base

Find the page file in `<project>/output/knowledge/pages/`.
Update the element with:
- New `locator`
- New `fallback` if changed
- Update `lastVerified` date
- Add a `changeNote` explaining what changed

```json
{
  "name": "Save Changes button",
  "type": "button",
  "locator": "role=button[name='Save Changes']",
  "fallback": "#save-btn",
  "destructive": false,
  "lastVerified": "2026-04-08",
  "changeNote": "Label changed from 'Save' to 'Save Changes' on 2026-04-08"
}
```

---

## Step 6 — Check for Other Affected Page Objects

Search all page object files for the old locator:
```bash
grep -r "old-locator-string" <project>/tests/pages/
```

If found in other page objects → fix those too.
Then update knowledge base for each fix.
All tests using those page objects automatically benefit — no test file changes needed.

---

## Step 7 — Verify

Run the fixed test:
```bash
npx playwright test <fixed-test-file>
```

If it passes → report success.
If still failing → repeat from Step 2.

---

## End Report

```
✅ Self-healing complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Tests fixed:     2
  Locators updated: 3
  Knowledge base:  updated
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Changes made:
  - <project>/tests/checkout-flow.spec.ts line 24: updated payment button locator
  - <project>/tests/settings-profile.spec.ts line 11: updated save button locator
  - <project>/output/knowledge/pages/checkout-payment.json: locator updated
  - <project>/output/knowledge/pages/settings-profile.json: locator updated
```
