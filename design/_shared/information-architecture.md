# Information architecture — the whole app

**Date** 2026-08-17 · **Author** design-agent (T-101, revised T-105/T-106) · **Status** proposal,
not yet specced. **§ 12 is a question for the owner, not a decision.**

**Trigger.** `reports/owner-decision-2026-08-17-conversation-is-not-a-list.md` (the conversation
stops rendering the task list) and `reports/owner-decision-2026-08-17-settings-and-lists.md`
(the app needs Settings; the todo needs personal lists).

**Revised 2026-08-17 (T-105/T-106)** for
`reports/owner-decision-2026-08-17-desktop-list-is-primary.md` — on a wide screen the task list
takes the centre and the assistant becomes a right panel. That decision **supersedes the
confirmation this document was written against** ("no list beside the conversation at any
width") for wide screens only; on a phone the peer-path design below stands untouched. Every
section that changed says so in place. The one thing the decision did **not** answer — what a
phone lands on — is § 12, and it is open.

**What this file is.** The map of surfaces: what exists, what each is *for*, what lives on each,
how a user moves between them, and what each looks like empty, loading and failing. It is the
layer that was missing — every previous design pass in this repo designed one screen at a time,
which is how the app arrived at a hamburger with nothing behind it and a settings-shaped hole
that no use case ever reported as missing (`uc-coverage-map.md` D2).

**What this file is not.** Not a spec — it states no acceptance criteria and renames no AC.
Not a requirement — it cites `uc-coverage-map.md` and the F-docs and restates neither. The
spec pass (T-103) restates F-001 AC-1 / AC-4; §10 below is design's input to it, nothing more.

**Scope, and the reason for it.** 54 use cases exist; 17 have never been examined. This designs
**what the app has today**, plus **the two things the owner named**, plus **what the
conversation-loses-the-list decision forces**. §9 lists what was deliberately left out. A design
that quietly covers everything is one nobody can review.

---

## 1. The structural decision: two paths, and both are always one tap away

`todo-ai ADR-11` is the reason the conversation is the main surface, and its own consequence
column is the reason it is not the *only* one: the list *"ở lại nguyên vẹn làm đường thứ hai"* —
it stays intact as the **second path**, because `todo-ai ADR-7` requires the todo app to work
with the AI off. F-001 AC-24 ("the full todo list remains usable by hand") and AC-25 ("hands over
to the list") lean on that path by name.

Until today the second path needed no navigation: it was on screen. Removing it from the
conversation is what turns ADR-11's promise into a structural question, and it has exactly one
honest answer:

> **The list is not a drawer item. It is the app's other half, and it is reachable in one tap
> from anywhere — most of all from a failure.**

A second path you reach by opening a menu and picking a row is not a fallback; it is a feature.
So the top-level structure is **two peer surfaces with a reciprocal switch**, not a home screen
with navigation hanging off it:

```
        ┌──────────────────────┐   one tap    ┌──────────────────────┐
        │  S1  Talk            │ ───────────► │  S2  Tasks           │
        │  say it, see what    │ ◄─────────── │  the whole todo,     │
        │  changed             │   one tap    │  by hand             │
        └──────────────────────┘              └──────────────────────┘
                                                       │ hamburger
                                                       ▼
                                              ┌──────────────────────┐
                                              │  S3  Lists menu      │──► S5 New list
                                              └──────────┬───────────┘
                                                         ▼
                                              ┌──────────────────────┐
                                              │  S4  Settings        │
                                              └──────────────────────┘
```

**Why the switch is in the top bar and not a bottom tab bar.** The bottom of the Talk surface
belongs to the composer and the mic orb — the signature of this design and the thing the whole
identity is spent on (`DESIGN.md ## Novelty budget ledger`). A tab bar underneath it would put
two competing primary controls in the same thumb zone and shrink the surface the owner just
asked to give room to. The top bar is always visible, costs no vertical space that content
wants, and is where the reciprocal control can carry a number.

**The switch carries the open count.** `Tasks · 3`. This is not decoration: it is the honest
replacement for what the always-on list gave for free — a peripheral sense that the list exists
and how much is on it. It also gives an applied turn a *second*, cheap confirmation (the count
moves) alongside the message bubble, which is the guarantee F-001 AC-1/AC-4 were protecting.
Zero open today renders **no badge**; the zero case is stated in words on S2 itself
("Nothing left today"), where there is room to say it properly.

### 1a. Above the split, the two peers stop taking turns — revised T-105

The owner's desktop decision does not add a surface or change what any surface is for. It
changes **how the two peers share one screen**, at one width, and nothing else:

| | Below `tokens.json breakpoints.split` | At or above it |
|---|---|---|
| Frame | one surface at a time | **S2 Tasks in the centre · S1 Talk in a `360–420px` right panel** |
| The reciprocal switch | `Tasks · N` / `Talk` in the top bar, one tap | **absent** — both are on screen, and a control that switches to what you are already looking at is dead |
| S3/S4/S5 | stack over the surface | stack over the **centre**; the panel is never dismissed by navigating |
| Which is primary | expressed by **order** — what opens first (§ 12, open) | expressed by **position** — the centre |

Two things this does **not** change, and both are load-bearing:

1. **The Applied bubble keeps its full per-field diff at every width.** The centre list is an
   addition, never the mechanism `AC-1` relies on. § 10's restatement of AC-1 is therefore
   unaffected by the desktop decision — which is the point of the constraint the owner attached
   to it. One mechanism everywhere; nothing about AC-1 branches on viewport.
2. **Tablet is not a third case.** `768` renders the single-surface frame, identical to `375`.
   Reasoning in `components.md § AppFrame`; the short version is that a split at `768` leaves
   the panel too narrow to hold a diff row, and the diff row is the thing the panel exists for.

**What this reverses in § 8.4 and in my own T-101 drawing** is recorded there and in § 11.

---

## 2. The surfaces

| ID | Surface | What it is for, in one sentence | Exists today? |
|---|---|---|---|
| **S1** | **Talk** | Where you say what needs doing, and see in the message itself exactly what changed. | Yes — minus the task list it currently renders beside itself |
| **S2** | **Tasks** | The whole todo, by hand, working identically when the assistant is off, broken or offline. | As a pane inside S1, never as a surface |
| **S3** | **Lists menu** | Choose which collection you are looking at, make a new list, and reach Settings. | No — the hamburger toggles the pane and opens nothing |
| **S4** | **Settings** | The switches that belong to you rather than to a task. | No |
| **S5** | **New list** | Name a new list. A sheet over S3, not a place you navigate to. | No — and the field it writes does not exist |

Five surfaces, three of which do not exist. Two things that look like surfaces and are
deliberately **not** surfaces:

- **The permission message, the offline banner, the queued-turn notice** are shell-level
  components that can appear on S1 *and* S2 — the offline banner in particular must appear on S2,
  because S2 is what AC-25 hands over to. They are not screens.
- **Inbox / Today / Done** are not surfaces. They are collections that S2 renders; the menu picks
  which. This matters for §9: `Upcoming` and `Logbook` are *the same kind of thing*, so leaving
  them out costs one menu row each, not a screen each.

---

## 3. What lives on which

Every capability the app has today, plus the two the owner named. Read this as the completeness
check the owner asked for — *"design lại app cho đầy đủ ứng với các feature đã có"*.

| Capability | Where it lives now | Where it lives in this IA | Note |
|---|---|---|---|
| Say / type a turn (F-001 AC-1, AC-17) | S1 composer | S1 composer | unchanged |
| Live transcript while listening (AC-2) | S1 composer | S1 composer | unchanged |
| Cancel (AC-3) | S1 | S1 | unchanged |
| **Seeing what a turn changed (AC-1, AC-4)** | **the list pane, plus the bubble** | **the bubble alone** | the change this document exists for — §10 |
| Undo, tap or voice (AC-5 … AC-8) | S1 applied bubble | S1 applied bubble | unchanged |
| Bulk-delete confirmation (AC-9 … AC-12) | S1 question bubble | S1 question bubble | unchanged |
| Clarify question (AC-13) | S1 question bubble | S1 question bubble | unchanged |
| No-match, unsupported query (AC-14, AC-15) | S1 bubble | S1 bubble | AC-15 names "the on-screen list and its existing filters" as the working alternative — that sentence now points at **S2**, one tap away, and must be re-read |
| Retry after AI error (AC-16, AC-24) | S1 error bubble | S1 error bubble | unchanged |
| **Add a task by hand (AC-18)** | list pane header | **S2** header, and S2's empty state | |
| **Complete / un-complete (AC-18)** | list pane row | **S2** row | |
| **Rename in place (AC-18, web only)** | list pane row | **S2** row | mobile gap D8 unchanged by this IA |
| **Delete by hand (AC-18, web only)** | list pane row | **S2** row | mobile gap D8 unchanged by this IA |
| Grouping by day | list pane | **S2** | unchanged |
| Filters `all / today / done` | list pane | **S3** collections | the three filters become three menu rows; same data, addressable |
| Offline banner + queued turn (AC-25) | S1 | **S1 and S2** | S2 is the surface AC-25 hands over to; a banner it cannot show is a banner in the wrong place |
| Mic permission modes (AC-20 … AC-22) | S1 | S1 | unchanged; §8 records the one vocabulary collision S4 introduces |
| Session boundary marker (AC-28) | S1 | S1 | unchanged |
| New-message affordance (AC-30) | S1 | S1 | unchanged |
| Talk back on/off (F-002 AC-6, AC-17) | **nowhere** | **S4** | F-002 is specced and unbuilt; the row ships with it, not before |
| **Theme (dark / light)** | **nowhere** | **S4** | `tokens.json` ships both themes and the app has no control — a capability that exists today with no surface |
| **Personal lists** | **nowhere; no field** | **S3**, and S2's header | §7 |
| **Move a task to a list** | **nowhere; no field** | **S2** row action | §7 |
| Go from a message to the task it changed | nowhere | **S1 bubble → S2** | new; §5 — below the split this navigates; above it, it only scrolls the centre |

**Read the "Seeing what a turn changed" row carefully after the desktop revision.** Above the
split a task list *is* on screen beside the conversation again, which looks like the row's "the
bubble alone" has been undone. It has not: **the bubble is still the only mechanism**, and the
centre list is an addition the spec must not lean on. That is the constraint the owner attached
to the repositioning, and § 1a and § 10 both turn on it. Every other row in this table is
width-independent.

---

## 4. Navigation — the whole map

Every edge, with its control and its cost. Nothing reaches a surface except through an edge on
this list.

| From | To | Control | Taps |
|---|---|---|---|
| S1 Talk | S2 Tasks | top-bar `Tasks · N` button | 1 |
| S2 Tasks | S1 Talk | top-bar `Talk` button | 1 |
| S1 Talk | S2 Tasks, at a named task | tap a task title inside a message bubble | 1 |
| S2 Tasks | S3 Lists menu | top-bar hamburger | 1 |
| S3 | a collection on S2 | tap the row; the menu closes | 1 |
| S3 | S5 New list | `New list` row | 1 |
| S3 | S4 Settings | `Settings` row, at the foot | 1 |
| S4 | back to S3 | back control | 1 |
| S5 | back to S3 | `Create` or `Cancel` | 1 |

**Entry — revised T-105/T-106.** Two different questions, and until today they had one answer.

- **Above the split there is no entry question.** Both surfaces are on screen from the first
  frame, with Tasks in the centre. "Opening on a wide screen shows your tasks first" is
  satisfied by *position*, not by a default, and nothing has to be chosen.
- **Below the split the app opens on S1 Talk**, including cold open after a kill — **as it does
  today, and as design proposes it should continue**. This is **§ 12 and it is not settled**:
  the owner has the call, and the table above is what the mockups currently draw.

**Every edge in the table above is unchanged at both widths**, except the two S1 ⇄ S2 rows,
which have no cost above the split because there is nothing to move between.

**Settings is three taps from Talk** (Tasks → menu → Settings) and one from the menu. That is the
right cost. Settings is opened rarely, and the alternative — a second entry point on S1 — buys
two taps at the price of the thing every menu design fails on: two doors into one room, which is
`LEARNINGS.md` L-005's shape applied to navigation rather than to code.

**Back always means "up one level"**, never "the previous surface". S1 ⇄ S2 is a switch between
peers and has no back; S3, S4 and S5 are stacked and do. A phone's system back on S1 or S2 exits
the app.

**Happy path, counted.** Say a task: 1 tap (mic) + 1 utterance = **2 actions**, unchanged from
`DESIGN.md ## User journey`. Add a task by hand from a cold start: Tasks (1) → Add task (1) →
type → done = **3 actions**. Reach a personal list: Tasks (1) → menu (1) → the list (1) = 3.
Nothing in this IA made the assistant path longer, which was the constraint that mattered.

---

## 5. The one new capability this decision forces: a message is a door to the list

With no list on screen, a user who wants a changed task *in context* — next to its neighbours,
with its due time, ready to edit by hand — has no route. Today they just looked left.

So: **every task named inside a message bubble is tappable**, and tapping goes to S2 with that
row scrolled into view and flashed once. The flash is AC-4's existing `diffFlashHold` /
`diffFlashFade` treatment, moved from "whenever a turn applies" to "on arrival from the message
that changed it" — the same cue, now attached to the moment it is actually informative.

This costs nothing in the data model: the bubble already carries `turn.changed_task_ids`
(F-001 AC-4). It is new behaviour, it is not in any F-doc, and the owner can cut it — but the
IA is dishonest without it, because "gắn các todo tại các message" is a promise that the message
holds the task, and a task you cannot open is only a description of one.

It is also `UC-52 AC-52.5 / 52.6` (turn → task navigation), which `uc-coverage-map.md` lists as
unspecced residue. This closes the smallest useful part of it and no more.

---

## 6. Empty, loading, failing — per surface

This is where this app's honesty lives. F-001's whole character is in its failure states, and a
new surface with no failure design inherits none of it.

### S1 Talk

| | |
|---|---|
| **Empty** | First run: the existing invitation (`components.md`, empty conversation state) — "Say it. I'll write it down." **One line is added**: a quiet pointer to Tasks. A first-time user whose mic is denied or absent (AC-20 hides it entirely) otherwise sees a screen with one control they cannot use and no evidence the rest of the app exists. |
| **Loading** | The session read on cold open. Today this gate exists in code with **no visual at all** — `foregroundSync` withholds input until `GET /assistant/session` returns (F-003 AC-5, BUG-002) and the user is told nothing. Design: skeleton bubbles in the thread's silhouette, and the mic in its existing **dimmed-transient** mode (`components.md § MicControl`) with the cause line "Getting your conversation…". **It must not render the empty invitation while loading** — a returning user seeing "Say it. I'll write it down." reads it as history lost. |
| **Failing — a turn** | Unchanged: Error bubble, plain cause, Retry on the same `client_turn_id` (AC-16, AC-24). |
| **Failing — offline** | Unchanged: OfflineBanner + QueuedTurnNotice (AC-25). |
| **Failing — the session read itself** | **New, and it has no design today.** The thread cannot render at all, so an error *bubble* is the wrong shape — there is no thread to put it in. Full-surface: "Couldn't load your conversation" + Retry + one line naming the second path, with the `Tasks · N` control still live in the top bar. This is the single most important new failure state in this document: it is the exact moment ADR-11's second path is supposed to exist, and until now there was nowhere for it to be offered. |

### S2 Tasks

| | |
|---|---|
| **Empty — no tasks anywhere** | "No tasks yet" + `Add task` + one line offering the other path ("or say one, on Talk"). Both doors, because a user who arrived here from a broken assistant needs the hand path first, and a user who arrived by curiosity needs to know the fast one exists. |
| **Empty — this collection only** | Different copy, because it is a different fact: "Nothing in Work" + `Add task`. Never the first-run wording — telling a user with 40 tasks that they have none is a lie the generic empty state tells. |
| **Empty — Done** | "Nothing completed yet." No CTA: there is no action that fills this list directly. An empty state offers the action **if the action exists**; inventing one here would be a shrug dressed as an invitation. |
| **Loading** | Skeleton rows in the row silhouette — checkbox, title, meta — five of them, under a real day header. No spinner. |
| **Failing — refresh failed, tasks on device** | An inline retry banner at the **top of the list**, with every known task still rendered and still editable: "Couldn't refresh your tasks — showing what's on this device" + Retry. **The list is never replaced by an error.** S2 is the fallback surface; a fallback that blanks itself on a network error has failed at the one job it has. |
| **Failing — refresh failed, nothing on device** | The error takes the surface, says exactly that, and keeps `Add task` live — the local no-AI path works offline (AC-25), so the primary action is genuinely available and must not be disabled for looking broken. |
| **Offline** | The list works untouched; the banner carries the news (`components.md § TaskList`, § OfflineBanner). |

### S3 Lists menu

| | |
|---|---|
| **Empty** | No personal lists yet: the built-in collections render, and `New list` is the invitation. The menu is never empty — it always holds Inbox, Today, Done, New list and Settings. |
| **Loading** | Built-in collections render **immediately** — they are derivable on device and must never wait on a network. Only the personal-lists section skeletons, two rows. |
| **Failing** | One line in the personal-lists section: "Couldn't load your lists" + Retry. Built-ins still work; Settings is still reachable. **Navigation must never be the thing that breaks** — if the menu fails closed, the user has no route to the second path or to the switch that might fix it. |

### S4 Settings

| | |
|---|---|
| **Empty** | Cannot be empty; it is a fixed set of rows. An empty Settings screen is a bug, not a state. |
| **Loading** | Labels render immediately; only a row whose *value* comes from the server skeletons its value. Nothing on the drawn screen does today — Theme is local — so this state exists for the rows §9 defers. |
| **Failing** | A switch that fails to save **reverts visibly** and says so **on the row**: "Couldn't save — tap to try again". Never a toast. A preference that silently does not stick is the quietest failure in any app, and the user finds out days later. |

### S5 New list

| | |
|---|---|
| **Empty** | The state it opens in: name field focused, `Create` inactive until a name is typed. |
| **Loading** | `Create` takes the standard loading treatment (`components.md § Buttons` — spinner replaces label, width locked). |
| **Failing** | Inline, under the field, and **the sheet does not close**: "A list called Work already exists." The typed name is never discarded. |

---

## 7. Surfaces that depend on a field that does not exist

`task` today is `id, user_id, title, due_at, reminder_at, priority, status, created_at,
updated_at, deleted_at`, with `status` = `inbox | today | done | archived`
(`src/assistant/api/types.ts`). **There is no list, project, tag or label field, and no `lists`
table.** Personal lists are a data-model change, not a UI one (`uc-coverage-map.md` UC-41).

Building half of this is the failure mode, so here is the line, explicitly:

| Buildable **today**, no new field | Blocked on `lists` + `tasks.list_id` |
|---|---|
| S1 with the list removed | **S3's personal-lists section** — every row below Done |
| S1's message-to-task link (§5) | **S5 New list** — the whole sheet |
| S2 as a surface: rows, add, toggle, rename, delete, day grouping | **S2's header naming a personal list** (built-in collections are fine) |
| S2's Inbox / Today / Done collections — they are `status` | **S2's per-row "Move to list" action** |
| S3's structure, built-in rows, `Settings` row | **S4's "Default list for new tasks"** (not drawn — §9) |
| S4 with Theme and About | The assistant creating a task **into** a list — needs `list_id` in the interpreter context, and `UC-41 AC-41.4` (the AI may never invent a list) routes through F-001 AC-13's clarify path |
| S4's Talk back row — needs F-002 built, not a new field | |

**This table is width- and platform-independent, and the T-104/T-105 drawings do not move a
single row of it.** The same surfaces are blocked in `app-shell.html`, `app-shell-ios.html` and
`app-shell-android.html`, at every width: S3's whole personal-lists section, the S5 sheet, S2's
header when it names a personal list, and the per-row "Move to list". The desktop panel adds no
field and needs none. Anyone reading the three shell mockups as a build order should read this
table first — **six of the drawn surfaces cannot be built from today's data model**, and the
platform variants make that easier to forget by making it look finished on three platforms.

**Two fields that are *not* the blocker, contrary to the report that started this:**
`due_at`, `reminder_at` and `priority` all exist on `task` and are already patchable
(`TASK_PATCH_FIELDS`). A due-date picker is a pure UI change. It is still out of scope here
(UC-34, §9), but it belongs in a different bucket from lists, and mixing them would over-price
the cheap half.

**Fields that block things this IA did *not* design**, recorded so the next pass does not
rediscover them: no `sort_order` (no drag ordering — D5), no `completed_at` / `done_from`
(no Logbook — D6), no `note` (no task detail worth the name — UC-44), no `parent_id`
(no sub-tasks — UC-36).

---

## 8. What I found that contradicts something I had to design around

Four. Each is a real collision, not a caveat.

**8.1 — "Settings" now means two different things, and the permission copy owns the older one.**
`components.md § Buttons` fixes **Settings**, capitalised, as *the OS Settings app*, and four
permission rows send the user there in words ("Turn Microphone on in Settings…"). The owner's
decision gives todo-ai its own Settings screen, and the house-words rule is one word per concept.
The two never co-occur on a rendered screen today — permission messages appear on S1, our
Settings row lives in S3 — so the ambiguity is real in the vocabulary and absent in the pixels.
I did **not** change the permission strings: they are asserted verbatim by
`src/assistant/mobile/__tests__/permissions.test.ts`, which parses this catalogue by row ID
(L-008), and rewording them to disambiguate would be a copy change wearing an IA change's
clothes. **The tripwire:** the day a permission message renders *inside* S4 — a plausible
"Microphone: off" row — the OS one must be qualified ("system Settings" / "App info"). Recorded
as a rule in `components.md § App shell` rather than left to be rediscovered.

**8.2 — F-002 AC-23's premise is withdrawn, and F-002 still says it.** AC-23 makes
`client.interface_language` a build-time constant *because* "no settings surface is a deliverable
of this feature or any other in flight" (`uc-coverage-map.md` D2). S4 exists in this IA, so the
reason is gone while the AC stands. I deliberately drew **no language picker**: the
settings-and-lists decision says that is a separate call that "should not ride along silently",
and drawing one would be exactly the silent ride. Flagged for spec-agent, not resolved here.

**8.3 — F-001 AC-15 names a surface that is about to move.** AC-15 answers list questions by
"naming the working alternative — **looking at the on-screen list and its existing filters**".
After this change there is no on-screen list, and the filters are menu rows. The sentence is
still *true* (the alternative exists, one tap away) and is no longer *accurate*. It needs the
same restatement treatment as AC-1 and AC-4 and is not currently on T-103's list.

**8.4 — RESOLVED 2026-08-17, and resolved the other way. Kept as the record.**
The original finding: the owner's decision was written unconditionally, while the complaint that
prompted it (`owner-feedback-2026-08-17-product-gaps.md` §1) was explicitly about "trong khuôn
khổ màn hình nhỏ bé" — a small screen — and F-001's own reasoning for the split pane was
recorded as sound on a wide one. I followed the decision as written (no list on S1 at any width),
flagged the ambiguity rather than assuming, and it was put back to the owner twice. The first
answer confirmed "every width". The second, later the same day, **repositioned the product**:
above the split the list takes the centre and the assistant takes a right panel.

Three consequences, all now landed:

- **The wide-screen half of this section is void.** S1 no longer holds a centred `760px` measure
  at `1280`; it holds a `360–420px` panel, and the measure argument (a conversation is unreadable
  at a `1200px` measure) is served by the panel rather than by centring.
- **The day-header gutter I drew for S2 is withdrawn** — see § 11. It was designed for an S2 that
  owned the whole width, and S2 now owns the centre column.
- **The phone half of this section stands entirely.** The complaint was about a phone; on a
  phone nothing changed.

**Worth keeping for the next pass:** the flag was right and the answer it drew was not the answer
it anticipated. Surfacing an ambiguity is not the same as guessing which way it will fall, and a
design that had quietly "corrected" the unconditional wording to "phones only" would have
produced a split pane the owner had not asked for and would have missed the repositioning
underneath it.

---

## 9. What I did not design, and why

Deliberate omissions. A design that says "these five surfaces, and here is what I left out" is
one the owner can act on.

| Left out | Why |
|---|---|
| **Upcoming, Logbook** (`todo-ai ADR-11` names both) | Each is one menu row and one S2 collection — the structure holds them. Upcoming derives from `due_at` (buildable), **Logbook cannot be built**: no `completed_at`, and D6 sends un-done tasks to `today` rather than home. Designing a Logbook that cannot be populated is how a half-built feature ships. |
| **Task detail** (UC-27, UC-44) | The largest omission and the most tempting. S2 carries exactly what exists today — inline rename and delete. A detail surface needs `note`, and a home for due/reminder/priority controls that do not exist. Out of the briefing's scope; it is Tier-1 #5 in the UC map. |
| **Search** (UC-37) | ADR-11 names it; nothing here implements it; no data-model change needed, so it costs a menu row and a surface later. Not forced by this decision. |
| **Drag ordering** (UC-43, ADR-11's fifth item) | Needs `sort_order`. D5 records that this repo ships exactly the automatic ordering UC-43 deleted. |
| **Due-date / reminder / priority controls** (UC-34, UC-35) | Buildable today (§7) and genuinely cheap — deliberately still out, because the briefing's scope is the app as it is plus the two named gaps, and this is a third. Flagged as the cheapest next thing. |
| **S4 rows: default list, export, delete history, account** | Each needs something that does not exist — `list_id`, UC-48, UC-28, UC-22. I drew three real rows rather than a full-looking screen of dead ones. Content discipline: a mockup that fabricates rows teaches implementers to build them. |
| **A language picker in S4** | 8.2 — a separate owner decision. |
| ~~**iOS and Android variants of the new surfaces**~~ | **DONE 2026-08-17 (T-104).** The reasoning for holding them — three variants of a proposal the spec pass would change is waste — was right and expired when the shape settled. `app-shell-ios.html` and `app-shell-android.html` now carry the `accessibilityIdentifier` / `resource-id` catalogues, identical to web's, and the two places touch is not hover (`components.md § AppFrame`). |
| **Any change to the three existing F-001 mockups** | They are the current build's contract: `src/assistant/web/__tests__/app.test.tsx` and `src/assistant/mobile/__tests__/a11y.test.ts` parse their testid catalogues at run time. Editing them now would break the build for a change the spec has not yet accepted. The new file is additive; the retirement of `assistant-drawer-button` happens with the spec pass. |

---

## 10. Design's input to the spec pass (T-103)

Not ACs. What the mechanism change means for the two ACs the owner's decision says must be
restated rather than deleted, plus the one nobody has listed.

- **AC-1** — the guarantee is *"the user can see what changed, in the same turn, without
  hunting"*. The mechanism was "it appears in the on-screen todo list within the same turn". It
  becomes: **the applied turn's message names every task it created, changed or deleted, with the
  per-field old → new**, in the same turn. The list is no longer where the result lives; the
  message is. The `Tasks · N` count moving is a second, non-primary confirmation and should not
  be specced as the guarantee — it is a number, and a number cannot say *which* task.
- **AC-4** — attribution stays; its *location* moves. The `NEW` / `EDITED` markers and the
  per-field diff belong to the bubble (they already render there). The row-level flash survives
  only as §5's arrival cue on S2. The clause that must **not** be lost: only the turn's own
  changes are attributed, and no raw uuid or draft-ref token ever renders (UC-52 AC-52.10).
- **AC-15** — see 8.3. Its named alternative moves from "the on-screen list and its existing
  filters" to the Tasks surface.
- **AC-18** — unchanged in substance, but every operation it names now happens on S2. Worth
  saying explicitly, because F-003's parity table lists AC-18 as holding identically across
  platforms while mobile ships two of its four operations (D8) — moving the surface does not fix
  that and must not be read as having fixed it.
- **AC-24 / AC-25** — "the full todo list remains usable by hand" and "hands over to the list"
  both now mean *one tap to S2*, which is a weaker claim than "already on screen" and a stronger
  one than "somewhere in a menu". If the spec wants a testable form: the control that reaches S2
  is visible and enabled in every S1 failure state, including the session-read failure in §6.

---

## 11. What was drawn, and what was left as IA

**Drawn — three files, one design.**

| File | Frame | States |
|---|---|---|
| `design/assistant/screens/app-shell.html` | web, **both sides of the split** | 22 |
| `design/assistant/screens/app-shell-ios.html` | phone, below the split only | 20 |
| `design/assistant/screens/app-shell-android.html` | phone, below the split only | 20 |

The twenty design states are the same in all three: S1 idle · empty · loading · session-failed;
S2 default · rename · arrived · empty-first-run · empty-collection · loading · refresh-failed ·
offline · load-failed; S3 default · empty · lists-failed; S4 default · save-failed; S5 default ·
name-taken. The web file carries two more — `phone-talk` and `phone-tasks` — which are **not**
extra design states: they are the below-split rendering of `talk-idle` and `tasks-default` inside
a phone frame, so a desktop browser can see the other half of the one layout branch. Without
them `shell-tasks-button` and `shell-talk-button` have no rendering to be checked in at all,
because they do not exist above the split.

All six mockups in the repo pass `.claude/tools/design-check` at **60 passed, 0 failed, 0
skipped** — token drift, horizontal overflow at every declared breakpoint, state switching,
testid uniqueness and per-state visibility, and the declared 4.5:1 contrast floor.

**`tokens.json` gained `breakpoints.split`** so the one width that branches the layout is a token
rather than a magic number in CSS, and so design-check measures overflow at it.

**Two hazards found while doing this, both of which produced a GREEN check for the wrong reason.
Recorded because an implementer will meet both.**

1. **A digit in the `breakpoints` note becomes a breakpoint.** The checker iterates *every* key in
   that block and parses digits out of the value, so a first draft of the explanatory note said
   "768" in prose and the tool silently added a phantom `@note (768px)` width and measured at it.
   It passed, so nothing complained. The note now contains no digits and says so about itself.
2. **A query container must be sized from outside.** `container-type: inline-size` carries
   `contain: inline-size`, so the element's own width may not come from its contents; `max-width`
   plus `margin: 0 auto` stops it stretching, and the two together **collapse it to zero**. The
   phone frame did exactly this, and design-check still reported `shell-tasks-button` and
   `shell-talk-button` visible — its visibility test asks only `width > 0`, which overflowing
   children of a zero-width box satisfy. The tool's verdict was right about the ids and told me
   nothing about the frame; a screenshot showed a blank column in one look. Fixed with an
   explicit `width: min(430px, 100%)`. This is `LEARNINGS.md` L-012's shape in CSS — a check that
   goes green propped up by something other than the thing it names.

**What the desktop revision changed in the drawing** (T-105), beyond adding the split:

- The **day-header gutter is withdrawn**. Day headers stack above their rows at every width and
  the list keeps a `720px` measure. It was drawn for an S2 that owned `1280`; S2 owns the centre
  column now, and a task row's hairline stretched across `830px` reads as a spreadsheet.
- **PathSwitch is absent above the split**, so `shell-tasks-button` / `shell-talk-button` are
  below-split-only ids. A desktop selector for either will not resolve, and should not.
- Two copy lines that named a **route only one width has** were made width-independent:
  SE-SESSION line 2 (was "open Tasks"), and the applied bubble's "tap a task to *open it in
  Tasks*" → "*find it in the list*", because above the split that tap only scrolls the centre.
  Both are one string at every width rather than two selected by viewport, which is the same
  discipline the AC-1 constraint imposes on the mechanism.
- The idle thread **sits on the composer** rather than at the top of its column. In a
  `420px` panel holding two messages the old top-alignment left a visible gap; "newest at bottom"
  (§ Message bubbles) was already the rule and is now what the mockup does at every width.

**Left as IA, on purpose** — S1's unchanged states (listening, thinking, applied, questions,
outcomes, permissions, boundary, new-message affordance) are already drawn in
`voice-assistant-view.html` and its two platform variants, and are not affected by this change;
redrawing them would create a second source of truth for states nobody is changing, which is
`LEARNINGS.md` L-004's shape. **This is also why the desktop panel's unchanged states are not
redrawn**: a panel-width `listening` or `question` bubble is the same bubble, and the one thing
that could have differed — whether the full diff survives at panel width — is drawn, in
`talk-idle`, and is exactly the constraint the owner attached to the decision. Upcoming, Logbook,
search, task detail and the deferred S4 rows are undrawn because they are undesigned.

---

## 12. Open for the owner — what does a phone land on, Talk or Tasks?

**Status: design proposes, owner decides. Nothing here is settled and no file assumes it is.**
The desktop decision did not ask or answer this; it says so itself.

### The proposal

**A phone lands on Talk.** That is what the app does today, what the three mockups draw, and what
I would defend.

### The argument

**These are not the same question asked twice.** Above the split there is no landing question at
all: both surfaces are on screen, and "the list is the primary object" is expressed by
**position** — the centre. Below the split there is no position to express it with, only
**order**. So the phone's choice is not a second answer to the desktop question; it is the only
question of its kind, and it should be decided by what a phone is for.

**A phone is where you capture; a wide screen is where you organise.** The happy path this whole
design is built around is *tap the mic, say it* — 2 actions, matching the existing app's "≤ 2
chạm" law (`DESIGN.md ## User journey`). The mic lives in Talk's composer. Landing on Tasks makes
that **3 actions**, a 50% increase on the one path the product's differentiator lives on, paid on
every capture, forever.

**Landing on Talk does not hide the list — it announces it.** `Tasks · 3` sits in the top bar of
every Talk state, carrying both the name and the count. If landing on Talk were the inconsistency
it might look like, the symptom would be a user who cannot find their tasks; there is no such
user, because the first screen names them and says how many there are.

**And it is consistent with the reference bar.** `DESIGN.md ## Identity` names ChatGPT voice mode
among the audience's daily apps. On a phone that product opens on the conversation and reaches
its history through a control; on a wide screen it shows both. The audience already holds this
shape.

### The honest case against, which the owner may find decisive

**"The primary object should be primary everywhere."** A user who learns *this is my todo list*
on a laptop and *this is a chat* on a phone is learning two products. The owner's day has been
about the todo underneath the assistant being the part that was never built — and landing on Talk
keeps the list the thing you go and find. That is a coherent position and I cannot falsify it
from here: nobody has data on whether this app's phone sessions are mostly *check what's next*
(reading, favours Tasks) or *put this somewhere* (capture, favours Talk).

### What makes this more than a default flag — the part worth deciding with

**If the answer is Tasks, I owe a design change, not a setting.** Voice capture would drop to
three actions unless the Tasks surface gains a capture affordance of its own — a mic in a Tasks
composer, or a mic-bearing FAB. That is a new control, a new id, new states, and a second place
the mic can live, which is `LEARNINGS.md` L-005's shape (one obligation, two doors) applied to
the interface. I have deliberately **not** drawn it: drawing it would be assuming the answer, and
`_ethos.md` § 1 puts this call with the owner.

**If the answer is Talk, nothing changes** — the mockups, the current build and this document
already agree, and the decision costs one line in the spec pass making it explicit rather than
inherited.

**Cheapest question that settles it:** *on your phone, in the morning, do you open this app to
see what's next, or to put something down?*
