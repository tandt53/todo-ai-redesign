# Owner decision, 2026-08-18 — landing surface, default collection, and what Inbox means

Three answers to the questions the build left open, plus one new requirement that
arrived with the first.

## 1. A phone lands on Talk — and Talk must have something to say

Confirms design's proposal (IA §12, OQ9). The reasoning stands: the mic lives in
Talk's composer, so landing on Tasks would make voice capture three actions
instead of two, paid on every capture.

**New requirement the owner added with the answer.** Landing on Talk must not be
an empty room. On open, the assistant greets and orients — one of:

- what is coming up today;
- encouragement mid-day: *you have finished X, Y left, which are …*;
- congratulation when the day is clear.

This is **not** the `talk-empty` state design already drew (that one is for a
first-ever open with no history). This is a **spoken-by-the-app summary on every
open**, and it is new behaviour, not new copy: it needs the counts, the
selection of which tasks to name, and a rule for which of the three shapes
applies.

Two things it must not become, both of which this project has rules for:
- **Not a fabricated answer.** It reports counts and names tasks it can read; it
  does not summarise, judge or predict. F-001's honesty ACs apply.
- **Not free text.** F-002 AC-22 established frames with slots for exactly this
  reason — an unenumerated combination has no frame and fails rather than
  shipping fluent text nobody reviewed.

## 2. Default collection is Today — and this collides with how tasks are created

**The owner chose Today. The build had chosen Inbox, for a reason that has not
gone away:** `addTask` creates `status: 'inbox'` with no date
(`_shared/controller.ts:657`), and Today shows tasks that are `status: 'today'`
or due today. So on the default surface, **adding a task makes it vanish.**

That is a concrete broken behaviour, not a preference. The two answers are
jointly inconsistent unless something changes, so something must.

**Resolution taken: adding a task while viewing a collection puts it in that
collection.** Add on Today creates a task that is on Today; add on Inbox creates
an inbox task. This is what every list app does, it is the least surprising
reading of "default is Today", and it changes no data model — only which status
`addTask` writes. The alternative — Today silently including undated inbox items
— makes Today mean two different things and leaves Inbox nearly empty.

Flagged rather than assumed: this changes `addTask`'s contract, which F-001 and
the api both describe. If the owner meant something else, this is the line to
change.

## 3. Inbox is every unfinished task

Confirms the build's reading, and the one under which no task can be stranded.
Inbox is a superset of Today, not a sibling bucket.

## What follows

- The landing summary needs design (frames + copy), spec (an AC, and where the
  honesty rules bind), then both clients. It is the largest of the three.
- The default collection is a one-line change plus the `addTask` contract change
  above.
- Inbox needs nothing; it is already built that way.
