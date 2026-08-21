# BRIEFING — T-184

- **Task ID:** T-184
- **Description:** F-006 revision 3 — the Gate 1 round-1 revision
- **Module:** assistant · **Feature:** F-006 · **Agent:** spec-agent
- **Date:** 2026-08-21

## Context

Gate 1 put **nine lenses** on F-006 and returned **REJECT — 21 HIGH · 29 MEDIUM · 6 LOW**.

**The round cap is 2. This is the last revision that gets reviewed.** After it, at most one
targeted re-review of the ACs each lens raised findings on.

**No user to interview. No prototype.**

## Read these first

1. `docs/reports/gate1-lenses/F-006-consolidated.md` — the seven convergences, the
   single-lens findings, what the gate affirmed, and the one owner decision.
2. **The nine individual lens files beside it** — `F-006-{product,architect,design,
   tester-api,tester-web,tester-mobile,dev-api,dev-web,dev-mobile}.md`. **Read them, not
   only the consolidation.** L-009: clustering drops what one lens saw alone, and **four of
   the sharpest findings here were seen by exactly one lens.** Every finding carries a
   `would_not_be_a_finding_if:` — that field is the cheapest route to a correct edit.
3. `docs/specs/assistant/F-006-recently-deleted.md` — your spec, revision 2.
4. `docs/reports/owner-decision-2026-08-19-carried-notice-placement-and-timer.md` **§7** —
   the owner's answer to product F2, taken today.

## Write to

- `/Users/tandt/projects/todo-ai-redesign/docs/specs/assistant/F-006-recently-deleted.md`
- `/Users/tandt/projects/todo-ai-redesign/docs/specs/assistant/index.md`
- `/Users/tandt/projects/todo-ai-redesign/docs/reports/gate1-lenses/F-006-revision-3-log.md`
  — **one row per finding, all 56**, with the AC ids touched and the disposition. That log
  is what determines the targeted re-review set, so a finding missing from it is a finding
  nobody re-reads.

## Fix C1 first — three of the other convergences fall out of it

**A trash entry's membership is not a closed set.** 7 of 9 lenses found it independently.
AC-11 defines *delete forever* by *"the same membership AC-9's restore would have put
back"*, and that restore pulls in a still-deleted parent **regardless of gesture** — a row
AC-6 makes a separate entry.

**State the closed membership rule once, in AC-6, and have AC-9, AC-11 and AC-12 refer to
that one set.** Architect's directive; dev-api's is compatible and sharper on the fix (the
parent invariant is a **restore-only** rule). Then the four undefined outcomes the
consolidation lists each need a stated answer — including the orphaned step, which the
restore code's own comment already calls unreachable.

## What is NOT yours in this revision

- **OQ2 (the series restore / `series_ended_at`) is T-181's**, assigned to architect. Do
  not answer it. You were right to record it.
- **Product F2 is answered — option A.** When `CN-UNDO` elapses, what replaces it **names
  the trash**. So F-006 **records the inbound path as satisfied by F-005 AC-43 and
  references it.** Do not restate the rule, and **do not settle it inside `## Impact`** —
  that section answering it three times is what produced the finding. The F-005 half is
  T-185, yours in the next dispatch.
- **The two API doors' shapes stay architecture's.** Requirements without shapes is
  correct and is not what any lens objected to.

## Adding ACs is permitted here — and prefer amending

F-005's amend-only constraint does not apply to F-006. But **every AC you add is unreviewed
after this round**, and *a revision adds ACs → the new ACs are unreviewed → the next round
finds them* is exactly the mechanism that produced F-005's rounds 2 and 3. Add one only
where an amendment genuinely cannot carry the rule, and say why in the log.

## Two findings that are about how you write, not what

Both were raised against your own text by lenses that had no coordination:

- **`## Impact` §1's enumeration is short** — three or four sites missing by its own
  criterion, including `mobile/model/task-link.ts:76`, **the most temptingly widenable site
  in the codebase**, which §8 spends a paragraph arguing must not be widened. Four lenses
  counted the headline and **got four different numbers.** Fix the list; consider dropping
  the count from AC-5 and keeping the enumeration in one place.
- **`## Impact` §10's stale-documents table is missing entries** the lenses named:
  `information-architecture.md` §2/§3/§4/§6, `api-contracts § Task on the wire`, and — per
  architect F5 — **a named writer for the ADR-009 amendment and for the read-that-mutates
  decision.** §10 currently says ADR-009 *"becomes wrong"* and names nobody to fix it.

## Success criteria

- Every one of the 56 findings has a row in the log with its disposition. HIGH findings are
  fixed or explicitly deferred with a reason.
- `bash .claude/tools/spec-check/declared-elements.sh docs/specs/assistant/F-006-recently-deleted.md`
  exits 0.
- AC ids stay contiguous, every AC keeps a platform tag, and the index row and prose stay
  correct — **its prose deliberately carries no revision number or AC count; do not add
  one.**
- **The membership rule is stated once** and the ACs that use it refer to that statement
  rather than re-deriving it.
