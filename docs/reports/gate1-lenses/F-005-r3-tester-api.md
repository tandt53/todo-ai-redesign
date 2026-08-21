# Gate 1 round 3 — F-005 — tester lens (api), targeted re-review

Persisted by the orchestrator per **L-009**. The lens wrote nothing.
**CHANGES REQUESTED — 4 HIGH · 4 MEDIUM · 2 LOW.** Confidence HIGH. All 25 listed
ACs re-read. Ids continue from this lens's round-2 return (T1–T31).

## Part A — all fifteen dispositions landed, eleven in full

Verified against spec text, not the log's `where` column. **Materially better than
round 2**, where four of sixteen were logged `resolved` on prose that discharged
nothing. Fully landed: T17, T18, T19, T20, T21, **T22**, T27, T29, T30, T31.
Landed with a new defect of their own: T23 (→ T34, T36), T24 (→ T39), T25 (→ T40),
T26 (→ T35), T28 (→ T38).

**T22 is the one this lens said to check hardest, and it is closed properly.** The
`## API Touch Points` bullet names **all three** constructions explicitly —
out-of-set stored priority (AC-8), pre-F-005 snapshot record (AC-34), a store
surviving a process restart (AC-15) — cites `__qa__` as the home, and says "the
shape is architecture's, that it exists is not". Each precondition is falsifiable
rather than a wish. **The no-new-AC constraint cost this lens nothing**: no
disposition needed an AC and got a clause instead, and T22 is closed *better* by a
contract-section obligation than by an AC, because architect writes contracts from
that section.

## Part B — findings, all introduced or left by the revision-3 amendments

**T32 · HIGH · AC-38 — the headline and the new sub-bullet state opposite models.**
The opening paragraph still says a passed reminder "is surfaced **once**" and "does
not reappear on every launch, on the next device, or after a reload"; the revision-3
sub-bullet says the marker is written on acknowledgement "and the surfacing
**persists across opens** until then". An unacknowledged reminder therefore reappears
exactly where the headline forbids it. This is the AC's single falsifiable clause and
the whole reason it now carries `(api)`. Two citable answers to the highest-value
case (open, do not acknowledge, reopen) — and `## Test strategy` sides with the
sub-bullet. *Directive:* strike "once" and scope the no-reappearance clause to an
**acknowledged** reminder.

**T33 · HIGH · AC-38 — the offline door requires the one mechanism the owner's answer
forbids by name.** AC-38 says acknowledgement "is recorded **when connectivity
returns**". AC-2's third state — the OQ6 answer, landed in the *same revision* — says
"there is no queue, no durable store and no replay… the retry is invoked by the user,
**never by a timer and never by reconnection**", and `## Out of Scope` repeats it
verbatim. Three implementations are citable and they differ observably (acknowledge
offline, reload, reconnect, reopen). There is also nothing to hold it in: an offline
**cold** open holds no server rows at all, so "surfaces what the client already holds"
surfaces nothing. **L-015's shape between two revision-3 changes rather than two owner
answers** — which is why the log's pairwise check did not surface it.

**T34 · HIGH · AC-44 + six ACs — the zone has a read, a `Required: yes` and a refusal,
and no writer anywhere.** AC-44 says it is "refreshed from what the client reports"
without naming a path; `## API Touch Points` says the contract owes "one stored source
the server **reads** on all four doors"; the CRUD endpoints 400 on a `timezone` field
by AC-44's own account. Two failures from one gap. *For the tester:* the fixture for
the new refusal cannot be constructed — an account with no zone is unreachable through
any named path, **which is T22's exact shape recurring on the refusal that replaced
T23.** *In production:* no account holds a zone today, so until some unnamed client
report lands, **every write that sets a repeat, completes a repeating task or picks a
due is refused** — the ordinary path for every existing user, on a field whose sibling
migration was measured row by row and declared migration-free.

**T35 · HIGH · AC-25 — the run count is not derivable from the declared model.**
Revision 3 defines it as "distinct occurrences completed **at least once**, whether or
not the row was later deleted and **whether or not the completion was later undone**"
— while the same AC forbids a stored counter and `## Data` says runs are "counted from
completions, **not stored**". Nothing in `## Data` records that an occurrence was ever
completed: no `completed_at`, no completion event, `status` holds only the current
state. So **the quantity that ends every series has no source** the moment an
occurrence is un-completed — which is AC-28's whole reason for existing. Observable:
with `count: 3`, complete occ1, un-complete, complete again, then occ2 and occ3 — does
the series end at occ3 or occ4? **C13 cannot catch this**, because it checks declared
fields against ACs, never an AC's need against `## Data`.

**T36 · MEDIUM · AC-44, AC-13 — is a read inside the refusal's scope?** AC-13's
absent-flag reading is resolved server-side on **read**, on every row with no stored
`due_all_day`. `GET /tasks` for an account with no zone either refuses (the list does
not load) or silently defaults (the fallback AC-44 forbids by name). AC-18's refusal
outcome, which AC-44 borrows, is written entirely about **writes**.

**T37 · MEDIUM · AC-38, AC-36, AC-40 — the newest write path has no allowlist answer.**
`## API Touch Points` notices the acknowledgement write is "in no allowlist today" and
routes it to AC-40 — whose rules are four field-validation rules, none about who may
write this field. Can a turn set `reminder_shown_at`, silently retiring a reminder the
user never saw? Can a caller acknowledge another user's reminder? **AC-41 — the other
brand-new write path this feature adds — got an explicit caller-scoping clause for
exactly this reason.** The same care was not applied here.

**T38 · MEDIUM · AC-43, AC-47 — the undo offer's enders and its family disagree about
reload.** AC-43: ends when used, dismissed, or replaced "**and by nothing else**".
Revision 3 then places it in AC-47's family, which acquired in the same revision "it
does **not** survive a reload". Both citable, on the only reversal for the most
destructive action in the feature — and unlike AC-47's notice this one is *buildable*
either way, since `delete_membership` is server-side.

**T39 · MEDIUM · AC-25, AC-30, AC-39 — the series delete is not one of the three
endings.** AC-25 enumerates "all three ways" a series ends; AC-30's series delete is
not among them, and `series_live` is defined against that list. Delete a whole series:
its completed occurrences survive by AC-30's own rule, their repeat is still set, none
of the three endings fired — so **`series_live` stays true and AC-39 marks them as
repeating forever, for a series that no longer exists.** T24's defect returning through
the door revision 3 opened.

**T40 · LOW · AC-26** — the headline still says "no path generates a second, and no
path generates none while the series is live" while the sub-bullet says re-completion
"generates nothing further". Resolvable in favour of the sub-bullet, but AC-2's offline
bullet leans on the headline phrase as a **state invariant**, so it is load-bearing in
two places with two meanings.

**T41 · LOW · `## Impact` §4** still says two open occurrences would violate "the
invariant the whole recurrence section rests on" — an invariant AC-26 withdrew in
revision 2 because AC-28 leaves two open deliberately. A QA author reading §4 for
AC-46's fixture writes an assertion that is red on AC-28's own path.

## Part C — checked and sound

AC-8 (the `none`-is-absence sub-bullet is the strongest new text in the revision: it
makes `Required: yes` and the migration-free claim true at once, and both failure modes
are directly assertable) · AC-10 · AC-13 (one answer per row, resolved server-side and
carried on the wire; the explicit "this AC does not ask anyone to turn those two
assertions red" is what stops the weaken-to-green decision) · AC-15 · AC-18 (the
whole-write scope closes all three observables T19 named, stated once rather than
per-AC) · AC-22, AC-23, AC-24 · AC-27 (four independent regression targets) · AC-28
(untouched, still the best-constructed AC in the spec; AC-46 now **cites** its five
conditions rather than restating them) · AC-30 · AC-33 (4.1.3 as a rule rather than an
enumeration is the fix that makes this AC survive the next revision) · AC-34 · AC-36
(the create-door half is a genuine catch and is stated as a requirement) · AC-39 ·
AC-40 · AC-41 (three guessable outcomes closed) · AC-43 · AC-46 (the capture-before-
apply ordering is in the AC — the half no downstream check could catch) · AC-47, AC-48.

**`## API Touch Points` now carries five obligations that were prose in revision 2** —
seed path, timezone, acknowledgement write, turn-refusal outcome, receiver obligation.
**That is the largest single improvement in the revision**, because it is the section
that decides what architect builds.

## The lens's own routing note

**T33 and T35 are the two it would not ship without.** T33 puts an AC in direct
contradiction with an owner decision taken in the same revision; T35 makes the quantity
that ends every series underivable from the declared model. **T32, T34, T36, T37, T38,
T39, T40 and T41 are one-clause edits and none needs a new AC** — the amend-only
constraint is not under pressure from this lens.
