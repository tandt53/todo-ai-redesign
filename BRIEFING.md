# BRIEFING — T-234

- **Task ID**: T-234
- **Title**: Task reorder: drag is enough, but Tab must reach every row
- **Module**: assistant
- **Feature**: F-009
- **Agent**: spec-agent
- **Date**: 2026-08-22
- **Depends on**: — (none)

## Context

`F-009 AC-6` (line ~96) currently specs reorder as pointer drag only:

> **AC-6** (web, mobile) — **Drag-to-reorder** is available only when manual sort is active.
> Web: drag handle on each row, click-and-drag. Mobile: long-press then drag. Writes the moved
> task's `sort_order`; sparse gaps avoid cascading writes to other rows.

This was raised as an accessibility gap — a reorder reachable only by a custom drag does not
exist for a VoiceOver or TalkBack user, the same shape of problem `F-001 AC-33` already solves
for delete.

**The owner decided on 2026-08-22 and the decision narrows the task from what it was raised as.**
This briefing is that decision. You are writing it down, not re-opening it.

**The answer: pointer drag is enough for reordering. Do NOT add Move up / Move down for tasks.**

Two things do change.

**(a) Tab navigation must work.** The owner's words: *"việc chuyển nhảy giữa các phần tử thì nên
làm"* — moving between elements by keyboard should work. Every task row and every control on a
row is reachable by Tab, and focus is visible when it lands. **This is a general requirement, not
a reorder feature** — it is not conditional on manual sort being active, and it is not a clause of
AC-6. Give it its own AC.

**(b) Screen-reader support for reorder is deferred by decision, and the AC must say so.** Leave
no silent hole: VoiceOver and TalkBack cannot perform a custom drag, so those users cannot
reorder tasks, and reorder is cosmetic enough to live without. Write the deferral, the reason,
and the consequence into AC-6 itself, so a later reader sees a decision rather than an oversight.

## The boundary — this is the part most likely to be got wrong

**The scope of that deferral is REORDER ONLY.** It was deliberately not widened to `F-001 AC-33`,
which requires a no-gesture delete path via the VoiceOver rotor and the TalkBack custom action
menu. The reason the two are treated differently: **delete destroys data and reorder does not.**

Do not apply the reorder deferral to delete. Do not amend, soften or cross-reference `F-001
AC-33` as though the same reasoning covers it. If anything, say in F-009 that the deferral stops
here and why, so the next reader cannot generalise it. If the owner meant it more broadly that is
a separate call, not yours to take.

**Also accepted, not a defect to fix:** lists reorder by a menu item while tasks reorder by drag.
That inconsistency was noticed and stands. Record it as accepted rather than harmonising the two.

## Read these files first

1. `docs/specs/assistant/F-009-list-actions.md` — AC-6 (~line 96), the `sort_order` row in
   `## Data` (~line 73), and the spec's `## Status` line for the revision convention
2. `docs/specs/assistant/F-001-*.md` — **AC-33** (the gesture-hidden delete path). This is the
   precedent you are deliberately *not* extending; read it so the boundary you write is accurate
3. `docs/specs/assistant/F-008-lists.md` — how lists reorder (menu item), for the accepted
   inconsistency
4. `docs/design/_shared/DESIGN.md` — `## Platform`, the row-delete table and the custom-action
   mechanism, so the new Tab AC does not contradict the drawn behaviour

## Write to

- `/home/user/todo-ai-redesign/docs/specs/assistant/F-009-list-actions.md`

## Success criteria

1. **AC-6 keeps pointer drag as the only reorder mechanism.** No Move up / Move down for tasks.
2. **AC-6 carries the deferral in its own text** — that screen-reader reorder is deferred, by
   owner decision on 2026-08-22, because VoiceOver and TalkBack cannot perform a custom drag and
   reorder is cosmetic; and that this deferral covers reorder and nothing else.
3. **A new AC requires Tab to reach every task row and every row control, with visible focus**,
   unconditional on sort mode. Platform-tagged the way the spec tags its other ACs.
4. **`F-001 AC-33` is neither amended nor undermined**, and F-009 says the deferral stops at
   reorder because delete destroys data.
5. **The lists-vs-tasks reorder inconsistency is recorded as accepted**, with the reason.
6. **The spec's own conventions are followed**: no AC renumbered, none deleted; the revision
   recorded in the `## Status` line the way F-001 records revisions 4–8, naming this task id and
   the date.
7. Verify on disk after writing — re-read what you wrote and confirm AC numbering is unbroken.

## Do not

Do not widen this into a general accessibility pass on F-009. Other ACs may well have gaps; if
you find one, **return it as an unresolved item** for a separate row rather than fixing it here.
The owner narrowed this task once already and a silent re-widening would undo that.
