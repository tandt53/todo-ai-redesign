# BUG-{nnn}: {short title}
<!-- Written by: qa-{platform}-agent when a test fails due to a product defect. -->
<!-- Lives at: {qa}/_shared/bugs/BUG-{nnn}-{slug}.md -->
<!-- See agents/_qa-foundations.md section 9 for the full bug format conventions. -->

## Metadata
| Field | Value |
|-------|-------|
| ID | BUG-{nnn} |
| Filed | YYYY-MM-DD by qa-{platform}-agent |
| Severity | CRITICAL / HIGH / MEDIUM / LOW |
| Layer | api / web / mobile (where the ROOT CAUSE is — not where observed) |
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
- Run ID: {qa}/{module}/runs/{YYYY-MM-DD}-{platform}-{label}.md
- Commit: {short hash}
- Stack: (from MANIFEST ## Stack)

## Triage notes
<!-- How the QA agent determined this is a product bug and not a script bug. -->
<!-- Required: proves the 3-step triage protocol from _qa-foundations.md was followed. -->
- Retried 3x: [passed on retry? → if yes, it was a flake, not a bug]
- Failure type: [selector / assertion / network / setup]
- Root cause determination: [why this is a product defect, not a test script problem]

## Suggested next step
Which implementer should investigate. Be specific: "backend-agent: check {file}, the {mechanism} is not {expected behavior}."
