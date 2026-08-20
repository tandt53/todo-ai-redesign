# TC-037: Every conversation message is announced to VoiceOver / TalkBack without moving focus

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-037 |
| Feature | F-003 (mobile-surface) |
| Platform | mobile |
| Acceptance criteria | AC-12, F-001 AC-19 |
| Type | accessibility |
| Priority | P1 |
| Status | draft |
| Automation | manual |
| Automation file | tests/assistant/mobile/F-003-mobile-surface.spec.ts (payload half only) |
| Targets | ios, android |
| Tier | manual-pass (real screen reader) + node-headless (announcement payload) |
| Created | 2026-08-16 by qa-mobile-agent |
| Last updated | 2026-08-17 by qa-mobile-agent |

## Summary
F-001 AC-19's live-region requirement maps to the native announcement APIs. **Every** message in F-001's Conversation model list is announced, without moving focus. Announcing the state word alone does not satisfy this: the screen-reader user must receive what changed, how many, which tasks by title, and that undo is available — the same information a sighted user reads from the message.

## Preconditions
- Real iOS device with VoiceOver on; real Android device with TalkBack on.
- Account `qamob-tc037@qa.example.com`; each message kind reachable.

## Test steps
For each message kind — applied · reverted · nothing-reverted · undo-refused · clarify question · confirm question · resolution outcome (executed / declined / declined-superseded / already-resolved) · no-match · session-closed boundary marker · queued-turn notice:
1. Drive the surface to produce it with the screen reader running.
2. Record what the screen reader speaks, verbatim.
3. Record where accessibility focus is before and after.
4. For the applied message, verify the spoken content includes the count, each changed task **by title**, and the availability of undo.
5. Navigate the surface by swipe afterwards and confirm the new message is reachable in the reading order.

## Expected behaviour
- All 11 message kinds are announced. A kind that is silent fails — this is the enumeration AC-12 requires and F-001 AC-19 already lists.
- Accessibility focus does **not** move on announcement; the user's reading position is preserved.
- The applied announcement carries what changed, how many, which tasks by title, and that undo is available. "Đã áp dụng" alone fails. The state word alone fails.
- The announcement is in Vietnamese (the interface language) and reads correctly with diacritics.
- Each announced message is subsequently reachable by swipe navigation in reading order.

## Test data
| Field | Value |
|-------|-------|
| user | qamob-tc037@qa.example.com |
| screen readers | VoiceOver (iOS), TalkBack (Android) |

## Notes
**Manual by specification.** AC-12 says "verified against a real screen reader on a device, not inferred from the tree (W3C F103)" — the same clause F-001 AC-19 carries, and F-001's web run left the equivalent manual AT pass open. The **payload** half is node-testable if an announcement seam exists: assert the string the client hands the announcer carries count + titles + undo. **That seam is not in the platform doc's port list** — see the open question raised in `index.md`. Without it AC-12 is 100% manual, which is a materially worse position than F-001's web surface.
