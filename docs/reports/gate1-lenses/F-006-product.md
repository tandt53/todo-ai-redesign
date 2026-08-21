# F-006 Gate 1 — product lens (T-182, 2026-08-21)

**Verdict:** REJECT · 2 HIGH · 2 MEDIUM · 0 LOW · all 16 ACs examined.

**The sentence that frames the return:** *the spec is unusually rigorous on what the
trash EXCLUDES and near-silent on what a user SEES in it.*

---

## F1 (HIGH) — AC-2, AC-3, AC-6 · no AC requires a trash entry to identify the task it holds

AC-2 fixes ordering and the empty state, AC-3 fixes two dates, AC-6 fixes the unit (a
gesture, not a row) — and nothing fixes what the user reads to tell one entry from
another. **The word "title" appears exactly once in the 466-line spec, in AC-7, and
there it is a prohibition.**

*Consequence:* restore is this feature's entire value and it becomes a guess. **The
asymmetry makes it concrete:** AC-7 requires the *step* entry to be named, so the
narrow case has a naming rule and the common case has none. And AC-3 proves entry
content is in AC scope here, so this is an omission inside a section that does
constrain content — not a deferral to design. Two derived quantities are also unstated:
what a cluster entry names when one gesture covers N+1 rows (AC-6), and what a series
entry says about how many occurrences come back (AC-8).

*Comparable:* Apple Reminders' Recently Deleted is a browsable list of the reminders
themselves — you tap the item, then Recover.

*would_not_be_a_finding_if:* an AC stated that an entry names the task it covers (and,
for a multi-row gesture, what it names and at what scale), or AC-3 said the two dates
are the **only** content this spec constrains and identity is design's.

## F2 (HIGH) — AC-1, AC-16 · one inbound path, and three separate refusals of the others

AC-1 puts a row in the Lists menu and removes the count. `## Impact` §4 leaves F-005
AC-43's undo notice silent about the trash; §8 keeps F-001's message door inert for a
deleted task; §4 leaves F-005 AC-4's terminal state unchanged. **Each refusal is
locally defensible and no AC owns the sum.**

*Consequence:* F-005 AC-43's ten-second elapse is gated on this feature, and F-005
AC-33 declares that elapse 2.2.1-conformant **because an equivalent untimed path
exists**. After the offer elapses, the user's only route to that path is a menu row
carrying no count and (OQ3) possibly no mark — nothing they were ever told about. **A
net the user cannot find at the moment they need it does not discharge the
dependency**, and F-005 then carries the false AA claim its own text warns about.

*This is the protocol's "impact silently settled rather than raised": three decisions
that each needed an owner.*

*would_not_be_a_finding_if:* an AC required the delete-time affordance to name the
trash, or `## Impact` raised the aggregate as an Open Question instead of answering it
three times in three sections.

## F3 (MEDIUM) — AC-7 · the AC fails its own stated purpose

AC-7 says this surface *"is the first place in the product where a lone deleted step
has to be identifiable at all"*, then gives a rule that does not make it identifiable:
the entry is *"named by that parent"*. **Two steps deleted from one parent in two
gestures produce two entries a user cannot tell apart.**

The collision is real: ADR-013 and F-005 AC-35/AC-36 forbid rendering a step title
anywhere — but those rules were written for surfaces the user did not ask to see the
step on. Here the user is choosing which deletion to reverse. Either the prohibition
takes a scoped exception on this surface, or AC-7 stops claiming identifiability.

*Cheapest of the four to leave:* 0 of the 57 soft-deleted rows today are steps.

## F4 (MEDIUM) — AC-4, AC-14, AC-15 · the assistant's READ is excluded on a WRITE rationale

AC-14 argues the exclusion from F-005 AC-36's closed permission list — **a write
list**. AC-4 removes deleted rows from the handle list — **an addressing mechanism**.
AC-15 then presents the total absence of a voice path as an accessibility strength.

*Consequence:* on a product whose purpose is *"the user talks to an AI assistant to
create, edit, and delete todos"*, the safety net behind delete has no voice at all,
including read-only. *"What happened to the dentist task?"* is unanswerable. The write
half is a sound safety decision; **the read half is a separate product decision that no
source settles and that the spec presents as derived.**

*Partly mitigated:* a delete made by voice is a turn, so F-001 AC-5's turn-shaped voice
undo still covers that path.

---

## Checked, nothing found

- **30-day retention is at market bar** and is the owner's settled call — Apple
  Reminders, Google Messages' 2026 trash, and Todo Cloud all use exactly 30 days. Not
  re-litigated.
- **AC-11's empty-trash risk is acceptably carried**: confirmed, names how many entries
  go, standard in the category. The one genuinely irreversible act is also the only one
  gated behind a confirmation — the right allocation.
- **AC-12's reachability-not-storage promise is not misleadable to a user**: AC-3
  forbids any wording promising the bytes leave the disk. The owner's cost is stated in
  AC text rather than a note.
- **AC-10 restores in place rather than to a default list**, diverging from Apple
  Reminders — deliberate and better argued than the comparable, since filing a task the
  user never filed is the worse outcome.
- **AC-1's refusal to carry a count is right on value grounds**: a badge on a surface
  whose worth is that you rarely need it is an inducement.
- **AC-2's empty state must read as ordinary, not as failure** — correct for a surface
  that is empty most of the time.
- **Entry volume is not a product problem at this scale**: 57 deleted rows, 20
  accounts, oldest 5 days. Newest-first with no search is sufficient.
- **AC-9 adds no second restore mechanism**; AC-11 reuses the existing `removed:`
  channel. No new vocabulary where one exists.
- **OQ2 not spent a finding on** — assigned to architect as T-181, per the briefing.

## Sources

Apple Support (Delete and recover reminders) · Google Messages 30-day trash ·
Asana's 2026 trash rework · Todo Cloud 30-day restore.
