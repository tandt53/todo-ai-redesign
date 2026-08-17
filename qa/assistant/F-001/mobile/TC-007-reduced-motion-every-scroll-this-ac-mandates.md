# TC-007: Reduced motion removes the animation from every scroll this AC mandates

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-007 |
| Feature | F-001 (voice-assistant-view) |
| Platform | mobile |
| Target | iOS (model tier + ReduceMotion port double) |
| Acceptance criteria | AC-30 (g), AC-19 |
| Type | accessibility |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/mobile/F-001-voice-assistant-view.spec.ts:562 |
| Created | 2026-08-17 by qa-mobile-agent |
| Last updated | 2026-08-17 by qa-mobile-agent |

## Summary
AC-30 (g) attaches the obligation to **the scroll**, not to the clause that triggers it,
and it says why: "an enumeration of triggers is exactly the shape that leaves one door
unguarded — L-005." As written the AC quantifies over three scroll paths — (b)'s follow,
(f)'s activation and (h)'s submit — so this TC drives three, each from its own trigger,
as three structurally different tests. The observable is the **absence** of animation,
never a shortened duration.

## Preconditions
- The mobile surface exposes a `ReduceMotion` port with a `FakeReduceMotion` double.
  `makeReduceMotion(true)` is the user having turned reduce-motion on **before** the app
  started.
- For the (h) path, the real in-process assistant server; namespace `qamob-ac30-`.

## Test steps (mobile)
1. Build a surface with `makeReduceMotion(true)` — never `set(true)` — and register a
   change listener. Trigger the **(b) follow** path: append at the threshold distance,
   confirm the path really is a scroll, then read whether the scroll animates.
2. Repeat with an independent surface for the **(f) activation** path: let two messages
   arrive away from the bottom, confirm there is a pill to activate, arrive at the bottom,
   then read whether the scroll animates.
3. Repeat with an independent surface for the **(h) submit** path: submit a turn on the
   real surface, confirm the user's own message was appended, then read whether the
   scroll animates.
4. In each of steps 1–3, assert the change listener never fired.
5. Build a surface with `makeReduceMotion(false)` and read the same value.
6. Build a surface with reduce-motion **off**, then call `set(true)` mid-session.
7. Inspect the *type* of the animate decision.

## Expected behaviour
- Steps 1–3 → **not animated**, on all three paths, each reached from its own trigger.
- Step 4 → the listener list is empty. This is L-006's remedy applied directly: `set(true)`
  also fires `onChange`, so a test that used it would prove "the controller reacts to a
  change notification" — which was never in doubt — while the path actually under test
  (reading the port's current value at start-up) went unasserted. Disabling the other
  cause is what makes these three tests mean what they claim.
- Step 5 → **animated**. Without this, steps 1–3 pass against an implementation that never
  animates anything.
- Step 6 → the mid-session change reaches the controller. This is the other door, and it
  is asserted on its own so it can never stand in for steps 1–3.
- Step 7 → a **boolean**. A number — 0, or 80 ms — would mean the scroll still animates
  and the clause has been quietly reinterpreted as "faster".

## Test data
| Field | Value |
|-------|-------|
| Reduce-motion double | `makeReduceMotion(true)` / `makeReduceMotion(false)` (`FakeReduceMotion`) |
| Submit utterance | `add qamob-ac30-g3` |

## Notes
- **What this TC cannot falsify.** That a smooth scroll actually lands where it claims,
  and that no intermediate frames are painted under reduce-motion. Frames are device-tier
  (TC-009). What is asserted here is that the animation decision is off for all three
  paths and that the port is the cause.
- The affordance itself "does not depend on motion" (design): presence, wording and accent
  carry the whole meaning, and only the scroll it triggers changes. That is why this TC
  asserts on the scroll decision and not on the pill.
- Mutation-checked: inverting the animate decision fails 6 cases.
