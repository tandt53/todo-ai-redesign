# TC-40: Non-mutating turns neither hold nor end the undo window — a misheard utterance never spends the undo

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-40 |
| Feature | F-001 (voice-assistant-view) |
| Platform | api |
| Acceptance criteria | AC-8, AC-6, AC-5 |
| Type | edge |
| Priority | P1 |
| Status | active |
| Automation | in-progress |
| Automation file | qa/assistant/automation/api/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-api-agent |
| Last updated | 2026-08-16 by qa-api-agent |

## Summary
Pinned 2026-08-16 (api-contracts undo section): the undo window is keyed to the newest applied turn **with non-empty `changed_task_ids`**. Non-mutating applied outcomes (`no_match`, `unsupported_query`, `unclassifiable`, declined/superseded/already-resolved resolutions) capture no `undo_snapshot`, are themselves refused `not_undoable`, and leave the previous turn's window untouched. The trap this kills: a misheard utterance ("delete the unicorn task" → no_match) landing between an apply and its undo must NOT cost the user their undo.

## Preconditions
- User `QAAPI-U1`, no `qaapi-` tasks; fixture rows UT-CREATE-1, UT-NOMATCH-1, UT-LISTQ-1, UT-DELETE-BULK-3, UT-ANS-NO-1.

## Test steps
| # | Method | Path | Headers | Body | Expected status | Assertions |
|---|--------|------|---------|------|-----------------|------------|
| 1 | POST | /assistant/turn | X-User-Id: {U1} | UT-CREATE-1 (mutating apply), turn `{ta}` | 200 | `changed_task_ids` non-empty — `{ta}` holds the window |
| 2 | POST | /assistant/turn | X-User-Id: {U1} | `"delete the unicorn task"` (UT-NOMATCH-1), turn `{tn}` | 200 | `outcome.kind: "no_match"`, `changed_task_ids == []` |
| 3 | POST | /assistant/turn | X-User-Id: {U1} | `"what's on Sunday?"` (UT-LISTQ-1) | 200 | second non-mutating turn — still no window movement |
| 4 | POST | /assistant/turn/{tn}/undo | X-User-Id: {U1} | `{via: "tap"}` | 409 | `UNDO_REFUSED / reason: "not_undoable"` — a non-mutating turn is never undoable (error-table row, third clause) |
| 5 | POST | /assistant/turn/{ta}/undo | X-User-Id: {U1} | `{via: "tap"}` | 200 | **the misheard-utterance trap:** `{ta}` is still the newest *mutating* applied turn — undo succeeds, `reverted` names the created task; NOT `not_newest` |
| 6 | — | fresh context: bulk question (UT-DELETE-BULK-3) after a mutating apply `{tb}`, then `"no"` (UT-ANS-NO-1) → declined resolution turn `{tr}` | X-User-Id: {U1} | — | 200 | declined resolution is applied-but-non-mutating: `POST /assistant/turn/{tr}/undo` → 409 `not_undoable`; `POST /assistant/turn/{tb}/undo` → 200 — the declined answer spent nothing |
| 7 | — | fresh session containing **only** non-mutating turns (no_match + unsupported), then voice `"undo"` | X-User-Id: {U1} | — | 409 | voice-guard: "no **mutating** applied turn exists" → `UNDO_REFUSED / not_undoable`; zero AI calls for the undo phrase; no task named "undo" |

## Expected behaviour
Window rule is mechanical: undo succeeds iff `status == "applied"` and max `seq` among applied turns **with non-empty `changed_task_ids`** of the open session. Non-mutating turns are invisible to the window in both directions (neither hold nor end it) and are refused when targeted directly.

## Test data
| Field | Value |
|-------|-------|
| user | QAAPI-U1 |
| flows | apply → no_match/unsupported → undo; apply → question → declined → undo both; non-mutating-only session → voice undo |

## Notes
Complements TC-18 (mutating-vs-mutating window mechanics), TC-13/TC-14 (the non-mutating outcomes themselves), TC-24 (voice-guard refusal shape). The unclassifiable variant is implicitly exercised in TC-08's flow; its non-mutating window behaviour follows the same pinned clause.
