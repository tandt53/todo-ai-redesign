# TC-012: Bulk delete asks (count + titles); single delete applies immediately with undo

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-012 |
| Feature | F-001 (voice-assistant-view) |
| Platform | web |
| Acceptance criteria | AC-9, AC-4 |
| Type | boundary |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/e2e/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-web-agent |
| Last updated | 2026-08-16 by qa-web-agent |

## Summary
The bulk-delete boundary: a delete touching MORE than one task executes only after confirmation (question message naming count and titles); a single-task delete applies immediately with undo. Boundary values: 1 task (applies) vs 2 tasks (asks).

## Preconditions
- Open session. User `qaweb-tc012@qa.example.com`; baseline seed tasks.
- Turn stub: 2-match delete → `asked` + `question {kind: bulk_delete}`; 1-match delete → `applied`.

## Test steps
1. Send a delete matching exactly 2 tasks (fixture `WEB-U3`).
2. Read the reply and the list.
3. Send a delete matching exactly 1 task (fixture `WEB-U4`, "delete qaweb pay electricity bill").
4. Read the reply and the list.

## Expected behaviour
- **Bulk (2)**: Question message with the count ("2") and BOTH titles; `assistant-chip-affirm` (danger) + `assistant-chip-negative`; list unchanged (AC-1 carve-out); no undo button on the question.
- **Single (1)**: No question. The task disappears from the list in the same turn; outcome message names the deleted task by title (AC-4 delete anatomy); `assistant-undo-button` present — undo, not confirmation, protects single deletes (spec "Considered and rejected").
- Danger styling appears on the affirm chip only — nowhere else in either exchange.

## Test data
| Field | Value |
|-------|-------|
| user | qaweb-tc012@qa.example.com |
| utterances | fixture rows `WEB-U3` (2-match delete), `WEB-U4` (1-match delete) |

## Notes
Boundary analysis on "more than one": exactly 1 and exactly 2 are the two sides of the AC-9 edge. The ≥3 shape is exercised by TC-002/TC-013.
