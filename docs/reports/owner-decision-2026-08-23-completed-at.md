# Owner decision, 2026-08-23 — `task.completed_at` is added

Owner: *"O1"*, answering the brief on T-117.

## The decision

**A task records when it was completed.** One nullable timestamp, written when a
task is marked done and cleared when it is un-done.

This unblocks **T-117** (`docs/reports/`, the mid-day progress display) and
**UC-45 AC-45.1** (Logbook grouped by completion day, which
`docs/specs/_shared/uc-coverage-map.md:161` records as MISSING).

## What it replaces

`docs/specs/assistant/data-model.md:320` derives `done_today` as
`status: 'done'` **and** `due_at` is today, and says in its own words that this
measures *"was due today and is done"*, not *"was completed today"*.

Three cases where the two differ, and the third is why this was decided rather
than deferred again:

| The user does | The derivation says |
|---|---|
| a task due today, ticked at 11pm last night | counted today |
| a task due yesterday, ticked this morning | not counted |
| **a task with no due date, ticked today** | **never counted** |

The third case is not an edge. `data-model.md:185` gives `undated` its own place
on the date axis, and quick-add creates a task without asking for a date — that
is the product's core promise (`CLAUDE.md ## Project`, `Is`). So the progress
display currently cannot see most of what a user finishes.

*Inferred from the derivation, not measured against the 790 rows.*

## What it does NOT settle

**F-005 AC-25 — the run count for a repeating task** — is still open, and this
decision does not close it. AC-25 counts occurrences *completed at least once*;
a single timestamp that is cleared on un-complete loses that fact. Complete an
occurrence, un-complete it, and the model says it was never completed.

`F-005-task-detail.md:675` already records this as an obligation on the
architecture phase rather than the spec. It stays there. **Do not read this
decision as having answered it.**

## Rejected

**An append-only completion log.** It answers all three needs and adds history,
and it was declined for cost: a new entity, more writes per completion, and sync
semantics the project does not need at prototype-grade with no real backend.

**Dropping the progress display.** The design and both clients' code already
exist; Logbook and AC-25 would stay wrong regardless.

## Common practice, as it stood in the brief

Google Tasks (`completed`, RFC3339, separate from `status`), Todoist
(`completed_at` on completed items), Apple Reminders
(`EKReminder.completionDate`) and Things 3 (Logbook by completion day) all store
**one timestamp**, not a log. None of them derives a completion day from a due
date.

## What happens next

The field belongs to the data model, so **architect-agent writes it** —
`docs/specs/assistant/data-model.md`, the API contract, and the `## Data` table
of any spec that reads it. This file is the decision, not the change.

Reversibility: cheap now — one nullable column, 790 rows, no real backend.
Expensive once clients read it.
