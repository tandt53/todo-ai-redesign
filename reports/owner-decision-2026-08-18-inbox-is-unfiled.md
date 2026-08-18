# Owner decision — Inbox is *unfiled*, not *undated*

**Date:** 2026-08-18 (the third decision on the collection model this day, and
the one that settles it)

## What the owner said

> *"Inbox nên là các task chưa xong, gồm cả task có ngày hay chưa."*
> — Inbox should be the unfinished tasks, with or without a date.

then, before deciding:

> *"các app khác giữ inbox như nào?"* — how do other apps keep Inbox?

and, given the answer, chose **Inbox = tasks not filed into any personal list**.

## Why the question changed the answer

Every mature todo app was checked for the same thing, and they agree: **Inbox is
a place, not a date filter.** In Todoist it is literally a project — the default
one, where a task goes when you pick no project. Things 3, TickTick and
OmniFocus all keep a real Inbox list that new items land in and that you empty
by *processing* items into projects and areas. In all of them a task can be in
Inbox **and** in Today simultaneously, because Today is a view and Inbox is a
container. Their sidebars overlap in exactly the way ours would.

**This corrects something I told the owner an hour earlier.** I argued that an
Inbox containing every open task "is not an inbox, because it can never be
emptied". That was wrong, and wrong in a specific way: I assumed the only way to
leave Inbox was to acquire a date. In the standard model you leave Inbox by
being **filed**. Under that definition Inbox empties normally — through a door
this app has not built yet.

## The decision, stated so it survives the app growing

**A task is in Inbox when it belongs to no personal list.** Nothing about dates.

`lists` and `tasks.list_id` **do not exist** (design's IA §7 and § ListsMenu both
record this: the LM-LIST row is drawn and unbuildable). So today, no task can be
filed, so **every open task is unfiled, so Inbox is every open task** — exactly
what the owner asked for. The owner's instinct and the industry definition are
the same list right now; they only look different because one of them names a
door that isn't built.

The value of choosing the definition rather than the list: **when personal lists
ship, Inbox narrows by itself.** No second rule change, no re-litigation, no
migration of meaning.

## What this costs, stated plainly

1. **The four buckets stop being disjoint, and ADR-009 § Amendment's central
   claim needs rewriting.** That section says *"Not-done splits on has-a-date;
   dated splits on past-or-today versus future. Every task has exactly one
   home."* That is now false — and the honest correction is not a patch but a
   recognition that **there are two axes**: a *date* axis (Today · Upcoming ·
   undated) that does still partition the open tasks, and a *filing* axis
   (Inbox · each personal list) that partitions them a second, independent way.
   The Lists menu shows both, which is what Todoist's sidebar does too.
2. **The menu's counts nest**: Inbox's number contains Today's and Upcoming's.
   The apps that live with this separate the two kinds visually — views in one
   group, containers in another — and our § ListsMenu already has that split
   (LM-COLLECTION / LM-LIST / LM-ACTION). Whether Inbox sits with the views or
   at the head of the lists is design's call and is now a real question.
3. **Inbox regains day grouping, reversing a decision taken this morning.**
   § TaskList made Inbox flat on the argument that *"Inbox IS 'no date', so
   `Anytime` is true of every row it can hold"*. The premise is gone: Inbox can
   now hold dated rows, including overdue ones.
4. **A trap worth naming before it bites.** § LandingSummary split `open_all`
   from `inbox_count` this morning precisely because they had stopped being
   equal. Under this decision they are **equal again today** and will **diverge
   again the moment personal lists ship**. Anyone who notices the equality and
   re-merges them will reintroduce the exact bug the split was made to fix —
   a user with a full week ahead told *"All done — your list is clear."* The two
   facts stay separate; their equality today is a coincidence of an unbuilt
   feature.
5. **AC-24's reachability bound rests on something new again.** It rested on
   Inbox being a superset, then on the four buckets being total. Under two axes
   it holds because *unfiled-or-filed* is total — but once lists ship, an undated
   task inside a personal list is in **no date collection and not in Inbox**, and
   is reachable only through its list. That is correct and normal; it is written
   down because it is the third different reason the same AC has been true, and
   the previous two both stopped being true without anyone noticing at the time.

## What does not change

The date collections are untouched: **Today** is still on-or-before today,
**Upcoming** still after today, both day-granular on the device clock, and
overdue still folds into Today. **Done** is still the one status predicate.
`dueAtForCollection` and the SaveNotice decision are unaffected — a task created
without a date is still unfiled and undated, so it is still in Inbox, and the
notice still tells the truth.
