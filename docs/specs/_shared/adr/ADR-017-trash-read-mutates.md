# ADR-017 — The trash read mutates the store

**Date**: 2026-08-23
**Status**: accepted
**Feature**: F-006 recently-deleted (AC-5, AC-12)

## Context

F-006 AC-12 requires that a deleted row stops being reachable after 30 days,
and there is no scheduler, background job, or cron in this app — verified
2026-08-21: the only timers in `src/` are client UI timers (a flash dismissal,
a retry sleep, the speech port) and none touches the store.

The expired rows must be removed *somewhere*, and the choices are:

1. A new background mechanism (scheduler, cron).
2. Sweeping on every task write.
3. Sweeping on the trash read.
4. Never removing anything.

Option 1 is out of scope (`F-006 ## Out of Scope` excludes it). Option 2 pays
a cost on every user's every keystroke to serve a surface they rarely open.
Option 4 is the leak this feature exists to close. Option 3 is what remains.

This means `GET /tasks/deleted` — a semantically read-only HTTP call —
mutates the store by hard-removing expired rows.

## Options Considered

1. **Always purge on the HTTP call.** Every HTTP invocation of
   `GET /tasks/deleted` evaluates the expiry predicate and removes expired
   rows from the store. The turn path's inline read (processing rule 5) does
   not purge. Chosen.

2. **Purge via a query parameter (`?purge=true`)** controlled by the caller.
   Rejected: a caller that forgets the parameter never purges, and the
   distinction is between HTTP callers (the surface) and inline callers (the
   turn path), which is a code-path distinction rather than a parameter
   distinction.

3. **A separate `POST /__qa__/purge-expired` endpoint for the sweeping.**
   Rejected: it splits a single concern (reading and removing expired rows)
   across two calls that must always be made together, and a client that
   calls one without the other either shows expired rows or removes rows it
   did not show.

## Decision

`GET /tasks/deleted`, when called via HTTP (the surface path), evaluates the
30-day expiry predicate and **hard-removes expired rows from the store** in
the same transaction that reads the results. Expired rows are excluded from
the response. The turn path's inline read evaluates the same predicate to
exclude expired rows but **does not remove them** — a question purges nothing
(F-006 AC-5, AC-14).

The implementation shape, stated because the `Store` port is constrained:
`Store` exposes `read` (*"callers must not mutate"*) and `transact`, and
`transact` clones the whole state and rewrites `data/assistant.json` on every
call. A naive implementation calls `transact` on every trash open. The
recommended shape: check the expiry predicate inside `read` first; if no row
is expired, return the read result without entering `transact`. If any row is
expired, enter `transact`, re-evaluate the predicate (the state may have
changed), remove expired rows, and return the results. This avoids a full
snapshot write when the trash holds nothing to purge — which, measured against
the live store where nothing is older than 5 days, is every call today.

## Consequences

- **Good:** no new infrastructure. The removal piggybacks on a door that
  already exists and already reaches every deleted row.
- **Good:** the assertion that rows were removed is testable through the
  raw-store harness read (`GET /__qa__/raw-tasks`), which is the only
  observable that distinguishes *"removed"* from *"hidden by the predicate."*
- **Bad:** a GET that mutates. This is unusual and must be documented at the
  endpoint and in the platform docs so implementers do not assume idempotency.
- **Bad:** an account nobody opens the trash on keeps its rows on disk past
  30 days. Accepted — AC-12 says so explicitly.
- **Neutral:** the turn path's exemption means a question about the trash
  can name a row that the next trash open removes. The expiry predicate
  already excludes it from the response, so the user never sees it.
