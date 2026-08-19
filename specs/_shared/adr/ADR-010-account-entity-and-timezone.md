# ADR-010 — The `account` entity, and where the user's timezone lives

**Date**: 2026-08-19
**Status**: accepted
**Feature**: F-005 (AC-44, AC-13, AC-12, AC-32) · **amends ADR-005**

## Context

`F-005 AC-44` makes an account-stored `timezone` the single source every
date-computing path reads, and refuses a computation that has none. The spec
recorded three things it deliberately did not settle (`## API Touch Points`,
four lenses):

1. **No writer.** *"Refreshed from what the client reports"* names no door.
   `timezone` rides `POST /assistant/turn` alone; `POST` / `PATCH` /
   `DELETE /tasks` run `rejectUnknownFields` and answer **400** to a client
   that sends one.
2. **No account record.** Measured on `data/assistant.json` 2026-08-19: the
   store's top-level keys are `sessions`, `turns`, `tasks`, `undo_records`.
   There is **no account entity**, and auth is an `X-User-Id` header stub —
   while **ADR-005 already decided that *the account* is the scope** for
   sessions and dedupe. That ADR's premise is load-bearing and unbuilt.
3. **The refusal is write-shaped and one use of it is a read.** AC-13's
   absent-flag resolution runs on every read of every row without a stored
   `due_all_day` — measured, **0 of 790 rows carry one**, so on day one that is
   every row on every `GET /tasks`. AC-18's refusal rule is *"writes nothing"*,
   which has no referent on a read. Refusing the read means the list cannot
   render; falling back to the server's own zone is forbidden by name in the
   same sentence. **AC-32 guarantees this surface works with zero AI calls
   while the assistant is erroring**, so a by-hand-only account must not be the
   account that cannot compute a date.

## Options considered

**For where the zone lives**

1. **On the request** (header or body, read directly by each computation) —
   zero new state; and it is the *one row, three answers* source AC-44 was
   rewritten against: a row created on a laptop in UTC reads all-day there and
   07:00 on a phone in UTC+7. Rejected.
2. **On each task row** — one answer per row by construction, but it is the
   *creating* device's zone frozen onto data, it needs a migration for 790
   rows, and it answers nothing for a computation about a row that does not
   exist yet (AC-12's shortcuts). Rejected.
3. **On a new `account` row keyed by `user_id`.** Chosen. It is also the row
   ADR-005 has been reasoning about since 2026-08-16 without one existing.

**For which door writes it**

1. **An explicit `PUT /account/timezone` the client calls at boot** — honest,
   and a client that forgets leaves the account zoneless with the failure
   surfacing much later as a refused write. Rejected as the *only* door.
2. **Every authenticated request carries `X-Timezone`, recorded by one
   installer in the auth step.** Chosen. It is the only option under which the
   zone is established by an *ordinary by-hand request* — which is exactly what
   AC-32's by-hand user makes, and what F-001 AC-24/AC-25 hand over to.
3. **The turn's `timezone` field alone** — the by-hand user never sends a turn.
   Rejected; it is the status quo the spec recorded as broken.

**For what refreshes an already-set zone**

1. **Every report overwrites it.** Rejected, and this is the subtle one: if
   each request upserts before its own read, device A resolves rows in UTC and
   device B in UTC+7 *in the same second* — the three-answers defect returning
   through the writer instead of the reader.
2. **First report wins; only an explicit user act changes it.** Chosen.

## Decision

- **New entity `account`**, one row per `user_id`, created lazily on the first
  authenticated request. Fields in `data-model.md § account`.
- **One installer, called from the auth step of every request** —
  `recordClientZone(state, userId, reported)`. This is L-005's own remedy
  applied in advance: there are two reporting channels (`X-Timezone`, and the
  pre-existing `POST /assistant/turn` body field, kept and now redundant) and
  **one** function that records them, so a grep for the installer returns every
  door.
- **`timezone` is set from the first report and never overwritten by a later
  one.** A differing report is recorded as `timezone_last_report` and changes
  nothing. `PATCH /account` (source `user`) is the only way to change an
  established zone; `GET /account` exposes both values so a client can offer
  the change rather than take it.
- **Every date computation reads `account.timezone`. No computation ever reads
  the request's header or the turn's body field.** One stored source, exactly
  as AC-44 words it.
- **Writes refuse when the zone is absent** — `409 TIMEZONE_UNKNOWN`, naming
  the `X-Timezone` header. Because the installer runs before routing, this is
  reachable only for a client that has never sent the header on any request:
  it is a **client contract violation, addressed to the client**, not a user
  state. That is the answer to product P17's *"a refusal the user cannot act
  on"* — the refusal the user could not act on does not arise.
- **Reads never refuse.** The read-side outcome for an absent flag and an
  absent zone is `due_all_day: null` on the wire, meaning *not determined*, and
  **a client renders a due with `due_all_day: null` as a date with no clock
  time**. This is not the silent fallback AC-44 forbids: nothing is guessed,
  the unknown is carried explicitly, and the direction it fails in is the one
  AC-13 exists to protect (never a time nobody picked). The rule that splits
  the two: **AC-18's refusal governs writes; a read withholds a derived value,
  never a row.**
- **The offline mobile create computes in the device zone and stores the answer
  rather than deferring it** (tester-mobile M14). A task created offline while
  viewing Today is written locally as **all-day** (`due_all_day: true`) and the
  replay carries the flag. AC-13 makes a *stored* flag authoritative wherever
  present, so the row never needs re-deriving and the three-answers case cannot
  arise for it. The device zone decides only which **day** the user meant,
  which is the one question no server can answer better.

## Consequences

- **Good:** ADR-005's premise now has a row. Any later account-scoped fact
  (a settings surface, a display language, a pinned collection) has a home
  instead of causing this ADR to be re-argued.
- **Good:** `due_all_day` drains by itself. Every write that touches `due_at`
  resolves and **stores** the flag, so the `null` wire value is a shrinking
  population and never a permanent mode.
- **Bad:** a user who first opens the app while travelling is pinned to the
  travelling zone until `PATCH /account` is called, and **this phase ships no
  settings surface to call it**. `GET /account` carries `timezone_last_report`
  precisely so the disagreement is visible to whoever builds that surface.
  Recorded as a known gap rather than hidden behind an auto-refresh whose cost
  is the defect above.
- **Bad:** an `X-Timezone`-less client gets a refusal it cannot fix at runtime.
  That is deliberate — the alternative is a silently wrong date.
- **Neutral:** no migration. The 790 existing rows are untouched; ADR-009's
  precedent (*"these are past states"*) is followed, and the read rule covers
  them from day one.
