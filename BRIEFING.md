# BRIEFING — T-187

- **Task ID:** T-187 · **Feature:** F-006 · **Agent:** spec-agent · **Date:** 2026-08-21
- **Description:** F-006 revision 4 — the assistant may read the trash

## Context

**Small, surgical amendment. Not a review round** — Gate 1's round 2 has not run yet and
waits on this, so what you leave here is what nine lenses read.

You recorded **OQ4** rather than answering it, correctly: whether the assistant may *read*
the trash is a scope call about what the assistant is for, and AC-14 had been presenting
the exclusion as **derived** from a write-permission list. **The owner has answered.**

**No user to interview. No prototype. Do not restructure the spec.**

## The answer — read yes, write no

`docs/reports/owner-decision-2026-08-19-carried-notice-placement-and-timer.md` **§8**.

| | |
|---|---|
| **Read — permitted** | the assistant can say what is in the trash and that a task went there. *"What happened to the dentist task?"* becomes answerable |
| **Address — UNCHANGED** | a deleted task stays out of the interpreter's handle list. It is not a handle for an edit, and *"delete the dentist task"* must not resolve to a row already deleted |
| **Write — UNCHANGED** | restore and permanent deletion stay hand-only. **This half was never in question** |

## Read these first

1. `docs/reports/owner-decision-2026-08-19-carried-notice-placement-and-timer.md` **§8** —
   the decision, the line, and the consequence it deliberately does not settle.
2. `docs/specs/assistant/F-006-recently-deleted.md` — **AC-4, AC-14, AC-15, OQ4**.
3. `docs/reports/gate1-lenses/F-006-product.md` — **F4**, the finding this answers. Its
   `would_not_be_a_finding_if:` is the shape of the correct edit.

## Write to

- `/Users/tandt/projects/todo-ai-redesign/docs/specs/assistant/F-006-recently-deleted.md`

## The three edits

**(a) AC-14 splits.** State the **write** refusal as inherited from F-005 AC-36, and the
**read** permission as **this feature's own decision with its own reason.** Product F4's
complaint was not the outcome but the derivation: a write-permission list was being used to
justify a read exclusion.

**(b) AC-4 is unchanged — and must be SEEN to be unchanged.** Its clause is about the
**handle list**, which is addressing, not reading. **A revision that widens AC-4 to admit
reading would make a deleted task addressable, which is not what was decided.** Make the
distinction explicit in the text so the next reader cannot collapse the two.

**(c) AC-15 may no longer present the absence of a voice path as an accessibility
strength**, because there is now one. Its zero-AI-calls claim about the *hand* path stands.

**(d) OQ4 closes** with its answer recorded, not deleted — same shape as OQ1.

## Do NOT

- **Do not resolve the dead end the decision creates.** The assistant can now say where a
  task went **and still cannot act on it** — the user is told *"it is in the trash"* and
  must go there by hand. §8 names that as the deliberate price and **routes it to the
  round-2 lenses on purpose**, because a tester and a product lens see it differently and a
  spec author sees it not at all. Record it if you wish; do not settle it.
- **Do not touch OQ2** — architect's, T-181.
- **Do not touch `index.md`** — its row and prose are right and deliberately carry no
  revision number or AC count.

## Success criteria

- **17 ACs before, 17 after.** Nothing renumbered, added or deleted. Verify by counting.
- `bash .claude/tools/spec-check/declared-elements.sh docs/specs/assistant/F-006-recently-deleted.md`
  exits 0.
- AC-4's addressing-vs-reading distinction is in the AC text, not in a note.
- **Sweep for sentences the old answer left standing.** You have now found this defect
  twice in your own work — six leftovers on F-005 at T-177, eight on F-006 at T-183 — and
  the strongest one each time was in a section nobody would think to re-read. `## Purpose`,
  `## Users & Permissions`, `## Out of Scope` and the mermaid nodes are where they hide.
