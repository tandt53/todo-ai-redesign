# BRIEFING — T-202

- **Task ID:** T-202 · **Agent:** design-agent · **phase:** `system` · **Date:** 2026-08-21
- **Description:** New visual language — the system only

## The owner asked for a redesign from scratch

They saw the app, asked whether the screens were designed, and were told **2 of 6 surfaces
and 1 of 5 features.** They answered: *"hãy design lại từ đầu thì tốt hơn."*

Scope was then set with a measurement — full record:
`docs/reports/owner-decision-2026-08-21-redesign-the-visual-language.md`.

> **Replace the visual language completely — colour, type, spacing, shape, layout. Keep the
> 52 element ids.**

**1,362 places in code and tests bind to those ids and nobody ever sees a name.** So the look
is entirely yours; the names are not.

## This dispatch writes the SYSTEM ONLY. Draw no feature screen.

`ORCHESTRATION § Phase 3 sequencing` forbids one pass for both, and the reason is the point:

> *A single dispatch that authors the design system and then builds screens against it has no
> external standard to meet — it wrote the standard moments earlier, so the result is
> self-consistent and unanchored.*

The screens are a later dispatch, held to what you write here.

## What you owe: something the owner can LOOK AT

**Every design-level correction in this project's history came from the owner seeing a render.
No agent raised any of them.** A visual language delivered as `tokens.json` plus prose cannot
be judged, and approving it unseen is how the next audit finds the same class of defect.

**Deliver a rendered specimen page** — one self-contained HTML file — showing at minimum:

- the palette **in use**, not as swatches
- the type scale in **real Vietnamese sentences** (the product's content is Vietnamese)
- a task row, with a due time and a priority mark
- a message bubble from the user and one from the assistant
- the button set, including a destructive one
- **a form field with a label** — see below, this one is not optional
- an empty state
- **at more than one width**, including one above 1440

**And it covers WEB AND MOBILE — all three platforms this project ships.** The existing
screens are drawn `web` / `-ios` / `-android`, and mobile is not "web at 390px": iOS and
Android have their own type ramps, their own touch minimums, their own back and sheet
conventions, and `platform/mobile.md` records where they diverge. **Show the same specimen
items under each**, and where a platform forces a different answer, show both and say which
rule caused it.

**One file. The owner opens it and sees everything.** Not one file per platform, not a
directory to browse — *"gom chúng lại trong file html để tôi có thể xem được thuận tiện"*.
Give it a way to move between platforms and widths inside the page — tabs, a switcher,
anything that works without a server. Self-contained: inline the CSS, no external fonts that
need the network, no build step.

## Three things the old system got wrong. The new one answers them or says why not.

1. **Nothing is measured above 1280.** The old `tokens.json`'s widest breakpoint is
   `desktop: 1280`; `design-check` iterates that list and stops. Its worst defect — **52% of
   the Tasks pane dead at 1920** — is invisible below 1140px **and present in its own mockup.**
   State a rule for wide desktop, or state why none is needed.
2. **`design-check` tests horizontal overflow and never underflow**, which is why it passed
   **60/60** with a 780px dead gutter on screen. If your system has a rule a check could
   enforce, say what it is.
3. **Form fields were never defined.** What shipped is 197px input stubs that clip the task's
   own title, because a class was used and styled nowhere. **Define field, label and form row
   before anyone draws a form.**

## Kept as decisions to BEAT, not as constraints

You may overturn any of these; you have to say so and say why.

- **The closed accent set, one meaning per colour.** It earned its keep: a proposed mark had
  **no colour available**, and that *was* the finding. If you want a sixth accent, take it and
  name its meaning.
- **One word per concept.** The old table binds *undo* and *put back* to different mechanisms
  on purpose.
- **Empty states that name their collection** rather than shrugging.

## What is fine today, from the audit — do not discard it by accident

At **1024** the Tasks column fills its whole pane with zero dead gutter: **the split works at
the width it was designed at.** **390 is the best-looking state in the app.** Contrast holds,
and one-signal-per-meaning holds in the list.

## Read these

1. `docs/reports/design-audit-2026-08-21.md` — the audit, with measurements and screenshots.
2. `docs/reports/owner-decision-2026-08-21-redesign-the-visual-language.md` — the scope.
3. `docs/design/_shared/DESIGN.md`, `tokens.json`, `information-architecture.md` §1 — **what
   you are replacing.** Read to know what you are beating, not to stay inside.
4. `docs/design/_shared/components.md` **§ Testid catalogue** — the ids you keep.
5. **The running app**, `http://localhost:5173/?qaUser=design-audit-1787320423` — five seeded Vietnamese tasks.
   `playwright-cli -s=<yours> open <url> | resize <w> <h> | screenshot`.

## Write to

- `docs/design/_shared/DESIGN.md`, `tokens.json` — the new language.
- `docs/design/_shared/specimen.html` — the rendered page. **One self-contained file
  covering web, iOS and Android**, opened with a double-click and nothing else.
- **Do NOT rewrite `components.md` in this dispatch.** It is 2,371 lines and most of it is
  behaviour, not appearance. Say in your return which of its sections the new language
  invalidates; rewriting them is the screens dispatch's problem, done once, with the system
  settled.

## Your return ends with `review_guide:`

**Two or three plain questions a non-designer can answer**, about the specimen. The
orchestrator presents exactly those to the owner and nothing else. That field is what the
sign-off step reads.

## Success criteria

- `specimen.html` opens by double-click, with no server and no network, and shows every item
  above **for web, iOS and Android**, at more than one width, **switchable inside the page**.
- The wide-desktop rule exists, or its absence is argued.
- Field, label and form row are defined.
- Every kept decision you overturned is named with its reason.
- **No feature screen drawn. `components.md` untouched.**
