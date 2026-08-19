# TC-019: Android permission matrix row 2/3 — denied (not permanent) → dimmed; next talk attempt may re-request

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-019 |
| Feature | F-003 (mobile-surface) |
| Platform | mobile |
| Acceptance criteria | AC-3, F-001 AC-21 |
| Type | negative |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/mobile/F-003-mobile-surface.spec.ts |
| Targets | android |
| Tier | node-headless (state machine) + device-lab (real dialog) |
| Created | 2026-08-16 by qa-mobile-agent |
| Last updated | 2026-08-17 by qa-mobile-agent |

## Summary
A first-time Android denial is recoverable in place: the OS will still show the prompt, so the next talk attempt **may** re-request. This is the row that must be distinguishable from permanently-denied (TC-020) — collapsing the two produces either a dead mic that never re-asks, or an app that pointlessly "re-requests" a dialog Android will never show.

## Preconditions
- Account `qamob-tc019@qa.example.com`; `client.permission_state = {microphone: denied}` (not permanent); request spy installed.

## Test steps
1. Open the surface. Read the mic mode and the message.
2. Activate the dimmed mic. Read the spy.
3. Grant on the re-request. Assert capture starts.
4. Reset to denied; type and send a turn.

## Expected behaviour
- Mic is **dimmed** with a message stating the microphone permission is off.
- Step 2: a re-request **is permitted** in this state — the spy records one `RECORD_AUDIO` request. (AC-3 says "may re-request"; the test asserts the client's chosen behaviour is consistent and does not silently do nothing, and that whichever branch is taken renders a visible affordance.)
- Step 3: granting from the re-request restores the mic and begins capture without a restart.
- Step 4: typing is fully unaffected.
- `client.permission_state.microphone` reads `denied`, **not** `permanently_denied` — the two values must not be conflated.

## Test data
| Field | Value |
|-------|-------|
| user | qamob-tc019@qa.example.com |
| matrix row | `PM-AND-2` |

## Notes
Distinguishing denied from permanently-denied requires the real `shouldShowRequestPermissionRationale` signal on a device; at this tier the distinction is carried by the port's state value. That mapping — OS signal → `denied` vs `permanently_denied` — is device-lab debt and is the thing most likely to be wired backwards.
