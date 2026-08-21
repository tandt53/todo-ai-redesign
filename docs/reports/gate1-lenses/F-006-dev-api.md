# F-006 Gate 1 — dev (api) lens (T-182, 2026-08-21)

**Verdict:** 3 HIGH · 3 MEDIUM · 2 LOW · all 16 ACs.
**All three HIGHs are one root:** the spec defines the trash entry by the **delete gesture**, but two rules cross entries — the restore's parent invariant, and a lone deleted step's parent — and no AC constrains the crossing.
**The no-scheduler premise holds:** 4 timers in `src/`, none server-side, none touching the store.

---

## F1 (HIGH) — AC-11, AC-9, AC-6, AC-7 · *delete forever* inherits rows from other gestures

AC-11 defines the destroy set as *"exactly the rows the entry covers — the same
membership AC-9's restore would have put back"*. **But the restore's membership is not
the gesture:** `app.ts:605-618` adds each member's **still-deleted parent** to the set —
a row from a different gesture, and therefore a different trash entry.

*Read literally, destroying the entry for a lone deleted step also hard-removes the parent
task's row — an entry the user did not select and can still see in the list.* Written the
other way, the AC contradicts its own wording. **Nothing downstream catches it: qa-api
tests the entry it destroyed, not the entry it did not.**

## F2 (HIGH) — AC-7, AC-9, AC-11, AC-12 · a restore that produces a permanently invisible row

The parent's row can leave the store first, by AC-11 or by AC-12's expiry. *The ordering is
reachable, not contrived:* `plan.ts:105` excludes an already-deleted step from a parent's
cascade, so "delete step, then delete parent" is genuinely two gestures and two entries.

**The entry has no name to render, and AC-9's restore succeeds anyway** — the parent loop
at `app.ts:610-614` skips a missing parent — producing a live step whose `parent_id` points
at nothing. That row is in no collection, in no handle list, and no longer in the trash:
**permanently invisible.** *The restore code's own comment already states the hazard.*

## F3 (HIGH) — AC-9, AC-12, AC-16 · the door changes and no outcome is specified

AC-9 and `## API Touch Points` both say the restore is unchanged — *"Nothing about it
moves"* — while AC-12 requires it to stop returning an expired row and `## Impact` §10 says
it *"gains the expiry precondition"*.

Today the door has exactly three outcomes: `401`, `404`, `200 {restored: false}`. **The
implementer must invent a fourth** — which ethos §9 forbids and which AC-16's 4.1.3 makes
user-visible: it requires every refusal be announced, **and the client cannot announce a
refusal it cannot distinguish from a double-tap.** Two clients and qa-api will each guess
separately.

## F4 (MEDIUM) — AC-6, AC-5, AC-11 · one of the two offered options is unbuildable

`## Data` declares `delete_gesture_id` *"internal, never serialized"*; `## API Touch Points`
offers architecture the choice of grouping *"server-side or by the client"*. **Client-side
grouping needs the gesture id on the wire, which the spec's own Data row forbids** — and
the option that looks cheapest is the forbidden one. It also blocks *empty trash*'s *"how
many entries"*, which is a gesture count, not a row count.

## F5 (MEDIUM) — AC-12, AC-5 · the AC settles what the touch point still calls open

AC-12: *"The removal **write** happens on the trash read."* `## API Touch Points`: *"what
is open here is where the removal write goes."*

**Not a free choice:** `Store` exposes `read` (*"callers must not mutate"*) and `transact`,
and `transact` clones the whole state and rewrites `data/assistant.json` on every call — so
*"GET that purges"* means every trash open is a full 839-row snapshot write unless the
predicate is checked first. **An architect who reads the touch point instead of the AC may
place the sweep elsewhere, and AC-12's own test then fails against a conformant
implementation.**

## F6 (MEDIUM) — AC-3, AC-12 · two computations of one value, no named authority

`deleted_at` is on the wire, so a client can and will add 30 days locally, while the
refusal happens on the server against the server clock. **AC-3 explicitly promises the date
*"is exactly what AC-12's predicate tests"*, so that drift is a spec violation nobody can
see until a user hits it.** The project already has the remedy as a named convention for
the identical class: one installer for the zone, every computation reading
`account.timezone`.

## F7 (LOW) — AC-11 · "no new response shape is owed" tells the architect not to look

The `removed:` channel is defined inside the multi-row rule alongside
`task: Task # the row the request addressed` — **and permanent deletion destroys the
addressed row, while *empty trash* addresses none.**

## F8 (LOW) — AC-5 · two counts do not reproduce

`deleted_at` appears on **56 lines across 15 files** outside `__tests__` (44 excluding
comments), not *"45 across 16"*. And AC-12's *"exactly two"* doors is not exact:
`planDelete` scope=series writes `series_ended_at` onto already-deleted rows via
`allow_deleted`, and AC-11 adds two more. *No consequence for the enumeration — all eleven
read sites are correct — but "exactly two" is the phrase an implementer greps against.*

---

## Checked, sound

- **The no-scheduler premise** — 4 timers in `src/` (flash dismissal, speech port, fixture
  sleep, controller retry). None server-side, none touching the store. **AC-12's
  evaluate-at-the-door design is the only one this app supports.**
- **AC-12's *"without exception"* against the turn-undo path** — the one place a leak was
  expected. `performUndo` requires the newest applied turn of the OPEN session, and
  `lazyIdleClose` runs at that door with a 180 s idle close. **A 30-day-old delete is
  unreachable through undo. The claim holds.**
- **AC-13's guard, verified in code** — a purged row has `cur === undefined` while
  `post_apply` is present, so it is skipped, not replayed (`undo.ts:167-176`). §5's warning
  about a purge that also cleans `post_apply` is exactly right: **that flips the row into
  the resurrect branch.**
- **§5's measurement reproduced exactly** — 24 of 420 turns, all applied.
- **§2 and §3** — `inCollection` does not contain the identifier `deleted_at` at all, so
  §3's *"nothing in the client would stop them"* is literally true.
- **AC-5 is achievable** — there is no `GET /tasks/{id}`; the only task-returning reads are
  `GET /tasks` and the write responses.
- **Nothing in the ACs assumes a background job.**
