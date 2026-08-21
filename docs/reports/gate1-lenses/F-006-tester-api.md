# F-006 Gate 1 — tester (api) lens (T-182, 2026-08-21)

**Verdict:** 2 HIGH · 3 MEDIUM · 0 LOW · 8 api-tagged ACs assessed (all 16 read).
**Every one of the spec's ten store measurements re-verified against `data/assistant.json` — all match exactly.**

---

## F1 (HIGH) — AC-9, AC-12 · no outcome stated for restoring an EXPIRED row, and the spec contradicts itself

`## API Touch Points` says `POST /tasks/{id}/restore` is *"unchanged and reused as-is.
Nothing about it moves"*. `## Impact` §10 says it *"gains … the expiry precondition of
AC-12"*, and AC-12 requires it to refuse.

*Consequence:* the contract has exactly three outcomes — `200 restored`,
`200 restored: false` (*the row is not deleted*), `404` (unknown id or another
account's). **An expired row is none of those three.** A QA author cannot state the
expected status, and both plausible picks are already spoken for: `404` is
indistinguishable from an unknown id, `restored: false` asserts the row is live, which
is false. **Whichever architecture picks, the assertion written against it also passes
for a different cause** — a false green on the one door that decides whether the 30-day
promise holds.

## F2 (HIGH) — AC-13 · the stated observable cannot carry what AC-13 asserts

`skipped` is defined as `[{task_id, title, reason: "modified_since_apply"}]`, and the
same contract section states **`skipped` names top-level tasks only**.

*Consequence:* two of AC-13's named states have no writable assertion. A **purged task**
lands in `skipped` with the only `reason` the enum has — so a row the user permanently
destroyed is reported to them as *"modified since apply"*, and **the test that passes
certifies a message that is wrong**. A **purged step** is contract-forbidden from
appearing in `skipped` at all. AC-13's own text says its purpose is to *"make it an
assertion instead of an accident"* — and the assertion it asks for is the one the
contract will not express.

## F3 (MEDIUM) — AC-12 · the removal write has no observable at any door

*"The expired rows go from the store the next time anyone opens that account's trash."*

After the trash read, an expired row is not listed and not restorable — **and both hold
identically whether the write happened or never happens at all**, because the
reachability predicate is evaluated at both doors regardless. The harness has no
raw-store read; `## Ops`'s retention counter is named in Ops and required by no AC. So
the test asserts the reachability predicate and gets labelled *"retention purge
verified"* — and the failure `## API Touch Points` itself names, *"no sweep at all
leaves expired rows on disk indefinitely"*, **ships green**.

## F4 (MEDIUM) — AC-6, AC-5 · the `api` tag may buy no verification

`## API Touch Points` leaves client-vs-server grouping to architecture; `## Data`
records `delete_gesture_id` as *"internal, never serialized"*. **If architecture takes
client-side grouping, the trash read returns N+1 flat rows and exposes no key**, so
AC-6 has nothing an api test can address — while reviewer C2 counts a P1 api case for
it anyway. The two branches are also not both available: client-side grouping needs a
key `## Data` forbids.

## F5 (MEDIUM) — AC-14 · a refusal path that cannot be reached

*"A turn attempting either is refused under F-005 AC-40 like any other unpermitted
write."* AC-40 and AC-36 are **field-scoped**. Restore and permanent-delete are not
fields, and no interpreted-action vocabulary contains them, **so the fixture Interpreter
cannot emit one and the precondition is unconstructible.** The caller-scoping half is
fully testable and is the half the AC says it exists for; the assistant half is true
only vacuously, and if a later feature adds such an intent nothing here turns red.

---

## Checked, sound

- **AC-4** — every named reader has an external observable; the interpreter handle list
  through a turn whose fixture intent addresses the deleted row and must resolve
  `no_match`.
- **AC-5** — caller scoping falsifiable via a second account's seeded rows.
- **AC-11** — hard removal has a stated observable (`removed: [uuid]`) plus the
  follow-up restore refusal. **Unlike AC-12's removal write, this one can fail.**
- **AC-12's reachability half** — server-side `FakeClock` moves the 30 days; F-005
  AC-44's seam is the right one and no second clock is needed.
- **Preconditions** — every fixture needed is constructible today; `POST /__qa__/seed`
  writes raw task and turn rows bypassing every write rule. No seeding gap blocks
  phase 5.
- **All ten store measurements** — 839 tasks, 57 soft-deleted across 20 accounts, 4
  carrying a gesture id, 0 deleted steps, 0 deleted series rows, oldest 2026-08-16,
  420 turns, 24 naming a soft-deleted row and all 24 applied. Exact.
- **`## Impact` §2 and §5** verified true against the suites they cite.

*Not filed:* AC-5's *"it is the only read"* universal negative — its highest-cost
instance is already named and observable under AC-4.
