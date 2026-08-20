# TC-030: Clean start — exactly one boundary message carrying the closed session's terminal outcomes

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-030 |
| Feature | F-001 (voice-assistant-view) |
| Platform | web |
| Acceptance criteria | AC-28 |
| Type | edge |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/e2e/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-web-agent |
| Last updated | 2026-08-17 by qa-web-agent (T-070b — ADR-008 English copy sync) |

## Summary
Session lifecycle is visible. On a clean start after a close, the surface renders exactly ONE boundary message carrying the closed session's terminal outcomes: the close marker (reason + time), every question declined by close named with its task titles, and any turn that resolved between last foreground and close (applied or failed, tasks named). A stale/closed session starts clean — never pointing at yesterday's conversation as if open. An open session resumes visibly.

## Preconditions
- User `qaweb-tc030@qa.example.com`; baseline seed tasks.
- `GET /assistant/session` stub per api-contracts: `session: null`, `boundary: {close_reason: "idle", declined_questions: [bulk_delete over 3 titles], late_outcomes: [1 applied turn "qaweb Call the bank"]}` (fixture `WEB-B1`).
- Second scenario: `session: Session` (open, with messages) for the resume path. Injectable idle-close timer for the live-close variant.

## Test steps
1. Load the surface against the boundary response. Count boundary markers; read the marker's content; read the conversation above/below it.
2. Assert the invitation/fresh surface follows the marker (mockup `boundary` state).
3. Resume scenario: load against an open session; read the conversation.
4. Live variant: with an open session and a pending question + an applied turn, fire the injectable idle-close timer, then reload → boundary must carry that question as declined by name.

## Expected behaviour
- **Exactly one** `assistant-boundary-marker` renders (count == 1 — the AC's bounded "exactly one").
- **Marker content**: close marker with reason/time ("Session closed — no activity · …"); each declined question named WITH its task titles ("Delete 3 tasks?" + the 3 titles kept); each late outcome with its tasks named ("While you were away: added “…”"). All three parts present when the fixture carries them.
- **Clean start**: no stale open conversation renders above the marker as current; composer empty; the surface invites fresh input. The late-applied task IS in the list (it happened).
- **Resume**: an open session's messages render (visibly resumed — history present, no boundary marker for the open session).
- **Live close**: the question declined by the close appears in the boundary by name on next load (D2: close = declined, visible on next open).

## Test data
| Field | Value |
|-------|-------|
| user | qaweb-tc030@qa.example.com |
| boundary fixture | `WEB-B1` (idle close + 1 declined question + 1 late applied) |

## Notes
The undo affordance never survives the boundary (AC-8, session-bounded) — cross-asserted here: no `assistant-undo-button` renders for the late-applied turn shown in the boundary.
