# TC-18: Undo refused when not the newest applied turn — and the window re-opens after undo

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-18 |
| Feature | F-001 (voice-assistant-view) |
| Platform | api |
| Acceptance criteria | AC-6, AC-8 |
| Type | negative |
| Priority | P1 |
| Status | active |
| Automation | in-progress |
| Automation file | qa/assistant/automation/api/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-api-agent |
| Last updated | 2026-08-16 by qa-api-agent |

## Summary
Undo is one level and session-bounded (AC-8): a newer **mutating** applied turn (non-empty `changed_task_ids`) ends the older turn's window. A stale-affordance undo yields the visible 409 `UNDO_REFUSED / not_newest` refusal — never silence (AC-6). Contract's mechanical rule also pins the re-open: after undoing the newest turn, the previous applied turn becomes newest again and is undoable.

## Preconditions
- User `QAAPI-U1`; applied turn A (UT-CREATE-1, `{ta}`), then applied turn B (UT-EDIT-1 on another seeded task, `{tb}`). B is newest.

## Test steps
| # | Method | Path | Headers | Body | Expected status | Assertions |
|---|--------|------|---------|------|-----------------|------------|
| 1 | POST | /assistant/turn/{ta}/undo | X-User-Id: {U1} | `{via: "tap"}` | 409 | envelope `{error: {code: "UNDO_REFUSED", message, detail: {reason: "not_newest", turn_id: {ta}}}}` |
| 2 | GET | /tasks | X-User-Id: {U1} | — | 200 | nothing reverted — turn A's and B's effects both still in place (refusal really refused) |
| 3 | POST | /assistant/turn/{tb}/undo | X-User-Id: {U1} | `{via: "tap"}` | 200 | newest turn B undone normally |
| 4 | POST | /assistant/turn/{ta}/undo | X-User-Id: {U1} | `{via: "tap"}` | 200 | window re-opened: A is now the newest **applied** turn (max seq among applied) and undoes successfully |

## Expected behaviour
Refusal rule is mechanical: undo succeeds iff `status == "applied"` and max `seq` among applied turns **with non-empty `changed_task_ids`** of the open session (pinned 2026-08-16 — non-mutating turns neither hold nor end the window, TC-40). One level at a time, but sequential undo A-after-B is legal — no hidden timer, no deeper history.

## Test data
| Field | Value |
|-------|-------|
| user | QAAPI-U1 |
| flow | apply A → apply B → undo A (409) → undo B (200) → undo A (200) |

## Notes
State-transition coverage (§3.4): invalid `applied(not newest) → undone` attempt, then the same transition made valid by B's undo. Also triggers the error-table row `409 UNDO_REFUSED/not_newest`.
