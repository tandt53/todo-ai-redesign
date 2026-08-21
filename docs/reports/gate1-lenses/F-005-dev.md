# Gate 1 — F-005 — dev lens

Persisted at dispatch time per **L-009**.

**HIGH 5 · MEDIUM 4 · LOW 0.** Confidence HIGH. All 37 ACs, and every code claim
in `## Impact` verified against the repo.

## HIGH

### F1 — AC-31, AC-4 — no route can un-delete a task
`DELETE` sets `deleted_at`; `PATCH` 404s on any deleted row; `GET /tasks` filters
them out; api-contracts lists four routes and **no restore**. The only un-delete
in the system reverts a **turn** — and a hand delete from the detail creates no
turn, so there is nothing to revert. Re-POST under the same id **409s**. So
`## API Touch Points`'s claim that the existing endpoints "carry all of it" is
false. **Earliest catch is web build time, after architecture has signed off on
"no new endpoints".**

### F2 — AC-6/8/10/36/37 — every new validation guards one door of two
`taskChangesFrom` is where "title must be non-empty", the priority set and the
null/empty rules live — **and the turn path never calls it.** `applyEdit` assigns
straight onto the row for every member of the diff tuple. So after F-005 a turn
can set **an empty title** (AC-37 says the task keeps its name), **a
whitespace-only note** (AC-6 says that is no note), **a free-string priority**
(AC-8 says four values), and an empty string where AC-10 says clearing stores no
value. This is the **L-005 shape the spec cites four times** — and the unguarded
door is the one **the spec itself widens in AC-36**. AC-37's own text says the
rule belongs "on the transition" and then names only the surface.
**Directive:** make the field rules bind **the write, not the endpoint**, and
follow the spec's own AC-36 pattern — a fixture row that tries an illegal value.

### F3 — AC-35, AC-17 — `inCollection` is not "the one predicate every count reads"
**Four live sites read `state.tasks` cardinality directly** and would count steps:
web `TasksSurface.tsx:241-249` (`nothingAnywhere`, `loading`, `failedBlank`),
mobile `tasks-view.ts:111,113` (**which chooses between the ET-FIRST and
ET-COLLECTION empty states**), mobile `index.ts:244` (`hasTasks`), mobile
`a11y.ts:278` (decides which a11y ids must exist).
A user whose only rows are steps sees *"this collection is empty"* instead of the
first-run state, and **the a11y id set expects a row that is never drawn.**
AC-35's own falsifiable claim — "in no count" — **fails at sites its directive
does not reach, and fails silently.**

### F4 — AC-13/22/12 — the forbidden behaviour is already shipped, unnamed
`dueAtForCollection('today')` returns **local midnight**, online and offline, for
every task created while viewing Today; `formatDue` returns `clock(d)`
unconditionally for a same-day due. **So those rows already render as "12:00 AM"
— a fabricated midnight shown as a time the user never picked, which is exactly
AC-13's stated failure, shipped.** AC-13 therefore forces changes to an F-001
create path and a shared formatter, **neither named in the nine Impact
subsections**, and leaves undecided what a pre-F-005 row with no `due_all_day`
reads as. §6 does this work for `priority`; nothing does it for `due_all_day`.

### F5 — AC-35/36/18 — steps become voice handles, and the link goes inert
`turns.ts:370-378` filters only on `user_id` and `deleted_at`, so **a task with
eight steps contributes nine handles.** AC-36 refuses the assistant the
structural fields but says nothing about `title`, `status` or `delete`, so a turn
can rename, complete or delete a step by name.
**The result is worse than the change itself:** F-001 AC-31's reveal is gated by
`inCollection`, which AC-35 makes false for every step — **so the assistant
reports changing a task and the message's link is inert, with no explanation
available to the user.** It also dilutes the handle list the whole UC-18
out-of-scope argument rests on.

## MEDIUM

- **F6 — AC-1/3/32 — the shell has no room for a fourth surface.** `ShellSurface`
  is `'talk' | 'tasks' | 'settings'` and the layout branch is a **container query
  in CSS with no width read in JavaScript** — a constraint recorded in an owner
  decision. So the detail must be one JS state that CSS places at both widths, and
  the spec gives no bound on what it displaces above the split: the list (which
  F-001 AC-24 puts beside the conversation) or the Talk panel (which AC-3 and
  AC-32 assume is live). **Whichever an implementer picks, one of the two
  contradicts an F-001 AC.**
- **F7 — AC-2, AC-33 — every existing task write discards its result, deliberately.**
  `toggleTask`, `editTask`, `removeTask` await and never read the result;
  api-contracts records this as an accepted window. AC-2 makes error surfacing a
  contract. The implementer must either **change the shared controller** — changing
  F-001's row behaviour on both clients, an impact none of the nine subsections
  names — or **add a second write path**, which is the duplication the spec objects
  to elsewhere.
- **F8 — AC-12/23/33 — no client clock.** `new Date()` is called inline at three
  sites and one of them documents the un-memoised call as deliberate; both
  clock-bearing seams are explicitly harness/server-side. AC-15's drag has the same
  problem for a different reason — **jsdom does not exercise a pointer gesture** —
  and AC-16's keyboard alternative is the half that is unit-testable.
- **F9 — AC-35/13/17/2 — "web first" is not achievable for four ACs.** Their
  implementation sites are in `_shared/`, **which the mobile client compiles.**
  Mobile inherits changed behaviour with no mobile AC, no parity row and no mobile
  test tier — the same class of gap §7 flags in the other direction. **Some of that
  inheritance is desirable, which is exactly why it should be stated rather than
  arrived at.**

## Impact-section claims verified

Every checkable code claim is accurate. Corrections and confirmations:
- **13 sites confirmed** by count. One correction: `NewTaskFields` is listed among
  the remaining sites but does not carry `reminder_at`; `TASK_CREATE_FIELDS` is a
  **14th** site that carries the field list without that field. Immaterial to the
  argument.
- `applyEdit` **does** push to `changed_task_ids` unconditionally before writing
  only the tuple's members — **the empty-diff failure is real**.
- `task-equals`'s field list **does** contain `updated_at` — the safety net holds
  by accident of one field.
- Undo's whole-row replacement, snapshot serialization, `inCollection`'s three
  reads, the 790/783/7/0 measurement, and the stale 29-vs-32 parity count: **all
  exactly as stated.**
- **§3's correction to the orchestrator's briefing is right** — F-002's table is
  keyed by message kind and already carries the non-title-edit row; no new spoken
  frame is owed.
- AC-4's server half **already holds**; AC-32's AI-call seam **exists**.

## Checked, nothing found

Wire shapes (delegated to architecture, correctly) · AC-2's field-level guarantee
is satisfiable today (`PATCH` already assigns only supplied keys and advances
`updated_at`) · AC-5's modified-since claim holds · AC-19/21/24/25/26/27/28/29/30
are pure server behaviour with no existing implementation to contradict ·
AC-7/9/17's placement on an unspecced surface · AC-33's WCAG list against the
platform doc.
