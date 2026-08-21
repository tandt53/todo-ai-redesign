# Owner decision — 2026-08-21 — redesign the visual language, keep the names

**Chosen after the design audit.** The owner asked whether the screens were fully designed,
was told **2 of 6 surfaces and 1 of 5 features**, and answered: *"hãy design lại từ đầu thì
tốt hơn."*

## Scope, and the number that set it

| | |
|---|---|
| Screens drawn | 6 files — the shell and the talk surface, one feature of five |
| Component definitions | 2,371 lines |
| Tokens | 60 |
| **Published element ids** | **52 — and 1,362 places in code and tests bind to them** |

**That last row is what the scope question turns on. Changing how it looks is nearly free.
Changing what things are called costs 1,362 edits and every UI test re-authored.**

**Chosen: redraw everything and replace the visual language — colour, type, spacing, shape,
layout — while keeping the element ids.** The app looks entirely new; **nothing structural
breaks, because the only thing kept is the part nobody sees.**

## The system comes first, and separately

`ORCHESTRATION § Phase 3 sequencing` forbids doing this in one pass, and the reason applies
exactly here:

> *A single dispatch that authors the design system and then builds screens against it has no
> external standard to meet — it wrote the standard moments earlier, so the result is
> self-consistent and unanchored. Splitting them also means a human reviews the system once,
> cheaply, instead of reviewing every screen forever.*

**So: one dispatch for the new visual language. The owner sees it and signs off. Then the
screens, and they are held to it.**

## The system must arrive as something the owner can LOOK AT

**Every design-level correction in this project's history came from the owner seeing a
render, and no agent raised any of them.** A new visual language delivered as
`tokens.json` plus prose cannot be judged, and approving it unseen is how the next audit
finds the same class of defect.

**So the system dispatch owes a rendered specimen page** — the palette in use, the type scale
in real sentences, a task row, a message bubble, a button set, an empty state, at more than
one width. **Not a token table.**

## What the audit says the new system must answer that the old one did not

- **What a wide desktop does with the space.** The old system's widest declared breakpoint is
  1280, and its worst defect — 52% of the Tasks pane dead at 1920 — **is invisible below
  1140px and present in its own mockup.** The new one states a rule above 1280 or explains
  why it does not need one.
- **Underflow, not just overflow.** `design-check` passed 60/60 with a 780px dead gutter on
  screen because it only tests horizontal overflow.
- **A form.** The task detail was never drawn, and what shipped is 197px input stubs. The new
  system needs field, label and form-row definitions before anyone draws that screen.

## What is deliberately kept

**The 52 element ids, and the contracts that reference them.** Also kept unless the new system
has a better answer: the closed accent set with one meaning per colour *(it caught a real
defect — a proposed mark had no colour available, and that was the finding)*, one word per
concept, and empty states that name their collection rather than shrugging.

**These are kept as decisions to beat, not as constraints.** If the new language wants a
sixth accent or a different word table, it may — it just has to say so and say why.
