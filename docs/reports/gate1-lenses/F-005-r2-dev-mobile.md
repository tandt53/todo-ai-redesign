# Gate 1 round 2 — F-005 — dev lens (mobile)

Persisted by the orchestrator per **L-009**. The lens wrote nothing.
**HIGH 5 · MEDIUM 4 · LOW 1.** Confidence HIGH. All 48 ACs examined; the nine
mobile-tagged against `src/assistant/mobile/`, `_shared/`, `platform/mobile.md` and
F-003. `## Impact` §7 and §9 verified line by line.

**The through-line of every HIGH:** the four new mobile ACs were written from the
server's point of view — "the server does X, so the phone gets Y". Each lands on a
client that has a **shipped, designed offline state** (`state.offline`,
`§ OfflineBanner`, F-003 AC-4) and **two doors into every open**, and no mobile-tagged
AC mentions either.

## HIGH

**F1 — AC-38 — "when the app opens" is not a defined event on this client.**
`init()` (cold open, calls `super.init()`) and `onForeground()` (resume, calls
`syncSession()` + `refreshTasks()`, never `super.init()`); F-003 AC-8 names both in one
breath precisely because BUG-002 was an obligation attached to one of them. Separately
`reminder_shown_at` is a *stored* fact and **an offline open cannot write it**:
`refreshTasks()` returns early with no server read while `state.offline`. Two silent
failures: attach to `init()` alone → a passed reminder never appears, because a phone
user's ordinary open is a resume (**L-005's shape, on the file L-005 names**, whose fix
was a single installer `gateForeground` that AC-38 gives no instruction to reuse);
attach to every foreground → AC-38's own "does not reappear on every launch" is false
whenever the user is offline. A foreground transition happens dozens of times a day.

**F2 — AC-26, AC-19, AC-2 — a mobile tick has two uncovered states.** *Offline:*
`toggleTask` (`_shared/controller.ts:586-606`) dispatches optimistically and returns at
the offline guard — never reaches the server, and `persistLocal()` saves only
`local === true` rows, so a tick on a server-owned row is **queued nowhere and erased by
the next `refreshTasks()`**. AC-26 states "no path generates none while the series is
live" — the offline mobile tick is exactly such a path, and it also loses the completion:
the user ticks, sees it go done, and finds it open again after the next foreground with
no successor and no message. *Online:* the multi-row response `## API Touch Points`
introduces for these three writes is thrown away, and **AC-3, the AC that forbids the
blind-refresh alternative, is `(web)`.**

**F3 — AC-43, AC-42 — every observable AC-43 states is web-shaped or unavailable.**
(i) it defers to AC-33's 4.1.3 / 2.1.1 — AC-33 is `(web)`, and keyboard operability is
not the phone's criterion; (ii) `platform/mobile.md` fixes the announcement path —
*"anything that announces goes through it"*, `model/announce.ts`, which builds every
string from the `Message` record — and a row-level undo offer on the Tasks surface is
**not a `Message`**, so the obvious implementation contradicts the platform doc;
(iii) the mobile a11y id set is closed and structurally asserted (`expectedIds`,
`a11y.ts:265-295`), and the only undo id `assistant-undo-button` is emitted **per
conversation message** — bound to the turn undo, which AC-43 explicitly says this is
not; (iv) offline, `removeTask` never reaches the server and AC-41's restore is a server
call, so both the delete and its undo are undefined.

**F4 — AC-2 — the governing sentence carries `(mobile)` and none of its three nouns
exists on this client.** No field: the mobile rename is a `TextInput` that **unmounts on
blur** (`commitRename` sets `renaming` false, *then* fires the write —
`TaskList.tsx:67-72`). No failure statement: the result is discarded. No retry
affordance on a row. AC-47, where the value goes once there is no field, is `(web)`-only
and its stated reason checks the wrong hole — *"the phone has no detail surface, so
there is no close for a failure to outlive"*; the phone's problem is that there is **no
field**, one level earlier than the close. The mobile QA tier tests AC text, not the
sub-bullet's gloss, and will file three bugs against behaviour nobody specified.

**F5 — AC-13, AC-14 — §10 names two writers of a bare local midnight; there is a
third.** `createLocalTask` (`controller.ts:669-687`) builds the row client-side from
`dueAtForCollection`, and `pushLocalTasks` re-POSTs it under a **closed inline
enumeration** `{id, title, due_at, priority, status}` (`:733-739`). Every new field on
`TaskCreateBody` is optional (`_shared/api/client.ts:31-42`), so widening the type
produces **no compile error** at that call site. A task created on the phone while
offline and viewing Today replays as a bare local-midnight instant with no
`due_all_day` — **the exact defect AC-13 exists to forbid, shipped through the one path
AC-13 does not name**, and invisible to type-checking. `api-contracts.md § Creating a
task in a collection` fixes the Today row as a bare local start and is **not in §9's
routing list**.

## MEDIUM

**F6 — AC-39, AC-25 — nothing to read "live" from.** `series_id` is never cleared;
`recurrence.*` representation is architecture's; `TaskWire` (`serialize.ts:25-35`)
carries nine scalars, none recurrence-related. The implementer picks `series_id != null`
— the only plausibly named field — and **every task that ever repeated is marked
repeating forever.** Separately `## Out of Scope` routes AC-39's home to *"a list row
whose surface has no spec"* — true for web, **false for mobile**: F-003 specs that list
and its id catalogue is closed and asserted.

**F7 — §7 and §9 contradict each other about D8.** §7 says the stale sentence "is
corrected here and in `uc-coverage-map.md` D8". The **rows** are (lines 74 and 100 carry
"closed 2026-08-18"); **D8's definition is not** — `uc-coverage-map.md:244-248` still
reads *"implements add and toggle only: no rename, no delete"*. The file's own
convention (line 48) is that divergences are *"defined once in `## Divergences`; rows
reference them"* — so **the canonical text is the stale one**. §9 correctly still lists
D8 as owed, which contradicts §7. This is the identical fact that produced round 1's
false premise and that the owner had to be corrected on before answering.

**F8 — AC-47's "the component family does not exist" is true-and-incomplete.**
`components.md § SaveNotice` (T-135, 2026-08-18) is a **persistent, dismissible, in-flow
strip in the Tasks surface's banner stack**, drawn in all three shell mockups, whose
central argument is *"a component that exists because something vanished may not itself
vanish on a timer"* — AC-47's no-self-dismiss rule, **already reasoned**. Two ids are
reserved on mobile (`tasks-save-notice`, `tasks-save-notice-dismiss`) and recorded in
`SHELL_IDS_BLOCKED` as designed-and-not-built. SaveNotice reports a *success with an
unexpected destination* rather than a failure, so the claim is not flatly false — but
**the phone already has the reserved home** that F4's failed row write and F3's undo
offer both need, and F-005's text says there is none.

**F9 — AC-44's two factual claims are both wrong.** *"The client has none [no seam],
and `new Date()` is called inline at three sites."* `_shared/controller.ts` has an
injectable `now` (`deps.now`, declared 61, stored 119, defaulted 138) and it is what
feeds `dueAtForCollection` on **both** clients (580, 672) — the seam already exists for
the exact computation AC-13 and AC-22 depend on. The inline sites number **five**, two
of them mobile: `TaskList.tsx:222` (the single render clock deciding Overdue/Today
grouping) and `tasks-view.ts:106`. AC-44 is `(api, web)`. An implementer told the client
has no seam builds a second one — **L-004's shape on the one value that must not have
two sources.**

## LOW

**F10 — AC-2's mobile sub-bullet over-cites.** It says `api-contracts.md` "records that
as an accepted window" for all three methods. `api-contracts.md:353-358` records it for
`toggleTask` **only**, inside one narrow stale-client scenario, describing a window one
page load wide. `editTask` and `removeTask` have no such record anywhere.

## `## Impact` §7 and §9 — claim by claim

All §7 code claims correct **except the D8 half (F7)**: `TaskList.tsx:71/136` exact ·
step exclusion / `due_all_day` / write-result handling are in `_shared/` ·
`tasks-view.ts:26-51` re-exports so one `inCollection` gate reaches both clients · the
three mobile readers at `tasks-view.ts:111,113`, `index.ts:244`, `a11y.ts:278` ·
`F-003 ## Parity` counts 29 and F-001 has 32, both measured · the three write methods
await and never read, and the call sites additionally use `void`. §9 is accurate for
the mobile-relevant entries; **one document is missing** — `api-contracts.md § Creating
a task in a collection` (F5).

## Checked, nothing found

AC-35 (mobile) — the six-reader enumeration is complete and correct; the `(mobile)` tag
is earned · AC-38's data availability — `TaskWire` already carries `reminder_at` ·
AC-13's rendering half — `formatDue` is shared and `TaskList.tsx:59` calls it, so the
fix reaches the phone as §7 claims; only the *create* half leaks · AC-19's mobile
obligation as stated is sound given AC-35 · AC-33 against `platform/mobile.md` — no
conflict for the surface it is tagged for · touch-target/keyboard/back-navigation rules
untouched (F-005 adds no mobile screen) · AC-45/47/48/1/3/4 correctly `(web)` ·
AC-20-31, 34, 36, 37, 40, 41, 44, 46 — AC-41's restore, AC-40's write-bound validation
and AC-46's undo-record widening all make mobile's fire-and-forget writes **safer** ·
AC-21's non-scalar warning has no mobile exposure · the interpreter handle list makes
the mobile message link *more* correct.

**Drift noted:** `uc-coverage-map.md:244-248` (D8 definition) contradicts its own rows
at 74 and 100 and contradicts `## Impact` §7.
