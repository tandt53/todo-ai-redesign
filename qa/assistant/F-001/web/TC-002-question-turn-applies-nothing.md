# TC-002: A question turn applies nothing — the question message IS the same-turn result

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-002 |
| Feature | F-001 (voice-assistant-view) |
| Platform | web |
| Acceptance criteria | AC-1, AC-9 |
| Type | negative |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/e2e/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-web-agent |
| Last updated | 2026-08-17 by qa-web-agent (T-070b — ADR-008 English copy sync) |

## Summary
AC-1's carve-out: a turn that produces a question (bulk-delete confirmation or clarification) applies nothing; its visible same-turn result is the question message itself. This is the web half of the server-refusal rule — the UI must show zero list changes while the question is pending.

## Preconditions
- Open session, idle. User `qaweb-tc002@qa.example.com`; baseline seed tasks (3 shopping-tagged tasks present).
- `POST /assistant/turn` returns `turn.status: asked`, `turn.question {kind: bulk_delete, task_ids, options}` naming 3 tasks.

## Test steps
1. Snapshot the task list pane (row count + each row's title/meta text).
2. Type "delete the qaweb shopping tasks" and send.
3. Wait for the assistant reply (mockup state `question-confirm`).
4. Re-read the entire task list pane.

## Expected behaviour
- **AC-9**: The reply is a question message naming the count ("Delete 3 tasks?") and all 3 task titles ("Will delete: …"); `assistant-chip-affirm` ("Delete 3 tasks", danger-styled, the only red action) and `assistant-chip-negative` ("Keep them") render.
- **AC-1 carve-out**: The task list is byte-identical to the pre-turn snapshot — no row removed, no badge, no diff, no count change. The question message is the only visible result of the turn.
- No Undo affordance appears (nothing was applied).

## Test data
| Field | Value |
|-------|-------|
| user | qaweb-tc002@qa.example.com |
| seed tasks | fixtures `baseline_tasks` |
| utterance | fixture row `WEB-U2` (bulk delete, 3 matches) |

## Notes
The pending question must block nothing — covered separately in TC-013/TC-014; this TC pins the zero-mutation half.
