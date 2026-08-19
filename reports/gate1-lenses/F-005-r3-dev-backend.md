# Gate 1 round 3 — F-005 — dev lens (backend/api), targeted re-review

Persisted per **L-009**. **HIGH 3 · MEDIUM 3 · LOW 1.** All 17 listed ACs re-read;
every code and data claim re-verified against the repo **and the live store**. Two of
three HIGHs are amendment-introduced.

All eight round-2 dispositions landed: F1 (AC-40's four api-assertable observables; §3's
correction verbatim), F2 (read side), F3 (**exactly** — `controller.ts:442`'s
`if (mutated) void this.refreshTasks()` verified, correction in both AC-26 and API Touch
Points), F4 (§1 re-filed; `applyCreate`'s hardcoded `reminder_at: null` at `apply.ts:49`
and `ContextTask`'s short shape both verified), F5 (`delete_membership` **correctly
declared as new server state**), F6 (**the excluded choice is the right one** — no step
titles reach an F-001 AC-4 message), F7 (`removeTask` named), F8 (§12 narrowed; **716
open rows across 190 accounts, 197 across all 790** — verified).

## HIGH

**F1 — the zone is read everywhere and written nowhere.** AC-44 states where it is
stored, who reads it and what absence does. It never states the path by which it is
**written**: "refreshed from what the client reports" names no door. And the store has
**no account entity at all** — top-level keys are `sessions`, `turns`, `tasks`,
`undo_records`; auth is an `X-User-Id` header stub — so there is **no existing record to
refresh and no existing write that could refresh it.** The only channel is
`req.timezone` on `POST /assistant/turn`. So **an account that has never sent a turn has
no zone, and every date computation is refused** — which is the by-hand user: **AC-32
guarantees this surface's operations make zero AI calls and work "while the assistant is
erroring", and F-001 AC-24/AC-25 hand over to it.** Setting a repeat, completing a
repeating task and AC-13's all-day reading would each be refused on an account that has
only ever used its hands. **L-015's shape: AC-44's refusal and AC-32's guarantee were
each reviewed and are each right.**

**F2 — the refusal is write-shaped and AC-13's use of it is a read.** AC-44 routes
absence to AC-18's rule, which is *"a refused **write** … **writes nothing**"*. AC-13's
absent-flag resolution happens on **every read of every row without a stored
`due_all_day`** — measured: **0 of 790 rows carry it**, so on day one that is every row
on every `GET /tasks`. "Writes nothing" has no referent on a read, and both improvisations
are bad: refuse the read (**the app cannot render at all** for a zoneless account) or fall
back silently, **which AC-44 forbids by name in the same sentence.**

**F3 — AC-46's five-conditions bullet never reverts the cascade, and names step titles.**
AC-46's subject is "creates **or changes**" and it names the AC-19 cascade as one of two
things it exists to cover. Applied to a cascade-ticked step, AC-28's five conditions fail
**by construction** — no `series_id`, created long before the completion, and
`updated_at !== created_at` because the cascade just wrote it — so **every cascaded step
is un-reverted**, which is *exactly the defect `## Impact` §4 says AC-46 closes*.
`undo.ts:98` is a whole-row replacement, so reverting the parent bypasses the
`completed_by_parent` logic AC-19 relies on. **Worse:** the same clause says the
un-reverted row is "named in the reverted turn's outcome message" — verified in code,
that is `undo.ts`'s `skipped` list, which carries a `title`. **So undoing a voice "done"
on a parent with eight steps puts eight step titles into the outcome message** — which
AC-46's own third bullet exists to prevent and AC-35/§12 forbid outright. *Directive:*
insert "created" into that one sentence and say a turn-**changed** row is reverted on its
own snapshot comparison. **One word plus one clause.**

## MEDIUM

**F4 — 53 rows are already soft-deleted with no `delete_membership`.** Measured: 53 of
790, across 18 accounts, all predating the field. AC-41 makes the restore a general write
path, so those 53 are addressable — and AC-41 covers the live-row case and not this one,
leaving three guesses including **the `parent_id` key AC-41 rejected by name**.

**F5 — the locally-created row is a third delete state, reachable while online.**
`removeTask` short-circuits on `task.local === true` **regardless of connectivity**
(`controller.ts:630-634`): the row is deleted locally, no `DELETE` is sent, and the delete
genuinely happened. Both branches are wrong as written: offer the undo and AC-41's restore
is aimed at a row the server never held; withhold it and the one offline-created task
becomes the irreversible destruction AC-43's coverage list exists to prevent.

**F6 — the F-002 dependency is stated as a note, and its analogy files it under the wrong
owner.** §13 and §14 each get an `## Impact` subsection, state the consequence of
non-amendment, and say "Routed to the orchestrator". The F-002 dependency gets **none of
the three** — and its analogy ("exactly as AC-41's restore was a dependency on
`api-contracts.md`") compares a cross-spec amendment to an in-feature contract item this
spec already discharges, **so it reads as already handled.** Downstream agents read the
spec, not the revision log where the routing actually lives.

## LOW

**F7 — §1 and `## API Touch Points` no longer agree on how many gating lists there are,
and the one that fails silently is in neither count.** §1's prose says **six** above a
**seven**-row table; API Touch Points enumerates a different six that **omits the wire
shape entirely** — on a feature that needs `series_live` and the all-day flag carried on
the wire. And `ContextTask` sits in the "remaining sites" group whose stated rationale
(*"a missed field is `undefined`"*) **does not reach it**, for the same reason it did not
reach `pushLocalTasks`. **The sixteen-site count itself is exact** — re-derived.

## Checked, nothing found

AC-2 (premise correction exact against `controller.ts:586-637`) · AC-3 (the rewritten
both-pending rule resolves to one order the server can produce) · AC-13's three writers ·
AC-15, AC-19 · AC-18's whole-write scope · AC-22, AC-27 · AC-26/AC-39 (sender and
receiver both obligations) · AC-36/AC-40 (four observables all api-assertable;
`TurnOutcome`'s six members re-verified — still no refusal) · AC-41 · AC-42/AC-43 ·
AC-44's client-seam half · AC-46's capture-before-apply ordering.

**New measurements this round:** 53 soft-deleted rows · **0 of 790 rows carry
`due_all_day`** · **no account entity exists in the store.**
