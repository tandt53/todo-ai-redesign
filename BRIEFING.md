# BRIEFING — T-183

- **Task ID:** T-183
- **Description:** F-006 — fold in the owner's retention answer, closing OQ1
- **Module:** assistant
- **Feature:** F-006
- **Agent:** spec-agent
- **Date:** 2026-08-21

## Context

**Small, surgical amendment.** You wrote F-006 an hour ago and recorded OQ1 — the
retention length — as the owner's to answer, with three options and their
measurements. **The owner has answered, and picked the option you recommended.**

**No user to interview. No prototype. Do not re-review or restructure the spec** —
Gate 1 has not run yet and its lenses read what you leave here.

## The answer

**30 days, reachability-scoped** — your O1, verbatim:

- After 30 days a deleted task can no longer be recovered.
- **The removal write happens when someone opens the trash**, not on a timer. The
  expiry *predicate* is evaluated at the two doors that already reach a deleted row.
- **Retention binds reachability, not storage**, and the spec must say so plainly:
  an account nobody opens the trash on keeps its rows on disk past 30 days. The
  promise to the user stays true — they cannot reach them — but *"deleted after 30
  days"* is not literally true of storage. **Do not let that read as an oversight;
  it is the trade the owner took, and the alternative was a background job this app
  does not have.**

The owner's record is `docs/reports/owner-decision-2026-08-19-carried-notice-placement-and-timer.md` **§6**.

## Read these files first

1. `docs/specs/assistant/F-006-recently-deleted.md` — your own spec. **AC-3**, **AC-12**
   and **OQ1** are the three places that change; check whether anything else in the
   document defers to OQ1 before you decide that is the whole list.
2. `docs/reports/owner-decision-2026-08-19-carried-notice-placement-and-timer.md` §6 —
   the decision as recorded, including the cost the owner accepted.

## Write to

- `/Users/tandt/projects/todo-ai-redesign/docs/specs/assistant/F-006-recently-deleted.md`

## What must be true when you finish

- **AC-3** states the period concretely and **AC-12** carries the clock, its reset on
  restore, and the doors the predicate is evaluated at.
- **OQ1 is CLOSED with its answer recorded, not deleted.** A closed question that
  still shows what was decided is what stops it being re-asked in three weeks.
- **The reachability/storage distinction is in the AC text**, not only in the open
  question or a note. It is the one thing about this feature that is easy to read as
  a bug later.
- **16 ACs before, 16 after.** Nothing renumbered, added or deleted. Verify by
  counting.
- `bash .claude/tools/spec-check/declared-elements.sh docs/specs/assistant/F-006-recently-deleted.md`
  exits 0.
- **Search the document for sentences that OQ1's absence left hedged** — *"once the
  retention is decided"*, *"the period"*, *"whatever the owner chooses"*. Your own
  T-177 return found six such leftovers in F-005 and named the shape: a new statement
  lands and its predecessor is left standing. Do that pass here on your own text.

## Do NOT

- Do not touch `docs/specs/assistant/index.md` — its row and prose are already right,
  and it deliberately carries no revision number or AC count.
- Do not answer OQ2 (the series restore). That is **T-181**, assigned to
  architect-agent, and you were right to leave it.
