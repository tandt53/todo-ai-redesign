# TC-17: Undo of a delete restores the tasks with all fields intact

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-17 |
| Feature | F-001 (voice-assistant-view) |
| Platform | api |
| Acceptance criteria | AC-6 |
| Type | happy |
| Priority | P1 |
| Status | active |
| Automation | in-progress |
| Automation file | qa/assistant/automation/api/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-api-agent |
| Last updated | 2026-08-16 by qa-api-agent |

## Summary
Revert shape "delete" (AC-6): deleted tasks are restored with **all fields intact** — not recreated bare. The seeded task carries every mutable field (due_at, reminder_at, priority, status) so a lossy restore is caught field-by-field.

## Preconditions
- User `QAAPI-U1`; seeded via POST /tasks: `{title: "qaapi-dentist", due_at: <D>, reminder_at: <R>, priority: <P>, status: "archived"}` (ADR-009 narrowed the write vocabulary; `today` is now a 400); full task object captured as `{orig}`.
- Applied single-delete turn via UT-DELETE-1-style row targeting `qaapi-dentist`, turn id `{tid}`.

## Test steps
| # | Method | Path | Headers | Body | Expected status | Assertions |
|---|--------|------|---------|------|-----------------|------------|
| 1 | POST | /assistant/turn/{tid}/undo | X-User-Id: {U1} | `{via: "tap"}` | 200 | `undone: true`, `reverted == [{task_id: {orig.id}, title: "qaapi-dentist"}]` |
| 2 | GET | /tasks | X-User-Id: {U1} | — | 200 | restored task **deep-equals** `{orig}` on every field: title, due_at, reminder_at, priority, status, id (same id — not a new row); `deleted_at` cleared |

## Expected behaviour
Delete-revert restores from `undo_snapshot`, so field fidelity is total. Field-wise deep-equality is the assertion — title-only restore is the classic lossy bug.

## Test data
| Field | Value |
|-------|-------|
| user | QAAPI-U1 |
| seed | qaapi-dentist with all optional fields populated |

## Notes
`updated_at` may legitimately differ post-restore; excluded from the deep-equality set, noted so the automation doesn't over-assert.
