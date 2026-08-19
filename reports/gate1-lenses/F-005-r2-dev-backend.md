# Gate 1 round 2 — F-005 — dev lens (backend/api)

Persisted by the orchestrator per **L-009**. The lens wrote nothing.
**HIGH 5 · MEDIUM 2 · LOW 1.** Confidence HIGH. All 48 ACs examined; every code
claim in `## Impact` re-verified against the repo, including the three new subsections.

## The four round-1 dispositions the briefing asked about

| Round-1 | Claimed fix | Verdict |
|---|---|---|
| dev-F2 — field rules guard the HTTP door only | AC-40 | **Landed, and correct about the code.** `taskChangesFrom` (`api/app.ts:137`) is called from exactly two places, both HTTP handlers (`:306`, `:341`); `applyEdit` (`engine/apply.ts:88-92`) assigns straight onto the row. But **AC-40's remedy is not implementable as worded — F1.** |
| dev-F4 — AC-13's forbidden behaviour is already shipped | §10 | **Landed and verified exactly.** `dueAtForCollection('today')` → `startOfTodayIso` → local midnight (`_shared/model/tasks.ts:255-272`); `formatDue` returns `clock(d)` unconditionally on a same-day due (`format.ts:27-34`). Nothing to add. |
| dev-F1 — nothing can un-delete a row | AC-41 + corrected API Touch Points | **Diagnosis exact** (`app.ts:347`, `:358` both 404 on `deleted_at !== null`; `:316` 409s a re-POST; `undo.ts:92` replays only a turn's snapshot). **The AC has a hole the round-1 finding did not — F5.** |
| dev-F8 — the ACs' clock is not the harness's | AC-44 | **Client-seam half implementable**; every model function already takes `now: Date = new Date()`. **The zone half is not — F2.** |

## HIGH

**F1 — AC-40, AC-36, AC-18 — the turn path has no refusal to be "identical" to.**
`TurnOutcome` (`api/types.ts:52-63`) has six members — applied, question, resolution,
unclassifiable, no_match, unsupported_query — **none is a refusal**; F-002's
`## What speaks` is declared "exhaustive and closed", fourteen rows, no refusal
either. `## Impact` §3 forecloses this — "No new SPK-* row is owed" — and that
conclusion was checked against the *applied — edit, non-title field* row, i.e. the
**permitted** half of AC-36 only. The HTTP refusal is a 400 addressed to a client
that sent a bad body; a turn refusal is addressed to a user who spoke a well-formed
sentence, so "identically" has no referent. Three wrong answers available: reuse
`no_match` (a lie — the task *was* matched), reuse the 500/502 failure envelope
(reports a server fault for a healthy turn), or write nothing and emit nothing —
**the silent drop AC-36 and AC-18 exist to forbid, which passes AC-40's own fixture
row** if that row asserts only "nothing was written". *Directive:* state that the
turn-path refusal is a new `TurnOutcome` member whose wording F-002 owns, and correct
§3 to say its "no new frame owed" finding covers the permitted half only.

**F2 — AC-44 + 6 ACs — the zone travels with a turn and only with a turn.**
`req.timezone` is a member of `TurnRequest`, allowlisted on `POST /assistant/turn`
alone (`app.ts:194-212`). `POST/PATCH/DELETE /tasks` run `rejectUnknownFields`
against `TASK_CREATE_FIELDS`/`TASK_PATCH_FIELDS` (`:134-135`), so a client sending a
zone gets **400**. The `Clock` port is `now(): number` — epoch ms, no zone. Every
operation AC-44 enumerates is triggered from the CRUD path: setting a repeat is the
detail's picker (AC-20, zero AI calls) → PATCH; completing is a tick from the detail,
a web row, or a **mobile** row → PATCH. The zone is available at exactly one of the
four doors that trigger the arithmetic — **L-005's shape, on the AC written to close
a clock gap.** `req.timezone` is also `string | null` and unvalidated; AC-44 makes it
load-bearing without saying what a null zone does. *Directive:* say where the server
gets the zone on the task-CRUD path and what it does without one; add it to
`## API Touch Points` as a contract change beside the multi-row response.

**F3 — AC-26, AC-39, AC-3 — nothing requires a client to READ the multi-row
response.** Both clients' only task-write path is the shared controller;
`toggleTask` (`_shared/controller.ts:596-607`), `editTask` (`:610-623`) and
`removeTask` (`:626-636`) apply an optimistic local change, then await and **discard
the `ApiResult` entirely** — no read, no error branch, **no `refreshTasks()`**. By
contrast `addTask` refreshes on success (`:582`) and a mutating turn refreshes
unconditionally (`:442`). A hand tick of a repeating task — the only path mobile has —
makes the row leave Today and the successor appear **nowhere**, until some unrelated
event refreshes, at which point a row the user never created materialises with no
gesture attached. Relatedly, `## API Touch Points` rejects the alternative on a
**false premise**: it calls a blind `GET /tasks` after a write "the manual refresh
AC-3 says there is none of", but `controller.ts:442` **already performs exactly that**
after every mutating turn, and AC-3's "no manual refresh" means no user gesture.
*Directive:* make the receiver an obligation, name `controller.ts:607/623/635` as its
sites, and correct the API Touch Points characterisation.

**F4 — AC-36, AC-40 — `NewTaskFields` is misfiled in §1, and the create half of the
voice decision ships broken.** §1 files `NewTaskFields` among the harmless
"remaining sites" on the reasoning that a missed field is `undefined` rather than its
empty value. Wrong for this one: `NewTaskFields` (`apply.ts:22-27`) is the **turn-path
create allowlist**, `applyCreate` (`:44-54`) hardcodes `reminder_at: null` and has no
note at all, and the interpreter's create shape is `{title, due_at?, priority?,
status?}` (`ports/interpreter.ts:57-63`). AC-36 demands "one fixture row per permitted
field" — which an **edit** row satisfies, so the create half ships green.
*"Add a task to call the dentist and remind me at nine"* — the most natural sentence
for the field the owner's voice answer exists to make reachable — creates the task
with the reminder **silently dropped** and a diff that never mentions it. Second,
smaller site: `ContextTask` (`interpreter.ts:24-30`) is what the model *reads* —
handle, title, status, due_at, priority — so the assistant **cannot see** the note or
reminder it is now permitted to change ("push the reminder an hour later" has nothing
to read). Neither list is in §1's fourteen.

**F5 — AC-41, AC-19, AC-15 — a cluster restore has no membership rule.** A hand
delete is `DELETE /tasks/{id}` (`app.ts:356-364`): it sets `deleted_at` on one row and
**records nothing about what the gesture covered** — there is no undo record for hand
actions, and AC-43's undo is an in-place client offer. Keyed on `parent_id`, the
restore resurrects a step the user deliberately deleted an hour earlier — an un-asked
row reappearing on the surface where AC-43 promises "it reverses exactly the action it
was offered for and nothing else". Keyed on the delete's actual membership, it needs
stored server state no AC names. A third guess — matching `deleted_at` timestamps — is
what an implementer reaches for and is a coincidence, not a key.

## MEDIUM

**F6 — AC-46 — does a turn-caused row enter the turn's *anatomy*?** AC-46 puts it in
`created_ids`, `undo_snapshot` and `post_apply` and is silent on `changed_task_ids`,
`turn.diff`, `created_titles`, `deleted_titles`. Today the two are one thing —
`ApplyResult` emits anatomy, snapshot, post_apply and created_ids from the same loop
(`apply.ts:75-99`) — so AC-46 is the first time they can differ, and the default route
(generate the successor via `applyCreate`) puts it in the anatomy **automatically**,
so the choice gets made without anyone noticing it was one. Included: a voice "done"
on a parent with eight steps renders nine-plus diff lines naming **step titles the
user has never seen**, since AC-35 makes steps undrawable — §12's complaint arriving
through a door AC-35's directive does not reach, because the handle list governs what
the model may *address*, not what the anatomy *reports*. Excluded: the undo record and
the message disagree about what the turn touched.

**F7 — AC-42, AC-43, AC-2 — the row-delete undo is offered whether or not the delete
happened.** `removeTask` never inspects the `ApiResult`. On a failed DELETE the row is
already gone locally with no server delete to reverse, so AC-43's undo calls AC-41's
restore on a live row (404 or no-op) and the user is told something was restored that
was never deleted. AC-2's mobile bullet commits to changing the shared controller but
frames it as *error surfacing for the detail's field writes*.

## LOW

**F8 — §12 overstates, and one number is off by three.** The shipped behaviour is
narrower and better: `mobile/model/task-link.ts` renders a task the current collection
does not hold as **plain text, deliberately not an inert control**, quoting AC-31 in
its header. Separately: 716 open rows is exact, but they span **190** distinct
`user_id`s (197 across all 790 rows), not 193. Neither changes a directive — but §12
is the subsection arguing the consequence is worse than the change, and round 1's
`## Impact` was trusted largely because its numbers held.

## `## Impact` re-verified in the repo — all hold

§1's thirteen `reminder_at` lines and the fourteenth list without it; `applyEdit`
pushing to `changed_task_ids` before writing only the tuple; `task-equals`'s `FIELDS`
containing `updated_at`; `cloneTask` as a shallow spread (`:24`) — so the shared-
`recurrence`-object hazard is real; the four row constructors, all literalling
`reminder_at: null`; §5's **six** readers each at the cited line; §6's migration —
**790 rows, 783 `null`, 7 `"high"`**, and `priority` accepting any string today
(`app.ts:151-156`); §7's `TaskList.tsx:71/136` correction; §10 in full; §11 in full;
undo's whole-row replacement (`undo.ts:98`); `TaskWire`'s short shape. One extra
measurement: **`reminder_at` is set on zero of 790 rows** — the owner-decision doc's
premise is still true today.

## Checked, nothing found

AC-34 (both halves coherent against `taskEquals`'s `===`-per-field and `undo.ts:96`'s
replay) · AC-25's run count (countable over `series_id` + completions) · AC-28's five
conditions (all readable from row state) · AC-2's field-level guarantee (satisfiable:
`PATCH` assigns only supplied keys, advances `updated_at`) · AC-5, AC-8's tolerant
read, AC-14's one-call create, AC-18, AC-20, AC-21, AC-23, AC-24, AC-27, AC-29, AC-30,
AC-31, AC-37 · AC-32's zero-AI-call seam (the CRUD routes genuinely never touch the
Interpreter, `app.ts:293-364`).
