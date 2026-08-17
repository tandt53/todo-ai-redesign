# BUG-004 — the conversation never scrolls to the newest message

- **Severity:** HIGH on mobile, MEDIUM on web — the reply to what you just said can land off-screen with no indication
- **Found:** 2026-08-17 (T-057), confirmed on the iOS Simulator; reproduced on web and on the react-native-web render
- **Status:** OPEN
- **Affects:** `src/assistant/mobile/components/ConversationList.tsx:299` and `src/assistant/web/components/ConversationPane.tsx` — **both clients, same omission**

## What happens

Send a turn. The outcome message is appended below the fold and **the view does
not move**. On a phone, once the conversation is a few turns long, the user taps
send and sees nothing change — the answer is there, just not on screen.

Worst case observed on the simulator: a bulk-delete confirmation rendered with
its two chips (`Xoá 3 việc` / `Giữ lại`) below the visible area. That is a
**destructive action whose only affordance is off-screen**, and the message that
asked the question is what pushed it there.

## Root cause

Neither client scrolls. Grep across both components finds no `scrollToEnd`, no
`onContentSizeChange`, no `scrollIntoView`, no `inverted` list:

- mobile — `ConversationList.tsx:299` renders a plain `<ScrollView>` with no ref and no scroll effect
- web — `ConversationPane.tsx` has no scroll call at all

This is not a regression. It has never been implemented on either client.

## Why nothing caught it

- **No AC requires it in the general case.** The nearest is **F-003 AC-10**, which
  requires that *"the software keyboard never occludes the composer or the newest
  conversation message"* — but that AC is scoped to the keyboard, and it is one of
  the four ACs still **unticked** pending a device pass. The non-keyboard case —
  a reply arriving while the user sits still — is specified nowhere.
- **The unit tier cannot see it.** Tests assert on model state and on rendered
  output, never on viewport position; a message that exists but is scrolled out of
  view is indistinguishable from one in view.
- **The QA browser tier cannot see it either**, for the same reason, unless a case
  explicitly asserts visibility rather than presence.

Worth recording how it surfaced: it was hit three separate times during screenshot
capture (browser, react-native-web, simulator) and twice written off as a defect in
the capture harness before the third occurrence made it obvious it was the app.
A workaround applied in tooling is how a real defect stays invisible.

## Fix

Scroll to the newest message when messages are appended, on both clients, and
respect `prefers-reduced-motion` / `AccessibilityInfo.isReduceMotionEnabled` for
the animation. Two behaviours worth deciding rather than assuming, and they are
product calls, not implementation details:

1. **Should it scroll when the user has scrolled up to read history?** Jumping
   away from what someone is reading is its own defect. The usual answer is: only
   auto-scroll when already near the bottom, otherwise show a "new message"
   affordance.
2. **Does the confirm question get special treatment?** It carries a destructive
   action; arguably it must be brought into view unconditionally.

## Related

- **F-003 AC-10** is unticked and device-pending. A device is now available
  (iOS Simulator, `.mobile-app/`), so the keyboard half can finally be verified —
  and it should be verified *after* this fix, since the two interact.
- Any new AC written for this belongs in F-001 (both platforms inherit it), not
  in F-003.
