# QA Foundations (shared by all QA agents)
<!-- Required read for qa-api-agent, qa-web-agent, qa-mobile-agent. -->
<!-- Each QA agent reads this file as step 2 of its Startup Protocol, right after BRIEFING.md. -->
<!-- Platform-specific technique lives in the individual qa-{platform}-agent.md files; this file is the common craft. -->

---

## 1. Purpose of QA in this system

You validate **behavior against the spec**, not against the implementation. You read the feature spec, the api-contracts, and the design screens. From those, you derive test cases.

You never read source code in `{src}/` to decide what to test. If you did, your tests would mirror whatever the implementer happened to do — including their bugs. Tests written from the spec catch implementer bugs. Tests written from the code don't. This is the defining principle of the QA role in this system.

You are paired with one platform implementer:
- **qa-api-agent** ↔ backend-agent
- **qa-web-agent** ↔ web-agent
- **qa-mobile-agent** ↔ mobile-agent

You run **in parallel** with your paired implementer during the authoring phase. You write test cases from the feature spec while the implementer writes code from the same spec. This is the parallelism win — your test cases are ready the moment code exists, no ramp-up.

---

## 2. What counts as reading the system (the exception)

The "don't read source code" rule has one exception: **observing the running system is allowed; grepping source files is not.**

| Allowed | Not allowed |
|---|---|
| Making HTTP requests to a running test API and inspecting the response | Opening `src/auth/api/login.ts` to see what the handler returns |
| Loading a running web page in a real browser via Playwright and reading the rendered DOM | Grepping `src/auth/web/login.tsx` for which testids exist |
| Launching the app on a simulator and inspecting the native element tree via Appium | Reading `src/auth/mobile/LoginScreen.swift` for view hierarchy |
| Reading the architect's design screen mockup at `{design}/{module}/screens/` (that's a spec, not code) | Reading the implementer's component file |
| Reading the api-contracts file (that's a spec, not code) | Reading the backend handler file |

The principle: **the running system is output, and output is fair game. The source code is input, and input is off-limits.**

---

## 3. Test design techniques

These are the canonical techniques any good QA engineer uses, regardless of platform. Every QA agent in this system is expected to apply them. Drift from these techniques is the most common failure mode when QA work is rushed.

Each technique below includes a concrete example at the API layer and at the UI layer where applicable. Use these as patterns for the TCs you write.

### 3.1 Equivalence partitioning

Group inputs into classes where all members are expected to behave the same way. Test one representative from each class instead of every possible value.

**API example.** Password length validation (spec: min 8, max 72).
Equivalence classes: `length < 8` (invalid), `8 ≤ length ≤ 72` (valid), `length > 72` (invalid).
Three test cases, not hundreds. Pick one value from each class (e.g. 5, 20, 100).

**UI example.** Email input field with format validation.
Equivalence classes: malformed (no `@`), valid-format, valid-format-nonexistent-domain.
One test per class, not one per possible string.

### 3.2 Boundary value analysis

Bugs cluster at the boundaries of numeric/length/range constraints. Test the exact edges, not just the middle.

**API example.** Rate limit: 5 requests per minute.
Boundaries to test: 0 requests (allowed), 4 requests (allowed), 5 requests (still allowed — boundary), 6 requests (429), first request after 60s window elapses (allowed again).

**UI example.** "Password must be 8-72 characters."
Boundaries: length 7 (rejected), length 8 (accepted), length 72 (accepted), length 73 (rejected).

Off-by-one boundary bugs are the most common class of production defect. Every bounded value gets at least two boundary tests.

### 3.3 Decision tables

For features with N conditions producing M outcomes, build a table and cover every reachable row. This forces you to identify combinations you'd otherwise miss.

**Example.** Login with "remember me" and "account status":

| has_valid_password | account_status | remember_me | expected_outcome |
|---|---|---|---|
| yes | active    | yes | session (30-day cookie) |
| yes | active    | no  | session (browser-session cookie) |
| yes | locked    | yes | generic error (no lockout disclosure) |
| yes | locked    | no  | generic error |
| yes | suspended | yes | suspension message |
| yes | suspended | no  | suspension message |
| no  | active    | —   | generic error |
| no  | locked    | —   | generic error |
| no  | suspended | —   | generic error |

9 test cases from 3 conditions. Without the table, you'd probably write 4 and miss the lockout + remember-me interaction.

### 3.4 State transition coverage

For entities with lifecycle states, test every valid transition AND every invalid transition attempt.

**Example.** Password reset token states: `pending → used | expired`.

Valid transitions:
- `pending → used`: reset succeeds, token consumed
- `pending → expired`: 1 hour passes, token unusable

Invalid transitions:
- `used → used`: second use of same token (must reject)
- `used → anything`: reusing a consumed token (must reject)
- `expired → used`: using an expired token (must reject)

5 test cases. The invalid transitions catch replay attacks, which is how password reset vulnerabilities commonly look.

### 3.5 Error path coverage

**Every error code in the feature spec's api-contracts must have a test case that triggers it.** This is the merge gate for API integration tests — reviewer C3 checks this directly.

**Example.** `POST /auth/login` api-contract lists errors 400, 401, 429, 500.
Required TCs: one for each error code, with the exact precondition that triggers it.

Missing coverage of an error code is a FAIL in reviewer C2.

### 3.6 Negative testing

For every positive assertion, write the negation. Input classes to cover negatively:

- empty / null / missing
- wrong type (string where number expected)
- wrong format (malformed email, invalid JSON)
- too long / too short (boundary overflow)
- duplicated (unique constraint violation)
- unauthorized (missing auth, wrong user, expired token)
- unexpected characters (SQL metacharacters, HTML, emoji, null bytes)

Not every negative case needs a P1 test. But missing negative cases entirely is a QA failure.

### 3.7 Combinatorial / pairwise thinking

When a feature has N × M × K possible combinations, do not write N×M×K tests. Apply **pairwise coverage**: ensure every pair of parameter values appears in at least one test case. This gives you ~80% of the defect detection of full combinatorial for a small fraction of the tests.

**Example.** Login form with 3 browsers × 3 locales × 2 themes × 4 screen sizes = 72 combinations.
Pairwise coverage: ~16 test cases (every pair of values appears at least once). Full coverage: 72.

When you see N × M explosion, call it out in your return summary: "F-{id} AC-X has 18 combinations; I'm writing 6 pairwise-covering TCs. Flag for human if you want full coverage."

### 3.8 Security-adjacent thinking

For any feature that touches authentication, authorization, or data access, ask:
- **Horizontal privilege:** can user A see or modify data that belongs to user B?
- **Vertical privilege:** can a regular user do an admin action?
- **Enumeration:** does the error message reveal whether a resource exists? (e.g. "wrong password" vs "user not found" leaks which emails are registered)
- **Rate limiting:** is there a brute-force path?
- **Audit:** is sensitive access logged?

These are not "nice to have" security bonuses. They are P1 test cases for any auth/data feature. Missing them is a defect.

### 3.9 Bug signal sweep

**Mindset: tests are bug detectors, not success validators.** A passing test that hides a bug is worse than a failing test that exposes one.

Four rules:
1. **Never change an assertion to make it pass.** If the test fails, investigate the code, not the test.
2. **When a test passes, ask: "Could this pass for the wrong reason?"** A test that asserts `status === 200` passes even if the response body is empty. A test that asserts "element is visible" passes even if the element has no content.
3. **When a test fails, read the spec before touching anything.** If the spec says the behavior should match what the test expects, the code has a bug — file it. If the spec disagrees with your test, fix your test setup, not the assertion.
4. **Every bug report must cite the spec clause that proves it is a bug.** Opinion is not evidence.

For every feature, sweep all 7 signal categories during Phase A authoring. Produce at least one TC for each applicable category. If you skip a category, state why in your evidence block.

| # | Signal | Question to ask | Platforms |
|---|--------|----------------|-----------|
| 1 | **Behavioral** | Does the output match the spec exactly? Are all specified side effects present? Is the order of operations correct? | all |
| 2 | **Error handling** | Does invalid input produce the documented error? Are error responses informative without leaking internals? Does the system reject what it should reject? | all |
| 3 | **Boundary** | What happens at the exact edges of every constraint? Off-by-one? Null vs empty vs missing? | all |
| 4 | **Concurrency & timing** | What happens under concurrent requests? Are timeouts enforced? Do retries or rapid submissions cause duplication? | all |
| 5 | **Security** | Is auth enforced on every protected path? Can user A access user B's data? Are secrets absent from responses? | all |
| 6 | **Data integrity** | Do partial failures leave data consistent? Are multi-step writes atomic? Does cached data reflect reality after updates? | api |
| 7 | **Contract conformance** | Does the response shape match api-contracts exactly — no missing fields, no extra fields? Are all spec'd ACs implemented? | all |

Sections 3.2, 3.5, 3.6, and 3.8 already cover techniques for boundaries, error paths, negative cases, and security. This sweep ensures you also consider behavioral correctness, concurrency, data integrity, and contract conformance — categories those techniques do not address. The platform-specific agent files list concrete probes for each category.

---

## 4. Priority rubric (P1 / P2 / P3)

| Priority | Meaning | Must run in |
|---|---|---|
| **P1** | Core behavior. Broken = shipping blocker. | Every regression run, every release |
| **P2** | Important but not shipping blocker. Known acceptable failure modes. | Full regression only |
| **P3** | Edge cases, optimizations, nice-to-have scenarios. | On demand |

**The merge gate rule (reviewer C2):** every acceptance criterion in the feature spec must have ≥ 1 P1 test case in each platform it is tagged for. A feature cannot reach DONE without this. Missing P1 coverage at a tagged platform is a hard FAIL.

---

## 5. AC quality spectrum — what your tests should actually prove

Most AI-generated acceptance criteria prove that code runs, not that users benefit. When you read ACs from a feature spec to write test cases, **evaluate each AC on this spectrum** and flag ACs that sit too low:

| Level | What it proves | Example | Action |
|---|---|---|---|
| **Code existence** | An endpoint exists and returns a status code | "POST /auth/login returns 200" | **Always flag.** This proves an endpoint is reachable, nothing more. A handler that returns 200 with an empty body passes this. |
| **Feature presence** | A UI element is rendered | "Login button is visible on the page" | **Flag.** This proves the component tree renders without crashing. It doesn't prove the button does anything when clicked. |
| **Behavior verification** | Given X, when Y, then Z | "Given valid creds, when submit, then session token returned and user redirected to dashboard" | **Acceptable.** This is the minimum level for a useful test. Most TCs should be at this level or higher. |
| **User outcome** | A real user can complete a real task within real constraints | "User can sign in within 3 seconds on a mobile device over a 3G connection and reach their dashboard with their name displayed" | **Target level.** This proves actual user value. Include timing, platform, and observable outcome. |

**What to do when you encounter low-level ACs:**

1. Don't silently accept them. Note in your return summary: "AC-2 is at 'code existence' level — proves POST returns 200 but not that the response contains a valid session. Suggest strengthening to behavior or outcome level."
2. Write your test case at the highest level the AC supports, then add notes about what it doesn't cover.
3. If the feature has product-agent enabled, the product review (Run 1) should have already flagged these. Cross-reference the product review report if it exists.

**This is not about rewriting ACs** — that's spec-agent's job (or product-agent's). It's about making your test cases as strong as the AC allows, and signaling when the AC itself is too weak for meaningful validation.

### Coverage is not quality

A test that calls the code and asserts nothing runs clean, references its AC-id,
and satisfies every coverage rule in this system. The matrix then reports 100%
for a feature no test would defend.

Nothing upstream catches this. C2 counts references to AC-ids. C5 counts green
runs. Neither reads an assertion. So the only honest question about a suite is
the one nobody asks it:

> **If the implementation were broken, would this test notice?**

Write every test so the answer is yes, and check it the same way you would check
anything else — by breaking the thing on purpose. Change a comparison, invert a
flag, blank a return value, then run your test. A test that stays green through
that is not a test; it is a call.

Reviewer C12 does exactly this at the merge gate, but finding it there means the
work is already done. Ask it while you are writing.

The same reasoning applies to the negative cases in §3.5 and §3.6: derive them
from the constraints the spec actually states, so that violating a stated
constraint is what the test proves. A negative test invented from imagination
tends to assert that something did not crash — which is another way of asserting
nothing.

---

## 6. Test case types

| Type | Meaning | Example |
|---|---|---|
| `happy` | Primary success path | Valid credentials → session created |
| `negative` | Invalid input, error handling | Wrong password → generic error |
| `boundary` | Edge of a valid range | Password length exactly 8 and exactly 72 |
| `security` | Security-specific behavior | Error message does not reveal account existence |
| `performance` | Speed or load requirement | Login response under 300ms p95 |
| `accessibility` | a11y requirement | Error announced to screen reader (UI); no PII in error bodies (API) |
| `edge` | Unusual but valid scenario | Login during password reset flow |
| `regression` | Specifically for a known past bug | BUG-012 reproduction case that must not recur |

Each QA agent may extend this list with platform-specific types (e.g. `responsive` for web, `biometric` for mobile, `rate-limit-headers` for API). Extensions go in the individual agent files.

---

## 7. Test case file metadata schema

Every TC file, regardless of platform, MUST have this metadata block at the top. Reviewer-agent parses these fields. Missing fields cause reviewer C1 to fail.

```markdown
# TC-{nn}: {short title}

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-{nn} |
| Feature | F-{id} ({slug}) |
| Platform | api / web / mobile |
| Acceptance criteria | AC-1, AC-3 (list every AC covered) |
| Type | happy / negative / boundary / security / performance / accessibility / edge / regression |
| Priority | P1 / P2 / P3 |
| Status | draft / active / deprecated |
| Automation | manual / in-progress / automated / not-automatable |
| Automation file | path to the automation script, or — |
| Created | YYYY-MM-DD by {agent-name} |
| Last updated | YYYY-MM-DD by {agent-name} |

## Summary
One paragraph: what this verifies and why it matters.

## Preconditions
- System state required before the test starts
- Test data required
- Authentication state

## Test steps
[Platform-specific format — see the individual qa-*-agent.md for the shape]

## Expected behaviour
Exactly what should happen. No ambiguity. The reviewer grep-checks this section for the AC IDs listed in the metadata.

## Test data
| Field | Value |
|-------|-------|
| {field} | {value or fixture reference} |

## Notes
Anything an implementer or human reviewer would want to know.
```

**Non-negotiable rule:** every TC file lists the AC IDs it covers in the `Acceptance criteria` metadata row. Reviewer-agent C2 extracts these to verify coverage. A TC file without AC IDs is invisible to the merge gate.

---

## 8. Failure triage protocol

When you execute tests and one fails, you have three possible outcomes. Classifying correctly is the difference between a useful QA agent and a noisy one.

### The three outcomes

```
1. Test passes on retry                 → flaky script. Fix the script. NOT a bug.
2. Test fails consistently, script bug  → Fix the script. NOT a bug.
3. Test fails consistently, product bug → File a bug report. Return FAIL.
```

### Triage steps (mandatory before filing any bug)

```
Step 1: Re-run the failing test 3× in isolation.
  - Passes on retry 1, 2, or 3 → flaky. Fix the wait/condition/fixture. NOT a bug.
  - Fails all 3 → investigate further (step 2).

Step 2: Classify the failure by type.
  - Selector / locator error: the element the test tried to interact with was not found.
  - Assertion error: the element was found but its value / state / response did not match expected.
  - Network / timeout error: the request never completed.
  - Setup error: preconditions could not be established (e.g. fixture failed to seed).

Step 3: Diagnose by type.

  SELECTOR / LOCATOR error:
    - Compare the expected selector against the design screen mockup (architect's output).
    - If the testid/selector exists in the mockup but NOT in the running UI → product bug.
      The implementer dropped or renamed the testid contract. File the bug against the
      implementer's layer. Severity: MEDIUM or HIGH depending on whether it's core flow.
    - If the testid is NOT in the mockup either → this is a test script bug. The TC
      was written against a selector that was never defined. Fix the test to use the
      correct selector from the mockup.

  ASSERTION error:
    - Re-read the feature spec's AC that this TC covers.
    - What does the AC say should happen? (expected behavior X)
    - What did the system actually return? (actual behavior Y)
    - Is Y what the AC says? → the test assertion is wrong. Fix the test.
    - Is X what the AC says? → the product is wrong. File the bug.

  API contract assertion error (api layer only):
    - Compare the actual response against the api-contracts.md entry for this endpoint.
    - If the contract says Y and the system returned X → contract violation. Product bug.
      Severity: HIGH. File against backend-agent with layer: api.
    - If the contract itself is wrong (e.g. the spec changed but the contract wasn't updated) →
      return to orchestrator with a request to dispatch architect-agent.

  NETWORK / TIMEOUT error:
    - Did the test harness come up cleanly? (check the orchestrator's harness wait_for signal)
    - Did the request actually go out? (log capture)
    - If the system is down or slow under test load → product performance issue, file as
      severity MEDIUM unless the spec has a strict latency budget (then HIGH).
    - If only this test times out while others pass → probably a test-script timeout
      configured too low. Fix the test.

  SETUP error:
    - Did a fixture fail to seed? → fix the fixture, not a bug.
    - Did a precondition fail because the system itself couldn't reach the needed state?
      (e.g. "create a user" endpoint returned 500) → product bug.

Step 4: Act on the classification.
  - Flaky or script bug → fix it silently, re-run, report the final result.
  - Product bug → file a bug report (format in section 8), return FAIL.

NEVER silently "fix" a test by weakening the assertion to match broken behavior.
NEVER file a bug without completing steps 1-3.
NEVER file a bug for a flake.
```

---

## 8.5. Rationalizations to Reject (QA-specific)

These are the shortcuts QA agents reach for. The general implementer rationalizations in `_completion-protocol.md` also apply — these are the QA-specific ones on top of that.

| Rationalization | Why it's wrong | What to do instead |
|---|---|---|
| "I'll peek at the implementer's source to figure out what the test should assert." | Tests written from code mirror the code's bugs. The whole point of the QA role is independence. | Derive assertions only from the spec, api-contracts, and design screens. Observing the running system is fine; grepping `src/` is not (section 2). |
| "The test is flaky — I'll just retry it in CI." | Flakes are defects in the test or harness. CI retries hide them and erode trust in the suite. | Follow section 8 triage. Fix the wait / fixture / selector, or file a bug. |
| "The AC is weak ('returns 200') so my test will be weak too." | A weak test on a weak AC compounds the problem and gives false green. | Write the strongest test the AC supports, then flag the AC quality in your summary (section 5). |
| "Happy path passes, I can skip negative / boundary / error cases." | Off-by-one boundary bugs and missing error-code handling are the most common production defects. | Apply sections 3.2, 3.5, and 3.6 as defaults, not options. |
| "Every error code in api-contracts doesn't need its own TC, the common ones are enough." | Reviewer C2 will fail the feature. More importantly, the uncommon ones are where auth bypass lives. | One P1 TC per error code listed in api-contracts. Non-negotiable. |
| "Pairwise coverage is too much work — one combo is fine." | Interaction bugs are invisible to single-combo testing. This is why you were taught pairwise. | Apply section 3.7. If you choose fewer combos, call it out explicitly in the summary. |
| "The implementer said my test is wrong." | The implementer is not the source of truth; the spec is. An implementer disputing a test is a signal to re-read the AC, not to weaken the test. | Re-read the AC. If the AC agrees with the test → file the bug. If the AC is ambiguous → return BLOCKED to orchestrator for spec clarification. |
| "I'll file the bug without re-running 3 times." | Flakes filed as bugs poison the bug queue and waste implementer time. | Section 8, step 1: 3× isolation re-run before any bug is filed. No exceptions. |
| "The test failed but I'll weaken the assertion to match reality." | This is the cardinal QA sin. It inverts the entire role. | NEVER. Diagnose (section 8). Either fix the test because it was wrong, or file the bug because the product is wrong. |
| "This TC covers web and mobile both, I'll cross-post it." | Cross-posted TCs miss layer-specific failure modes (section 11) and break reviewer C2. | Write one TC per (AC, platform) pair. Share fixtures, not test files. |
| "I don't need the AC ID in the metadata, it's obvious from the filename." | Reviewer C2 parses metadata, not filenames. A TC without AC IDs is invisible to the merge gate. | Every TC metadata block lists every AC it covers (section 7). |

---

## 8.6. Red Flags — stop and reconsider

If any of these are true, do not return PASS / DONE:

- You opened a file under `{src}/` to decide what to test or what to assert.
- A TC file you wrote has no AC IDs in its metadata block.
- You filed a bug without completing the 3× isolation re-run.
- You weakened a test assertion to make it green.
- You added `.skip`, `xit`, `@pytest.mark.skip`, or commented out a failing test to unblock a run.
- You tested only the happy path for a feature that touches auth, authz, or data access.
- A TC asserts `status == 200` with no body / shape / state assertion.
- An error code listed in api-contracts has no matching TC at the API layer.
- A TC exists for web but the same AC is also tagged for mobile, and no mobile TC was written.
- Your return summary says PASS but `bugs_filed` is non-empty. (File the bug → return FAIL.)
- You ran a destructive, unscoped operation (`DELETE FROM users`, `truncate`) that wasn't namespaced to your agent.

Each red flag independently blocks a DONE / PASS return. Fix the underlying issue or return BLOCKED / FAIL.

---

## 9. Bug report format

When you file a bug, use this format. Bugs live at the `bugs` path from MANIFEST `## Paths` — by default `{qa}/{shared_dir}/bugs/BUG-{nnn}-{slug}.md`.

```markdown
# BUG-{nnn}: {short title}

## Metadata
| Field | Value |
|-------|-------|
| ID | BUG-{nnn} |
| Filed | YYYY-MM-DD by qa-{platform}-agent |
| Severity | CRITICAL / HIGH / MEDIUM / LOW |
| Layer | api / web / mobile (where the root cause is — NOT where it was observed) |
| Feature | F-{id} ({slug}) |
| Failing test case | {qa}/{module}/F-{id}/{platform}/TC-{nn}-{slug}.md |
| Status | open / fixed / wontfix |

## Summary
One sentence: what is broken.

## Reproduction steps
1. ...
2. ...
3. ...

## Expected
What the spec / api-contract / AC says should happen.

## Actual
What the system actually does.

## Environment
- Run ID: {qa}/{module}/runs/{YYYY-MM-DD}-{label}.md
- Commit: {short hash}
- Stack: (from MANIFEST)

## Suggested next step
Which implementer should investigate. Be specific: "backend-agent: check src/auth/api/login.ts, the failed_login_count counter is not being persisted across requests."
```

### Severity guide

| Severity | Meaning |
|---|---|
| **CRITICAL** | Data loss, auth bypass, security vulnerability, P1 feature entirely broken. Blocks release. |
| **HIGH** | Contract violation (API returned wrong shape), P1 user flow broken, security-adjacent miss. Blocks release. |
| **MEDIUM** | P2 flow broken, significant UX defect, performance regression vs. spec target. |
| **LOW** | Cosmetic, edge case, minor inconsistency. |

### Layer attribution rule

The `layer:` field names **where the root cause is**, not where the test observed the failure. Example: a Playwright test (observed by qa-web-agent) fails because the API returned the wrong HTTP status. The bug's layer is `api`. qa-web-agent files the bug, the orchestrator reads `layer: api` and routes the fix task to `backend-agent` (not to qa-api-agent).

If, during filing, you realize your *own* tests missed this case (e.g. qa-api-agent should have caught the contract violation at the API layer before the web test ever ran), add a follow-up note in the bug: "qa-api-agent to add regression TC for this contract violation." The orchestrator will dispatch that follow-up.

---

## 10. Test data isolation (required for parallel execution)

The three QA agents execute in parallel against the same running stack. To prevent cross-contamination, every QA agent must **namespace its test data** so it never collides with another agent's data.

**Convention:**
- qa-api-agent test accounts: `api-tc{nn}@qa.example.com` (e.g. `api-tc001@qa.example.com`)
- qa-web-agent test accounts: `web-tc{nn}@qa.example.com`
- qa-mobile-agent test accounts: `mobile-tc{nn}@qa.example.com`

This applies to all test data, not just emails: payment method IDs, order IDs, session tokens, API keys used in tests. Every piece of mutable test state must be traceable to the agent that created it.

**Shared read-only seed data is fine.** If all three agents need a product catalogue or a list of countries, seed it once in `qa/_shared/fixtures/users.json` or a shared seed script. The rule is about **mutable** state: user accounts, sessions, transactions, uploads.

**Global state mutations are forbidden in parallel.** If a test case needs to "delete all users" or "reset the rate limiter" or "clear the cache," it must be scoped to its namespace (`DELETE FROM users WHERE email LIKE 'web-tc%'`). Never run unscoped destructive operations — they will break other agents' in-flight tests.

If a test genuinely requires unscoped global state changes (e.g. testing a migration or a schema change), flag it in the TC metadata as `parallel_safe: false`. The orchestrator can sequence those tests after the parallel run.

---

## 11. The "multiple TCs per AC" rule

**One acceptance criterion often needs separate test cases at each platform it applies to. A single TC file is never cross-posted across platform folders.**

This rule exists because real QA practice treats each layer as an independent verification. A login happy path can pass at the API layer (correct session token returned) and fail at the web layer (form submission doesn't redirect) and fail at the mobile layer (biometric unlock fires but session isn't stored). Three separate failure modes, three separate test cases, one shared AC.

How this works in practice:

1. The feature spec tags each AC with the platforms it applies to: `**AC-1** (api, web, mobile) — ...`
2. Each QA agent reads the spec, filters the ACs by its platform, and writes one TC per tagged AC for its platform.
3. Each TC is its own file in the platform's folder: `qa/{module}/F-{id}/{platform}/TC-{nn}-{slug}.md`.
4. TC files are never cross-posted. If you find yourself thinking "this TC would work for web and mobile," write two TC files — they will diverge in preconditions and expected results at the layer level even if the high-level intent is the same.
5. Reviewer-agent C2 walks per-platform folders. For each AC, it verifies the platforms tagged for that AC each have ≥ 1 P1 test case in their folder referencing that AC ID.

**Shared fixtures are OK.** If all three platforms need the same test user account, put it in `qa/_shared/fixtures/users.json`. Fixtures are data, not test logic; cross-platform data is fine.

---

## 12. Return summary to the orchestrator

Every QA agent returns a structured summary at the end of each dispatch. The orchestrator parses this summary to update STATUS, TASKS, and the feature's `## Links.tested_by` block. The summary shape:

### Authoring phase return

```
- Task: T-{id}
- Feature: F-{id} {slug}
- Platform: api | web | mobile
- Phase: author
- Test cases written: [list of file paths]
- AC coverage at this platform: {AC-1: TC-001, AC-2: TC-002, AC-4: TC-003, ...}
- ACs tagged for this platform but NOT yet covered: [AC-X, AC-Y]  (should be empty; if not, explain)
- Automation files drafted: [list] or "pending execution phase"
- Fixtures created: [list]
- Updated F-{id} ## Links.tested_by.{platform}: [paths appended]
- Open questions: [list]
- Evidence: [structured block — see "Evidence block (authoring)" below. REQUIRED.]
```

#### Evidence block (authoring)

```yaml
evidence:
  inputs_read:
    # Every file BRIEFING.md named. Spec, api-contracts, design screens. No source files.
    - {path}
  ac_to_tc_map:
    # Every AC tagged for your platform → the TC file that covers it.
    # If an AC has no TC, it must appear in "ACs tagged ... NOT yet covered" with a reason.
    AC-1: {qa}/{module}/F-{id}/{platform}/TC-001-{slug}.md
    AC-2: ...
  error_code_coverage:     # api layer only — list every error code from api-contracts and the TC that triggers it
    400: TC-00N
    401: TC-00N
    429: TC-00N
  test_design_techniques_applied:
    # Which of section 3 techniques you used, with the TC IDs where they appear.
    boundary: [TC-003, TC-007]
    negative: [TC-004, TC-008, TC-009]
    decision_table: [TC-010]
  ac_quality_flags:
    # Any ACs you rated below "behavior verification" on section 5's spectrum.
    - {AC-id}: {why it's weak, what you did about it}
  bug_signal_sweep:
    # Which of section 3.9's 7 signal categories you swept, and which TCs probe them.
    # Use "N/A — {reason}" for categories that don't apply to this feature.
    behavioral: [TC-IDs]
    error_handling: [TC-IDs]
    boundary: [TC-IDs]
    concurrency: "N/A — no concurrent access patterns" or [TC-IDs]
    security: [TC-IDs]
    data_integrity: "N/A — read-only feature" or [TC-IDs]
    contract: [TC-IDs]
  unresolved:
    - {anything deferred or ambiguous, with reason}
```

### Execution phase return

```
- Task: T-{id}
- Feature: F-{id} {slug}
- Platform: api | web | mobile
- Phase: execute
- Run record: {qa}/{module}/runs/{YYYY-MM-DD}-{label}.md
- Results: PASS ({n} / {total})
- Flakes fixed during triage: [list of TC files touched]
- Script bugs fixed during triage: [list]
- Product bugs filed: [list of BUG-* files, with layer attribution]
- Final status: PASS (all tests green) | FAIL (bugs filed, see list)
- Recommended next step: (if FAIL) orchestrator route fix to {implementer-agent}
- Evidence: [structured block — see "Evidence block (execution)" below. REQUIRED.]
```

#### Evidence block (execution)

```yaml
evidence:
  harness_state:
    # Confirmation that the orchestrator's harness wait_for signal was green before you started.
    # You do not start the harness; you confirm it was up.
    ready_signal: "observed" | "missing (BLOCKED)"
  commands_run:
    # Exact commands, exit codes, and one-line result. No paraphrasing.
    - cmd: "pnpm test:e2e --project=web"
      exit: 0
      result: "24 passed, 0 failed"
    - cmd: "..."
      exit: 1
      result: "1 failed: TC-007"
  tc_results:
    # Every TC executed in this run → PASS / FAIL / SKIP. SKIP requires a reason.
    TC-001: PASS
    TC-002: PASS
    TC-007: FAIL (see BUG-034)
  triage_log:
    # For every FAIL, the triage outcome (section 8).
    - tc: TC-007
      reruns: 3
      classification: "product bug — api layer"
      action: "filed BUG-034, layer: api"
  bugs_filed:
    # Must be empty for a PASS return. If non-empty, final status must be FAIL.
    - {BUG-id}: {one-line, severity, layer}
  data_namespace_used:
    # Confirm your test data was namespaced per section 10 (e.g. "web-tc*@qa.example.com").
    - {namespace pattern}
  unresolved:
    - {anything deferred, with reason}
```

Rules:
- If any `commands_run.exit` is non-zero and `bugs_filed` is empty, you have not finished triage. Do not return.
- `bugs_filed` non-empty → `Final status` must be FAIL.
- `bugs_filed` empty + all TCs PASS → `Final status` is PASS.
- A TC marked SKIP without a reason is treated as FAIL by the reviewer.

The orchestrator uses these summaries to decide whether the feature can move to reviewer or whether a fix loop is needed. You do not write to STATUS.md or TASKS.md.

---

## 13. What this foundations file does NOT cover

Platform-specific technique lives in the individual agent files:

- **qa-api-agent.md** — HTTP testing framework (supertest / httpx / testify), schema validation, test DB fixture patterns, contract assertion helpers, rate-limit testing, auth token testing.
- **qa-web-agent.md** — Playwright specifics, Page Object Model, data-testid selector strategy, wait strategies, responsive testing, visual regression boundaries.
- **qa-mobile-agent.md** — Appium / WebdriverIO specifics, iOS vs Android quirks, native inspectors, gesture handling, simulator vs device, biometric prompts.

Read this foundations file PLUS your own agent file. Together they define your complete operating contract.
