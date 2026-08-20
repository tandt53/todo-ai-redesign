# TC-32: Setting and clearing a repeat needs no AI

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-32 |
| Feature | F-005 (task-detail) |
| Platform | api |
| Acceptance criteria | AC-20, AC-21, AC-32 |
| Type | happy |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/api/F-005-task-detail.spec.ts (`describe('TC-32 …')`) |
| Created | 2026-08-19 by qa-api-agent |
| Last updated | 2026-08-19 by qa-api-agent |

## Summary
"This diverges from UC-39's main flow step 1, which sets the cadence in natural language — **this repo has no model** (map D1, `ADR-001`), so a spoken cadence has nothing to interpret it. The picker is therefore the whole mechanism, not the fallback." The api-tier observable is the AI-call counter across the whole repeat lifecycle, plus the fact that named cadences resolve into AC-21's existing rule set rather than needing new shapes.

## Preconditions
- In-process harness: `createApp(deps)` with the `__qa__` doors mounted in front, on an ephemeral port, driven by supertest. Fresh durable store per test.
- The clock seam and the account zone are both held at `T0 = 2026-08-19T12:00:00.000Z` / `UTC` by `POST /__qa__/set-clock` (AC-44). Every fixture instant is derived from `T0`, never from a wall clock (L-023).
- The shared `CountingInterpreter` seam, read both in-process and through `GET /__qa__/ai-calls`.

## Test steps (API)
| # | Case (automation `it` name) | Request | Expected |
|---|------------------------------|---------|----------|
| 1 | TC-32a set, preview and clear a repeat with the AI-call counter frozen at zero | preview, `PATCH` to set, `PATCH` to clear | `series_live` true then false; the counter is unchanged, in-process and over the door |
| 2 | TC-32b named cadences resolve into AC-21's rule set | weekly on `mo,tu,we,th,fr` ("every weekday") | accepted as an ordinary weekly rule with five weekdays; `series_live: true` |

## Expected behaviour
- Zero AI calls for setting, previewing and clearing a repeat.
- "Every weekday" is expressible as weekly interval 1 on five weekdays — "named cadences cost no model change; they are labels over rules that already exist" (product F12). The label is design's; the API's obligation is that the rule is expressible.
- The preview-then-commit model is the repeat picker's alone (AC-2, design D5); every other field saves on leaving the field.

## Test data
| Field | Value |
|-------|-------|
| namespace | task titles `qaapi5-*`; reserved user ids in `docs/qa/_shared/fixtures/api/f005-users.json`. No unscoped destructive operations (§10). |
| weekday set | `mo,tu,we,th,fr` |

## Notes
- The complement of this case is TC-27a: a turn attempting to set a repeat is **refused**, which is what makes "the picker is the whole mechanism" true from both sides.
- *Would this notice?* Yes — any interpreter call on the repeat path fails TC-32a's counter assertion, which is read through the same door the e2e tier uses.
