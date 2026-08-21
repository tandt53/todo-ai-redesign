# UC coverage map — the 54 inherited use cases against what this repo has

**Date**: 2026-08-17 · **Author**: architect-agent (T-096) · **Covers**: every UC in
`docs/specs/_source/todo-ai/02-use-cases.md` (UC-01 … UC-54, contiguous, 54 of them)

## Why this file exists, and where it lives

`docs/specs/_source/` was imported today. This repo has cited it since F-001 — `UC-20`,
`UC-52 AC-52.18`, `todo-ai ADR-7`, `todo-ai ADR-11` — while the documents lived only in the
other repository. Nothing listed which of the 54 use cases this redesign has answered, which
it answered *differently*, and which it never looked at. The owner is choosing the next
features and had no map. This is it.

**Path.** `{specs}/_shared/uc-coverage-map.md`, resolved through `MANIFEST ## Paths`
(`specs: docs/specs/`, `shared_dir: _shared`). Three roots were candidates and two are wrong:

- **not `docs/specs/_source/`** — that root is a verbatim, read-only mirror (`docs/specs/_source/README.md`
  rule 1). A map that classifies the source is *this project's* judgement about the source, and
  writing it there gives one truth two homes, which is `LEARNINGS.md` L-004 — the failure this
  repo has hit more times than any other.
- **not `docs/specs/assistant/`** — the module root holds features. This file spans the whole product,
  including four groups (CORE todo, reminders/privacy, ecosystem, Nhóm I) that no module owns
  yet, and it will outlive the `assistant` module.
- **`docs/specs/_shared/`** — where cross-cutting artifacts live by MANIFEST convention
  (`architecture`, `adrs`, `learnings`, `glossary`). This is a cross-cutting reference, not a
  requirement and not a decision. It cites; it never restates.

## Three rules this map is written under

1. **A UC is evidence of what was wanted, not a standing commitment.** These were written for the
   previous app, and the owner has changed direction more than once today. Where a UC is stale,
   the row says so and cites the decision. No UC is quietly marked BUILT or DROPPED to make a
   tally look tidy.
2. **`docs/specs/_source/` is not edited.** Every reinterpretation lives here or in an F-doc.
3. **`todo-ai ADR-7` is not `ADR-007`.** Two independent ranges that overlap. Inherited ADRs are
   written `todo-ai ADR-N`; this repo's are zero-padded (`docs/specs/_shared/adr/ADR-00N`). T-066
   records that F-002 cites them ambiguously five times.

## How to read a row

| Class | Means |
|---|---|
| **BUILT** | An F-doc AC implements the UC's main flow, and code is on disk. The row names the F-doc ACs. Where UC ACs are still unreached, they are named as **residue** — BUILT never means "finished". |
| **CHANGED** | Built, but this repo deliberately answered it differently. The row names the divergence and where it is recorded. **This is the column that matters**: a redesign that drifts from its source without saying so is what this map exists to prevent. |
| **DROPPED** | The source marks it `ĐÃ BỎ` with a date, or an owner decision here has removed it. |
| **MISSING** | No F-doc reaches it and no code implements it. Sub-marked: *spec-only* (spec written, nothing built), *deferred-here* (a decision on record explains why not yet), *deferred-in-source* (the source itself postponed or blocked it), *unexamined* (nobody here has looked at it). |

Cross-cutting divergences are numbered **D1 … D8** and defined once in `## Divergences`; rows
reference them rather than repeating them.

## Counts

| Class | Count | |
|---|---|---|
| BUILT | **15** | every one carries residue; none is complete against its UC |
| CHANGED | **8** | all eight are recorded somewhere; none was silent, though two are recorded only in code |
| DROPPED | **2** | both from the source (`UC-38` 15/08, `UC-40` 14/08). **No owner decision here has dropped a UC.** |
| MISSING | **29** | 1 spec-only · 8 deferred-here · 3 deferred-in-source · **17 unexamined** |
| **Total** | **54** | |

The number to act on is not 29 — it is **17 unexamined**, and fourteen of those are the CORE
group and Nhóm I, i.e. the todo app underneath the assistant.

---

## The table

### Nhóm CORE — the todo app that must work with no AI (UC-31 … UC-40)

| UC | Asks for | Class | Answered by / why not |
|---|---|---|---|
| UC-31 | Quick-add by hand, instant, local-first | BUILT | F-001 AC-18 (zero AI calls), AC-25 (offline local path); `controller.addTask` + `+ Add task` on both clients. **Residue:** AC-31.1 — online, `addTask` awaits `POST /tasks` *and* a full `refreshTasks` before the row is drawn (`_shared/controller.ts:557-558`), which is a server wait the AC forbids; offline is local-first and correct. No `quickadd:latency` instrument. AC-31.3 (date in the sentence) needs UC-46. |
| UC-32 | Done / undone toggle | BUILT | F-001 AC-18; `controller.toggleTask` → `PATCH /tasks/{id}`. **Residue:** AC-32.2 — done tasks are reviewable only through web's `done` filter; there is no Logbook (UC-45). Un-doing returns the task to where it came from as of ADR-009 (D6, resolved). |
| UC-33 | Delete with in-place undo; 30-day restore | BUILT | F-001 AC-18; `DELETE /tasks/{id}` soft-deletes (`api/app.ts:346`), web has a delete control. **Residue:** AC-33.1 — a hand delete has **no undo at all** (F-001's undo is turn-shaped: AC-5 "the newest applied *turn*"); no trash, no restore, no 30-day purge; **mobile has no delete control** (D8 — **closed 2026-08-18**: `mobile/components/TaskList.tsx:136` calls `controller.removeTask`; this row is the stale text, corrected by F-005 Gate 1 product lens F5). |
| UC-34 | Deadline & reminder by picker, no AI | MISSING *(unexamined)* | `due_at` and `reminder_at` exist and are patchable (`TASK_PATCH_FIELDS`), and nothing in any client sets them. |
| UC-35 | Priority by hand, urgency visible in the list | MISSING *(unexamined)* | `priority` exists as a free `string \| null` — not the three-value low/medium/high the UC names — with no control and no visual mark. |
| UC-36 | Sub-tasks, full CRUD, user-ordered | MISSING *(unexamined)* | No `parent_id`, no ordering field. Blocks UC-04. |
| UC-37 | Search title + note, works offline | MISSING *(unexamined)* | Nothing. The source routed UC-38's dropped filtering *into* search, so search now carries two jobs. |
| UC-38 | Filters | **DROPPED** | Source: `ĐÃ BỎ (15/08/2026)`, with all three reduction steps kept. Web's `ListFilter = all \| today \| done` is destination-by-status, not the tag/urgency/date axes UC-38 removed — it does not resurrect it. |
| UC-39 | Recurring tasks | MISSING *(unexamined)* | No recurrence model. Needs UC-34 (a recurring task must have a due date) and UC-36. |
| UC-40 | Bulk operations by touch | **DROPPED** | Source: `ĐÃ BỎ (14/08/2026)`, on a tap count (N vs N+2). **But see D7** — this repo added a *voice* bulk path the drop never considered. |

### Nhóm A — capture by AI (UC-01 … UC-04)

| UC | Asks for | Class | Answered by / why not |
|---|---|---|---|
| UC-01 | One sentence → a task | **CHANGED (D1)** | F-001 AC-1, AC-2, AC-17, AC-23 (raw transcript persisted before interpretation = AC-01.3 ✓). Divergence: there is **no model**. Interpretation is a 23-row fixture table (`api/ports/fixture-table.ts`, `fixture-interpreter.ts`) — an unmatched utterance is `no_match`. Recorded in `ADR-001` and F-001 `## Test strategy`. AC-01.1's 4 s p95 has neither a model nor an instrument. |
| UC-02 | Vietnamese datetime extraction | **CHANGED (D1, D2)** | Twice diverged: the mechanism (fixture rows carry literal `due_at`; no parser exists) and the language (`ADR-008` makes the product English; `docs/reports/owner-decision-2026-08-17-english-first.md`). AC-01.2 "keep the user's original language" is now moot for one language. |
| UC-03 | Split a paragraph into several tasks | **CHANGED (D1)** | The shape exists — a fixture `create` row may carry several tasks and `applyCreate` writes them atomically (F-001 AC-1) — but only for utterances in the table. AC-03.2's "never silently truncated" is untested at any length. |
| UC-04 | Sub-task decomposition | MISSING *(unexamined)* | No sub-task concept anywhere. Blocked by UC-36. |

### Nhóm B — conversational editing (UC-05 … UC-09)

| UC | Asks for | Class | Answered by / why not |
|---|---|---|---|
| UC-05 | Say more, and it lands on the task just made | **CHANGED (D1)** | F-001 AC-4 renders the per-field diff, and the engine hands every turn the whole live list as handles `t1..tn`, so a follow-up *can* address the right task. But AC-05.1 (indirect reference — "cái đó", "task đầu tiên") is fixture-matched on the whole utterance, not resolved; F-001 says "anaphora quality inherited, not restated" — **inherited from a repo that is not this one**. |
| UC-06 | Edit by voice; only the named field changes; old value visible next to undo | BUILT | F-001 AC-4 (per-field `old → new` from `turn.diff`) + AC-5…AC-8 (undo). AC-06.2 is met more strictly than the UC asks. |
| UC-07 | Cancel a task by voice, with undo | BUILT | F-001 AC-5…AC-8; delete via the turn path, undo restores all fields (AC-6). |
| UC-08 | Agent asks instead of guessing | BUILT | F-001 AC-13 — clarify question carries the **actual** candidates, no data changes until answered, tap sends the option's literal text (AC-10). F-001 adopts UC-08's edge table as written. |
| UC-09 | Fix a title in place, faster than saying it again | BUILT | F-001 AC-18; `TaskListPane.tsx:127,136` inline rename. **Residue:** **mobile has no inline rename** (D8 — **closed 2026-08-18**: `mobile/components/TaskList.tsx:71` calls `controller.editTask`; stale text, same correction); AC-09.2 (the next AI turn sees the hand edit) is F-001 Open Question 7 — *unanswered in the spec but satisfied in code*: `engine/turns.ts:368-378` reads the task list fresh inside the serial queue slot. |

### Nhóm C — session lifecycle (UC-10 … UC-13)

| UC | Asks for | Class | Answered by / why not |
|---|---|---|---|
| UC-10 | Commit the session, drafts → tasks | **CHANGED (D3)** | There is no draft and no commit: a turn applies atomically to real tasks (F-001 AC-1), recorded in `ADR-002` (superseding `todo-ai ADR-9` for this surface). **The source is already stale here by its own admission** — UC-11's rewrite note says the draft concept was dropped by `todo-ai ADR-7`. AC-10.2 (sub-tasks as `parent_id` children) has no referent. |
| UC-11 | Idle sessions close, and the user is told | **CHANGED** | F-001 AC-28 (boundary marker, close reason, clean start). Divergence: **180 s, server-owned, lazily evaluated** — `ADR-004`, deciding against UC-11's 2 minutes and the old client's ~3. |
| UC-12 | Block over-long sessions (turn 31 → `409 commit_required`) | **CHANGED** | `ADR-003` created a **new session entity** rather than reusing `capture_sessions`, so the 30-turn cap does not apply to assistant turns. A sliding 10-turn interpretation window survives (`turns.ts:381`). Recorded; not silent. |
| UC-13 | Survive crash / offline | BUILT | F-001 AC-25 (queued replay), AC-28 (stale session starts clean); the kill-surviving halves moved to F-003 AC-5/AC-6 via F-001 AC-26/AC-27. **Residue:** kill survival is mobile-only; web has reload durability, which F-002 `## Verification status` records as a weaker claim. |

### Nhóm D — task management (UC-14 … UC-17)

| UC | Asks for | Class | Answered by / why not |
|---|---|---|---|
| UC-14 | Inbox, ordered, drag-sortable | BUILT | `GET /tasks` (created_at order) + the task pane on both clients. **Residue:** AC-14.1's `sort_order` half is entirely absent — see UC-43 and **D5**. |
| UC-15 | Today focus + remaining count | BUILT | Web `ListFilter='today'` and day grouping (`TaskListPane.tsx:39-58`), open count at `:198`. **Residue:** mobile has the count but no filter and no grouping. |
| UC-16 | One-tap done; soft delete, restorable | BUILT | Same code as UC-32/UC-33. **Residue:** AC-16.2's *restorable* half — the server writes `deleted_at` and nothing ever reads it back. |
| UC-17 | Multi-device sync ≤ 3 s, LWW | MISSING *(deferred-here)* | `ADR-001`: prototype server, in-process memory store, no Supabase, no realtime. F-003 `## Out of Scope` declines offline-first sync beyond F-001 AC-25. UC-17 AC-17.3 makes UC-22 a precondition, and that is missing too. Also blocks UC-50 and UC-51 in the source's own dependency graph. |

### Nhóm E — phase 2 (UC-18 … UC-21)

| UC | Asks for | Class | Answered by / why not |
|---|---|---|---|
| UC-18 | Open a saved task → mic → incremental update | **CHANGED (D4)** | The *need* (AC-18.1: changes land on the existing task, no duplicate) is satisfied by construction — every turn addresses the user's whole live task list through opaque handles (`turns.ts:370-378`, `ADR-002`), so there is nothing to inject. The UC's *flow* (a per-task mic entry point) does not exist, because no task-detail surface exists. |
| UC-19 | Home-screen widget | MISSING *(deferred-here)* | F-003 `## Out of Scope` — widgets/Live Activities, with reasons. |
| UC-20 | The app speaks back | MISSING *(spec-only)* | **F-002 is written to revision 3 and nothing is built**: `implemented_in: []`, `tested_by` empty. It is the binding next feature from F-001's Gate 1 decision D1, and its Gate 1 closed **unreviewed** at the round cap. AC-20.6 (spoken day summary, offline, no model) is excluded from F-002 and reserved as **F-004, which nobody has committed to**. |
| UC-21 | Swap AI model, compare on an eval harness | MISSING *(deferred-here)* | Requires a model. There is none (D1); no `ai_config`, no `ai_requests` telemetry. |

### Nhóm F — accounts, permissions, failure paths (UC-22 … UC-25)

| UC | Asks for | Class | Answered by / why not |
|---|---|---|---|
| UC-22 | Sign-up / sign-in / first run | MISSING *(deferred-here)* | Identity is an `X-User-Id` request header (`ADR-005` scopes sessions and dedupe to the account; `ADR-001` defers the real thing). No login, no first-run, no Sign in with Apple. |
| UC-23 | Mic / speech permission denied | BUILT | The best-covered UC in the repo: F-001 AC-20 (capability detection, never platform name), AC-21 (asked before the first talk attempt, covers **every** required grant), AC-22 (transient failure ≠ denial); F-003 AC-2 (iOS dual grant, sequenced, mic-refusal ends it), AC-3 (Android permanently-denied path), AC-4 (missing language pack). |
| UC-24 | Input that is not a task | BUILT | F-001 AC-14 (no-match **quotes the heard transcript**) and AC-15 (unsupported query names the working alternative, zero mutations). **Residue:** AC-24.3 / AC-24.4 — the *offer to record it as a task* is explicitly not specced; F-001 calls it a follow-up. |
| UC-25 | AI error / timeout / retry | BUILT | F-001 AC-23 (`transcript_raw` persisted before interpretation → AC-25.1), AC-16 (per-status dedupe → AC-25.3, retry never double-applies), AC-24 (error message + retry, list stays usable). **Residue:** AC-25.2 — no error telemetry, no "three failures in a row" suggestion. |

### Nhóm G — reminders and personal data (UC-26 … UC-28)

| UC | Asks for | Class | Answered by / why not |
|---|---|---|---|
| UC-26 | Reminders that actually fire | MISSING *(deferred-here)* | `reminder_at` is a field nothing consumes. F-003 `## Out of Scope` declines push notifications with reasons. AC-26.3's global off needs a settings surface (D2). |
| UC-27 | Edit a saved task by hand — every field | MISSING *(unexamined)* | Only the title is hand-editable, on web only. No detail surface; no note field; due/reminder/priority have no control. AC-27.2 (deadline and reminder are two moments, and the user must know which one makes a sound) is *modelled* — the fields are separate — and unreachable. |
| UC-28 | Privacy: delete conversation history / delete account | MISSING *(unexamined)* | Nothing. `POST /assistant/session/close` is not deletion. The source calls this mandatory before any store submission. Needs the settings surface (D2) and a real account (UC-22). |

### Nhóm H — ecosystem (UC-29, UC-30)

| UC | Asks for | Class | Answered by / why not |
|---|---|---|---|
| UC-29 | Create a Jira/GitHub issue by voice | MISSING *(unexamined)* | Phase 3 in the source; no F-doc mentions it. Its connect/disconnect surface is Settings (D2). |
| UC-30 | Push an appointment to Calendar | MISSING *(deferred-here)* | Calendar is one of UC-53's seven doors, and F-001 + F-003 both defer UC-53 as a separate feature. |

### Nhóm I — gaps found against comparable apps (UC-41 … UC-51)

| UC | Asks for | Class | Answered by / why not |
|---|---|---|---|
| UC-41 | User-created lists / projects | MISSING *(unexamined)* | **The owner's headline gap.** `task` has no list, project, tag or label field — `status` (`inbox\|today\|done\|archived`) is the only grouping (`api/types.ts:6` and `:9-21`). This is a data-model change, not a UI one: `lists` table, `tasks.list_id`, every `status` grouping site, the export envelope, and the interpreter context (AC-41.4 forbids the AI from creating a list — F-001 AC-13's clarify path is exactly the mechanism it names). |
| UC-42 | Upcoming — the next 7 days | MISSING *(unexamined)* | Web's `groupTasks` (Today / Tomorrow / Later / Anytime) partly answers "what's coming" but not the UC: no 7-day frame, no rendered empty days, no pinned overdue group, no "Sau đó · N" tail. |
| UC-43 | Drag ordering — the *only* ordering | MISSING *(unexamined)* | No `sort_order` field, no drag, on either client. **See D5** — the repo currently ships exactly the automatic ordering UC-43 deleted. |
| UC-44 | A note on a task | MISSING *(unexamined)* | No field. It is also the field UC-37's search and UC-54's `find_tasks` are specified to scan. |
| UC-45 | Logbook — history by completion day | MISSING *(unexamined)* | No `completed_at`, no `done_from`. Web's `done` filter shows completed tasks in creation order, which is not AC-45.1. **AC-45.2 is now met** without either field — ADR-009 (D6, resolved); AC-45.1 is what still needs `completed_at`, and ADR-009 § Consequences records that `status: 'done' && isToday(due_at)` measures *"was due today and is done"*, not *"was completed today"*. |
| UC-46 | Understand dates in quick-add, without AI | MISSING *(unexamined)* | The source calls this "**the `todo-ai ADR-7` hole**": only AI can set a deadline. **Here it is worse** — only the 23-row fixture stub can, and only for those rows. Nothing else in the product can put a date on a task. |
| UC-47 | Capture from the share sheet | MISSING *(deferred-here)* | F-003 `## Out of Scope` — a second input path that bypasses the turn, routed to the UC-53 feature. |
| UC-48 | Export / import JSON | MISSING *(unexamined)* | Nothing. Needs the settings surface (D2); AC-48.4's envelope carries `lists`, so it is worth more after UC-41. |
| UC-49 | Start date separate from deadline | MISSING *(deferred-in-source)* | Source: `⏸ HOÃN` — "not enough to write ACs", a product question the source itself declines to answer. Do not schedule. |
| UC-50 | Sharing / collaboration | MISSING *(deferred-in-source)* | Source: `🚫 CHẶN bởi UC-17`. |
| UC-51 | Image attachments | MISSING *(deferred-in-source)* | Source: `🚫 CHẶN bởi UC-17`. |

### Nhóm J — voice-first (UC-52 … UC-54)

| UC | Asks for | Class | Answered by / why not |
|---|---|---|---|
| UC-52 | The conversation is the main surface | BUILT | F-001, broadly, and its own `## Coverage` section enumerates the split: covered — AC-52.1 (talking surface is the main view), 52.3's persistence half (F-001 AC-23), 52.7 (AC-24, AC-25), 52.10 (AC-4, no uuid or draft-ref ever renders), 52.18 (voice undo, AC-5, `ADR-006`). Server is the source of truth for history (`GET /assistant/session`), as the UC requires. **Residue:** AC-52.4 partial (boundary marker, not the review timeline); 52.2 / 52.5 / 52.6 (history review + turn→task navigation), 52.8, 52.9, 52.11, 52.12, 52.13–17 (transcript search) — none specced. |
| UC-53 | Hand the next step to the OS (call, mail, maps, calendar) | MISSING *(deferred-here)* | F-001 and F-003 both defer it by name as a separate feature with its own permission questions. Its seven doors are unbuilt; `todo-ai ADR-8`'s three tests would apply to each. |
| UC-54 | Speak to the whole list; `find_tasks` | MISSING *(unexamined)* | F-001 shipped only its **safety rules** — AC-9…AC-12 from UC-54 AC-54.6/54.7 (a multi-task delete needs an affirmative; the answer travels as a normal turn) — and AC-15 answers list questions honestly with zero mutations. The capability itself is absent. **The seatbelt is built and the car is not**, which is an unusual and probably correct order. Closer than the spec implies: `turns.ts:370` already hands every turn the whole live list. |

---

## Divergences

**D1 — There is no model. Interpretation is a 23-row fixture table.**
`api/ports/fixture-interpreter.ts` + `fixture-table.ts`; an unmatched utterance returns
`no_match`. Recorded in `ADR-001` and in F-001 `## Test strategy` (the stub replaces *model
interpretation only*; orchestration, gating, persistence, dedupe and undo run for real). This is
sound as a prototype decision and it changes what four UCs promise (UC-01, UC-02, UC-03, UC-05).
**The wording to watch:** F-001's coverage section says the interpretation-quality ACs "belong to
the existing engine and are not re-verified here" — the existing engine is in the *other*
repository. Read from inside this repo that sentence describes coverage that does not exist here.

**D2 — "No settings surface" was a load-bearing premise, and the owner withdrew it today.**
`docs/reports/owner-decision-2026-08-17-settings-and-lists.md`. It was cited as a premise by F-002
AC-23 (interface language is a build-time constant *because* no settings surface is a
deliverable), by `ADR-008`, and by F-002 `## Out of Scope`. **Five UCs put their surface in
Settings** — UC-26 AC-26.3, UC-28, UC-29 AC-29.2, UC-30, UC-48 — plus F-002's own on/off control
(AC-6, AC-17). None of the five is reachable while the host is declared not to exist, and none
of the five says so. There is **no UC for the settings screen itself**; it appears only as a
container, which is why its absence never showed up as a missing UC.

**D3 — Drafts and commit are gone; the assistant writes real task ids server-side.**
`ADR-002` supersedes `todo-ai ADR-9` *for this surface only*. The model still never sees a real
id — it gets opaque handles `t1..tn` — but the write happens on the server inside the turn. This
is the divergence the source would care about most, and it is properly recorded.

**D4 — Every turn sees the user's entire live task list.** `turns.ts:370-378`, read fresh inside
the serial queue slot. Two consequences worth knowing: it satisfies UC-09 AC-09.2's freshness
guarantee that F-001 left open as Open Question 7, and it inverts UC-54's cost argument — that UC
was designed so token cost is bounded by *results* rather than list length, and today the whole
list goes up on every turn, uncapped.

**D5 — Ordering.** UC-43 (15/08/2026) deleted automatic sorting outright: "thứ tự chỉ có một, và
nó là thứ tự người dùng tự xếp." This repo ships **only** automatic ordering — `created_at` from
the server, regrouped by due date on web — and no drag anywhere. Not wrong as a first cut; it is
simply the option the source removed, and nothing here records the reversal.

**D6 — Undone tasks go to `today`, unconditionally.**

> **RESOLVED 2026-08-18 (web-agent, T-121) by ADR-009.** `controller.toggleTask` now writes
> `status: 'inbox'` and **does not touch `due_at`** (`_shared/controller.ts`), so the collection
> survives the round trip: a row dated today returns to Today, a dateless one returns to Inbox.
> Verified both branches, each through the state only it can reach —
> `web/__tests__/controller.test.ts` § "un-completing returns a task to the collection it came
> from"; mutating the line back to `'today'`, or adding `due_at: null` to the PATCH, turns them red.
>
> **The mechanism is not `doneFrom`, and it does not need to be.** UC-45's own edge-case table
> (`docs/specs/_source/todo-ai/02-use-cases.md:904`) already defines the fallback for an empty
> `doneFrom`: *"Suy từ `dueAt`: due trong hôm nay → Today, còn lại → Inbox."* That inference is
> exactly what this repo now does, universally rather than as a fallback — so AC-45.2's behaviour
> is satisfied by the rule UC-45 itself supplies, with no new field. What a real `doneFrom` would
> still buy is a task moved to a collection by hand *against* its date; no surface offers that
> move (owner decision 2026-08-18, § Not settled), so there is nothing yet for it to record.

The original entry, kept because the shape of the defect is worth remembering: `controller.toggleTask`
set `status = 'done' ? 'today'`. UC-45 AC-45.2 requires an un-done task to return to the list it came
from (`doneFrom`). The behaviour was decided in code before the UC that governs it was read — and it
was wrong twice over once Today became a date, since `status: 'today'` on a dateless row put it in no
Today at all.

**D7 — Bulk operations were dropped for touch and re-entered by voice.** UC-40's `ĐÃ BỎ` rests
on a tap count — N taps beats N+2 through a selection mode — which is an argument about *touch*.
F-001 AC-9…AC-12 ships a bulk delete over voice, with a confirmation the source never needed
because it had no voice path to multi-task destruction. The drop and the addition do not conflict;
nobody has written down that they are about different input modes.

**D8 — Mobile does not have the manual path the parity table promises.**
F-003 `## Parity with F-001` lists **AC-18** among the ACs that "hold identically … no mobile
fork", and F-003 AC-1 makes that list observably binding. `mobile/components/TaskList.tsx`
implements *add* and *toggle* only: no rename, no delete (`editTask` and `removeTask` have no
mobile caller). AC-18 names four operations. Two of them are absent on that client.

---

## Where the source contradicts a decision taken here

Ordered by what it costs to leave unstated. These are worth more than the tally.

**1. `todo-ai ADR-11` promises a safety net this repo has not built.** ADR-11 is the reason the
conversation is the main surface — and its own consequence column says the list *"ở lại nguyên
vẹn làm đường thứ hai"*: Inbox, Today, Upcoming, Logbook and drag ordering stay intact, because
`todo-ai ADR-7` needs somewhere to fall back to when the network is gone. In this repo that
second path is one flat pane with three filters. Of the five things ADR-11 names as staying
intact, two exist in reduced form and three do not exist at all. **F-001 AC-18, AC-24 and AC-25
all lean on that fallback by name** — "the full todo list remains usable by hand" — and the list
they lean on is much thinner than the ADR assumed. This is the same thing the owner asked in
`docs/reports/owner-feedback-2026-08-17-product-gaps.md` §3, arrived at from the requirements side.

**2. The source is bilingual by design; `ADR-008` made the product English.** UC-01 AC-01.2 (keep
the user's language), UC-02 (Vietnamese time expressions), UC-08 AC-08.1 (ask in the user's
language) and UC-46's VN+EN grammar table all assume two languages. `ADR-008` and
`docs/reports/owner-decision-2026-08-17-english-first.md` reverse that for this phase and drop the
`hoàn tác` undo phrase. Anyone reading UC-02 or UC-46 as a work order will build the wrong thing
unless they read ADR-008 first. **The source stays in Vietnamese and must not be edited** — that
is what this row is for.

**3. The owner's own gap report overstates one gap, and the map should not inherit the error.**
`docs/reports/owner-feedback-2026-08-17-product-gaps.md` §3 states "there is no `PATCH`/`PUT`" and
"no `DELETE`", and concludes tap-to-edit and swipe-to-delete exist "at no layer — not in the UI,
not in the API". Measured today: `PATCH /tasks/{id}` and `DELETE /tasks/{id}` both exist
(`api/app.ts:322-350`), the shared controller wraps both, and **web** ships inline rename and a
delete control. What is true is the *mobile* half — and the owner was looking at the mobile
build. The report's conclusion is right about the product and wrong about the layer, and the fix
is much cheaper than the report implies for web and a real gap for mobile (D8).

**4. UC-46 is the hole the source already named, and it is deeper here.** UC-46 exists because
"hiện chỉ AI đặt được `dueAt`" — a violation of `todo-ai ADR-7`. In this repo the only thing that
can set a deadline is a 23-row fixture stub. Every UC that depends on a task having a date —
UC-34, UC-39, UC-42, UC-26 — inherits that.

**5. Two `ĐÃ BỎ` decisions were about touch, and this product's main input is voice.** UC-38
(filters) was dropped partly because "cái nào gấp" is answerable by eye from a red bar at the row
edge (UC-35) — a mechanism this repo has not built, so the replacement for the dropped feature is
also absent. UC-40 is D7. Neither drop should be reversed on this evidence; both should be
re-read before the CORE group is specced, because their reasoning rests on affordances that do
not exist here.

**6. What this repo built that no UC asked for** — recorded so the map reads in both directions.
F-001 **AC-30** (the conversation follows new messages only when you are already at the bottom)
comes from BUG-004 and `docs/reports/owner-decision-2026-08-17-new-message-affordance.md`, not from
any UC; the source has no conversation-scroll requirement at all. F-002's `speech.decision_log`,
its closed reason vocabulary and its declared spoken frames are likewise this repo's invention,
answering `LEARNINGS.md` L-008 rather than UC-20. Both are improvements. Neither is traceable to
the source, and a later reader diffing the two products will find them unexplained unless this
map says so.

---

## What to build next — the MISSING set, ordered

Not by UC number. Ordered by dependency and by what the owner has said is deficient. The two
owner statements of 2026-08-17 sit at the top because they are the only two entries with an
explicit owner mandate behind them.

**Tier 0 — the two the owner named today**

| # | Item | Why here |
|---|---|---|
| 1 | **A settings surface** *(not a UC — D2)* | Cheapest thing that unblocks the most. Five UCs (26, 28, 29, 30, 48) and one written spec (F-002 AC-6/AC-17) put their surface inside it. It has no UC of its own, which is precisely why nobody noticed. Owner: *"App mà ko có setting là thiếu."* |
| 2 | **UC-41 — lists** | Owner: *"Todo mà ko có các list cá nhân thì càng thiếu."* Largest blast radius of anything on this list: `lists` table + `tasks.list_id`, every `status`-grouping site on both clients, the interpreter context, UC-48's export envelope. AC-41.4 (the AI may never invent a list) already has its mechanism in F-001 AC-13. |

**Tier 1 — the `todo-ai ADR-7` floor: the todo app that must work with AI off**

| # | Item | Depends on / why here |
|---|---|---|
| 3 | **UC-34 — deadline & reminder pickers** | The field already exists and is already patchable; only a control is missing. Cheapest item with the widest downstream (42, 39, 45, 26 all need dates). |
| 4 | **UC-46 — dates understood in quick-add, no AI** | The named `ADR-7` hole (contradiction 4). Wants UC-34 first, because AC-46.2's `×` has to fall back to a manual picker. |
| 5 | **UC-27 + UC-44 — a task detail surface, with `note`** | Every remaining CORE field needs somewhere to live. Without it, 35/36/39 have no home. |
| 6 | **UC-35 — priority** | One AC; rides on (5). Note the field is a free string today and the UC wants three values plus a list-visible urgency mark. |
| 7 | **UC-37 — search** | No data-model change. Carries two jobs since UC-38 was dropped into it. Wants UC-44 (`note` is in scope for search). |
| 8 | **UC-45 — Logbook** | Needs `completed_at` for AC-45.1 (grouping by completion day). **No longer needs `done_from`** — ADR-009 satisfied AC-45.2 by removing something, and D6 is resolved. |
| 9 | **UC-43 — drag ordering** | Needs `sort_order`; closes UC-14 AC-14.1's residue and retires D5. |
| 10 | **UC-42 — Upcoming** | Pure derivation from `due_at` (AC-42.3 adds no field). Cheap once (3) lands. |
| 11 | **UC-36 — sub-tasks** | `parent_id` + per-parent order. Blocks UC-04. |
| 12 | **UC-39 — recurring** | Largest CORE item. Needs (3) — a recurring task must have a due date — and (11) — steps return unticked. |

**Tier 2 — the conversation's unfinished promises**

| # | Item | Why here |
|---|---|---|
| 13 | **UC-04 — AI sub-task decomposition** | Blocked by 11; trivial afterwards. |
| 14 | **UC-54 — whole-list commands + `find_tasks`** | Its safety rule already shipped (F-001 AC-9…12) and the engine already sees the whole list (D4). Closer than the spec implies. Also the point where D4's uncapped context has to be answered. |
| 15 | **UC-20 — talk-back** | Not a spec decision: **F-002 is written and unbuilt**. Two things to weigh first — its Gate 1 closed unreviewed at the round cap, and F-002's own Purpose records that the spoken surface is *empty offline*, which is the leg of `todo-ai ADR-11`'s market claim that F-004 would carry and nobody has committed to F-004. |
| 16 | **UC-24 AC-24.3/24.4 — offer to record an out-of-scope request** | F-001 named it a follow-up; small, and it is the honesty half of `todo-ai ADR-8`'s boundary. |

**Tier 3 — gated on a real backend, not on a product decision** *(all wait on `ADR-001` expiring)*

17 **UC-22** (auth / first-run) → 18 **UC-17** (sync; UC-22 is its stated precondition) →
19 **UC-28** (privacy & deletion — mandatory before any store submission, needs Tier-0 #1 and #17) →
20 **UC-26** (reminders that fire — scheduler + push + per-task and global off) →
21 **UC-48** (export/import — needs Tier-0 #1, and is worth more after #2).

**Tier 4 — do not schedule**

UC-49 (`⏸ HOÃN` in the source — a product question the source declines to answer), UC-50 and
UC-51 (`🚫` blocked by UC-17 in the source), UC-19, UC-47, UC-53, UC-29, UC-30 (deferred by name
in F-001/F-003 with reasons), UC-21 (needs a model — D1).

---

## Keeping this file true

- It is a **map, not a requirement**. It cites UC ids and F-doc AC ids and restates neither.
  When an F-doc changes, this file's rows change; the reverse is never true.
- One row per UC, one class per row. A UC that becomes BUILT keeps its residue list until the
  residue is empty.
- New divergences get the next `D` number and are stated once.
- If a UC is reinterpreted for the redesign, the reinterpretation belongs in an **F-doc**, and
  this map records where — never in `docs/specs/_source/`.
