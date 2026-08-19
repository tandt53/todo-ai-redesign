# Gate 1 round 2 — F-005 — dev lens (web)

Persisted by the orchestrator per **L-009**. The lens wrote nothing.
**HIGH 4 · MEDIUM 3 · LOW 3.** Confidence HIGH. All 48 ACs read; every code claim
run against the repo.

**Round-1 findings re-checked against current text, not the log:** F1→AC-41 ✓ ·
F2→AC-40 ✓ · F3→AC-35's six readers ✓ (`TasksSurface.tsx:241,242,249` are the three
raw `state.tasks.length` reads; 261/342 go through `collectionTasks`) · F4→§10 ✓ ·
F5→AC-35/36 + §12 ✓ · F6→AC-45 ✓ (and AC-45 answers the half F6 left open — the
detail displaces the list, not the Talk panel) · F7→AC-2's mobile bullet ✓, decided
the right way · F9 ✓. **F8 is the one row the log over-credits — L2.**

## HIGH

**H1 — AC-2, OQ6 — offline, the client never attempts the write, so AC-2's two
states do not cover the state the code already has.** `_shared/controller.ts:586-637`
— all three write methods open with `if (task.local === true || this.state.offline ||
!this.onlineNow()) { this.persistLocal(); return }`, and `persistLocal()` (`:692`)
saves **only** rows with `local === true`. An offline field edit to a *server* task is
held in in-memory state alone: never sent, never queued, never marked, and replaced by
the server value at the next `refreshTasks()` (`:660-668`) or at reload. **That is
precisely the silent revert AC-2's governing sentence forbids**, and AC-2's machinery
cannot reach it because nothing failed; AC-47 never fires because there is no failure
to outlive. And `## Out of Scope` / **OQ6 assert the opposite as settled** — "AC-2
already defines the behaviour … what is actually open is durability." *There is no
pending edit whose durability is in question.* F-001 AC-25 makes offline a first-class
state, so this is ordinary, not an edge. *Directive:* AC-2 states what a field edit
does while offline, and OQ6's premise is corrected.

**H2 — AC-47 × AC-3 — reopening on a task with an outstanding notice has two rules
giving opposite answers.** AC-47: the field shows "the user's value, still failed …
never the stored value", ending "when a later successful write to that same field
supersedes". AC-3: a turn or undo "updates the displayed values within that turn".
**AC-36 makes this ordinary rather than contrived** — the owner's voice decision makes
`note`, `priority`, `due_at`, `reminder_at` assistant-settable. Supersede → the user's
typed value disappears with no announcement, the silent loss AC-47 rejects one
paragraph earlier. Do not supersede → the field shows a stale failed value on top of a
change the assistant named in a message, and **F-001 AC-31's door delivers the user
onto a surface that contradicts the message that sent them.**

**H3 — AC-48 / F-001 AC-31 — the door's activatability gate is unamended, and its own
stated reason does not survive the new route.** The gate is one predicate:
`ConversationPane.tsx:71` — `if (!reveal.canReveal(taskId)) return <span
className="diff-task">` — a real `<button>` or **plain text**, never a disabled
control; `shell.ts:114` — `canReveal = state.tasks.some(t => t.id === taskId &&
inCollection(t, collection, now))`; `DEFAULT_COLLECTION = 'today'`. So a dateless task
the assistant just created is **already plain text**. F-001 AC-31's inert clause is
unamended by revision 6 and its justification is *"rendered as an inert control it
would be an affordance that does nothing"* — **false in the detail-open state, where
the postcondition needs nothing from the list.** Leave `canReveal` alone → the swap
route is dead for a large common class of named tasks, in the arrangement rev 6 calls
"most obviously alive" — the convergence-2 dead-link shape the owner rejected,
arriving through the gate instead of the route. Branch it → a link appears and
vanishes as the detail opens and closes with the row unchanged, and the shipped meta
string (`ConversationPane.tsx:131-136`, *"tap a task to find it in the list"*, chosen
width-independent on purpose) becomes false. Compounding: while the detail is open the
gate consults `shell.collection`, **a list AC-45 puts on screen at no width** —
activatability decided by a filter the user cannot see. `## Impact` has no subsection
for what AC-48 changes in existing web code; neither site is named anywhere.

**H4 — §1 has a fifteenth closed field list, on the client, and it drops fields
silently.** `_shared/controller.ts:733-739`, inside `pushLocalTasks` — the
offline→online replay — hand-enumerates `{id, title, due_at, priority, status}`. It is
**not** among §1's fourteen, and it is not a constructor but a *replay projection*, so
§1's own "a missed field is `undefined` rather than its declared empty value" does not
reach it. A note, reminder, step, priority or repeat set on an offline-created task is
accepted by the surface and **silently discarded at reconnect**. It is shared code, so
the phone has it too.

## MEDIUM

**M1 — AC-44 — *"the client has none"* is false, and it is the half that decides what
gets built.** `ControllerDeps.now?: () => string` (`controller.ts:57-65`), defaulted at
`:138` — an injectable clock every harness already relies on. The inline count is right
for web but omits **eight defaulted `now: Date = new Date()` parameters**
(`format.ts:27,38,53,62`, `tasks.ts:255,268,429,435`) — the exact functions AC-12,
AC-13 and AC-22 change, and a *default* is what makes a missed injection silently
wall-clock instead of a type error. Told the client has no seam, an implementer builds
a second one — two clocks on one client, which AC-44 itself forbids: **L-004's shape.**
And `deps.now` returns an ISO string while every view consumer needs a `Date`, so
widen-vs-add is a genuine fork AC-44 closes by asserting the wrong premise.

**M2 — AC-44 — the zone travels with a turn, and none of the computations AC-44 names
is a turn.** `timezone` is sent at exactly one site (`controller.ts:317`, in the turn
body). `createTask`/`patchTask`/`deleteTask` send `content-type` and `X-User-Id` and
nothing else. Every computation AC-44 names is triggered by a task write.
`## API Touch Points` enumerates what the field lists must grow by and does not name
it. `platform/web.md`'s *"the client never invents shapes"* means the implementer
cannot simply add it.

**M3 — AC-47's mechanism plausibly lands in `_shared/`, which mobile compiles.** The
supersession rule and reopen-merge require the notice store to see **every** write to
that task's fields — retry, turn, undo, `refreshTasks()`. Only `AssistantController` /
`state.tasks` observes all four; React state owned by the detail cannot see a turn's
write. That is a **fifth instance of the pattern §7's four-row table exists to
enumerate**, and the table predates AC-47. AC-47's `(web)`-not-`(mobile)` note reasons
only about the *surface*, which is true and does not answer where the mechanism lives.

## LOW

**L1 — AC-45's second bullet contradicts itself in one sentence.** "Above the split it
occupies the column the task list occupies", then "the conversation stays rendered
above the split, so AC-3's arriving change and **F-001 AC-32's non-stale list** keep a
subject." With the detail in the list's column the list is rendered at no width — which
§13 and F-001 AC-24 rev 5 both state, and rev 5 says explicitly that *"AC-32 is
conditional on the list being rendered."* Only AC-3 keeps a subject. As written it
reads as licence to keep the list on screen as a third column above the split, which is
the reading §13's amendment depends on being wrong.

**L2 — dev-F8's second half was dropped and the log records the whole finding
`resolved`.** Round 1's F8 was two claims: no client clock (→ AC-44), and *"AC-15's
drag has the same problem for a different reason — jsdom does not exercise a pointer
gesture — and AC-16's keyboard alternative is the half that is unit-testable."*
`## Test strategy` says nothing about which tier verifies AC-15's pointer reorder, and
AC-16's move mode appears nowhere in it. **One of this lens's nine round-1 rows is a
claim the spec does not support.**

**L3 — one citation drifted.** §1 cites `_shared/controller.ts:681` for the row
constructor; it is at **673**. Every other web/shared citation checked holds.

## Checked, nothing found

**AC-45 is buildable exactly as written.** `ShellSurface` gains a fourth value and
`styles.css:224-227` / `:706-723` extend by one line each — `settings` is the shipped
precedent for *replaces the centre, never the panel* (`:723`). Every surface is mounted
at every width and the below-split branch is `display:none` (`:224`), so F-001 AC-31
rev 6's *"below the split the case does not arise"* holds **structurally** — the door is
out of the a11y tree and unfocusable there. No JS width read is required or introduced.
Round-1 F6 fully resolved. **The container-query claim is true** (`styles.css:207-221`,
`:706` — one `@container app (min-width: 1024px)`, no viewport read in any JS file).

Also clean: AC-1's rename-gesture collision named in its own sub-bullet · AC-2's
field-level write satisfiable today · AC-3's five control classes implementable in
React · AC-4's terminal state correctly has no retry · AC-32's counter seam exists ·
AC-33 against `platform/web.md` · AC-35's web half site by site · AC-39's row
obligation placed on F-001 AC-32's precedent · AC-42/AC-43 reuse `controller.removeTask`
which exists on both clients. **No AC contradicts `platform/web.md`** except through M2.
