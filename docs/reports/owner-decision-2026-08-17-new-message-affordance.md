# Owner decision, 2026-08-17 — how the conversation follows new messages

Resolves the two open questions in
`qa/_shared/bugs/BUG-004-conversation-never-scrolls-to-newest-message.md`.

## The decision

**Slack's behaviour, and no exception for the destructive confirmation.**

1. **Scrolled to the bottom** — new messages arrive in view, as they would in any
   chat surface. (Implicit in the choice; stated here so it is not left to the
   implementer.)
2. **Scrolled up, reading history** — the view **does not move**. The user is not
   dragged away mid-sentence.
3. **One affordance, not one per message.** A single notification sits **near the
   composer**. It does not multiply: five messages arriving while the user reads
   produce the same one affordance, not five.
4. **Tapping it scrolls to the bottom.**
5. **The bulk-delete confirmation gets no priority.** It uses the same affordance
   as everything else. The owner was offered a carve-out — the confirm question
   blocks on an answer and its two chips are the only way to give one — and
   declined it in favour of one consistent rule.

Owner's words: *"giống như case tin nhắn mới, behave giống như Slack. Chỉ có 1
layout thông báo ở gần textbox, user click vào thì sẽ tự scroll xuống cuối."*

## What this means for the confirm question — stated, not hidden

Under rule 5 a user who has scrolled up can be asked *"Delete 3 tasks?"* and not
see it. The app waits on an answer the user has no indication is pending, beyond
the same generic affordance any message produces.

That is a deliberate, informed trade — consistency over a special case — but it
puts weight on **one thing the affordance must do well**: it has to make clear
that something is *waiting*, not merely that something *arrived*. Whether that is
wording, a count, or a state on the affordance is design's call, and it is the
single most load-bearing detail of this feature. It should not ship as a bare
"new messages" label.

## Scope

Both clients. The new AC belongs in **F-001** — both platforms inherit it — not in
F-003, per BUG-004's own routing note.

Respect `prefers-reduced-motion` / `AccessibilityInfo.isReduceMotionEnabled` for
the scroll animation.
