# Review — F-{id} {slug}
<!-- Written by: reviewer-agent after running C1-C8 structural checks. -->
<!-- Lives at: reports/review-F-{id}-{date}.md -->

**Date**: {YYYY-MM-DD}
**Agent**: reviewer-agent
**Task**: T-{id}
**Result**: STRUCTURAL-PASS | STRUCTURAL-FAIL

## Summary
{N}/8 checks passing. {one-line headline if FAIL}

## Checks

| #  | Check                    | Result    | Notes                          |
|----|--------------------------|-----------|--------------------------------|
| C1 | Links populated          | PASS/FAIL | {detail}                       |
| C2 | AC coverage (per-platform)| PASS/FAIL | {uncovered (AC, platform) pairs}|
| C3 | API contract consistency | PASS/FAIL | {mismatches}                   |
| C4 | No hardcoded design      | PASS/FAIL | {N violations}                 |
| C5 | Test suite green         | PASS/FAIL | {pass / fail / skip counts}    |
| C6 | TODOs tracked            | PASS/FAIL | {N orphans}                    |
| C7 | Security sanity          | PASS/FAIL | {audit summary + findings}     |
| C8 | Ops readiness            | PASS/FAIL/N/A | {observability + rollback + flag} |

## Failures in detail

### C{n} — {check name}
- `{file}:{line}` — {assertion that failed} — {suggested fix}
- ...

(Repeat for each failing check.)

## Human checklist

The structural checks above cannot validate subjective quality. A human must confirm before merge:

- [ ] Does the UX match the design intent (not just match tokens)?
- [ ] Are error messages clear and on-brand?
- [ ] Does the feature feel coherent with the rest of the product?
- [ ] Are any trade-offs the implementer made acceptable?
- [ ] Is documentation (if user-facing) updated?

## Next step

- **STRUCTURAL-PASS** → orchestrator surfaces this report to a human for final sign-off, then merge.
- **STRUCTURAL-FAIL** → orchestrator dispatches a fix task back to the relevant implementer with the specific failing check + file:line list.
