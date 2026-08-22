# Owner decision — 2026-08-22 — the task detail is a property sheet

**Raised by the owner looking at the specimen on a phone:** *"nó dùng nhiều border trong màn
hình này ấy. Hãy nghĩ xem mang task detail sẽ có rất nhiều fields với loại khác nhau."*

**Measured, and worse than the impression.** The current drawing carries **10 bordered fields
across 7 rows plus 3 segmented groups**, and the spec still owes note · priority · deadline ·
reminder · repeat · steps — with steps growing. Stacked vertically that is a wall of boxes.

## This is where the new border rule contradicts itself

The softened rule says *an input field is one of the three places a 1px line earns its
place.* **True for one field. Multiplied by a task detail it produces exactly the grid the
rule exists to remove.**

## And the deeper error: it is not a form

**Nobody fills this screen and submits it.** `F-005 AC-2` saves on blur and there is no Save
button. The user opens a task, glances at what it has, and changes one thing.

**It is a property sheet**, and that is how every comparable draws it — Things 3 has no boxes
at all; Apple Reminders puts N properties in **one** rounded container with inset separators;
Notion and Linear keep property rows borderless until hover.

## Chosen

**A property is a row showing its current value. Tap it and the picker opens.**

*Deadline · Fri 6:00 PM* — tap, the calendar appears. Not a bordered control sitting open on
the screen waiting to be used.

| | |
|---|---|
| **Typed values** — name, note | keep an affordance, because you must find where to type. It may appear **only when empty, hovered or focused** rather than permanently |
| **Picked values** — priority, deadline, reminder, repeat | **a row, no box** |
| **Steps** | a list, not a form |

**Twelve boxes become two.**

**The cost the owner accepted:** changing two properties in a row means opening two pickers.
The gain is that the screen is readable at a glance and short on a phone, and that it obeys
*ít thao tác càng tốt* for the common case, which is changing one thing.

## The consequence that is not paint, and is not the drawing's to settle

**`AC-2`'s save-on-blur is written for fields.** A row that opens a picker has no blur in the
same sense — it has an open, a choice and a dismiss, and a dismiss without a choice must not
be a write.

**The drawing names this; the spec answers it.** Nothing in the redraw may quietly redefine
when a value is committed.
