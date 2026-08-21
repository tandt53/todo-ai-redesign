# F-006 Gate 1 — dev (mobile) lens (T-182, 2026-08-21)

**Verdict:** 3 HIGH · 4 MEDIUM · 12 mobile-tagged ACs, all 16 read.

---

## F1 (HIGH) — AC-1, AC-2 · a new destination on the phone with no navigation class, so Android back has no answer

The mobile shell's entire navigation state is
`{ surface: 'talk'|'tasks', overlay: 'none'|'menu'|'settings', collection }`. Every other
Lists-menu row is a `select-collection` edge landing on S2 Tasks, **where `shellBack()`
returns `consumed: false` — on S1/S2 the Android back press exits the app, deliberately.**
Overlays go up one level instead.

AC-1 places the trash row beside `Done`, pointing at the S2 reading; **`## Impact` §2
forbids the mechanism that makes the S2 reading work** (a fifth `Collection` — and
`ListsMenu.tsx`'s `ICON: Record<Collection, …>` makes a fifth member a typecheck failure).
So the implementer must invent the navigation class, **and one of the two inventions makes
back exit the app from a surface reached in two taps.**

`## Impact` §10 lists eight documents that go stale and `information-architecture.md` is
**not among them** — not §4, whose rule is *"nothing reaches a surface except through an
edge on this list"*. **F-005 AC-45 is the precedent that did exactly this and is not being
followed.**

## F2 (HIGH) — AC-9, AC-11 · every offline guard the clients have is unreachable here, by construction

`refusesOffline(task: TaskView)` (`_shared/controller.ts:1239`) is **keyed on a row found
in `state.tasks`**, and `## Impact` §3 requires trash rows to live in their own state and
never enter that array. So the refusal, the `local === true` short-circuit and the
revert-on-failure are all unreachable from these three calls, **and the implementer gets no
default from the codebase.**

AC-15 says these work *"while the assistant is erroring"*, which is about AI and **reads at
a glance as "offline"**. One of the three is the only irreversible act in the product: *a
delete forever queued offline and replayed later destroys rows after the user has left the
surface, with the confirmation AC-11 requires having been shown against a state that has
since changed.*

## F3 (HIGH) — AC-10 · false on the phone in **both** halves

**"On screen":** a phone is always below `breakpoints.split` and renders one surface at a
time. The user is looking at the trash; the restored row is in Today or Inbox on S2.
Either the app leaves the trash — a navigation no AC states, **and one that makes restoring
three entries in a row impossible** — or the observable is simply not there.

**"Move it by hand":** the phone's row has exactly three controls (`toggleTask`,
`editTask`, `removeTask`). **There is no date control and no filing control on the phone at
all** — `writeField` is never called from `src/assistant/mobile/`. So a task restored into
Today because its date passed **cannot be moved anywhere by hand on that client.** AC-10
justifies "no relocation rule" with a remedy the phone does not have.

## F4 (MEDIUM) — AC-2 · the analogous phone surface has five views and three banners; the trash gets two

`tasks-view.ts`: `TasksView = 'default' | 'empty-first' | 'empty-collection' | 'loading' |
'error'`, `TasksBanner = 'none' | 'retry' | 'offline'` — **precisely because its read can be
slow, fail, or be offline.**

Deleted rows are in no local store by AC-4, so there is nothing to fall back on when the
read fails — **and a client with no failed-read state renders the empty list, which is
AC-2's *"nothing has been deleted recently"*.** That is the one drawing AC-2's second
sentence forbids, reached by the shortest implementation path.

## F5 (MEDIUM) — AC-3, AC-12 · the 30-day constant would get three readers, and `## Data` names two

If the client derives `deleted_at + 30 days`, each client gets its own copy of the constant
**and its own clock** — the phone against `ControllerDeps.now`, while the predicate that
decides recoverability runs on the server's. *L-004's shape inside the exact structure
L-023 was written about.* `## Test strategy` says AC-12 is testable through F-005 AC-44's
seam — **which is one seam per side, not one seam.**

## F6 (MEDIUM) — AC-6, AC-7 · two values the client needs to draw an entry have no stated source

**AC-6:** grouping is offered as server-or-client, but `serialize.ts:33` lists
`delete_gesture_id` among the fields the wire omits. **The client cannot group by a field it
cannot see.**
**AC-7:** a lone deleted step is *"named by that parent"* — but the client's only task store
holds live rows only, and §3 requires trash rows kept out of it. **When the parent is itself
deleted, its title is in neither store and the entry cannot be named at all.** The phone has
never drawn a step, so there is no existing resolution path to reuse.

## F7 (MEDIUM) — AC-5 · "eleven filters across the API and both clients" undercounts, and the omissions are the tempting ones

By §1's own criterion it omits `mobile/model/task-link.ts:76`, `web/shell.ts:206` (a deleted
task's title is inert rather than a link — **both named in §8**) and
`web/components/TaskDetail.tsx:332`. **The three shared-controller lines are the only client
entries in the list, so "and both clients" is the phrase that is wrong.**

*This matters more than an arithmetic slip:* §1's stated failure mode is a site being
**helpfully widened** while someone builds the trash, and `task-link.ts:76` is the most
temptingly widenable site in the codebase — §8 spends a paragraph arguing it must not be. **A
test written to AC-5's number asserts over a set that excludes it.**

---

## Checked, sound

- **AC-4** — the phone's exclusion happens upstream of `inCollection` at
  `controller.ts:969/974/1690`; separately falsifiable at each named reader.
- **AC-9 needs no new client write path** — `client.ts:244` already exposes `restoreTask`
  and the shared controller already calls it for the undo.
- **AC-14** — per-account scoping is the `X-User-Id` header both clients already send.
- **AC-15** — the phone's list affordance is unconditionally enabled, so *"works while the
  assistant is erroring"* holds structurally.
- **AC-16 2.5.1 is satisfiable with the existing pattern** — the phone has no swipe gestures
  today and the row's delete control is always visible in the trailing slot.
- **Touch targets** — `touch.ts`'s `touchProps` already supplies per-platform hitSlop.
- **`## Impact` §1's headline measurement** — re-measured, 45 non-comment lines / 16 files,
  exact. Only the eleven-reads subset is wrong (F7).
