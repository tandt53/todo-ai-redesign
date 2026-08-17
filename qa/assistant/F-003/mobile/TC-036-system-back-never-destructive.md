# TC-036: System back navigation is never destructive; Android back dismisses the keyboard first

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-036 |
| Feature | F-003 (mobile-surface) |
| Platform | mobile |
| Acceptance criteria | AC-11, AC-5, AC-6, F-001 AC-28 |
| Type | negative |
| Priority | P1 |
| Status | draft |
| Automation | manual |
| Automation file | — |
| Targets | ios, android |
| Tier | device-lab (real back gesture) + node-headless (non-destructiveness, via TC-025/TC-030) |
| Created | 2026-08-16 by qa-mobile-agent |
| Last updated | 2026-08-17 by qa-mobile-agent |

## Summary
Leaving the assistant view is a **background transition**, not a cancel and not a session close. Android system back and iOS back-swipe must not cancel an in-flight turn, must not close the session, and must not discard composer text. With the keyboard open, Android back dismisses the keyboard first and leaves the view only on the second press.

## Preconditions
- Real devices: one Android (gesture nav and 3-button nav), one iOS (back-swipe).
- Account `qamob-tc036@qa.example.com`; request spy and session-state readable.

## Test steps
1. Start a turn (thinking). Press system back. Return to the view; read the turn's outcome.
2. Type composer text without sending. Press back. Return; read the composer.
3. With a pending question, press back. Return; read the question.
4. Press back and check `session.status` on the server.
5. With the keyboard **open**, press Android back once; observe. Press again; observe.
6. Repeat 1–4 with iOS back-swipe, and repeat 5 on Android with 3-button navigation.

## Expected behaviour
- Step 1: the in-flight turn is **not** cancelled — it resolves server-side and its outcome renders on return (AC-6 governs; a sent turn always completes).
- Step 2: composer text is intact on return (AC-5 governs — `client.pending_input`).
- Step 3: the pending question is still there and still answerable.
- Step 4: `session.status` is still **open**. No `POST /assistant/session/close` was sent. Session close remains explicit or idle-driven only (F-001 AC-28, ADR-004).
- Step 5: the **first** Android back press dismisses the keyboard and leaves the view; the **second** leaves the view. One press must not do both.
- iOS back-swipe behaves as a background transition with the same guarantees.

## Test data
| Field | Value |
|-------|-------|
| user | qamob-tc036@qa.example.com |
| nav modes | Android gesture nav, Android 3-button, iOS back-swipe |

## Notes
**Not automatable at the node tier — "system back and back-swipe" is in the spec's device-lab list.** The *consequences* (no cancel, no close, text kept) are node-assertable as a background transition and are covered by TC-025 and TC-030; what needs a device is that the real back gesture is routed to the background path at all — the thing most likely to be wired to a navigation `goBack` that unmounts and discards state.
