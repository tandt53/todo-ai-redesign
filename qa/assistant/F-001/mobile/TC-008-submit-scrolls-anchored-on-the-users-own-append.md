# TC-008: Submitting a turn scrolls to the bottom — anchored on the user's own append

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-008 |
| Feature | F-001 (voice-assistant-view) |
| Platform | mobile |
| Target | iOS (real assistant server, in-process) |
| Acceptance criteria | AC-30 (h), AC-3 |
| Type | happy |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/mobile/F-001-voice-assistant-view.spec.ts:728 |
| Created | 2026-08-17 by qa-mobile-agent |
| Last updated | 2026-08-17 by qa-mobile-agent |

## Summary
The single exception to "the view never moves on its own", and it is granted to the
**user's action**, never to a message's importance. AC-30 (h) is precise about the moment:
"the append of the user's own message, not the submit gesture" — because F-001 renders the
user's turn optimistically, and a scroll computed at gesture time lands short by exactly
that row.

## Preconditions
- The real in-process assistant server (`createApp` → `http.Server` on an ephemeral
  port); only model interpretation is stubbed, per F-001 ## Test strategy. Orchestration,
  the confirmation gate, persistence and session lifecycle all run real.
- Namespace `qamob-ac30-`; one uuid user per test (foundations §10).

## Test steps (mobile)
1. Start a surface, type `add qamob-ac30-h1`, and call submit. **Synchronously**, before
   awaiting anything, read the conversation.
2. Await the submit and let the outcome settle; read the conversation again.
3. Compute "the bottom" from the metrics as they stand **at the gesture**, then grow the
   content by one message row (the user's own, 176 units) and measure what distance is
   left over.
4. Start a surface, leave the composer empty, and submit.
5. Submit a real turn, let the reply arrive, and compute the follow decision for that
   reply from the post-submit position.

## Expected behaviour
- Step 1 → the conversation holds **exactly one** message and it is the user's own. The
  gesture and the append are two different instants and the append has already happened;
  the outcome has not.
- Step 2 → the user's row is still first, and the assistant's outcome now follows it.
- Step 3 → the left-over distance equals exactly one row (176), which is **greater than
  the threshold**. So a scroll aimed at the gesture-time bottom is a real miss, not one
  absorbed by (a)'s slack, and the surface is still not at the bottom afterwards.
- Step 4 → **nothing is appended** and the interpreter is never called. AC-30 (h): "A
  submit that appends nothing — AC-3's cancel-before-send, which renders nothing —
  scrolls nothing."
- Step 5 → the reply follows on its own, leaving nothing unseen. "Nothing is pinned
  beyond that append": having scrolled, the user is at the bottom by (a), so the reply
  arrives in view through (b). There is no follow-this-turn-until-it-resolves mode.

## Test data
| Field | Value |
|-------|-------|
| Utterances | `add qamob-ac30-h1`, `add qamob-ac30-h4`, and the empty string |
| User row height | 176 logical units (test data; BUG-004's own measurement) |
| Namespace | `qamob-ac30-`, one uuid user per test |

## Notes
- **What this TC cannot falsify.** That the surface actually scrolls on submit, and that
  it lands at the bottom. The anchor — that the user's own message is appended by the
  submit, before any outcome exists — is proved here on the real surface, and the
  arithmetic of the miss is proved here too. Which instant the RN component reads its
  metrics at is device-tier (TC-009).
- (h) does not reopen the owner's rule 5: a bulk-delete confirmation that arrives without
  a send from this user is still governed by (c) and (e) — see TC-003 and TC-005.
