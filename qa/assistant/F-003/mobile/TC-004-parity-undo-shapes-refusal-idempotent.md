# TC-004: Parity — undo revert shapes, visible refusal, idempotent replay

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-004 |
| Feature | F-003 (mobile-surface) |
| Platform | mobile |
| Acceptance criteria | AC-1, F-001 AC-6, F-001 AC-8 |
| Type | happy |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/mobile/F-003-mobile-surface.spec.ts |
| Targets | ios, android |
| Tier | node-headless |
| Created | 2026-08-16 by qa-mobile-agent |
| Last updated | 2026-08-17 by qa-mobile-agent |

## Summary
F-001 AC-6 and AC-8 are server-side ACs in the parity table's "cost the mobile client no behaviour" group — but they have a client-visible face that mobile must render, and F-003 AC-1 makes that face testable at this tier. Undo covers the whole turn, refusals are **visible outcome messages stating why** (never silence), the undone turn stays visible marked undone, and the window is session-bounded with no hidden timer.

## Preconditions
- Account `qamob-tc004@qa.example.com`; open session with one applied multi-task turn.

## Test steps
1. Apply a 3-task turn. Tap `assistant-undo-button` on its message.
2. Read the reverted outcome message, the list, and the original turn's rendering.
3. Tap undo again on the same (now undone) turn.
4. Apply a second mutating turn, then attempt undo of the **first** turn via a stale affordance.
5. Attempt undo after session close.

## Expected behaviour
- All 3 tasks revert in one gesture — undo is whole-turn, never per-task.
- Read-back observable: a subsequent task-list read returns the reverted values (create → gone and staying gone; edit → prior field values; delete → restored with all fields intact).
- The original turn stays **visible, marked undone** (mockup `reverted` state: the prior bubble carries the `undone-tag` label `Undone`), not removed from the conversation.
- Step 3 is idempotent: the same success outcome renders again, and the list does **not** change a second time.
- Step 4 and step 5 render an AC-6 refusal **message** naming the reason (`not_newest`, `session_closed`). Never a silent no-op, never a toast that leaves no conversation record.
- The undo affordance visibly disappears from the older turn once a newer **mutating** turn exists (F-001 AC-8).

## Test data
| Field | Value |
|-------|-------|
| user | qamob-tc004@qa.example.com |
| namespace | `qamob-` |

## Notes
The falsification probe for this TC: make the client swallow a `409 UNDO_REFUSED` silently. The test must go red on the missing message, not merely on a changed list.
