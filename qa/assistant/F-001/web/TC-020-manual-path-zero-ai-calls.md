# TC-020: Manual path — all list operations by direct touch, zero AI calls (counter-proven)

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-020 |
| Feature | F-001 (voice-assistant-view) |
| Platform | web |
| Acceptance criteria | AC-18 |
| Type | happy |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/e2e/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-web-agent |
| Last updated | 2026-08-16 by qa-web-agent |

## Summary
All four list operations (create, edit, complete, delete) are doable by direct touch without the assistant — with ZERO AI calls, asserted via the harness AI-call counter (the spec's declared seam). This is the bounded form of the prohibition: counter delta == 0 across the whole manual sequence, and no `/assistant/*` request observed.

## Preconditions
- Open session surface, idle. User `qaweb-tc020@qa.example.com`; baseline seed tasks.
- Harness AI-call counter seam readable (spec Test strategy). Network capture on `/assistant/*` and `/tasks*` routes. Manual ops call `/tasks…` per api-contracts (Prototype task CRUD).

## Test steps
1. Read the AI-call counter (baseline).
2. **Create**: `assistant-add-task-button` → add "qaweb manual task" by hand.
3. **Complete**: toggle `assistant-task-checkbox` on a seeded row.
4. **Edit**: edit a seeded task's field by direct touch.
5. **Delete**: delete "qaweb manual task" by direct touch.
6. Read the counter again; dump captured requests.

## Expected behaviour
- **Each op lands**: created row appears (visible AND titled "qaweb manual task"); completed row shows done treatment and checkbox `aria-pressed="true"`; edit shows the new value; deleted row gone.
- **Zero AI**: counter delta is exactly 0; zero requests to `/assistant/*`; all mutations went to `POST/PATCH/DELETE /tasks…`.
- No assistant message is added to the conversation by manual ops, and no attribution badge appears on hand-changed rows (AC-4 scope rule — manual work is never attributed to a turn).

## Test data
| Field | Value |
|-------|-------|
| user | qaweb-tc020@qa.example.com |
| manual task title | "qaweb manual task" |

## Notes
This is also the ADR-7 floor the offline TC (TC-029) stands on. Mockup states exercised: `idle-tasks` (list + add button visible alongside conversation).
