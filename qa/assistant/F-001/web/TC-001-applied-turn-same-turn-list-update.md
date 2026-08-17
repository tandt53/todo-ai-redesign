# TC-001: Applied turn — changes land in the on-screen list within the same turn

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-001 |
| Feature | F-001 (voice-assistant-view) |
| Platform | web |
| Acceptance criteria | AC-1, AC-4 |
| Type | happy |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/e2e/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-web-agent |
| Last updated | 2026-08-16 by qa-web-agent |

## Summary
An applying turn's changes must appear in the todo list pane — the source of truth — within the same turn, atomically. The chat reply alone is not the result (spec Purpose: "the list, not the chat reply, is where the result lives"). This TC also probes false-green: the changed row must be visible AND populated with the new value, and the applied bubble must be visible AND carry a real diff.

## Preconditions
- Open session, surface idle. Signed in as `qaweb-tc001@qa.example.com`.
- Seed tasks from `qa/_shared/fixtures/web/assistant-web-fixtures.json` (baseline set incl. "qaweb Review Q3 budget draft" at 2:00 PM).
- `POST /assistant/turn` mocked/stubbed per api-contracts (200, `kind: "turn"`, `turn.status: applied`, `turn.diff` edit 2:00 PM → 4:00 PM + create "qaweb Pick up birthday cake").

## Test steps
1. Type into `assistant-composer-input`: "push the qaweb budget review to 4pm and add qaweb pick up the birthday cake on Saturday"; activate `assistant-composer-send`.
2. Observe thinking: `assistant-state-indicator` shows the thinking state word ("Đang xử lý…"; the mockup says "Đang nghĩ…" — see run record drift note) (mockup state `thinking`).
3. When the turn response arrives, without any further user action, read the task list pane.
4. Read the applied bubble (mockup state `applied-diff`).

## Expected behaviour
- **AC-1**: In the same turn (no reload, no extra interaction), the list pane shows the edited row "qaweb Review Q3 budget draft" with the NEW time (4:00 PM, not 2:00 PM) and the created row "qaweb Pick up birthday cake". All of the turn's changes appear together (atomic) — never one without the other.
- **AC-4**: The changed rows (`turn.changed_task_ids`) are marked in place — edited row carries the Edited badge and per-field old → new (2:00 PM → 4:00 PM); the created row carries the New badge with no fabricated old value. Rows NOT in the turn are unmarked.
- Applied bubble states the real count (Vietnamese applied-head, e.g. "Đã thêm 4 việc" / "Đã sửa 1 việc · thêm 1") and per-field diff; `assistant-undo-button` present (violet, per mockup canon).
- False-green guards: assert the row's new-value text content, not just visibility; assert diff chips contain non-empty old/new strings.

## Test data
| Field | Value |
|-------|-------|
| user | qaweb-tc001@qa.example.com |
| seed tasks | fixtures `baseline_tasks` |
| utterance | fixture row `WEB-U1` (multi-op edit+create) |

## Notes
Surface state after the applied message is idle (mockup `idle-tasks` / `applied-diff`). The rowFlash marking animation is design-level; the TC asserts the badge/diff presence, not animation timing.
