# Owner decision — 2026-08-21 — the app speaks on open, after MVP

**Answers D1 of `docs/reports/audit-voice-first-2026-08-21.md`.** The audit found that
`F-002 § What speaks` has **14 speaking rows and every one is a reply to a turn the user
issued** — *the app only ever speaks when spoken to* — while the two things it is already
specified to say unprompted are both specified as pixels.

---

## The decision

**MVP: silent. The app answers when asked and says nothing on its own.**

**After MVP: on open, wait about two seconds, then a greeting and a summary of what is still
left to do today.**

## The two-second pause is part of the decision, not a detail

The owner did not say *"speak on open"*. They said **wait, then speak**. That is a different
product: a user who opened the app to look at something has two seconds to start doing it
before a voice begins, and a user who opened it hands-free gets the sentence anyway.

**Whatever cancels the greeting in that window is design's to draw and has to exist** —
speaking over a user who has already started typing is the failure the pause is there to
prevent.

## What this fixes beyond answering the question

**F-004 stops being circular.** Today `F-002` defers the spoken summary to F-004, `F-004` has
no spec file, and `index.md` calls it *"reserved, not committed"* — **so the requirement is
deferred by citing a feature that exists only because F-002 deferred it.** UC-20 AC-20.6
carries a note saying this exact requirement had already been lost once to a rewrite and
restored.

**It is now committed, with content and a position: after MVP, greeting plus what remains
today.** *Reserved* becomes *scheduled*.

**And the MVP silence is now a decision rather than an accident.** F-002's shape was correct
and nobody had said so on the record. It is said here.

## The one thing this answer leaves ambiguous, read conservatively

The audit recommended speaking **the passed reminder** as the stronger of the two cases: *a
reminder the user set BY VOICE, delivered only as pixels and dismissible only by hand.* Every
comparable product cited speaks it — Alexa, Google Assistant, Maps.

*"Chỉ trả lời khi hỏi"* covers it: **a reminder is not a reply to a question, so at MVP it
stays silent too.** Recorded as the reading rather than as a separate decision, because it is
one word to overturn and expensive to have got backwards silently.

## What follows

- **F-002's `## Out of Scope` says F-004 is committed and scheduled, not reserved** — and
  says what it contains.
- **`index.md`'s F-004 line changes the same way.**
- **F-007 (the model authors the reply) does not need a speaks-unprompted channel at MVP**,
  which is the answer the audit said was cheaper to have before F-007's spec than after.
- **The audit's other five findings are unaffected** and route separately. **F3 in particular
  is not a voice-first question at all**: nothing says how an utterance ends, and
  `DESIGN.md` and `components.md` answer it differently — one says end-of-speech auto-sends,
  the other labels the control *"tap to stop"*, which under `F-001 AC-3` is a **cancel**.
  **The most-used interaction in the product is the only one with no AC.**
