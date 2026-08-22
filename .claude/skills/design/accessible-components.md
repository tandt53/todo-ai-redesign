# Accessible components

Read when drawing anything that is not a plain button, link or text field:
a dialog, a menu, a set of tabs, a combobox, a disclosure, a toast, a list that
can be reordered. Those are where accessibility is designed rather than added,
because the decisions are about focus and announcement, not about contrast.

Contrast, target size and label-in-name are covered by the design system and by
`design-check`. This file is about the rest.

## The first rule is to use the native element

A `<button>` is focusable, keyboard-operable, announced and styled-state-aware
before anyone writes a line of ARIA. A `<div role="button">` needs a tabindex, a
key handler for Enter and Space, and a disabled state that actually stops the
handler — and it will still be wrong on some platform.

**ARIA is for what HTML cannot express.** Reaching for it first is how a screen
gets less accessible while acquiring more attributes.

## Every control has a name, a role, and a value

Design owes each of the three, in writing, per control:

- **Name** — what a screen reader says. If the control shows text, the accessible
  name starts with that text; a control labelled "Delete" whose name is "Remove
  item" breaks voice control, because the user says what they can see.
- **Role** — what kind of thing it is. Native element or explicit role.
- **Value / state** — pressed, expanded, selected, checked, busy, invalid. A
  state a sighted user can see and a screen-reader user cannot is a defect.

An icon-only control needs a name that is not the icon's name. "Trash" is what it
looks like; "Delete task" is what it does.

## Focus is a design decision

- Opening a layer over the page — dialog, sheet, menu — **moves focus into it**,
  and focus does not escape it while it is open.
- Closing it **returns focus to the control that opened it**. Not to the top of
  the page, and never nowhere: focus landing on `<body>` strands a keyboard user
  with no position.
- Something appearing without being asked for — a toast, an inline error — does
  **not** steal focus. It announces itself instead.
- Focus must be **visible**. If the design suppresses the default ring, it owes a
  replacement with the same contrast, on every control.

## Keyboard, per component kind

| Component | Keys |
|---|---|
| Dialog, sheet, menu, popover | `Esc` closes and returns focus |
| Tabs, radio group, toolbar, listbox | Arrows move **within**; `Tab` leaves the group entirely |
| Menu, combobox | `Enter` activates, `Esc` closes, arrows move, typing jumps |
| Anything draggable | A keyboard route that does the same job — the drag is never the only way |

The rule behind the table: `Tab` moves between groups, arrows move inside one.
A set of twelve tabs that each take a `Tab` press is technically operable and
practically unusable.

## Announcing change

A live region announces **what changed**, not the region it lives in.

- `polite` for status: saved, four results, sending. It waits for a pause.
- `assertive` almost never. It interrupts whatever the user was hearing, so it is
  for something they must act on now — a session about to expire, work about to
  be lost.
- The region must **exist before the text does**. A container injected together
  with its message is frequently not announced at all, which is the most common
  way this is silently broken.
- Say the change, not the whole state. "Three tasks left" after a delete, not the
  entire list re-read.

## Errors

An error is announced when it happens, is associated with the field it belongs
to, and says what to do. Colour is never the only signal — a red border with no
text is invisible to a screen reader and to a colour-blind user both.

## What to return

Per non-trivial component: its role, its accessible name, the states it exposes,
where focus goes on open and on close, its keys, and what is announced when it
changes. If any of those is "same as the native element", say that — it is an
answer, and it is usually the right one.
