# Gate 1 round 2 — F-005 — architect lens

Persisted by the orchestrator per **L-009**. The lens wrote nothing.
**HIGH 4 · MEDIUM 6 · LOW 1.** Confidence HIGH. All 48 ACs plus `## Data`,
`## API Touch Points`, all thirteen `## Impact` subsections, `## Ops`,
`## Test strategy` and the eight open questions. Evidence read in source:
`api/app.ts:120-175,290-370`, `engine/{apply,task-equals,undo}.ts`,
`engine/turns.ts:355-395`, `engine/serialize.ts:25-130`,
`_shared/controller.ts:560-700`, `api-contracts.md`, `data-model.md`,
`ADR-009 § Amendment 2`.

**Question 4 (ordering / transaction boundaries) is where this round's findings
concentrate** — F1–F4, F9. All four round-1 HIGHs are genuinely discharged as
*requirements*; three left a boundary the requirement does not reach.

## HIGH

**F1 — the multi-row rule is a closed list of three and at least four more writes
qualify.** `## API Touch Points` and AC-26 say: "Three writes here do: completing a
repeating task, completing a parent, deleting a cluster." Missing: **un-completing a
parent** (AC-19 reverses the cascade across N steps), **un-completing a repeating
task** (AC-28 removes the successor), **restoring a cluster** (AC-41, explicitly "a
parent and its steps in one call"), **deleting a whole series** (AC-30 trashes every
unfinished occurrence — not a parent+steps cluster), and **a step reorder** if
positions are dense integers (AC-15 says the order lives on "the step's own record",
singular, but moving one step among N renumbers up to N rows). An enumerated list that
reads as considered is what an implementer builds to, so AC-3's no-manual-refresh
guarantee has no mechanism for exactly the gestures AC-28's mis-tap recovery and
AC-43's undo are built on. Not hypothetical: `_shared/controller.ts:606` already
`await`s `patchTask` and discards the body with no `refreshTasks` after it.
*Directive:* replace the closed list with the rule; if an enumeration is kept, make it
complete — and state that AC-15's reorder may change more than the moved row.

**F2 — AC-46 requires rows the record's own capture rule cannot hold, and changes two
contract documents §9 does not route.** `undo_snapshot` is contractually captured
"immediately **before** apply, inside the apply transaction" (`data-model.md
§ assistant_turn`; `api-contracts.md POST /assistant/turn` rule 6); `post_apply` after
apply, keyed by touched `task_id`; `created_ids` written by `applyCreate`. AC-46's rows
are a successor that does not exist until *during* apply, and cascaded steps whose
identity is known only once children are looked up. So AC-46 requires the touched-row
set to be computed **before** the snapshot capture, or the capture points to move — an
ordering the spec never states. AC-26's "inside the completing write's transaction"
does not supply it: **being inside the transaction says nothing about being inside the
capture**, and an implementer who satisfies the transaction sentence still ships a
half-reverted undo, which AC-46 itself calls worse than no undo. §9 routes
`data-model.md § task` and `api-contracts.md § Prototype task CRUD` but **not**
`data-model.md § assistant_turn`, `POST /assistant/turn` rule 6, or the undo endpoint's
"Revert shapes" enumeration — all three of which AC-46 falsifies as written.

**F3 — undo's removal of a successor and AC-28's removal obey different conditions,
and undo's is blind to the one condition AC-28 exists for.** Once AC-46 puts the
successor in `created_ids`, `undo.ts` removes it iff `taskEquals(cur,
post_apply[id])` — a whole-row comparison over ten scalar fields. **AC-28's fifth
condition is "no step of it ticked or changed"**, and ticking a step changes the
*step's* row, not the successor's — so `taskEquals` still reports equal and undo
hard-deletes the successor, destroying the user's work on next week's occurrence in
exactly the case AC-28 was written to protect. Two doors onto one outcome with
different guards — **L-005's shape, where the second door is one AC-46 has just
created**, so nothing upstream flags it. The natural AC-46 test passes.

**F4 — a write in flight when the detail closes, failing afterwards, matches neither
AC-2's two closing states nor AC-47's trigger — and that is the ordinary sequence.**
AC-2's bullets are keyed on the write's state **at the moment of closing**; AC-47's
trigger is "when the detail closes … **while a write on it is in the failed state**".
Because closing is "honoured at once" and the surface "never holds itself open
waiting", the common order is close → then fail. On that path AC-2's in-flight bullet
says only that the write "resolves against the stored task" (describes success, silent
on failure) and AC-47's trigger has not fired. **The trade the owner made — give up the
hold, gain the notice — buys nothing on the most likely close.** AC-48 already asserts
what the plain close does not grant: "a save that fails at that moment goes to AC-47's
notice." One of the two doors out of the detail is specified and the other is not.

## MEDIUM

**F5 — AC-21 — recurrence's representation changes `turn.diff`'s declared shape and
the spec presents the choice as consequence-free.** `data-model.md § assistant_turn`
declares `diff: {task_id, field, old|null, new|null}[]` with `null` as the sentinel for
the absent side; F-001 AC-4 renders `old → new` per field. If recurrence is an object,
a recurrence diff row's `old`/`new` is an object — colliding with the sentinel and with
AC-4's rendering — and `applyCreate`/`applyDelete`, which enumerate every non-null
member, emit it on every create and delete of a repeating task. §2 goes as far as note
bodies in a diff row and stops before the type.

**F6 — `reminder_shown_at` has a set rule and no clear rule.** Two records reach the
contradictory state (future `reminder_at` + set marker): the user re-sets the reminder
later on a task whose earlier reminder was surfaced (AC-10 makes `reminder_at` freely
writable, nothing clears the marker); and AC-27's successor "carries everything the user
set" with a clear-list naming only `completed_by_parent`, so **every occurrence after
the first has a reminder that never fires.** Both rebuild the write-only data path
AC-38 was created to close, one level down, and both are invisible.

**F7 — AC-43's step-reorder undo has no record anywhere.** The three delete cases call
AC-41's restore. Reversing a reorder needs the prior `step_order` of every row the move
renumbered — up to N rows per F1. Neither `## Data` (no hand-undo record) nor
`## API Touch Points` (no endpoint; `PATCH` is per-task) says where those values live,
and **AC-15 already ruled out the obvious answer by name** for the sibling case: "the
order lives on the record that came back — a server row, not a client buffer."

**F8 — `priority`'s `none` has no declared representation, and `## Data`'s
`Required: yes` contradicts §6's migration-free claim.** Both are true only if `none`
**is** the absence of a value, which the spec never says — and the alternative is
observable: `applyCreate` skips null fields when building the diff, so a literal
`'none'` adds a `priority: none` row to F-001 AC-4's message on **every create**, and
`taskEquals` compares `===`, so stored `null` and live `'none'` are unequal in the
modified-since gate. The spec knows how to state this when it wants to — `due_all_day`
and AC-10 both give an explicit absent-on-a-stored-row reading. Priority is the field
that got neither, with 783 live rows.

**F9 — AC-48's headline and its sub-bullets state two different orderings, and the
headline's is the one AC-2 was just narrowed to forbid.** Headline: "the outgoing
task's pending work is **settled before** the new subject renders." Sub-bullets:
focused-and-dirty fields "save as though focus left" and "a save that fails at that
moment goes to AC-47's notice" — i.e. the swap does not wait. An implementer building
to the bold sentence makes the swap block on an in-flight write, **reproducing on the
swap door the exact hold the owner's answer removed from the close door.** One word.

**F10 — AC-14's server-assigned position does not reach the offline create path.**
F-001 AC-25's offline path creates a task **locally, under a client-generated id**, and
replays on reconnect. A step created through that door has a position the client either
invented or does not have, which the server overwrites at replay — after the user has
seen the list and possibly reordered it. **The same undefined-position window architect
F11 shut for POST-then-PATCH, reopened through a door the spec does not mention.**
`## Out of Scope` routes offline *field edits* to OQ6 and says nothing about offline
*creates*, which F-001 already supports today.

## LOW

**L1 — AC-28's "removes the successor" does not say soft or hard, and this feature has
both.** Every delete in F-005 is soft and restorable through AC-41; the one hard removal
in the codebase is undo's create-revert. A soft-removed successor is a row AC-41 can
restore, producing **a second open occurrence of one series** — the state the recurrence
section rests on not having.

## Checked, no finding

**The four round-1 HIGHs, re-checked:** arch-F1 → AC-21 + §1 + `## Data` closing note,
discharged as a requirement; the scalar-only claim is restated accurately (`cloneTask`
is `{...t}`, `taskEquals` is `===` per field over ten names, four flat row
constructors) and choosing the remedy is correctly left to architecture — F5 is the
only residue. arch-F2 → AC-41 + corrected API Touch Points + §11; verified in source
(`app.ts:347`, `:358`, `:297`, `TASK_PATCH_FIELDS` at `:135`, `undo.ts`), and the false
sentence is **quoted and replaced rather than edited away**. Resolved. arch-F3 →
resolved: the dateless branch now routes `F → G → H` into the alignment decision and
through the shared preview node `R` before `J`; one order, stated in AC-22, with the
collection consequence stated once. arch-F4 → AC-46 exists; F2 and F3 are what it does
not reach.

**Round-1 MEDIUMs/LOWs:** F5 (both halves land — F1 is incompleteness, not absence) ·
F6 (`DIFF_FIELDS` splits, in AC-36 and §1/§2) · F7 (verified at `turns.ts:369-378`,
which filters on `user_id` and `deleted_at` only and never consults `inCollection`) ·
F8 (AC-34 carries both directions with the absent-key rule) · F9 · F10 · F11 (F10 above
is the door it does not reach) · F12 (both expressions narrow together and stay
separate; §9 routes `INV-INBOX-FILING` and `ADR-009 § Amendment 2 §5` — **no merge
proposed**) · F13.

**Impact claims re-verified in source:** §1's five gating lists exist at the cited lines
— `TASK_CREATE_FIELDS = ['id','title','due_at','priority','status']` (`app.ts:134`)
genuinely carries neither `parent_id` nor `note`/`due_all_day`/`reminder_at`, and
`rejectUnknownFields` makes each a 400 · §4's whole-row replacement · §11's four-way
impossibility · §12's handle list · §6's tolerant-read precedent.

No finding, each for a stated reason: AC-1, 7, 9, 11, 16, 17, 32, 33, 39, 45 and
AC-47's rendering half (presentation/reachability, no entity or contract consequence) ·
AC-37, AC-40 (the guard exists at `app.ts:141-146` and is genuinely called only from the
HTTP handlers; moving it onto the write needs no contract change) · AC-36's
`DIFF_FIELDS` split (one constant cannot be both; two can) · AC-44's two server seams ·
AC-35's `inCollection` seam · AC-30's delete scope (correctly left to architecture) ·
AC-47's durability (explicitly bound to the running app, routed to OQ6) · §5, §7, §10,
§13 accurate in architect terms.

## Routing note from the lens

**F2 and F4 are the two that cannot be caught later.** F2's failure is a silently
half-reverted undo, which no C-check looks for; F4's is a lost user value on the
ordinary close path, which reads as working software until someone loses a paragraph.
F1 is the one an implementer will otherwise discover expensively at the un-complete
gesture. **None of these re-argues an owner decision** — F4 and F9 find that answer 1
of the detail-trap decision was implemented with one door narrowed and the other left
open, which is in scope by the briefing's own rule.
