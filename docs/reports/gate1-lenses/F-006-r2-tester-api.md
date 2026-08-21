# F-006 Gate 1 ROUND 2 — tester (api) lens (T-186, 2026-08-21)

**Verdict:** 1 HIGH · 2 MEDIUM. **All 5 round-1 findings hold** — re-checked against the revision-4 text, not against the log.
**AC-17, never reviewed by anyone, produced 2 of the 3.** Store re-measured: 839 / 57 / 53 null-gesture / 0 `parent_id` / 420 turns — all reproduce.

---

## F1 (HIGH) — AC-14, AC-15 · the new read half has **no channel**

`turn.outcome.kind` is **seven closed members**, and F-002 `§ What speaks` declares its
per-kind table **"exhaustive and closed"**. A question about the list returns
`unsupported_query` today.

**So the only free-text field an implementer can reach is `unsupported_query.alternative`
— which would report a question the assistant just answered as unsupported.** That is the
same false statement round 1's F2 found in `skipped.reason`, and **a QA author asserting
*"the reply names it"* would certify it.**

*No AC and no touch point asks for a slot.* Filed HIGH rather than *"architecture's shape to
fill"* deliberately: **the other three owed shapes are each recorded in `## API Touch
Points`, and this one is recorded nowhere.**

## F2 (MEDIUM) — AC-17, AC-12 · reading the trash to observe the empty is what destroys the expired rows

AC-17 removes every deleted row *"expired or not"* — and **the only product door that could
show it is the trash read, which purges the expired rows itself first** (AC-12's
removal-on-read).

*A test that seeds expired rows, opens the trash, empties it and asserts the trash is empty
**passes against an implementation whose empty ignores expired rows entirely***, because
AC-12 already took them. The clause is then certified by a test that never exercised it.

## F3 (MEDIUM) — AC-13, AC-17 · three paths now hard-remove a row and AC-13 names none

`## Test strategy` names **one** fixture. A QA author writes it against AC-11, C2's per-AC
count is satisfied, and **the higher-blast-radius of the two irreversible acts ships with no
undo case** — L-012's exact shape, on the act that destroys an account's whole trash.

---

## Round-1 findings — all five hold

| | |
|---|---|
| **F1** expired-restore outcome | **holds** — AC-9 states four outcomes, (c) and (d) required distinguishable from (b), from each other and from 404. `## API Touch Points` **withdraws "unchanged"**. *The state has a slot.* |
| **F2** `skipped` cannot express it | **holds, both halves** — a distinct reason is now a requirement (spelling architecture's) and the top-level-only step gap is named. **Slot, not sentence.** |
| **F3** removal write unobservable | **holds** — the account's stored row count after the trash read is the assertion; the raw-store read is named as owed |
| **F4** grouping option unbuildable | **holds, and the branch is closed rather than offered** — server-side grouping fixed, entry addressed by member task id, no gesture id on the wire |
| **F5** unreachable refusal path | **holds** — the write half is now a structural guarantee read off the action vocabulary |

## AC-17 — first review it has had

Its set is stated and is **deliberately not AC-6's membership** — keyed on `deleted_at`,
addresses no entry. Success has a failing observable at the trash read for the non-expired
rows *(expired half → F2)*. Post-state rule inherited from AC-11 in full. Caller scoping
covered. **Response shape correctly recorded as owed — AC-11's *"no new shape is owed"* is
withdrawn for it by name.** Undo interaction → F3.

## The routed question, in tester's terms

> **The dead end is testable; what is not is whether it is survivable.** An implementation
> replying *"the dentist task is in the trash"* and one replying *"…— open Recently deleted
> from the Lists menu"* are **indistinguishable to every assertion this spec supports**, and
> `## Impact` §8 puts the inert message door right beside the reply.
>
> If F1 is fixed, the cheapest insurance is one clause requiring the reply to name the hand
> path — **then the dead end is at least drawn rather than merely permitted.** Not filed as
> a finding: whether the price is acceptable is product's call.
