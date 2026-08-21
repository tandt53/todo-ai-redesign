# F-006 Gate 1 ROUND 2 — dev (mobile) lens (T-186, 2026-08-21)

**Verdict:** 2 HIGH · 1 MEDIUM. **All 7 round-1 findings hold — and 4 of them verified against the source they cite rather than the disposition log.**

---

## F1 (HIGH) — AC-10 · the restore notice is a **seventh** member of a closed six-member union

AC-10's only observable on the phone is a new row in `CarriedRowId` — **a closed union of
exactly six** (`mobile/model/carried.ts:62`), whose six row states are enumerated under
**one exemplar testid** in F-003's closed catalogue (`a11y.ts:162,192`). **No section routes
that id.**

*`## Impact` §4 calls it **"only a new member"**; §9's catalogue list omits it entirely.*
So the implementer invents a row id inside a catalogue `platform/mobile.md` calls *"closed
and structurally asserted"*, and **the QA author cannot address the outcome of a restore at
all** — the same failure AC-1 was amended to prevent, one level up.

## F2 (HIGH) — AC-9 · restore is the third write and the only one with no failed/offline post-state

AC-9's four outcomes are **all server verdicts**. AC-15 and AC-16 both enumerate the
offline/failure answers as *"AC-2's read, AC-11's and AC-17's writes"* — **so the hole reads
as a complete answer.**

*The cheapest copy on the phone is `undoLastAction`'s branch (`_shared/controller.ts:1451`),
which restores an undo offer that does not exist on this surface and announces
`UNDO_FAILED` — **wording that names undo, not restore** — and it checks connectivity
nowhere, so **restore is the one act here that will be attempted offline.***

**Evidence the spec itself supplies:** `## Impact` §11's third bullet says *"this feature's
three writes"* and **names two.**

## F3 (MEDIUM) — AC-17 · the confirmed set and the destroyed set are not bound

AC-17's confirmation names **the entries the client last read**; the act destroys **every
deleted row the account holds at act time.** Nothing binds them.

*On the irreversible act, the user accepts a named list and a different list is destroyed* —
the *"confirmation shown for a state that has since changed"* failure **AC-11 names in its
own offline bullet**, reached here with no queueing involved. **AC-11 pinned its set against
exactly this; AC-17 did not.**

---

## Round-1 findings — seven of seven hold

| | |
|---|---|
| **F1** Android back | **holds, and buildable** — AC-2's *own edge, own return, back takes the return* is the S4/Settings pattern exactly: `Overlay` gains `'trash'`, `shellBack` gains one branch. §10 routes IA §2/§3/§4/§6 to design |
| **F2** offline guard | **holds** for the two destructive writes. `## Out of Scope` carries only the exclusion and the ACs carry the post-state — *which is what I asked for.* **The third write is F2 above** |
| **F3** AC-10 false on the phone | **holds, verified in source** — `CarriedNotices` is mounted at the frame **above** the surface host (`AssistantScreen.tsx:99`), outside the stack, so the notice **is** visible over the trash. Both false sentences withdrawn; §11 records the phone's missing filing control |
| **F4** two states | **holds** — AC-2 names four and cites `tasks-view.ts:66` by name |
| **F5** 30-day clock | **holds** — *"one value, one reader tier: the server"* · *"No client derives it"* |
| **F6** two unsourced values | **holds** — AC-6 closes client grouping; AC-7 renders the step's own title and states the orphan case |
| **F7** count wrong / list short | **holds** — §1's table carries all three sites I named, **including `mobile/model/task-link.ts:76`**; AC-5 states no count |

## The routed question — not filed as a finding, and why

*The spec already spends the two sentences that make it safe on my side:* §1 says the read
permission *"is not a licence to widen"* `task-link.ts:76`, and §8 says making the door open
the trash *"is a new requirement for F-001 to take, not a repair"*. **Nothing is left for an
implementer to invent.**

**What I can add that product and tester cannot measure: the price is not symmetric across
clients, and it was taken with the web number in view.**

- **Web above the split:** the Talk panel stays mounted beside the centre and stacked
  surfaces slide over the centre only — **the answer and the trash are co-visible**, and
  *"go look"* costs one navigation with the sentence still on screen.
- **Phone:** S1 and S2 are peers, the trash is an overlay over S2, and `'go'` clears the
  overlay — **the answer and the remedy are never on screen together.** The user carries the
  task name across three taps.

*The conversation persists, so nothing is lost: three taps and a held thought, not a broken
path.* **As dev, that is an acceptable price.** One sentence in AC-14's dead-end bullet
naming the phone as where the cost is worst would record it — *but it changes no code and I
would not spend a revision on it alone.*
