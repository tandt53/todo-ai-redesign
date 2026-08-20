# TC-046: Under reduce-motion, clause (h)'s submit completes without animation

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-046 |
| Feature | F-001 (voice-assistant-view) |
| Platform | web |
| Acceptance criteria | AC-30, AC-19 |
| Type | accessibility |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/e2e/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-17 by qa-web-agent |
| Last updated | 2026-08-17 by qa-web-agent |

## Summary
Clause (g) on the **submit** path — the newest of the three, added with clause (h) by the owner decision closing Open Question 8, and therefore the one most likely to have been wired without inheriting the obligation. Clause (g) is written as a quantifier rather than a list precisely so a later-added trigger cannot escape it.

## Preconditions
- `prefers-reduced-motion: reduce` set and asserted.
- Fresh account `qaweb-tc046-{run}-*@qa.example.com`, overflowing conversation, user parked at the top.

## Test steps (web)
1. Set reduce-motion; assert it took.
2. Build an overflowing conversation; scroll to the top; let the park's own scroll event drain.
3. Start recording scroll offsets.
4. Submit a canonical `plan the week` turn; wait 1200ms.
5. Stop recording; read `distance_from_bottom`.

## Expected behaviour
- `distance_from_bottom ≤ 48`.
- **At most two** recorded scroll offsets. Two, not one, because this path mandates two scrolls: clause (h) on the user's own append, then clause (b)'s follow of the reply that lands after it. Each must complete in one step; neither may ramp. An animated version of the same path walks through a long ladder and fails this immediately.

## Test data
| Field | Value |
|-------|-------|
| user | qaweb-tc046-{run}-*@qa.example.com |
| preference | `prefers-reduced-motion: reduce` |

## Notes
The two-step allowance is the faithful reading of clause (g), which quantifies over *each* scroll the AC mandates rather than over the total motion between two observations. The first version of this case assumed one scroll and failed on a compliant surface — a wrong test, corrected, not an assertion weakened: the failing offsets were `[623, 744]`, two discrete instant jumps, and no ramp between them.

Worth recording next to that: with motion **on**, this same path is where BUG-006 lives. The two facts are consistent — the defect is a race between the animation and the arriving reply, so removing the animation removes the race. That is evidence for the diagnosis, not a reason to consider the path covered.
