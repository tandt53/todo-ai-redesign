# Skill: Scenario Executor

Execute test scenarios directly in the browser using `playwright-cli`. Accepts
both natural language descriptions and structured test definitions. Uses the
knowledge base for locators, navigation, and expected behavior.

---

## Path Convention

All paths are relative to the **active project directory** (`projects/<project-name>/`).
- `<project>` = `projects/<project-name>` (e.g., `projects/odc-academy`)
- `output/` = `<project>/output/`
- `tests/` = `<project>/tests/`

---

## When to Use

- User provides specific test cases to execute (not generate code for)
- User wants to verify a flow works end-to-end in the live app
- User wants to test a scenario the crawl identified as risky
- User wants quick ad-hoc testing without writing Playwright test files

**This skill executes scenarios live.** It does NOT generate test code files —
use `skills/04-test-generation-skill.md` for that.

---

## Prerequisites

1. Knowledge base exists (`<project>/output/knowledge/pages/*.json`)
   - If not: run Phase 1 crawl first (`skills/02-crawl-skill.md`)
2. Browser can reach the target app (`baseUrl` from `<project>/crawl.config.json`)
3. Auth session available if app requires login (`<project>/output/session.json`)

---

## Input Formats

### Natural language (ad-hoc)

User provides scenarios in plain English:

```
Execute these scenarios:
1. Login as admin, create a new user with role Teacher, verify success message
2. Go to classes page, create a class, assign it to a teacher, verify it appears in the list
3. Try to access /dashboard/users as a student — should be denied
```

### Structured format (repeatable)

User provides a JSON or YAML file, or inline definition:

```json
{
  "scenarios": [
    {
      "name": "Create teacher user",
      "preconditions": ["logged in as admin"],
      "steps": [
        { "action": "navigate", "target": "/dashboard/users/create" },
        { "action": "fill", "field": "Full Name", "value": "Test Teacher" },
        { "action": "fill", "field": "Email", "value": "test-teacher-{{timestamp}}@test.local" },
        { "action": "select", "field": "Role", "value": "Teacher" },
        { "action": "fill", "field": "Password", "value": "TestPass@123" },
        { "action": "click", "target": "Create User button" },
        { "action": "assert", "type": "alert", "expected": "User created successfully" }
      ]
    }
  ]
}
```

---

## Execution Flow

### Step 1 — Parse the scenarios

Read the user's input and break it into discrete scenarios. For each scenario, identify:
- **Preconditions** — what state is needed before starting? (logged in as X, on page Y,
  data exists Z)
- **Steps** — the sequence of actions to perform
- **Expected outcomes** — what should happen at the end (alerts, redirects, page state)

For natural language input, use the knowledge base to resolve vague references:
- "create a new user" → navigate to `/dashboard/users/create`, fill the form, submit
- "verify success message" → check `alertsObserved` from knowledge base to know what
  the success message text should be
- "classes page" → `/dashboard/classes` (from `pageIndex.json`)

### Step 2 — Resolve locators from knowledge base

Before executing, look up every element reference in the knowledge base:

1. Read `<project>/output/knowledge/pageIndex.json` to find page files
2. For each page involved in the scenario, read its JSON file
3. Map scenario references to actual locators:

| Scenario says | Knowledge base lookup | Resolved locator |
|---------------|----------------------|------------------|
| "Full Name field" | page forms[].fields[] where name matches | `label='Full Name'` |
| "Create User button" | page elements[] where name matches | `role=button[name='Create User']` |
| "Role dropdown" | page forms[].fields[] where name="Role" | `label='Role'` |
| "success message" | page alertsObserved[] where type="success" | Expected text: "User created successfully" |

**If a locator is not in the knowledge base:** Take a snapshot of the current page
and find the element directly. This handles cases where the crawl didn't capture
everything or the UI has changed.

### Step 3 — Handle preconditions

Before executing scenario steps:

**Login preconditions:**
- "logged in as admin" → `playwright-cli state-load ./<project>/output/session.json`
- "logged in as teacher" → `playwright-cli state-load ./<project>/output/session-teacher.json`
  (if exists, otherwise login manually using provided credentials)
- No login mentioned → assume current session or load default session

**Navigation preconditions:**
- "on the classes page" → `playwright-cli goto <baseUrl>/dashboard/classes`
- "user X exists" → note as assumption, warn if can't verify

**Data preconditions:**
- If a scenario requires data to exist (e.g., "a class with students"), note it
  as an assumption in the report. Don't create test data unless the scenario
  explicitly asks for it.

### Step 4 — Execute steps

For each step in the scenario:

```bash
# Navigate
playwright-cli goto <url>
playwright-cli snapshot

# Fill fields
playwright-cli fill <locator> "<value>"

# Click buttons
playwright-cli click <locator>

# Select dropdown options
playwright-cli select <locator> "<value>"

# Wait for navigation/loading after actions
playwright-cli snapshot

# Read alerts after actions that trigger them
playwright-cli eval "window.__qaReadAlerts()"
```

**Between each step:**
1. Take a snapshot to verify the page is in the expected state
2. If something unexpected happens (error page, redirect, unexpected alert),
   record it but continue executing remaining steps
3. Read alerts after any action that might trigger feedback (form submit,
   button click, navigation)

**Dynamic values:** Replace placeholders in test data:
- `{{timestamp}}` → current Unix timestamp (for unique emails, names)
- `{{date}}` → today's date in YYYY-MM-DD format
- `{{random}}` → random 6-digit number

### Step 5 — Verify expected outcomes

After executing all steps, check the expected outcomes:

| Assertion type | How to verify |
|----------------|---------------|
| **Alert/toast** | `playwright-cli eval "window.__qaReadAlerts()"` — check text matches |
| **Redirect** | Compare current URL to expected URL after snapshot |
| **Element visible** | Snapshot the page, look for element in output |
| **Element not visible** | Snapshot the page, confirm element is absent |
| **Page content** | Snapshot and check for expected text/data |
| **Error state** | Check for error alerts, error CSS classes, validation messages |

### Step 6 — Record results

After each scenario, record the result:

```
Scenario: Create teacher user
Status: PASS ✅
Steps executed: 7/7
Duration: ~12 seconds
Details:
  ✅ Navigated to /dashboard/users/create
  ✅ Filled Full Name: "Test Teacher"
  ✅ Filled Email: "test-teacher-1713272400@test.local"
  ✅ Selected Role: "Teacher"
  ✅ Filled Password: "TestPass@123"
  ✅ Clicked Create User button
  ✅ Alert observed: "User created successfully"
```

Or on failure:

```
Scenario: Create teacher user
Status: FAIL ❌
Steps executed: 5/7
Failed at: Step 6 — Click Create User button
Details:
  ✅ Navigated to /dashboard/users/create
  ✅ Filled Full Name: "Test Teacher"
  ✅ Filled Email: "test-teacher-1713272400@test.local"
  ✅ Selected Role: "Teacher"
  ✅ Filled Password: "TestPass@123"
  ❌ Clicked Create User button → expected success alert, got error:
     "Email address is already in use"
  ⏭️ Skipped: Alert assertion (dependent on previous step)
```

---

## Output

Write execution results to `<project>/output/knowledge/scenario-results.json`:

```json
{
  "executedAt": "2026-04-16T14:00:00.000Z",
  "totalScenarios": 3,
  "passed": 2,
  "failed": 1,
  "results": [
    {
      "name": "Create teacher user",
      "status": "pass",
      "stepsTotal": 7,
      "stepsExecuted": 7,
      "duration": "~12s",
      "steps": [
        { "action": "navigate /dashboard/users/create", "status": "pass" },
        { "action": "fill Full Name = 'Test Teacher'", "status": "pass" },
        { "action": "assert alert 'User created successfully'", "status": "pass" }
      ]
    },
    {
      "name": "Access users page as student",
      "status": "fail",
      "stepsTotal": 3,
      "stepsExecuted": 3,
      "failedAt": "Step 3 — assert access denied",
      "actual": "Page loaded normally instead of showing access denied",
      "steps": [
        { "action": "load session-student.json", "status": "pass" },
        { "action": "navigate /dashboard/users", "status": "pass" },
        { "action": "assert access denied", "status": "fail", "actual": "Page rendered with full user list" }
      ]
    }
  ]
}
```

### Console summary

```
=== Scenario Execution Results ===

✅ PASS: Create teacher user (7/7 steps)
✅ PASS: Create class and assign teacher (9/9 steps)
❌ FAIL: Access users page as student
   Expected: access denied
   Actual: page loaded with full user list — PERMISSION BUG

Results: 2 passed, 1 failed out of 3 scenarios
Full report: <project>/output/knowledge/scenario-results.json
```

---

## Handling Failures

When a scenario step fails:

1. **Take a screenshot** — `playwright-cli screenshot --filename=fail-<scenario>-step<N>.png`
2. **Take a snapshot** — capture the actual page state
3. **Record the discrepancy** — expected vs actual
4. **Continue remaining scenarios** — don't abort the entire run
5. **Skip dependent steps** within the failed scenario — mark as skipped

---

## Safety Rules

- **Never** execute steps that delete or destroy production data unless the scenario
  explicitly says to test deletion AND the step is clearly labeled as destructive
- **Always** use test data identifiers (`test-`, `@test.local`) when creating entities
- **Always** read alerts after form submissions and button clicks
- **If redirected to login** → load session file, retry once, then fail the step
- **If element not found** → take snapshot, try fallback locator from knowledge base,
  then fail the step with details

---

## Example Invocations

**Natural language:**
```
Read skills/08-scenario-executor-skill.md and execute:
1. Login as admin and create a new student user
2. Verify the student appears in the user list
3. Edit the student and change their name
4. Verify the name change is reflected
```

**From the QA Intelligence Report:**
```
Read skills/08-scenario-executor-skill.md and execute the scenarios
recommended in <project>/output/knowledge/qa-intelligence.json
```

**Structured file:**
```
Read skills/08-scenario-executor-skill.md and execute scenarios from <project>/tests/scenarios/smoke-test.json
```
