# Design signoff — F-009 list actions

**Date:** 2026-08-22 · **Design:** T-225, ten states across the three shell mockups
**Gate 1.5:** passed, 0 HIGH from three lenses (`gate15-lenses/F-009-consolidated.md`)
**Verdict: CHANGES REQUESTED — two of three questions returned work, one accepted as drawn.**

## What was shown

The three states design-agent chose in its own `review_guide:`, rendered at 1440 and clipped to
the app frame, plus a fourth for the 1920 question. Not a gallery — three states, chosen by the
agent that drew them, with its own questions asked verbatim.

1. `select-some` — selection mode, three rows selected, bulk toolbar
2. `overflow-open` — the menu with all three item kinds visible at once
3. `search-no-results` — the empty state naming the query
4. `wide-tasks` at a true 1920 viewport, frame released — for the row-gap question

## Q1 — the overflow menu

**Asked:** does it read as a single legible layer, or do the three item kinds fight each other?

**Owner:** *"Menu theo như screenshot. Nhưng cái pop up ở quá xa dấu ba chấm."* — the menu itself
is accepted; its **position** is not. It sits too far from the `⋯` that opens it.

**Measured after the answer, to make the fix specific:** the menu's top edge is **68px below** the
button's bottom edge, and its right edge **overhangs the button's right edge by 82px**. The CSS
sets `position:absolute` with `top:60px`, `right:24px` **and** `left:704px` — it is positioned
against the pane, not against its trigger, so it does not hang off the control at all.

**Change:** anchor the menu to `shell-overflow-button`. Right edges aligned, a small token gap
below. Contents unchanged — the owner accepted those.

## Q2 — selection mode

**Asked:** does the accent-tinted row ground read as "selected" at a glance?

**Owner:** *"Ok. Tôi nhìn được. Nhưng mà layout ko đẹp, checkbox ko có margin, và nó đang dùng
round khác so với selected area."* — the signal reads; the execution does not.

**Measured, and the two complaints turn out to be one defect.** The selected row ground is
`radius.md` 12px; the selection checkbox is `radius.sm` 8px on a 20×20 box; the checkbox's
computed margin is `0px` and its inset from the row's left edge is **0px** — it sits flush against
the ground's edge.

`tokens.json radius.nesting_rule` uses this exact case as its worked example:

> *"A control at sm 8 inset by 4 inside a card at md 12 is correct; the same control at md inside
> it is the concentric-corner mistake."*

So **8-inside-12 is right, and the radius must not change** — `radius.assign.sm_note_checkbox`
records that the checkbox moved from xs to sm by owner decision, and reverting it would undo that.
What is missing is the **4px inset the rule depends on**. With inset 0 the two radii have no
relationship to express, which is exactly why they read as arbitrary.

**Change:** give the checkbox its inset inside the ground. Radii unchanged.

## Q3 — the 1920 row gap

**Asked:** does the ~395px gap between title and right-aligned due date bother you, or read as
margin?

**Owner:** *"hiện tại tôi thấy ok."* — **accepted as drawn.**

**This closes a question that had been open and unraised since T-227**, which was asked to raise it
and did not. The row does not stretch to 1920: it stays 820px and centred, so the gap is about
half a row rather than half a screen. Recorded here so it is not re-opened without new evidence.

## What changed as a result

- **T-247** — menu anchoring, and the checkbox inset. Dispatched with T-246 as one pass, since
  both touch the same three mockups.
- **Gate 1.5 is NOT re-run.** ORCHESTRATION § Gate 1.5 Step 6: re-dispatch a lens only where the
  change touches what that lens found. Anchoring and inset touch neither the dev lens's
  buildability findings nor the tester lens's selector findings nor the spec lens's AC coverage.
