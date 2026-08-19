# BRIEFING — T-177

- **Task ID:** T-177
- **Description:** F-005 amendment — § CarriedNotice moves to the bottom, and the undo rows gain a 10s life
- **Module:** assistant
- **Feature:** F-005
- **Agent:** spec-agent
- **Date:** 2026-08-19

## Context

F-005's Gate 1 was closed by the owner on 2026-08-19 and revision 4 shipped. This is
**not** a fifth review round. It is an amendment forced by an owner decision taken
after the gate closed, while looking at the feature running on an iOS simulator.

The owner saw `CN-UNDONE` (*"Buy milk" is back on the list.*) docked under the top bar
and asked whether design or the implementers had got it wrong. **Neither had** — both
built exactly what this spec requires. So the requirement is what changes.

**The amend-only constraint from revisions 3 and 4 still holds: 48 ACs before, 48
after. Nothing renumbered, nothing added, nothing deleted.** Four existing ACs are
amended and one open question closes.

There is a companion new feature, **F-006 (the trash)**, queued as T-178 and specced
separately. **Edit (d) below depends on it**, and that dependency must be visible in
the AC text rather than assumed.

## Read these files first

1. `reports/owner-decision-2026-08-19-carried-notice-placement-and-timer.md` — the
   decision, all five sections. §2's table and §4's last paragraph are the two that
   change AC text most directly.
2. `specs/assistant/F-005-task-detail.md` — **AC-43, AC-47, AC-33 and OQ13**. AC-47's
   lifetime bullet and AC-33's 2.2.1 bullet both carry parenthetical revision history
   explaining why the current wording is as strong as it is; read those before
   weakening either, because both were tightened deliberately in revision 4 and one of
   them was tightened *to remove exactly the reading a timer reintroduces*.
3. `design/_shared/components.md` **§ CarriedNotice** (from `## Placement` through the
   lifetime rules) — what design published against the current AC, including the
   composer constraint on Talk.
4. `src/assistant/mobile/model/carried.ts` — `carriedRows()`. The row-type boundary
   edit (b) needs is already visible here: `CN-UNDONE` is built with `blocks: []` and
   `action: null`.
5. `reports/owner-decision-2026-08-19-close-gate-one.md` §2 — the decision this one
   amends. The undo offer was put in AC-47's family there; that placement stands.

## Write to

- `/Users/tandt/projects/todo-ai-redesign/specs/assistant/F-005-task-detail.md`
  (amend in place — revision 5)
- `/Users/tandt/projects/todo-ai-redesign/specs/assistant/index.md`
  (the revision number — revision 4 shipped without this being updated once already,
  and it is the one file a fresh session reads to learn where a feature stands)
- `/Users/tandt/projects/todo-ai-redesign/reports/gate1-lenses/F-005-revision-5-log.md`
  (one row per edit, with the AC ids touched)

## The four edits

**(a) AC-47 — placement is the frame's bottom edge.** No AC constrained the edge
before; AC-47 requires *visible wherever the user is*, which the bottom satisfies as
well as the top. **The constraint that travels with it:** on Talk the composer is at
the bottom and the keyboard rises over it, so the region docks **above the composer**
and moves with the keyboard, not against the screen edge. Design owns the exact rule;
the AC states that the bottom edge may not occlude the app's primary input.

**(b) AC-47 — the lifetime rule splits, and the split is by what the row carries.**

| Row | Carries | Lifetime |
|---|---|---|
| `CN-FAILED`, `CN-OFFLINE`, `CN-DELETED` | text the user typed that the app could not store | never self-dismisses — unchanged |
| `CN-UNDO`, `CN-UNDONE` | nothing the user typed | 10s, then gone |

**State the rule by carried content, not by row id.** A rule written as a list of ids
is one the next row added to this family joins by default and probably wrongly; a rule
written as *"a row carrying a value the user typed never self-dismisses"* decides that
case in advance. AC-2's guarantee is the reason the first group exists at all, and it
is untouched.

**(c) AC-43 — a fifth ender.** The list is *used, dismissed, replaced, reloaded* and
now **elapsed**. Its *"and by nothing else"* must name it. Revision 4 had to make this
exact edit once already, for the reload, and recorded why leaving the phrase standing
over an incomplete list is worse than having no phrase at all.

**(d) AC-33 — 2.2.1, and this is the edit with a trap in it.** A ten-second limit on
an affordance carrying an action is precisely what **2.2.1 Timing Adjustable**
governs. Revision 4 specifically removed the reading that *a five-second timer extended
on focus* would satisfy the rule, so **pause-on-hover is not the answer and citing it
repeats the error that revision was written to fix.**

What makes the timer conformant is **F-006's trash**: once an equivalent, untimed path
to the same outcome exists, nothing is lost by elapse. **Write that dependency into
the AC.** An AC that says *"the timer is fine"* without saying *"because the trash
exists"* becomes a false conformance claim the moment F-006 slips — and this feature
declares WCAG 2.1 AA by name.

**(e) OQ13 closes:** recovery is the trash, for its retention period; the undo offer
is a shortcut to it, not the remedy itself.

## Success criteria

- 48 ACs before, 48 after. No id renumbered, added or deleted. Verify by counting.
- `bash .claude/tools/spec-check/declared-elements.sh specs/assistant/F-005-task-detail.md`
  exits 0.
- AC-47's lifetime rule is stated **by carried content**, and both groups are named.
- AC-43's ender list has five enders and its closing phrase matches the list.
- AC-33's 2.2.1 text states the F-006 dependency explicitly. **If you judge that a
  timed limit cannot be made conformant this way and needs an owner answer rather than
  a statement, say so and return BLOCKED on that edit alone** — the other four stand
  on their own. A false AA claim is not a detail to settle by default.
- OQ13 is closed with its answer recorded, not deleted.
- The revision log has one row per edit with the AC ids touched.
