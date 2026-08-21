# BRIEFING — T-178

- **Task ID:** T-178
- **Description:** F-006 — Recently deleted (the trash)
- **Module:** assistant
- **Feature:** F-006 (assigned — do not pick your own)
- **Agent:** spec-agent
- **Date:** 2026-08-21

## Context

**This is a new feature with its own spec and its own Gate 1.** It is deliberately
not folded into F-005: the owner closed that gate, and F-005 is under an amend-only
constraint that adding a trash would break.

**There is no user to interview.** Work autonomously from the owner decision and the
files below. Do not build an HTML prototype.

**Why it exists, and this is the part that must survive into the spec.** The owner
asked what comparable products do. Every major todo app keeps delete; they differ only
in the net behind it — Apple Reminders keeps *Recently Deleted* for 30 days, TickTick
and Things (Mac) have a Trash, Todoist relies on daily backups, and Things on iOS has
**no net at all** and compensates by making deletion a multi-step process. This app
currently has a **one-tap delete on every list row** and no net.

**F-005 revision 5 now depends on this feature shipping.** AC-43's ten-second elapse
on the undo offer does not ship before F-006, and AC-33's WCAG 2.2.1 argument is
written as *the timer is conformant because an equivalent untimed path exists*. Until
this feature lands, that path does not exist. **A reader of F-006 must be able to see
that F-005 is waiting on it.**

## Read these files first

1. `docs/reports/owner-decision-2026-08-19-carried-notice-placement-and-timer.md` —
   **§4 and §5**. §4 carries the market comparison, what already exists, what is
   missing, and the structural rule. §5 carries the scope split and the ordering.
2. `docs/specs/assistant/F-005-task-detail.md` — **AC-41** (restore), **AC-42** (the
   row's delete), **AC-43** (the undo offer and its five enders), **AC-47** (the
   notice family). These are the callers; F-006 must not restate their rules, only
   reference them.
3. `docs/specs/assistant/api-contracts.md` — `DELETE /tasks/{id}` and
   `POST /tasks/{id}/restore`. Read what the restore already guarantees before
   specifying anything that restores.
4. `docs/specs/_shared/adr/ADR-012-delete-membership-and-restore.md` — delete
   membership and why restore is a route rather than a patchable field.
5. `docs/specs/_shared/adr/ADR-009-today-is-a-date.md` — **§ Amendment 2**, the
   two-axis model. This is the structural trap below.
6. `src/assistant/api/app.ts` — the delete, restore and task-read paths. Read what is
   built before specifying what is missing; the gap is smaller than it looks.

## Write to

- `/Users/tandt/projects/todo-ai-redesign/docs/specs/assistant/F-006-recently-deleted.md`
- `/Users/tandt/projects/todo-ai-redesign/docs/specs/assistant/index.md` (add the row)

## What already exists — measured, not assumed

Verified by the orchestrator on 2026-08-19 by reading the API. **Deletion has been
soft since F-001**: `deleted_at` and `delete_gesture_id` are stored fields, `DELETE
/tasks/{id}` sets `deleted_at`, `GET /tasks` filters `deleted_at === null`
(`app.ts:422`), `POST /tasks/{id}/restore` clears it and replays the whole delete
gesture, and **the live store already holds 53 soft-deleted rows out of 790**.

**The data for a trash is already there and has been all along.** Do not spec a
migration, a new column, or a new restore mechanism. Say what is already true and
reference it.

## What is missing — this is the feature

1. **A read path that returns deleted rows.** Every current read filters them out.
2. **A retention rule and a purge.** Nothing has ever removed a soft-deleted row, so
   today they accumulate forever — **that is not a trash, it is a leak that happens to
   be recoverable.** A stated retention turns one into the other. Apple's 30 days is
   the reference point, not a mandate.
3. **Permanent deletion** — one row, and empty-all. This is the only genuinely
   irreversible act in the product and the only place a confirmation earns its keep.
4. **The surface** — a lists-menu entry, peer to `Done`.

## The structural trap — the one thing most likely to be got wrong

`ADR-009 § Amendment 2` models tasks on **two axes**: a date axis (Today · Upcoming ·
undated) and a filing axis (Inbox · lists), with `Done` the gate that empties both.

**The trash is on neither axis.** It is a **lifecycle state** like `Done`, not a
**container** like `Inbox`. A deleted task must appear in **no** collection, **no**
count, and **no** assistant query while it sits there.

Built as a fifth filing destination it repeats exactly the category error the
four-buckets decision fixed, and `INV-INBOX-FILING` is the standing warning about that
family of mistake. Say which it is, in the spec, in one sentence.

## Questions the spec must answer rather than leave to whoever builds first

Some of these you can decide and record; some are the owner's. **Mark clearly which
is which** — a decision you took and a question you are asking must not look alike.

- **How long is the retention, and what starts the clock?**
- **What purges — a background job, a read-time sweep, or the user only?** There is no
  scheduler in this app today. If nothing purges automatically, say so plainly rather
  than implying one.
- **What happens to a deleted task's steps, and to a step whose parent is live?**
  ADR-012 already answers part of this for restore; the trash view has to agree with
  it or state where it differs.
- **A deleted repeating task** — is the series ended, and what does restoring it do?
- **Does restoring return the task to where it was, or to Inbox?** The row may have
  been in a collection that no longer makes sense (a due date now in the past).
- **Is the trash per-account?** It must be, but say it.

## Also required

- **`## Impact`** — mandatory, this is not the first feature in the module. What
  changes in F-001, F-003 and F-005 because deleted rows become reachable. **Go
  looking specifically at every count and every read path that currently assumes
  `deleted_at IS NULL`** — that assumption is about to have an exception, and the
  places relying on it are not all in one file.
- **One thing T-177's return surfaced that belongs here:** AC-41's restore has **no
  read path that returns a deleted row**, and nothing has ever purged one. Both were
  left as architecture's problem; they are this feature's.

## Success criteria

- The spec exists at the path above with every section the output contract requires.
- `bash .claude/tools/spec-check/declared-elements.sh docs/specs/assistant/F-006-recently-deleted.md`
  exits 0.
- Every AC has a stable `AC-n` id and a platform tag.
- The index row is added **and** — read this file before writing it — its prose
  currently opens with a per-feature "F-00X is at revision N" sentence. **Do not add a
  stale one.** If a sentence you write will be wrong at the next revision, write it so
  that it cannot be.
- `## Impact` names what breaks, not only what is added.
- The ADR-009 answer (lifecycle state, not container) is stated explicitly.
- F-005's dependency on this feature is visible from F-006's own text.
