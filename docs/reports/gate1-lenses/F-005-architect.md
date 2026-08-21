# Gate 1 — F-005 — architect lens

Persisted at dispatch time per **L-009**.

**Verdict counts:** HIGH 4 · MEDIUM 7 · LOW 2. Confidence HIGH. All 37 ACs, plus
`## Data`, `## API Touch Points`, all nine Impact subsections, and the ten open
questions. Evidence read in source, not inferred: `api/app.ts:124-372`,
`engine/apply.ts`, `engine/task-equals.ts`, `engine/undo.ts:60-140`,
`engine/serialize.ts`, `engine/turns.ts:355-395`, `_shared/model/tasks.ts:320-440`,
`_shared/controller.ts:620-700`, `api-contracts.md`, `data-model.md`,
`ADR-009 § Amendment 2`.

## Findings

### F1 — HIGH — AC-21/25/29/34/5 — recurrence is the first non-scalar field
Four mechanisms are scalar-only **by construction**: `cloneTask` is a shallow
spread, `taskEquals` compares `===` per field, `applyEdit`/`applyDelete` write
whole field values into `DiffRow.old/new`, and the row constructors build flat
literals. The Impact section treats all five closed lists as *add the field
name* problems and never says **one of the new names is an object**.
A shallow clone means the undo snapshot and the live row **share one
`recurrence` object** — mutating the rule mutates the snapshot, so AC-34's
"restoring never unsets" and AC-5's modified-since both stop holding, and undo
**overwrites the user's edit instead of skipping and naming it** (the exact
F-001 AC-7 guarantee). Invisible in every test that builds its own fixture,
because the identity comparison passes for the same reason the bug exists.
**Directive:** flatten recurrence into scalar columns, or require deep copy on
snapshot capture and structural comparison in modified-since — and name
`cloneTask`/`taskEquals` in Impact §1 as scalar-only.

### F2 — HIGH — AC-31/15/19 — nothing in the system can un-delete a row
`DELETE` sets `deleted_at`; `PATCH` 404s on any deleted row and `deleted_at` is
not in `TASK_PATCH_FIELDS`; `POST` with the same id answers `409`; `undo.ts`
reverts only rows in a **turn's** snapshot, so a detail-surface delete has no
entry. The client fires the DELETE immediately with no window.
So `## API Touch Points`'s **"No new assistant endpoints" is false** for AC-31.
Unresolved, the implementer either invents a contract or downgrades undo to a
client delay — which cannot satisfy AC-15's *"returns to the position it held,
because the order lives on the record that came back"*: that sentence names a
server row, not a client buffer.
**Directive:** state that un-delete is a new write path; say whether restoring a
parent restores its steps in one call or N.

### F3 — HIGH — AC-22, AC-23 — two ACs and the flowchart give three answers
Set "weekly on Monday" on a dateless task on a Wednesday. **AC-22:** due becomes
today, task joins **Today**. **AC-23:** a due the rule does not admit moves
forward to the nearest admitted day — Monday — landing it in **Upcoming**. **The
flow diagram** routes the dateless branch straight to "Repeat saved", skipping
alignment entirely, leaving the first occurrence on a day the rule excludes —
the one outcome AC-23 exists to prevent.
The three differ in a way the collection model makes visible, so
`collectionCount` and the badge disagree with the spec depending on which AC the
implementer read last.
**Directive:** fix the operation order in one AC, restate the collection
consequence, correct the flowchart's dateless branch.

### F4 — HIGH — AC-26/28/19/5/34 — undo breaks the one-open-occurrence invariant
A voice turn can set `status: 'done'` (it is in `DIFF_FIELDS`), which under
AC-26 generates a successor. That successor is created outside `applyCreate`, so
it is **not in `created_ids`, not in `undo_snapshot`, not in `post_apply`**.
Undoing that turn reopens the completed row and leaves the successor standing:
**two open occurrences of one series** — violating the invariant the spec says
"the rest of this section rests on". The same hole swallows AC-19's cascade:
steps ticked by their parent are not in the snapshot either, so undo leaves them
done. Impact §4 analyses undo only for field *shape*; this is a row-set problem.
AC-28 covers the un-complete gesture and undo is the other door — L-005's shape.
**Directive:** add an AC for undoing a turn that completed a repeating task or a
parent with steps; add a row to Impact §4 for generated rows.

### F5 — MEDIUM — AC-19/26/31/3 — every write returns exactly one task
`PATCH`/`DELETE`/`POST` each return one `{task}`, and F-005 makes three single
writes affect more than one row. The spec says generation is "a server
behaviour" and never says how the client learns what else the server did.
Either every write is followed by a blind `GET /tasks` — contradicting AC-3's
no-manual-refresh guarantee having a defined mechanism — or each door invents a
multi-row response independently. The transaction boundary is also unstated:
whether the successor is created inside the completing write's transaction is
the difference between a crash leaving a series with **zero** open occurrences
and leaving it with one.
**Directive:** state what a cascading write returns, and that generation is
inside the completing write's transaction.

### F6 — MEDIUM — AC-36/6/7 — one tuple cannot be both lists
Impact §1 correctly names `DIFF_FIELDS` as **both** the assistant's write
allowlist **and** the source of `turn.diff`. AC-36 requires the write half to
exclude `parent_id`, `step_order` and `recurrence.*`; F-001 AC-2/AC-4 require the
diff half to describe a delete or create **completely**, and
`applyCreate`/`applyDelete` enumerate every non-null member.
Narrow it and deleting a repeating task emits a diff omitting the recurrence;
widen it and AC-36's refusal has no allowlist to hang on.
**Directive:** say the constant splits into two lists; extend Impact §2's
note-in-a-diff-row observation to creates and deletes.

### F7 — MEDIUM — AC-35/36/18 — the interpreter reads a different list
AC-35 places the step exclusion in **one** predicate (`inCollection`), but the
interpreter's handle list is built from a different query — every live undeleted
row sorted by `created_at` — which never consults it. **Steps become ordinary
handles**, with titles, statuses, dates and priorities, and are enumerated in a
`bulk_delete` question's `task_titles` and `ask_snapshot`.
So the assistant can address, rename, complete and bulk-delete steps as
top-level tasks. AC-36 does not cover this: it constrains what may be *set*, not
which rows may be *addressed*. "Delete everything" would name step titles the
user never sees in a list. The spec's own test note asserts `inCollection`
membership only — **so this passes green**.
**Directive:** extend AC-35 to the interpreter's task list, the second reader of
"the task list".

### F8 — MEDIUM — AC-34, AC-5 — the gate in front of the replay fails the other way
`undo.ts:80,98` calls `taskEquals(cur, turn.post_apply[id])` over a hand-kept
field list. Widening it makes **every pre-F-005 `post_apply` record compare
unequal to a live row** — `undefined` stored versus `null` live — for every new
field at once. An undo across the change reverts nothing and reports every task
as modified: F-001 AC-7's skip path firing on tasks the user never touched, and
a created task left standing. Louder and more wrong than the unset-field case
AC-34 was written for, and AC-34's directive does not fix it — the gate
compares, it does not replay.
**Directive:** extend AC-34 to the modified-since comparison and state the
absent-key rule; the two records need opposite treatments.

### F9 — MEDIUM — AC-25, AC-30 — soft deletes and the run count
AC-25 rejects a stored counter because it "would be wrong the first time anyone
deletes an old occurrence" — but deletes here are **soft**, and AC-30 sends every
unfinished occurrence to the trash. Counting only live rows **reproduces exactly
the defect AC-25 cites as its reason**. Counting deleted rows means "delete the
whole series" immediately satisfies the run count and ends the series — a
second, unstated behaviour of that button.
**Directive:** say whether the count reads rows with `deleted_at` set.

### F10 — MEDIUM — AC-25/28/30 — `series_id`'s lifetime is unstated
`## Data` marks it required "with a repeat"; AC-25 says clearing a repeat leaves
the occurrence as an ordinary task. Dropped, AC-30 and the run count lose their
only key to the history rows. Kept, the requiredness clause is wrong.
**Directive:** state assigned-when and cleared-when (or never).

### F11 — MEDIUM — AC-14/15/18 — the create allowlist is not enumerated
`TASK_CREATE_FIELDS` carries neither `step_order` nor `note`, `due_all_day` or
the recurrence fields, and `taskChangesFrom` rejects unknown fields — so any of
them on a create is a 400. Adding a step becomes POST-then-PATCH with unstated
ordering: between them the step exists with an **undefined position**, which
AC-3's live-update guarantee renders to any other client watching.
**Directive:** enumerate the create allowlist; say who assigns a new step's
position.

### F12 — LOW — AC-35 — the invariant's subject narrows silently
Excluding steps from every count falsifies the sentence INV-INBOX-FILING is
written in: both `open_all` and `inbox_count` come to mean "every open
**non-step** task". The invariant's guard is that its two expressions are
deliberately **not written the same**; two subjects quietly narrowing at once is
how someone later concludes they are one fact — the re-merge the ADR says the
note is the weakest defence against.
**Directive:** add `data-model.md § INV-INBOX-FILING` and `ADR-009 § Amendment 2
§5` to Impact §9's routing list.

### F13 — LOW — AC-21, AC-24 — two month-days can clamp to one date
`{30, 31}` in April both resolve to the 30th. Harmless if candidates are
deduplicated after clamping, a defect if not. **The month-boundary table the test
strategy asks for will not contain the case**, because it is only visible once
the set has two members.
**Directive:** one clause on AC-24.

## Checked, no finding (anti-theatre)

- **AC-1, 4, 7, 9, 16, 17, 32, 33** — presentation obligations, no entity, field,
  endpoint or ordering consequence.
- **AC-2** — implementable on the existing `PATCH` unchanged; `taskChangesFrom`
  already builds a sparse change set, so last-writer-wins per field is the built
  behaviour and the interleaving test can be written today.
- **AC-8** — contract change, named as one, migration measured; one write site,
  and `serializeTask` passes the stored value through, so tolerant read costs no
  second code path.
- **AC-10/12/13** — existing columns already patchable; only `due_all_day` is new
  and its representation is correctly left to architecture.
- **AC-11's claim verified**: no consumer of `reminder_at` exists anywhere
  outside the field lists.
- **AC-27** — expressible from the two existing columns, no third field.
- **AC-30**'s delete scope correctly flagged as architecture's call, not decided.
- **AC-37** — the guard already lives in `taskChangesFrom`, so every door through
  the existing write path satisfies it. Worth knowing **before it is built twice**.
- **Impact §1's thirteen-site count and its five gating lists** — verified at the
  cited lines; all five gate what the table says.
- **Impact §3's correction** (no new spoken frame owed) — holds against F-002's
  message-kind keying.
- **Impact §5's `inCollection` reading** — verified line by line; the step-row
  claim is correct and the seam is the right one, for the reason given.
- **Impact §6's measurement and §4's whole-row replacement** — both as stated.

## Routing notes from the lens

- **F2 makes `## API Touch Points`'s "No new assistant endpoints" false as
  written.**
- **F3 is the only finding where two ACs and the flowchart give three different
  answers to one question** — it needs the owner or spec-agent to pick, not
  architecture.
