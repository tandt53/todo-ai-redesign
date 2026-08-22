# BRIEFING — T-211

- **Task ID:** T-211 · **Agent:** design-agent · **phase:** `screens` · 2026-08-22
- **Description:** Redraw the nine mockups against the softened language

## What changed under you

You revised the system yesterday: **radius back on a six-step scale**, **the 1px rule demoted**
to three earned cases with space and ground primary, and **1920 answered by turning the row
rules off** after the two-column tier lost its own render.

**The nine mockups are still v2-square.** `design-check` is **127 / 10**, and all ten are one
retired token (`--radius-bubble`) still declared in them. Redrawing clears it.

## The owner made one decision that changes a screen's shape, not its paint

They looked at the specimen on a phone and said the form uses too many borders, *and asked what
happens when the task detail carries many fields of different kinds.*

**Measured on your own drawing: 10 bordered fields across 7 rows plus 3 segmented groups**, with
note · priority · deadline · reminder · repeat · steps still owed and steps growing.

**That is where your border rule contradicts itself.** *An input field is one of the three
places a line earns its place* — true for one field, and multiplied by this screen it is exactly
the grid the rule exists to remove.

**The deeper thing, and the owner's answer:** nobody fills this screen and submits it. AC-2
saves on blur; there is no Save button. **It is a property sheet.**

> **A property is a row showing its current value. Tap it and the picker opens.**
> *Deadline · Fri 6:00 PM* — tap, the calendar appears.

| | |
|---|---|
| typed — name, note | keep an affordance; **it may appear only when empty, hovered or focused** |
| picked — priority, deadline, reminder, repeat | **a row, no box** |
| steps | a list |

**Twelve boxes become two. Draw it; do not re-litigate it.** The owner took the cost: two
changes in a row means two pickers.

**Full record:** `docs/reports/owner-decision-2026-08-22-the-detail-is-a-property-sheet.md`.

## One thing you must NAME and must NOT settle

**AC-2's save-on-blur is written for fields. A picker row has no blur in that sense** — it has
an open, a choice and a dismiss, **and a dismiss without a choice must not write.**

**Say so in your return. Do not answer it in the drawing.** It is T-213, spec-agent's. A mockup
that quietly implies a commit moment is a spec written in the wrong file.

## Scope

**Nine mockups** — app shell · Talk · task detail, each web / iOS / Android — **and the
all-in-one page**. Same four surfaces as before; the lists menu, settings, new list and the
trash are still tranches 2 and 3.

**Also finish what tranche 1 left:** `components.md` still has five sections marked stale at
their own heads (§ ListsMenu · § SettingsRow · § ListEditorSheet · § Drawer · § Spoken frames)
— **leave those for tranche 2**, but the sections this redraw touches must match what you draw,
including the new property-row pattern, which `§ TaskDetail` and `§ Field · Label · FormRow`
do not yet describe.

## Both self-checks apply, and the second is new

**`### Self-review with eyes`** — as always.

**`### Accessibility self-check`** — added to your agent file on 2026-08-22 at the owner's
request, and **this is the first dispatch that runs it.** Four browser probes plus two questions
you answer yourself. **Record every answer under `a11y_review:`, empty lists included.**

**It matters more than usual here:** a property row that opens a picker is a **custom control**.
It needs a role, a name, a keyboard path, and a focus return when the picker closes — none of
which a bordered `<input>` needed you to think about.

## Read these

1. `docs/design/_shared/specimen.html` — the softened system, rendered. The screens are held to it.
2. `tokens.json` — the radius scale, `border.when_a_line_earns_it`, `layout.ultra_answer`, and
   **`layout.two_column_tested_and_rejected`, so you do not re-propose it.**
3. `docs/reports/owner-decision-2026-08-22-the-detail-is-a-property-sheet.md`
4. The running app, `http://localhost:5173/?qaUser=design-audit-1787320423`.

## Write to

`docs/design/assistant/screens/` (nine mockups + `index.html`) and `docs/design/_shared/components.md`.

## Success criteria

- **`design-check` green.** Ten failures go to zero, or each survivor is named with its reason.
- The task detail is a **property sheet**: rows for picked values, boxes only where something is
  typed. **Count the painted lines in your return and compare to the 13 you measured before.**
- **No testid invented, none renamed.**
- `a11y_review:` present, with the picker row's role, name, keyboard path and focus return.
- The AC-2 commit-moment question is **named and left open.**
- `index.html` rebuilt and opening by double-click.
