# F-006 Gate 1 ROUND 2 — tester (mobile) lens (T-186, 2026-08-21)

**Verdict:** 1 HIGH · 3 MEDIUM. **All 6 round-1 findings landed in the text; both HIGHs hold.**
**All four new findings are in the fix for F4** — `## Test strategy` now has a mobile tier, and the tier is wrong three ways.

---

## F3 (HIGH) — AC-17 · *"expired or not"* cannot fail at any product door

AC-17 destroys *"every deleted row of the account, expired or not"*. **An expired row is
unlisted and unrestorable whether or not the act removed it** — so the expired half has no
observable that can fail.

**An implementation that empties only the unexpired rows passes every assertion written
from this AC, and the expired rows stay on disk forever** — the leak `## API Touch Points`
names as the failure mode, arriving through the one act the user is told is irreversible.

*AC-12 already owes a raw-store harness read for exactly this. **AC-17 does not cite it.***

## F1 (MEDIUM) — AC-2, AC-11, AC-17 · model-testable rules routed to the device debt group

The split sends *"AC-2's four states"* and *"AC-11 / AC-17's confirmations"* wholly to the
device group — but **the rule each AC actually added is a decision in shared model code
that a node run can turn red.** So the two prohibitions revision 3 added for the phone (a
read in flight, failed or offline must never render the empty state; offline the destroy is
refused rather than queued) land in the group defined as *"not ticked on a node run"* —
**verified at no tier at all.**

*Measured: the seam exists.* `MobileControllerDeps.connectivity` (`mobile/controller.ts:123,144`),
driven by `setOnline` (`_shared/controller.ts:805`), **with an existing test using it** at
`mobile/__tests__/lifecycle.test.ts:460`.

*Directive: split those three by **observable** — decision vs render — not by AC name.*

## F2 (MEDIUM) — AC-8, AC-16 · the enumeration is incomplete and its count is wrong

**Thirteen ACs carry `(mobile)`, not twelve.** AC-8 and AC-16's 4.1.3 appear in **neither**
group. AC-12, tagged `(api)` only, sits **in the mobile node list**.

*A phase-4 author greps for their AC and finds nothing for AC-8 or for the announcement rule
AC-16 spent a whole revision-3 bullet enumerating* — **the same "no rule, both
improvisations known-bad" state the split was written to end.**

*And: AC-5 already publishes the rule this line breaks — L-027, the enumeration is the
contract and the number is not.*

## F4 (MEDIUM) — AC-14 · the dead end is unobservable

AC-14 makes the assistant's read falsifiable in one fixture but **constrains nothing about
what the reply says** beyond naming the task and the trash.

**The one reply this permission exists to produce is the one nothing tests:** *"it is in the
trash, I'll put it back"* satisfies AC-14 as written, contradicts AC-4 and AC-15 **in the
user's understanding rather than in the store**, and turns nothing red.

---

## The routed question, answered in tester's terms

> **The dead end is acceptable. What is not acceptable is that it is invisible to the
> suite.**
>
> §7 already set the precedent for exactly this shape — when the undo offer elapses, what
> replaces it *names the trash*, because a net the user cannot find does not discharge the
> dependency. **The assistant read is the same situation one layer up:** a location the
> user is told about and cannot act on discharges nothing unless the reply also says how to
> get there. *One clause and one fixture assertion, not a reversal of the owner's line.*

## Round-1 findings — all six checked

| | |
|---|---|
| **F1** offline / no failure states | **holds** — AC-2 names four states, offline by name, and forbids the empty render for in-flight, failed and offline |
| **F2** AC-1 placement unobservable | **holds** — the row has its own contract testid and is stated not to be an LM-COLLECTION member; `## Test strategy` puts placement in the device group. *`expectedShellIds` is still a Set, so a set assertion still cannot see placement — **that is now honest debt, not a false green.*** |
| **F3** date producer | **holds** — *"produced by the server… No client derives it"*, and `## Data`'s retention row reads *"one value, one reader tier: the server"* |
| **F4** no mobile tier | **landed, three defects in the fix** — F1 and F2 above |
| **F5** failed-write post-state | **holds** in text for AC-11 and AC-17; its verification tier is F1 |
| **F6** orphaned step | **holds** — AC-7's orphan rule, AC-9's refusal (d), and the two-gesture fixture with its three cases |

## Also checked, sound

- **AC-9's four outcomes** — (c) and (d) required distinguishable at the door, wire shape
  routed to architecture. Assertable as stated.
- **AC-15** — the zero-AI-call counter is scoped to the hand path and AC-14's turn is
  explicitly excluded. **No double-count; the boundary is stated.**
- **AC-5** — the assistant's read is a **caller** on the existing path, not a second door.
  AC-4 and AC-5 stay consistent.
- **No iOS/Android divergence** — AC-2 gives the surface its own edge and return, and maps
  the Android back press onto that return.
- **Nothing device-rendered could be checked.** No suite in this repo has ever run on a
  simulator — F-003's standing debt, unchanged since round 1.
