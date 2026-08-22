# BRIEFING — T-210

- **Task ID:** T-210 · **Agent:** design-agent · **phase:** `system` (revision) · 2026-08-22
- **Description:** Soften the language — radius back, fewer borders, 1920 rethought

## The owner looked at your screens and gave four instructions

> *"Design dùng element có góc vuông xấu quá, nên bo góc tròn cho mềm mại hơn. Đôi khi layout
> hiển thì nhiều element có border nhiều quá làm xấu cả màn. Về web đặc biệt chú ý với kích
> thước 1920 trở lên, hiện tại nó xấu điên. Giao diện nên đơn giản, mềm mại, dễ dùng, ít thao
> tác càng tốt."*

Full record: `docs/reports/owner-decision-2026-08-22-soften-the-language.md`.

**This is a revision, not a replacement.** The direction they signed off — light ground, one
accent, the time rail, three accents down from five — **is not reopened.** Adjust it.

## 1 · Corners are rounded

`tokens.json` currently says `radius.none: 0` on everything structural and its own note calls
that *"the single biggest shape change from v1"*, arguing it at length.

**The owner has looked at it and it reads hard.** The argument was good and the render
disagrees with it. **The scale, and which components take which step, is yours. That radius
applies is not.**

## 2 · There are too many borders

**Measured on `app-shell.html`: 46 border declarations, 15 of them a full box around an
element.**

**The 1px-rule principle is sound. The density is the defect.** Every element got one, so the
page reads as a grid drawn over the content instead of content with structure in it.

Most of what a border currently separates can be separated by **space**, by **ground**, or by
**nothing**. Keep the rule where it carries meaning — and the count above is the evidence that
it does not currently.

**Give yourself a number you can check.** A density rule design-check could enforce is worth
more than a principle it cannot.

## 3 · Web at 1920+ is the one they named, and it is NOT the gutter

You already made the leftover symmetric — **220/220, down from 0/780** — and the owner says it
is still *xấu điên*. **The measurement got fixed and the look did not.** Do not re-solve the
gutter.

**What the render actually shows:** the list is 820 wide, and a row holds a time, a checkbox
and a title. **Roughly half of every row is empty horizontal space**, so at 1920 the rows read
as stretched hairlines across a very wide screen. Even gutters did nothing about a row that is
mostly nothing.

**That is a layout question.** A wide screen either gives the row **more to hold**, or gives it
**less width**, or **stops being a single list**. Pick one and argue it. The current answer is
the one the owner rejected.

## 4 · The standing brief, and the clause that gets dropped

> **Simple · soft · easy to use · as few actions as possible.**

**The last clause is about interaction, and this is a visual pass, which is exactly why it will
go missing.** Write it into `DESIGN.md` as a principle the screens are held to. Where a screen
can lose a tap, it should — and if your ≥1920 answer adds one, that is an argument you owe.

## Read these

1. `docs/reports/owner-decision-2026-08-22-soften-the-language.md`
2. `docs/design/_shared/specimen.html`, `DESIGN.md`, `tokens.json` — your own system.
3. `docs/design/assistant/screens/app-shell.html` at **1920** — the state complained about.
   Render it. Do not reason about it from the CSS.

## Write to

- `docs/design/_shared/tokens.json`, `DESIGN.md`
- **`docs/design/_shared/specimen.html` — update it in the same pass.** It is the artifact the
  owner judges; a system whose specimen still shows square corners has not changed.

**Do not redraw the nine mockups here** — that is T-211, once this is settled. Same reason as
before: a system and the screens built against it in one dispatch has no standard to meet.

## Success criteria

- Radius applies to structural components; the scale is stated with what takes which step.
- **A border-density rule exists and is checkable**, and the count in `app-shell.html` has a
  target to come down to.
- The ≥1920 answer is a **layout decision with an argument**, not more spacing.
- Fewest-actions is a principle in `DESIGN.md`, not a note.
- **`specimen.html` re-rendered and looked at** — screenshot it and read the PNGs before you
  return. Every previous defect in this project was caught that way and none by reading.
- Your return ends with `review_guide:` — two or three plain questions about the new specimen.
