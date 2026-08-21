# F-006 Gate 1 ROUND 2 — product lens (T-186, 2026-08-21)

**Verdict: REJECT** — 2 HIGH · 1 MEDIUM · 1 LOW. **All four round-1 findings hold; F2 and F4 are the splits I asked for.**
**Both HIGHs are on AC-14's read permission, which revision 4 added and no lens had ever read.**

---

## F1 (HIGH) — AC-14, AC-15 · **the assistant denies the task it just named**

The assistant says *"the dentist task is in the trash"*. **The very next thing a user says —
*"put it back"* — reaches `no_match`.**

*The read grant **manufactures an intent** the turn path answers with the one improvisation
this project already excludes by name:* `turns.ts:603`, written for F-005 AC-40 —
**"`no_match` is a lie (the task WAS matched)"**. And AC-14 says **no AC turns red on it.**

*Directive: a turn asking for an act on a row the assistant has named as being in the trash
is answered by naming the trash and the way to reach it, **never by `no_match`.***

## F2 (HIGH) — AC-14, AC-7, AC-5 · one row both permitted and forbidden to be spoken

AC-14 lets the assistant say *"what is in the trash"* **without bound**; AC-7 scopes the
step-title exception to **"this surface and to nothing else"**.

*The cheapest implementation serialises AC-5's read into the turn context and **speaks step
titles** — exactly what the handle list's step exclusion was built to stop (`turns.ts:390`
names **"read step titles aloud"** as its reason) — **breaking ADR-013 in the one path no AC
asserts on.***

*Recommendation: mirror the handle list — top-level tasks only. Needs no ADR-013 change.*

## F3 (MEDIUM) — AC-17, AC-2 · a confirmation that must name entries, in states with no listing

AC-2 defines in-flight, failed, offline and empty states **in which there is nothing to name
them from.** So an implementer either shows a confirmation naming nothing — **weaker than
the count-only fallback the owner's 2026-08-17 decision already excludes** — or disables the
control on rules nobody wrote, **and the one bulk irreversible act behaves differently on
each client.**

## F4 (LOW) — AC-3, AC-11, AC-17 · a ban that catches the copy for which it is true

AC-3's *"no wording on this surface may promise that"* reads surface-wide, **while AC-11 and
AC-17 hard-remove the rows and the User Flow already draws *"this cannot be undone"* on both
confirmations.**

---

## The routed question, answered

> **The dead end is acceptable.** Keeping the only irreversible act away from an interpreted
> intent is right, and I would not trade it. **What is not acceptable is how the product
> currently falls into it — F1.**

## And this is L-015's shape, one round later

**§7** (the elapsed offer names the trash) landed in **revision 3**. **§8** (the assistant
may read) landed in **revision 4**. **Each was reviewed alone.**

Composed, **§7 signposts the trash at the moment the user has just been speaking — which
routes voice users *into* §8's dead end rather than away from it.** L-015 says the pairwise
read is the revision agent's job and nobody else's; **it did not happen across two
revisions.**

## Round-1 findings — four of four hold

| | |
|---|---|
| **F1** entry identity | **holds** — AC-3 gains *"what it holds"*; cluster and series counts both there; AC-7 carries the step case |
| **F2** one inbound path | **holds, and it is option A done correctly** — `## Purpose` records it once and references F-005 AC-43; §4 points at the owner and says *"settles nothing"*; §8's refusal is **explicit and reasoned, not accumulated** |
| **F3** AC-7 identifiability | **holds** — the scoped ADR-013 exception names both step and parent; the orphan case is stated with its three alternatives priced |
| **F4** assistant read | **answered my way, and the split is the one I meant** |

## Also checked

- **AC-17's 3-names-plus-count is not a finding** — Gmail's *Empty Trash now* and Apple
  Reminders' *Delete All* **name nothing at all**, so this exceeds the comparables.
- **AC-16's *"2.2.1 is not engaged"* is correct** — the criterion's own exception covers
  limits beyond 20 hours, and 30 days clears it.
- **The orphaned-step entry is not a dead end** — the user can still destroy it or empty, so
  an unrestorable entry is not also unremovable.
- **Likelihood on F2, stated honestly:** 0 of 57 deleted rows are steps, so it is unreachable
  on today's data. *AC-7 exists anyway, which is the answer to "then why state it".*
- **Comparables give no counter-example on F1** — Siri, Alexa and Google Assistant have no
  voice restore from any Recently Deleted, **but none of them first tells you the item is
  there.**
