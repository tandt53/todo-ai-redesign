# BRIEFING — T-194

- **Task ID:** T-194 · **Feature:** F-002 · **Agent:** spec-agent · **Date:** 2026-08-21
- **Description:** F-004 is committed and scheduled, not reserved

## Tiny and surgical. Two sentences in two files. Change nothing else.

The owner answered a question the voice-first audit raised. **No user to interview, no
prototype, no restructuring, no AC added or touched.**

## The decision

Full record: `docs/reports/owner-decision-2026-08-21-the-app-speaks-on-open.md`.

- **At MVP the app is silent.** It answers when asked and says nothing on its own. **This is
  now a decision, not an accident** — F-002's shape was correct and nobody had said so on the
  record. Say it.
- **After MVP: on open, the app waits about two seconds, then greets and says what is still
  left to do today.** That is F-004, and **it is committed with content and a position.**
- **The ~2s pause is part of the decision, not a detail.** The owner said *wait, then speak*.
  A user who opened the app to look at something gets two seconds to start before a voice
  begins. **Whatever cancels the greeting inside that window has to exist** — speaking over a
  user who has already started typing is the failure the pause exists to prevent. That is
  design's to draw; record that it is owed.

## Why this matters more than its size

**F-002 currently defers the spoken summary to F-004. F-004 has no spec file, and both F-002
and the index call it *"reserved, not committed"*. So the requirement is deferred by citing a
feature that exists only because F-002 deferred it.**

**`UC-20 AC-20.6` carries a note saying this exact requirement was already lost once to a
rewrite and restored.** Leaving it as *reserved* is how it gets lost a second time.

## The two edits

1. **`docs/specs/assistant/F-002-talk-back.md:297`** — currently
   *"The spoken day summary (UC-20 AC-20.6) — **reserved as F-004, not committed**."*
   Becomes **committed and scheduled after MVP**, with its content stated: a greeting plus
   what remains today, after a ~2s pause on open. Keep the rest of the bullet — the
   local-data / no-model / works-offline properties are still true and are why it is cheap.
2. **`docs/specs/assistant/index.md:31`** — *"**F-004 is reserved, not committed**"*. Same
   change, same words.

**Also, in F-002:** state that MVP silence is a recorded owner decision of 2026-08-21, not an
omission. One sentence, wherever it belongs in `## Out of Scope`.

**Line 346 is a traceability row** describing what revision 2 did. **It is history — do not
rewrite it.** If it now reads as stale, add a dated note beside it rather than editing the
record.

## One reading to carry, recorded conservatively

The audit's stronger case was the **passed reminder**: set by voice, delivered only as pixels,
dismissed only by hand. The owner's *"chỉ trả lời khi hỏi"* covers it — **a reminder is not a
reply to a question, so at MVP it stays silent too.** Record that as the reading, not as a
separate decision, so it is one word to overturn.

## Do NOT

- Do not add, renumber or amend any AC.
- Do not touch F-004 itself — it has no file and this task does not create one.
- Do not touch the audit report or any other spec.

## Success criteria

- Both sentences changed, both saying **committed and scheduled after MVP** with the content
  named.
- The ~2s pause and the cancel-affordance-is-owed note are in F-002.
- MVP silence is stated as a decision with its date.
- AC count unchanged in F-002 — verify by counting.
- `bash .claude/tools/spec-check/declared-elements.sh docs/specs/assistant/F-002-talk-back.md`
  exits 0.
