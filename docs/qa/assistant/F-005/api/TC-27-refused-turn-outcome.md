# TC-27: The refused turn — an outcome, not a silence

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-27 |
| Feature | F-005 (task-detail) |
| Platform | api |
| Acceptance criteria | AC-36, AC-40, AC-18, AC-37, AC-6, AC-8, AC-22 |
| Type | negative |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/api/F-005-task-detail.spec.ts (`describe('TC-27 …')`) |
| Created | 2026-08-19 by qa-api-agent |
| Last updated | 2026-08-19 by qa-api-agent |

## Summary
"`TurnOutcome` has six members and **not one of them is a refusal**… All three reachable improvisations are worse than the gap: `no_match` is a lie (the task **was** matched), the failure envelope reports a server fault for a healthy turn, and **write nothing and say nothing passes AC-40's own fixture row** if that row asserts only that nothing was written." So every refusal here asserts the stated reason **and** four absences, and the three improvisations are excluded by name.

## Preconditions
- In-process harness: `createApp(deps)` with the `__qa__` doors mounted in front, on an ephemeral port, driven by supertest. Fresh durable store per test.
- The clock seam and the account zone are both held at `T0 = 2026-08-19T12:00:00.000Z` / `UTC` by `POST /__qa__/set-clock` (AC-44). Every fixture instant is derived from `T0`, never from a wall clock (L-023).
- Fixture rows that ATTEMPT each refused field and each broken rule — reachable only because the AI-facing change shape carries the structural fields and the write path refuses them at runtime.

## Test steps (API)
| # | Case (automation `it` name) | Request | Expected |
|---|------------------------------|---------|----------|
| 1 | TC-27a a STRUCTURAL field attempted through the turn path is refused | turns attempting `parent_id`, `step_order`, `repeat_*` | `kind: 'refused'` with a contract reason; task unchanged; not in `changed_task_ids`; no diff row; `not_undoable` on undo |
| 2 | TC-27b a turn may NOT set reminder_shown_at | a turn attempting `reminder_shown_at` | refused; the marker is still `null` |
| 3 | TC-27c AC-40 — one row per FIELD RULE | empty title; a non-text note; an out-of-set priority | `empty_title` / `note_not_text` / `priority_not_in_set`, with the four absences each time |
| 4 | TC-27c2 AC-40 — a rule that NORMALISES normalises at both doors | whitespace-only note via `PATCH` and via a turn | both store `null`; the turn is `applied`, not refused; the diff's `new` is `null` and not `''` |
| 5 | TC-27d clearing the due of a repeating task is refused on the TURN path too | a turn attempting `due_at: null` on a repeating task | `clear_due_while_repeating`; the due is unchanged |
| 6 | TC-27e ONE LEGAL AND ONE ILLEGAL field in one change writes NOTHING AT ALL | a turn setting `note` and clearing `title` together | `empty_title`, `field: 'title'`, and the legal `note` was NOT written |
| 7 | TC-27f the refusal carries a reason from the contract's closed list | any refused turn | `reason` is in the enumerated set; the outcome's keys are exactly `kind, reason, field, task_id`; `task_id` names the unchanged task |

## Expected behaviour
- Every refusal has an **asserted outcome**: the stated reason, and that nothing was written. "A refusal with no observable is the defect, not the refusal."
- The four absences are asserted every time, because `## Impact` §1 names the exact silent-drop shape — a task marked changed with an empty diff.
- `changed_task_ids` is empty and no `undo_snapshot` is captured, so **a refused turn never occupies or advances the undo window**, exactly like `no_match` — asserted through a real `409 UNDO_REFUSED / not_undoable`.
- The turn's own `status` stays `applied`: the status machine is untouched, and no new turn status is needed.

## Test data
| Field | Value |
|-------|-------|
| namespace | task titles `qaapi5-*`; reserved user ids in `docs/qa/_shared/fixtures/api/f005-users.json`. No unscoped destructive operations (§10). |
| reason set | `empty_title, priority_not_in_set, note_not_text, structural_field_not_settable, step_not_addressable, nesting_too_deep, repeat_on_step, until_and_count, end_before_due, clear_due_while_repeating, timezone_unknown, length_exceeded` |

## Notes
- **TC-27c2 exists because of a wrong assertion of mine.** I first expected a whitespace-only note through the turn path to be *refused* with `note_not_text`. It is not: AC-6's rule for the note is a **normalisation** (whitespace-only is stored as no note at all) and the HTTP door performs it with a `200`. AC-40's claim is *same rule, outcome stated per path* — not *every rule is a refusal*. Asserting a refusal there would have pinned a **divergence** between the two doors, which is the defect AC-40 exists to close, written backwards. The refusal reason `note_not_text` is for a value that is not text at all, so the attempt is a non-string.
- `step_not_addressable` and `nesting_too_deep` are not reachable from the turn path in this suite: AC-35 removes steps from the handle list, so a turn cannot address one at all (TC-25b), and the turn path offers no create-under-a-step shape. Both are covered at the HTTP door (TC-11a). Recorded rather than left as a silent gap.
- *Would this notice?* Yes — "write nothing and say nothing" fails TC-27f's `kind` assertion; a field-level refusal fails TC-27e; a turn that applied a structural field fails TC-27a's task-equality assertion.
