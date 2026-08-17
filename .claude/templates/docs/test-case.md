# TC-{nn}: {short title}
<!-- One file per test case. Lives at {qa}/{module}/F-{feature_id}/{platform}/TC-{nn}-{slug}.md -->
<!-- Platform: api | web | mobile -->
<!-- Written by: qa-{platform}-agent. See agents/_qa-foundations.md for shared conventions. -->

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-{nn} |
| Feature | F-{id} ({slug}) |
| Platform | api / web / mobile |
| Acceptance criteria | AC-{n}, AC-{m} (list every AC this TC covers) |
| Type | happy / negative / boundary / security / performance / accessibility / edge / regression |
| Priority | P1 / P2 / P3 |
| Status | draft / active / deprecated |
| Automation | manual / in-progress / automated / not-automatable |
| Automation file | {path to automation script} or — |
| Created | YYYY-MM-DD by qa-{platform}-agent |
| Last updated | YYYY-MM-DD by qa-{platform}-agent |

## Summary
One paragraph: what this test verifies and why it matters.

## Preconditions
- System state required before the test starts
- Test data required (with namespace — see _qa-foundations.md section 10)
- Authentication state

## Test steps
<!-- Format depends on platform:
     API: use a request/response table (method, path, body, expected status, expected shape)
     Web: use numbered narrative steps with data-testid references from the design screen
     Mobile: use numbered narrative steps with accessibility ID references -->

| # | Action | Expected result |
|---|--------|----------------|
| 1 | [action] | [expected] |
| 2 | [action] | [expected] |

## Expected behaviour
Exactly what should happen. No ambiguity. Include timing if the spec has a latency budget.

## Test data
| Field | Value |
|-------|-------|
| {field} | {value or fixture reference} |

## Notes
Anything a reviewer or human tester would want to know.
