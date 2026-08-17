# TC-028: After a kill, an unanswered question and the undo affordance reappear per their own rules

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-028 |
| Feature | F-003 (mobile-surface) |
| Platform | mobile |
| Acceptance criteria | AC-6, AC-8, F-001 AC-8, F-001 AC-10 |
| Type | edge |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/mobile/F-003-mobile-surface.spec.ts |
| Targets | ios, android |
| Tier | node-headless |
| Created | 2026-08-16 by qa-mobile-agent |
| Last updated | 2026-08-17 by qa-mobile-agent |

## Summary
AC-6's last clause: after a kill, unanswered questions and the undo affordance reappear **per their own rules** — meaning they are reconstructed from the server's session read, not from local state. A pending question survives because it is a message on the server, and the undo affordance reappears only if its turn is still the newest **mutating** applied turn.

## Preconditions
- Account `qamob-tc028@qa.example.com`; `DurableStore` outliving the model.

## Test steps
1. Ask a bulk-delete question. Kill. Cold-open.
2. Read the conversation: is the question present and still answerable?
3. Answer affirmatively; assert it executes exactly once.
4. Fresh session: apply a mutating turn. Kill. Cold-open. Read the undo affordance.
5. Fresh session: apply turn A, then apply mutating turn B. Kill. Cold-open. Read which turn carries undo.
6. Fresh session: apply a turn, close the session, kill, cold-open. Read the undo affordance.

## Expected behaviour
- Step 2: the question renders as a message with its chips and is still resolvable — no timeout ran while the process was dead (D2: no timeout anywhere).
- Step 3: the affirmative executes once; the question resolves exactly once.
- Step 4: `assistant-undo-button` is present on the restored turn.
- Step 5: undo is on **B only**; A's affordance is gone — the window is reconstructed from server state, not from whatever the client had cached before the kill.
- Step 6: no undo affordance — session close ended the window (F-001 AC-8), and the boundary message renders instead (TC-031).
- In every branch the affordance state matches what a client that had never been killed would show for the same server state.

## Test data
| Field | Value |
|-------|-------|
| user | qamob-tc028@qa.example.com (one sub-account per branch) |

## Notes
Step 5 is the discriminating case. A client that restores its own cached "undo available for turn A" flag passes steps 2–4 and fails here — which is the bug: local state overriding the server read, forbidden by AC-8.
