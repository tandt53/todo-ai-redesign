# F-005 task-detail — API test cases (index)

**Authored:** 2026-08-19 by qa-api-agent (T-166, `phase: author`) — from
`specs/assistant/F-005-task-detail.md` (revision 4, Gate 1 closed),
`specs/assistant/api-contracts.md § Feature F-005`,
`specs/assistant/data-model.md § Feature F-005` and ADR-010 … ADR-015 only.
**No file under `src/` was read to decide what to assert** (`_qa-foundations §2`).

**Automation:** `qa/assistant/automation/api/F-005-task-detail.spec.ts`
(vitest + supertest, in-process against `createApp(deps)`, per
`specs/_shared/platform/backend.md ## Test Harness`).
**Command:** `npx vitest run qa/assistant/automation/api/F-005-task-detail.spec.ts`

**Harness doors (new, T-166):** `qa/assistant/automation/harness/qa-doors.ts` —
`POST /__qa__/seed`, `POST /__qa__/set-clock`, `POST /__qa__/reopen-store`, plus
the pre-existing `GET /__qa__/ai-calls` and `POST /__qa__/advance-clock`. One
implementation, mounted both by `qa-test-server.ts` (the Playwright harness
process) and by the in-process api suites, because two seed doors would be
L-004's shape inside the instrument built to detect it. The contract for them is
`api-contracts.md § Harness doors`.

**Test data namespace:** task titles `qaapi5-*`; reserved user ids and the pinned
clock in [`qa/_shared/fixtures/api/f005-users.json`](../../../_shared/fixtures/api/f005-users.json).
Separate from the F-001 suite's `users.json` on purpose: ADR-010 makes
`account.timezone` **first-report-wins**, so two suites sharing an account id
would make the zone depend on which suite ran first.

**One instant, one zone (AC-44, L-023):** every fixture instant derives from
`T0 = 2026-08-19T12:00:00.000Z` in `UTC`, held by `POST /__qa__/set-clock`, which
writes the zone onto the account row as well as moving the seam. L-023 records
this project shipping a harness that pinned the seam and left the fixtures on the
wall clock: 771 tests were green *because the view read the wrong clock*. Which
way the clock has to move is a per-case decision and is stated in each case —
TC-31 needs it **held** (AC-5's `updated_at` proof), TC-20 needs it **advanced**
(AC-28's third condition is a timestamp equality and is otherwise
unconstructible).

---

## Test cases

| TC | Title | ACs | Type | Pri |
|----|-------|-----|------|-----|
| [TC-01](TC-01-qa-harness-doors.md) | The three `__qa__` doors do what they claim | AC-8, AC-15, AC-34, AC-44 | edge | P1 |
| [TC-02](TC-02-field-level-write.md) | Every change is a field-level write, falsifiable both ways | AC-2 | happy | P1 |
| [TC-03](TC-03-multi-row-response-rule.md) | A write that changes more than one row returns every row it changed | AC-26, AC-2 | happy | P1 |
| [TC-04](TC-04-title-never-empty.md) | The title is never empty, and never silently truncated | AC-37, AC-40 | negative | P1 |
| [TC-05](TC-05-note-no-empty-string.md) | The note: line breaks survive, blank input stores no note at all | AC-6 | boundary | P1 |
| [TC-06](TC-06-priority-four-states-and-absence.md) | Priority has four states, and `none` is an absence | AC-8, AC-40 | boundary | P1 |
| [TC-07](TC-07-due-and-reminder-set-and-clear.md) | Due and reminder: set, clear, and the marker a reminder write clears | AC-10, AC-20, AC-32 | happy | P1 |
| [TC-08](TC-08-due-all-day-three-rules.md) | `due_all_day` — a date-only due never behaves as a time nobody chose | AC-13, AC-44 | boundary | P1 |
| [TC-09](TC-09-one-instant-one-zone.md) | One instant, one zone, one answer per row | AC-44, AC-32, AC-13 | boundary | P1 |
| [TC-10](TC-10-step-created-in-one-call.md) | A step is created in one call, positioned by the server | AC-14 | happy | P1 |
| [TC-11](TC-11-what-a-step-is-and-is-not.md) | What a step is, and is not — one level, no repeat, whole-write refusal | AC-18, AC-14 | negative | P1 |
| [TC-12](TC-12-step-order-survives-restart.md) | The order of the steps is the user's, and it survives a restart | AC-15, AC-41, AC-43 | happy | P1 |
| [TC-13](TC-13-parent-transitions.md) | What happens to a step when its parent moves — all four | AC-19, AC-26, AC-41 | happy | P1 |
| [TC-14](TC-14-recurrence-shapes.md) | The recurrence shapes that exist, exactly | AC-21, AC-20 | boundary | P1 |
| [TC-15](TC-15-repeat-always-has-a-due.md) | A repeating task always has a due — create, then align | AC-22, AC-13, AC-23 | happy | P1 |
| [TC-16](TC-16-due-must-lie-on-the-rule.md) | The due must lie on the rule, and it moves forward | AC-23, AC-29 | happy | P1 |
| [TC-17](TC-17-month-day-clamp.md) | Month-day overflow clamps, and candidates de-duplicate | AC-24, AC-44 | boundary | P1 |
| [TC-18](TC-18-series-ends-one-way.md) | A series ends one way, never two — and all four endings | AC-25, AC-30, AC-26 | boundary | P1 |
| [TC-19](TC-19-successor-carries-the-work.md) | Completing a repeating task never loses the work | AC-26, AC-27, AC-13 | happy | P1 |
| [TC-20](TC-20-un-complete-removes-untouched-successor.md) | Un-completing removes the successor only when untouched | AC-28, AC-46 | edge | P1 |
| [TC-21](TC-21-edit-one-occurrence.md) | Editing one occurrence edits only that occurrence | AC-29, AC-23 | happy | P1 |
| [TC-22](TC-22-delete-scope-occurrence-or-series.md) | Deleting names which of the two things it is about to do | AC-30, AC-31, AC-25, AC-41 | edge | P1 |
| [TC-23](TC-23-restore-a-soft-deleted-task.md) | A soft-deleted task can be restored | AC-41, AC-31, AC-15, AC-19 | happy | P1 |
| [TC-24](TC-24-snapshot-two-opposite-rules.md) | Restoring a snapshot never unsets a field it predates | AC-34, AC-8 | edge | P1 |
| [TC-25](TC-25-step-is-not-a-handle.md) | A step is in no collection, in no count, and is not a handle | AC-35, AC-36 | security | P1 |
| [TC-26](TC-26-assistant-may-set-four-fields.md) | What the assistant may set — a capability, not a permission | AC-36 | happy | P1 |
| [TC-27](TC-27-refused-turn-outcome.md) | The refused turn — an outcome, not a silence | AC-36, AC-40, AC-18, AC-37, AC-6, AC-8, AC-22 | negative | P1 |
| [TC-28](TC-28-reminder-acknowledgement.md) | The server writes `reminder_shown_at` on an acknowledgement | AC-38, AC-10, AC-40 | happy | P1 |
| [TC-29](TC-29-undo-a-turn-that-completed-a-repeating-task.md) | A turn that completed a repeating task, then undone | AC-46, AC-26, AC-28 | edge | P1 |
| [TC-30](TC-30-undo-a-turn-that-completed-a-parent.md) | A turn that completed a parent, then undone — no step title | AC-46, AC-19, AC-35 | edge | P1 |
| [TC-31](TC-31-hand-edit-is-modified-since.md) | A hand edit makes the task modified-since, and the undo names it | AC-5 | edge | P1 |
| [TC-32](TC-32-repeat-is-a-picker.md) | Setting and clearing a repeat needs no AI | AC-20, AC-21, AC-32 | happy | P1 |
| [TC-33](TC-33-wire-shape-contract-drift.md) | Contract drift — the wire shape is exactly what is declared | AC-2, AC-8, AC-13, AC-25, AC-19 | edge | P1 |
| [TC-34](TC-34-error-code-matrix.md) | The error-code matrix — one case per declared code | AC-8, AC-13, AC-18, AC-21, AC-22, AC-25, AC-30, AC-37, AC-38, AC-41, AC-44 | negative | P1 |
| [TC-35](TC-35-idempotency-concurrency-inversion.md) | Idempotency, concurrency, and the pinned contract inversion | AC-26, AC-38, AC-41, AC-2 | edge | P1 |

## AC coverage — every `(api)`-tagged AC in F-005

31 of F-005's 48 ACs carry `(api)`. Each has at least one P1 case here.

| AC | Also tagged | Covered by | The observable |
|----|-------------|-----------|----------------|
| AC-2 | web, mobile | TC-02, TC-03, TC-33 | the request body's key set, `prior`, and an arrival surviving an interleaved save |
| AC-5 | web | TC-31 | the task is skipped and named by an undo, with `updated_at` held equal |
| AC-6 | web | TC-05 | `note: null` on read-back, never `""`; the 20 000 bound refused not truncated |
| AC-8 | web | TC-06, TC-24a, TC-33b | the **stored** value is `null` for `none`; an out-of-set stored value reads as `none` |
| AC-10 | web | TC-07 | clearing stores no value; a reminder write clears `reminder_shown_at` |
| AC-13 | web, mobile | TC-08, TC-09d | the flag's three resolution rules, and one answer per row across devices |
| AC-14 | web | TC-10 | `parent_id` on the create; a supplied `step_order` preserved |
| AC-15 | web | TC-12 | one row per move, `prior.step_order`, and the order across a store re-open |
| AC-18 | — | TC-11 | the refusal's stated reason, and that the whole write wrote nothing |
| AC-19 | web, mobile | TC-13, TC-30 | `completed_by_parent` on the cascade, and only the cascade reversed |
| AC-20 | web | TC-32, TC-07c | the AI-call counter across set / preview / clear |
| AC-21 | — | TC-14 | the two exclusions refused; canonicalisation; per-member diff rows |
| AC-22 | — | TC-15 | today's all-day due created, then aligned; clearing the due refused |
| AC-23 | web | TC-16 | forward alignment at all three entry points; the preview equals the commit |
| AC-24 | — | TC-17 | the month-boundary table, and `{30,31}` in April as one date |
| AC-25 | web | TC-18, TC-22c | `series_live` false for all four endings; the run count's three properties |
| AC-26 | mobile | TC-19, TC-03, TC-35c | one successor per occurrence, in the write's own response |
| AC-27 | — | TC-19c–g | note, priority, every step unticked, the reminder's offset, the placement |
| AC-28 | — | TC-20 | each of the five conditions violated alone; the removal is hard |
| AC-29 | — | TC-21 | history untouched (`updated_at` included); the new rule reaches the next one |
| AC-30 | web | TC-22 | completed occurrences left; `series_ended_at` on survivors; one-call undo |
| AC-31 | web | TC-22a, TC-23 | the soft delete, and the cluster restore it offers |
| AC-34 | — | TC-24 | a pre-F-005 record compares equal, and replay leaves absent fields alone |
| AC-35 | web, mobile | TC-25 | the interpreter context holds one handle for a task with eight steps |
| AC-36 | — | TC-26, TC-27 | one fixture row per permitted field on both paths; the refused outcome |
| AC-37 | web | TC-04, TC-27c | empty title refused at both doors; the task keeps its name |
| AC-38 | web, mobile | TC-28 | `reminder_shown_at` persisted by the server, across a store re-open |
| AC-40 | — | TC-27 | one row per rule through the turn path, with four asserted absences |
| AC-41 | web | TC-23 | identity kept; the legacy row restores alone; the no-op is stated |
| AC-44 | web, mobile | TC-09, TC-17, TC-01c | the DST outcome, the roll's independence from the clock, the refusal |
| AC-46 | — | TC-29, TC-30 | two structurally distinct cases + the absence of step titles |

**`(api)`-tagged ACs not covered:** none.

## Error-code coverage

| Endpoint | Code | Case |
|---|---|---|
| `POST /tasks` | 400 VALIDATION (title, note, priority, `parent_id`, step-repeat, bounds, non-creatable field, `status: 'today'`) | TC-04c, TC-05b, TC-06d, TC-11a, TC-11b, TC-14b–e, TC-33e, TC-34a |
| `POST /tasks` | 409 TASK_ID_EXISTS | TC-23f, TC-34c |
| `POST /tasks` | 409 TIMEZONE_UNKNOWN | TC-09a, TC-34b |
| `POST /tasks` | 401 UNAUTHENTICATED | TC-34d |
| `PATCH /tasks/{id}` | 400 VALIDATION (every enumerated reason) | TC-34a |
| `PATCH /tasks/{id}` | 404 NOT_FOUND (deleted row, unknown id, cross-account) | TC-23f, TC-34d |
| `PATCH /tasks/{id}` | 401 UNAUTHENTICATED | TC-34d |
| `DELETE /tasks/{id}` | 400 VALIDATION (`scope=series` with no series) | TC-22d, TC-34a |
| `POST /tasks/{id}/restore` | 401 / 404 | TC-23e, TC-34d |
| `POST /tasks/{id}/reminder-ack` | 409 REMINDER_MOVED | TC-28c, TC-34c |
| `POST /tasks/{id}/reminder-ack` | 400 VALIDATION (missing `reminder_at`, unknown field) | TC-28g |
| `POST /tasks/{id}/reminder-ack` | 401 / 404 | TC-28f, TC-34d |
| `POST /tasks/{id}/repeat-preview` | 401 / 404 | TC-34d |
| `GET /account` · `PATCH /account` | 401 | TC-34d |
| `PATCH /account` | 400 VALIDATION (unknown IANA zone) | TC-09e |
| turn path | `refused` outcome, every reachable reason | TC-27 |

**Refusal reasons not reachable from the turn path in this suite, recorded
rather than hidden:** `step_not_addressable` (AC-35 removes steps from the
handle list, so a turn cannot address one — TC-25b asserts the exclusion) and
`nesting_too_deep` (the turn path offers no create-under-a-step shape). Both
rules are covered at the HTTP door, TC-11a.

## Test design techniques applied

| Technique | Cases |
|---|---|
| boundary value | TC-04b, TC-05d, TC-10d, TC-14d, TC-17, TC-18h |
| equivalence partitioning | TC-05b, TC-06a/d, TC-14a |
| decision table | TC-11c (four illegal parents), TC-18d (four endings), TC-20 (five conditions), TC-34a (twelve reasons) |
| state transition | TC-13 (four parent transitions), TC-18 (series endings), TC-23d (delete → restore → restore) |
| negative | TC-04, TC-05b, TC-06d, TC-11, TC-14b/c, TC-15c, TC-18a/b, TC-22d, TC-27, TC-34 |
| assertion of absence | TC-11a, TC-12b, TC-25b, TC-27, TC-30a |
| security-adjacent | TC-11c, TC-23e, TC-25, TC-28f, TC-34d |
| concurrency | TC-35c |
| data integrity | TC-02c, TC-11d, TC-12g, TC-19b, TC-24, TC-35d/e |
| contract drift | TC-33 |
| false-green control | TC-16d, TC-25c, TC-31b |

## What is NOT this tier's, and where it is

- **AC-2's failed-write, offline-refusal and close-then-fail states** — surface
  obligations (AC-47, AC-2's mobile bullet). qa-web-agent and qa-mobile-agent.
- **AC-35's five client-side cardinality readers** (`nothingAnywhere`, the mobile
  first-run choice, `hasTasks`, the a11y id set) — `data-model.md` says
  explicitly that no server-side check can see them.
- **AC-38's acknowledgement gesture and its offline behaviour** — design owns
  which control carries the action; the clients own "an acknowledgement made
  offline is not recorded".
- **AC-15's pointer reorder** — web e2e only; jsdom does not exercise a
  path-based pointer gesture (`## Test strategy`).
- **AC-1, AC-3, AC-4, AC-7, AC-9, AC-11, AC-12, AC-16, AC-17, AC-32, AC-33,
  AC-39, AC-42, AC-43, AC-45, AC-47, AC-48** — not `(api)`-tagged.

## Notes for the reviewer

- **Seven assertions in this suite were red on first authoring and each was
  triaged rather than weakened.** Two were genuine mistakes of mine about the
  spec (TC-18f expected a second successor where AC-26's revision-4 phrasing is
  per-occurrence and idempotent; TC-27c expected a refusal where AC-6's rule is a
  normalisation the HTTP door also performs). Two were fixture defects that made
  the case measure the wrong thing (TC-20c/d needed the clock advanced, because
  AC-28's third condition is a timestamp equality; TC-24b's fixture nulled
  `priority`, which is an F-001 baseline field and so is *present* in a
  pre-F-005 record). Two were assertions that conflated *membership of
  `changed`* with *was trashed* (TC-22b/e) — a minimal reproduction showed the
  survivor's `deleted_at` was `null` all along. One was a harness artefact
  (TC-09d: `recordClientZone` runs on every request, so reading the account
  through the default agent overwrote the observable). **No product bug was
  found**, and no assertion was relaxed to reach green.
- **Falsifiability** was not verified by mutating `src/` — that is outside this
  dispatch's scope and is reviewer C12's job. What stands in its place is the
  record above: each case's "Notes" section states which implementation error
  turns it red, and seven of them demonstrated it by going red for a real reason
  during authoring.
