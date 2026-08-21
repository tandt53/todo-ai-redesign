# F-006 Gate 1 ROUND 2 — dev (api) lens (T-186, 2026-08-21)

**Verdict:** 1 HIGH · 3 MEDIUM. **All 8 round-1 findings hold — every fix landed in text, none claimed-but-absent.**
Every store measurement reproduces exactly. **All 15 line citations in `## Impact` §1 reproduce verbatim.**

---

## F1 (HIGH) — AC-14, AC-5, AC-12 · **the assistant's read IS the read that purges**

AC-5 states the assistant's read is *this* read; AC-12 puts the retention **removal write**
on that same read. **They compose into: asking the assistant about the trash hard-removes
rows.** Unstated.

*Either the turn inherits AC-5's read whole and **a fixture that asks the assistant anything
about the trash purges before the test's own assertion** — making AC-12's row-count
observable unattributable — or architecture exempts the turn caller, and **"the removal write
happens on the trash read" is false for one of that read's two callers** with nothing stating
it.*

## F2 (MEDIUM) — AC-14, AC-12 · **the dead end is 180 seconds wide, not absolute**

`POST /assistant/turn/{turn_id}/undo` accepts `via: "voice"`, and `performUndo` replays the
pre-apply row verbatim — **so a voice undo of a delete un-deletes, inside ADR-004's
180-second idle window.**

*AC-14's paragraph reads as absolute.* **An owner weighing whether the dead end is
acceptable is weighing the wrong shape.**

## F3 (MEDIUM) — AC-5, AC-4 · §1's criterion admits ten sites its table does not carry

The criterion includes *"a write's own view of what is live"*. The omitted sites include
`turns.ts:646` and `plan.ts:301`/`:677` — **the apply-time guards that stop a turn writing a
row deleted since resolve** — and the four task doors an implementer will actually touch
(`app.ts:498, :524, :654, :690`) **are covered by no row.**

*Either add the ten, or drop the write-guard clause from the criterion.*

## F4 (MEDIUM) — AC-17, AC-11 · the confirmed set and the destroyed set can disagree

**A task deleted between the trash read and the confirm — by the other client, or by a turn,
both of which can delete — is destroyed without being named.** That is the owner's
2026-08-17 decision failing on the one act it was written for. **AC-11 closed the mirror
case explicitly; AC-17 inherited only the post-state rules.**

---

## Round-1 findings — eight of eight hold

Closed-membership stated once and referred to (verified by reading all four ACs) · the
orphan refusal is buildable (`app.ts:611`'s `parent === undefined → continue` is the branch
that changes) · five restore outcomes as requirements with shapes left to architecture ·
client-side grouping **closed rather than offered** · the read-that-mutates decision now
*taken*, with the 839-row transact cost carried · server-producer for the date · the
"no new response shape" sentence withdrawn for both doors · §1's headline count dropped and
AC-12's *"two doors"* scoped to the ones that hand a row to a user.

**One closure verified against code rather than text:** *an orphaned step is always a
singleton entry* — `plan.ts:105` cascades live steps only and `restoreTask` restores a whole
gesture, **so a gesture can never be left half-deleted with an orphan inside it.**

## Also checked, sound

- **AC-14's read-without-addressing needs a channel the shipped Interpreter port does not
  have** — `InterpreterContext` carries exactly one task array and **every `ContextTask`
  mints a handle.** §10 routes this to architect and names the exact hazard. *Not a finding.*
- **The expired-parent-restored-by-invariant path is unreachable** on the product path — a
  parent's entry can never be older than a separately-deleted step's entry.
- **A mutating GET bypassing the per-account serial queue is not a platform contradiction** —
  measured: no task write door is queued; only the assistant doors are.
- **AC-12's no-scheduler premise still holds** — no server-side timer added since round 1.
