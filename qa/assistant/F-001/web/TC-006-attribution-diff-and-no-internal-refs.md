# TC-006: Attribution in place — create/edit/delete anatomy; internal refs never render

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-006 |
| Feature | F-001 (voice-assistant-view) |
| Platform | web |
| Acceptance criteria | AC-4 |
| Type | negative |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/e2e/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-web-agent |
| Last updated | 2026-08-16 by qa-web-agent |

## Summary
Every AI-applied change is attributable in place: edit shows old → new per field; create is marked new with no fabricated old value; delete is named by title in the outcome message (no row remains). Only the turn's own rows are marked — hand-edited rows and rows from other turns are never attributed to this turn. And the internal-ref rule: raw task uuids and draft-ref tokens (`#d1` style) never render anywhere — this uses the spec's internal-ref fixture row.

## Preconditions
- Open session. User `qaweb-tc006@qa.example.com`; baseline seed tasks.
- Turn stub returns a 3-op applied turn (edit + create + delete) whose wire payload carries task uuids (as api-contracts allows) — fixture row `INTREF-1` from the canonical utterance→intent table (spec Test strategy: "an internal-ref row asserting no uuid/draft-ref token ever renders").
- One unrelated task hand-edited immediately before the turn.

## Test steps
1. Hand-edit "qaweb Call Mom" (change time) via direct touch.
2. Send the 3-op utterance; wait for the applied message.
3. Inspect: edited row, created row, the outcome bubble (for the deleted task), the hand-edited row.
4. Scan the FULL rendered DOM text (list pane + conversation) for uuid patterns (`[0-9a-f]{8}-[0-9a-f]{4}-…`) and draft-ref tokens (`#d\d+`).

## Expected behaviour
- **Edit**: row marked Edited, old → new shown per changed field (chip-old strikethrough → chip-new).
- **Create**: row marked New; NO old value anywhere for it (no fabricated old chip).
- **Delete**: no row remains; the turn's outcome message names the deleted task by title.
- **Scope of marking**: the hand-edited "qaweb Call Mom" row carries NO badge/diff from this turn; older turns' rows unmarked.
- **Internal refs**: zero uuid strings, zero `#d…` tokens in any rendered text — user words and real task titles only.

## Test data
| Field | Value |
|-------|-------|
| user | qaweb-tc006@qa.example.com |
| utterance/intent | canonical fixture table row `INTREF-1` (web mirror in assistant-web-fixtures.json) |

## Notes
The uuid regex scan is the bounded, falsifiable form of the AC-14/AC-18/AC-29-style prohibition rewrites: assert the bounded check (rendered text scan), not a universal negative.
