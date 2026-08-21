# BRIEFING — T-188

- **Task ID:** T-188 · **Feature:** F-006 · **Agent:** spec-agent · **Date:** 2026-08-21
- **Description:** F-006 revision 5 — the round-2 findings, and the two frames the trash needs

## This is the last revision. There is no round 3.

Gate 1 round 2 returned **14 HIGH · 20 MEDIUM · 3 LOW** across nine lenses. **The owner
waived the round cap once**, and the constraint is the substance of the waiver:

> **NO NEW ACs. 17 before, 17 after. Nothing renumbered, added or deleted.**

**The reason is measured, not stylistic.** Of round 2's 14 HIGH:

| where | count |
|---|---|
| AC-14 / AC-15 — the owner's read permission, added **after** round 1 | 7 |
| AC-17 — created by a **round-1 fix**, never read by any lens | 3 |
| AC-9 / AC-7 — clauses **added** by round-1 fixes | 4 |
| text that existed at round 1 and survived it | **0** |

**Every new HIGH was on text nobody had read. A revision that adds is a revision that ships
unreviewed text.** Amend; do not add.

**No user to interview. No prototype.**

## Read these

1. `docs/reports/gate1-lenses/F-006-r2-consolidated.md` — the seven convergences and the
   single-lens findings.
2. **The nine `F-006-r2-*.md` files beside it** — read them, not only the consolidation
   (L-009). Each finding carries `would_not_be_a_finding_if:`; **that field is the cheapest
   route to a correct edit.**
3. `docs/specs/assistant/F-006-recently-deleted.md` — revision 4.
4. `docs/reports/owner-decision-2026-08-21-the-model-authors-the-reply.md` **§1** — the
   owner's short-term answer, which is edit (a) below.

## Write to

- `docs/specs/assistant/F-006-recently-deleted.md`
- `docs/reports/gate1-lenses/F-006-revision-5-log.md` — **one row per finding, all 37**, with
  disposition and ACs touched.

## Order of work

**(a) C1 first — the owner's decision is currently unimplementable.** Three lenses found it
independently, from three different closed sets: `§ Spoken frames` has no row, F-002 AC-22
makes an unframed utterance **fail**, `turn.outcome.kind` is seven closed members, and the
only reachable free-text field would report a question the assistant just answered as
unsupported.

**The fix is two frames in the EXISTING five-slot vocabulary** — *"it is the frames that are
missing, not the slots"* (design lens):

- a **task-is-in-the-trash** answer, slot `title`
- a **what-is-in-the-trash** answer, slots `count` + `title_list`

Route them to `§ Spoken frames` in `## Impact` §9 and §10, **design named as writer.**

**(b) C2 — the reply that becomes a lie.** The assistant says *"the dentist task is in the
trash"*; the user says *"put it back"*; that reaches `no_match`. **`turns.ts:603` already
excludes that improvisation by name, in words written for F-005 AC-40: *"`no_match` is a lie
(the task WAS matched)."*** State in AC-14 that such a turn is answered by naming the trash
and the way to reach it, never by `no_match`.

**(c) Then C3–C7 and the single-lens findings**, in the consolidation's order.

## Two things you must NOT do

- **Do not add an AC.** If an amendment genuinely cannot carry a rule, **say so in the log
  and leave the finding recorded** — architecture takes it as a stated question. That is a
  better outcome than a seventeenth-plus-one AC nobody reviews.
- **Do not touch OQ2** — architect's, T-181.

## A correction to carry, because it changes an argument you may reuse

An earlier orchestrator note claimed *"a hallucinated task name deletes the wrong thing."*
**That is false** — deletion is id-driven, so a wrong name still deletes the right row.
**What breaks is consent:** the user says yes to a sentence that does not match the action.
If you reuse that argument anywhere, use the correct form.

## Success criteria

- **17 ACs before, 17 after.** Verify by counting.
- `bash .claude/tools/spec-check/declared-elements.sh docs/specs/assistant/F-006-recently-deleted.md`
  exits 0.
- All 37 findings have a row in the log with a disposition. **HIGH findings are fixed, or
  explicitly deferred with the reason.**
- The two frames are routed in `## Impact` §9 **and** §10, with a writer named.
- **Sweep for sentences the old answers left standing.** You have found this defect in your
  own work three times now — six leftovers on F-005, eight and then six on F-006. The places
  they hide are `## Purpose`, `## Users & Permissions`, `## Out of Scope` and the mermaid
  nodes.
