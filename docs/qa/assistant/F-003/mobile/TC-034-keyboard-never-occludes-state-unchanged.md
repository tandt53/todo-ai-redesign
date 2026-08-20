# TC-034: The software keyboard never occludes the composer or the newest message; showing it changes no conversation state

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-034 |
| Feature | F-003 (mobile-surface) |
| Platform | mobile |
| Acceptance criteria | AC-10 |
| Type | edge |
| Priority | P1 |
| Status | draft |
| Automation | manual |
| Automation file | — |
| Targets | ios, android |
| Tier | device-lab (occlusion + rotation) + node-headless (state invariance, see TC-035) |
| Created | 2026-08-16 by qa-mobile-agent |
| Last updated | 2026-08-17 by qa-mobile-agent |

## Summary
The keyboard is the mobile-only surface that can hide the two things the user most needs to see: what they are typing, and what the assistant just said. AC-10 requires that neither is ever occluded, that show/hide is state-neutral (it neither sends nor cancels a turn), and that composer text survives keyboard toggling **and device rotation**.

## Preconditions
- Real devices/simulators: one iOS, one Android. Both orientations available.
- Account `qamob-tc034@qa.example.com`; a conversation with at least one message and a long newest message.

## Test steps
1. Focus `assistant-composer-input` to raise the keyboard. Screenshot.
2. Measure: is any part of the composer or of the newest conversation message behind the keyboard?
3. Type text. Dismiss the keyboard. Read the composer, the conversation state, and the request spy.
4. Raise the keyboard while the surface is **thinking**; then while it is **listening**; then with a question pending.
5. Rotate the device with text in the composer and the keyboard up; rotate back.
6. Repeat with the largest system text size and with a third-party keyboard of non-default height.

## Expected behaviour
- With the keyboard up, the full composer **and** the newest conversation message are visible — the conversation scrolls rather than being covered.
- Step 3: composer text is intact after dismiss; the conversation state is unchanged; the request spy records **zero** turns. Show/hide neither sends nor cancels.
- Step 4: raising the keyboard during thinking does not cancel the in-flight turn; during listening it does not stop capture-or-send; with a question pending it does not resolve the question.
- Step 5: composer text survives rotation in both directions, and the newest message is still visible after each rotation.
- Step 6: the guarantee holds at maximum text size and with a taller third-party keyboard — an implementation that hardcodes a keyboard height fails here.

## Test data
| Field | Value |
|-------|-------|
| user | qamob-tc034@qa.example.com |
| composer text | `qamob-tc034 văn bản còn nguyên` (diacritics probe rotation-safe encoding) |

## Notes
**Not automatable at the node tier — the spec names "keyboard occlusion and rotation" in its device-lab list.** Occlusion is a rendered-geometry property; asserting a `KeyboardAvoidingView` prop would test the source text, not the observable (L-002). The **state-invariance** half of AC-10 is node-testable and lives in TC-035; this TC owns the geometry and is device-lab debt.
