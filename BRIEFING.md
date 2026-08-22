# BRIEFING — T-215

- **Task ID:** T-215 · **Agent:** design-agent · **phase:** `screens` · 2026-08-22
- **Description:** Ground instead of border on typed fields, plus two defects in the same renders

## The owner signed off your screens and answered all three questions

Record: `docs/reports/design-signoff-core-screens.md`.

**Q1 — do you know where to tap to change the deadline?** *"Biết."* The property row reads.

**Q3 — two pickers, or a tray that stays open?** *"2 picker."* **Settled: each property opens
its own picker and it closes on choosing.** Do not build a tray. *(It also removes a question
that would have reached AC-2 sideways — a tray walking between properties has no obvious
commit moment at all.)*

**Q2 is the one with work in it**, and the owner did not just approve — they supplied a better
option:

> *"Đủ rồi. Nếu hiển thị nền khác cho dễ nhận biết, ta có thể bỏ border đi."*

## Change 1 · a typed field gets a GROUND, not a border

**This is your own `border.separation_order`** — space, then ground, then type weight, and only
then a line. The rule was already written; the field was the one place still reaching past it.

**It pays where it costs most.** `detail-blank` at 390 draws a boundary on **both** the name and
the note, precisely because they are empty — the state with the most boxes in the whole screen.
A ground says *type here* without four edges.

**Keep the affordance honest:** it must still be obvious the thing is editable when empty,
hovered and focused. **Focus is the one place a visible boundary is not optional** — 2.4.7 needs
a focus indicator, and the ground alone will not carry it.

**Check the contrast of the new ground against the page** — `bg.sunken` on `bg.base` is a real
pair and it is on the published list.

## Change 2 · "Add a step" is drawn twice

On the phone, `detail-blank` shows a `+ Add a step` row **and** an `Add step` button. **One
action, two affordances**, on a screen whose owner's standing brief is *simple, soft, easy, as
few actions as possible.*

**Neither the visual review nor the a11y probes caught it and neither could** — a duplicate
affordance is valid in every mechanical sense. Pick one and delete the other; check the other
platforms for the same thing.

## Change 3 · the iOS sheet is wearing web's clothes

`task-detail-ios-detail-deadline-pick-390.png` holds **browser-default `date` and `time`
inputs**, Chrome's calendar and clock glyphs and all, inside an iOS bottom sheet. **On iOS that
control is a wheel.**

Your own platform table says *putting a FAB on iOS is wearing another platform's clothes.*
**This is the same mistake in the other direction.** Draw the platform's own control — and
**check Android too**, where the answer is a Material date picker, not the same web input.

## Scope — bounded, do not widen

Nine mockups where they are affected, `index.html`, and the `components.md` sections these
three changes touch (`§ Field · Label · FormRow`, `§ PropertyRow`, and the platform table if
change 3 moves it).

**Do not** draw the lists menu, settings, new list or the trash. **Do not** revisit the picker
model, the property-sheet decision, radius, or the 1920 layout — all settled.

## One thing you reported that is NOT yours to fix here

`border.budget_boxes: 5` is unreachable by construction. **You do not own `tokens.json` in
`phase: screens` and that has not changed** — it is T-214. If change 1 moves the count, say so;
do not edit the token.

## Both self-checks again

**Visual review** and the **accessibility self-check**. Change 1 touches focus visibility and
change 3 touches a control's role and keyboard path, so probes 1, 2 and 5 are the live ones.
**Record `a11y_review:` with counts, empty lists included.**

## Success criteria

- `design-check` still green, or each failure named.
- **`detail-blank` at 390 has no field boxes**, and the field is still obviously editable —
  say how you verified that in a screenshot rather than in the CSS.
- Focus remains visible on both typed fields, on every platform.
- One "Add a step" affordance, across all three platforms.
- iOS and Android pickers use their own controls.
- No testid invented, none renamed. `index.html` rebuilt.
