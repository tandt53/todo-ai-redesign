# Owner feedback, 2026-08-17 — layout, menu, and how much of a todo app this is

Raised by the owner after looking at the mobile build on a simulator. Recorded for
later work, not acted on. Each point below was checked against the code rather
than accepted or dismissed on impression.

---

## 1. The mobile layout puts two panes on one small screen

**Owner:** *"bố cục của màn hình chưa phù hợp khi quá nhiều thứ hiển thị, vừa chat
vừa hiển thị list các todo trong khuôn khổ màn hình nhỏ bé."*

**Confirmed, and the design does have an escape hatch that is not doing its job.**
`AssistantScreen.tsx:34` holds `listOpen`, defaulting to **true**, and the top-bar
button toggles it. So the list *can* be collapsed — but:

- it defaults open, so the crowded state is the one every user meets first;
- the control that collapses it is a **hamburger**, which reads as "menu", not as
  "hide the list";
- F-001's own reasoning for the default is recorded in `AssistantScreen.tsx:29-31` —
  an applied turn's changes must be visible in the list within the same turn
  (AC-1/AC-4), which is why the list sits beside the conversation rather than
  behind navigation. That reasoning is sound on a wide screen and is what the
  owner is now pushing back on for a phone.

**This is a real design question, not a bug:** on a phone, "the change is visible in
the list in the same turn" and "the conversation has room to breathe" are in
tension, and F-001 resolved it for the desktop case. Worth reopening for mobile
specifically — F-003 currently inherits the layout rather than deciding it.

## 2. The menu is not a menu

**Confirmed.** The hamburger's only behaviour is `setListOpen(v => !v)`. There is no
menu, no settings, no navigation, no account surface. Nothing is behind it.

Note this collides with two things already on record: ADR-008 chose English with
**no i18n layer and no settings surface**, and F-002 AC-23 makes the interface
language a build-time constant *because* "no settings surface is a deliverable of
this feature or any other in flight". So the absence is deliberate and consistent
so far — but it means every future preference (language, talk-back, notifications)
has nowhere to live.

## 3. "Are the basic todo features incomplete?" — yes, and here is exactly what is missing

**A task has** (`api/types.ts:10-20`): `id`, `user_id`, `title`, `due_at`,
`reminder_at`, `priority`, `status`, `created_at`, `updated_at`, `deleted_at`.

`status` is `inbox | today | done | archived` — a fixed four-value lifecycle, **not**
a user-defined list. The `inbox` chip in the UI is this status, not a project.

> ### ⚠️ CORRECTION, 2026-08-17 — the paragraph below was wrong when first written
>
> I told the owner there is **no hand-editing at any layer**. That is false, and
> architect-agent caught it while building the UC map (T-096). Measured:
> `PATCH` and `DELETE` **both exist** (`src/assistant/api/app.ts`, the task route),
> the shared controller wraps them as `editTask()` and `removeTask()`, and
> **the web client ships inline rename and delete** — `TaskListPane.tsx` calls both.
>
> **The real gap is mobile only.** `mobile/components/TaskList.tsx` implements add
> and toggle and nothing else.
>
> **How I got it wrong, because the shape matters:** I listed the endpoints with a
> regex for `path === '...' && method === '...'`. The PATCH/DELETE route is written
> as a **pattern match** on the path (`taskMatch !== null && (method === 'PATCH' …)`),
> so my pattern could not match it structurally, and I read the empty result as
> absence. That is `L-002` exactly — a source-text scan answering a question about
> behaviour, returning a confident wrong answer — committed while holding every
> agent in this session to the opposite standard.
>
> The paragraph and table below are left **as originally written**, struck through in
> substance by this note, because the correction is worth more with the error visible
> than with it quietly edited away.

**The API is two endpoints for tasks:** `GET /tasks` and `POST /tasks`. That is all.
*(WRONG — see the correction above. `PATCH` and `DELETE` exist.)*

| Basic todo capability | State |
|---|---|
| Create a task by hand | **yes** — `POST /tasks`, the `+ Add task` control |
| Mark done / undone | **yes** — `controller.toggleTask()` |
| **Edit a task by hand** (rename) | **web: YES** (`editTask` → `PATCH`) · **mobile: no** — corrected 2026-08-17 |
| **Delete a task by hand** | **web: YES** (`removeTask` → `DELETE`) · **mobile: no** — corrected 2026-08-17 |
| Notes / description on a task | **no field** |
| Subtasks / checklists | **no** |
| Projects, lists, tags, labels | **no** — `status` is the only grouping |
| Recurring tasks | **no** |
| Reminders that actually fire | **field only** — `reminder_at` exists; nothing schedules or delivers a notification |
| Search / filter beyond the fixed groups | **no** |
| Reorder / manual sort | **no** |
| Attachments | **no** |

**The sharpest consequence, restated after the correction:** on **mobile** there is no way to fix a mistake by hand. On web there is. That asymmetry is itself a finding — F-003's parity table lists AC-18 among the ACs holding *identically* across platforms, which is now a documented divergence rather than the parity it claims.

*(Original, over-broad wording:)* there is no way to fix a mistake by hand. If the
assistant creates a task with the wrong title or the wrong date, the user's only
route is to ask the assistant again. Tap-to-edit and swipe-to-delete are the two
gestures people expect from any todo list, and neither exists at any layer — not
in the UI, not in the API.

Whether that is right depends on a product decision nobody has made explicitly:
**is the assistant the only way to change a task, or the fastest way?** F-001 was
specced as an assistant surface, and the task list has been treated throughout as
its output rather than as an editable list in its own right. That framing has held
because nothing tested it; the owner just did.

---

## Suggested shape of the work, if it is taken up

These are three different sizes and should not be one feature:

- **(a) Mobile layout** — a design question against F-003, reopening the
  list-beside-conversation default for small screens. Cheapest, and the owner has
  already seen the problem.
- **(b) A real menu** — a surface with somewhere for preferences to live. Blocks
  nothing today but is the prerequisite for every deferred setting.
- **(c) Direct task editing** — the largest. Needs API (`PATCH`, `DELETE`), a spec
  decision on assistant-vs-direct, undo semantics for a hand edit (F-001 AC-5's undo
  is turn-shaped and a hand edit is not a turn), and both clients.

(c) is where the real design work is: the undo model, the conflict rules between a
hand edit and an in-flight assistant turn, and what the assistant says when the user
has changed something under it.
