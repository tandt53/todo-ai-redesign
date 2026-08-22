# BRIEFING — T-218

- **Task ID:** T-218 · **Agent:** design-agent · **phase:** `screens` · 2026-08-22
- **Description:** One gutter rule, Android's AM/PM, and better copy for an empty name

## The owner reviewed your three states and passed all three questions

*Does the ground read as editable?* — **yes.** *Do the iOS wheel and Android calendar look
native?* — **yes.** *Is Clear below the fold acceptable?* — **yes.**

**Three things came back, one of them structural.**

## 1 · The typed fields sit on a different gutter from everything else

> *"title và description đang có độ kích thước và căn lề không giống các element khác"*

**Measured at 390 in `detail-blank`, and both edges are off rather than one:**

| | left | right | text starts |
|---|---|---|---|
| title ground · note ground | **4** | **386** | 16 |
| property block | **16** | **374** | 24 |
| Delete button | 16 | — | — |

**The two grounds are 12px wider on each side than everything else on the screen, and the
text inside them does not line up either.**

**This reads as a half-finished optical alignment.** Bleeding a ground out by its own padding
so the *text* lands on the gutter is a real technique — **it works only when everything else
puts its text on that gutter too, and the property rows do not.** So neither the grounds nor
the text agree with anything.

**Pick ONE rule and apply it to every block on the screen**, then write it in `components.md`
so the next surface inherits it rather than re-deciding:

- every ground shares a left edge and every text is inset by the same amount, **or**
- every ground bleeds by its own padding and every text lands on one gutter.

**Also answer the size half.** The owner said *"kích thước và căn lề"*. The title is 31px
against 16 everywhere else — **it is the heading and the name of the thing, so large is
probably right, but they raised it and it deserves an answer rather than an assumption.**
Check it at 390 in a render, not in the CSS.

## 2 · Android's AM/PM is stacked and should be horizontal

The owner liked the Android calendar and named exactly one thing wrong in it: **the AM/PM
selector runs vertically. Lay it horizontally.**

*(Worth noting when you touch it: you already found and fixed this control once, for being
48×34.5 against Android's 48dp floor. Do not lose that.)*

## 3 · `Name this task` wants better copy

**This screen is reached straight after a task is created by voice** — the metadata line right
under it says *"Added just now · by voice"*. So this placeholder is **the first thing a new
task says to its owner.**

`Name this task` is an instruction to do work. Something that reads as the task waiting to be
named would sit better with *simple, soft, easy*. **Your call; the house vocabulary in
`components.md § Buttons` binds the words, and this is a placeholder rather than a label, so
check what that section allows before inventing one.**

**English — `ADR-008`.**

## Scope

The three task-detail mockups, `index.html`, and the `components.md` sections these touch.
**Nothing else moves.** Not the property-sheet model, the picker model, radius, the 1920
layout, or the ground-instead-of-border decision — all settled and all signed off.

**The gutter rule may touch the app shell if it is genuinely one rule for the system.** If it
does, say so and change only what the rule forces; do not redraw the shell for tidiness.

## Both self-checks

Visual review and the accessibility self-check. **Change 2 touches a control you already
repaired for a hit-area failure — re-measure it after moving it**, and record probe 3's count
for that state specifically.

## Success criteria

- **One gutter rule, stated in `components.md` and true of every block** on the task detail.
  Prove it with measured left/right edges in your return, the way this briefing did.
- The title's size is answered, not assumed.
- Android AM/PM horizontal, **and still meeting the 48dp floor** — give the measurement.
- New placeholder copy, in English, consistent with the house vocabulary.
- `design-check` still green. No testid invented or renamed. `index.html` rebuilt.
