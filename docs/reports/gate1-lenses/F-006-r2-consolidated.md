# F-006 Gate 1 ROUND 2 — consolidation (T-186, 2026-08-21)

**Verdict: 14 HIGH · 20 MEDIUM · 3 LOW across nine lenses. The round cap is reached — a third round escalates to the human regardless of severity.**

| lens | H | M | L |
|---|---|---|---|
| design | 2 | 4 | 1 |
| architect | 2 | 2 | 0 |
| product | 2 | 1 | 1 |
| dev (mobile) | 2 | 1 | 0 |
| tester (web) | 2 | 2 | 0 |
| dev (api) | 1 | 3 | 0 |
| dev (web) | 1 | 2 | 1 |
| tester (api) | 1 | 2 | 0 |
| tester (mobile) | 1 | 3 | 0 |

---

## The finding that frames everything else

**All 56 round-1 findings hold. Every one. Verified independently by nine lenses, most of
them against the source or the working tree rather than against the disposition log.**

Round 2 is therefore **not** a report that revision 3 failed. It is a report that **the
things nobody had reviewed were the things that were wrong** — and the arithmetic is stark:

| Where the 14 new HIGHs sit | count |
|---|---|
| **AC-14 / AC-15 — the owner's read permission, added in revision 4, after round 1** | **7** |
| **AC-17 — split out of AC-11 by a revision-3 fix; no lens had ever read it** | **3** |
| **AC-9 / AC-7 — clauses *added* by revision-3 fixes** | **4** |
| ACs that existed at round 1 and survived it unchanged | **0** |

**Every single new HIGH is on text that no lens had read.** That is the mechanism the T-184
briefing named in advance — *every AC you add is unreviewed after this round* — arriving
exactly as predicted, from two directions at once: the owner answered after a round, and a
fix created an AC.

---

## The seven convergences

### C1 — **The assistant is required to say something no vocabulary can say** · 3 lenses
`AC-14, AC-5` — design F1, tester-web F1, tester-api F1. **Independently, from three
different closed sets:**

- **`components.md § Spoken frames`** has no row for it — and **F-002 AC-22 makes an unframed
  utterance *fail* rather than ship generated text.** *Its test parses that section by row ID
  at run time.*
- **`turn.outcome.kind` is seven closed members**, and F-002 `§ What speaks` calls its table
  *"exhaustive and closed"*.
- **The only free-text field reachable is `unsupported_query.alternative`** — which would
  report a question the assistant just answered as unsupported.

**So the owner's decision is currently unimplementable.** *Both frames fit the closed
five-slot vocabulary — it is the frames that are missing, not the slots.*

### C2 — **The read grant manufactures an intent the turn path answers with a lie** · 4 lenses
`AC-14` — product F1 (sharpest), tester-api, tester-web F3, tester-mobile F4.

> The assistant says *"the dentist task is in the trash."* The user says *"put it back."*
> **That reaches `no_match` — the assistant denies the task it named one turn earlier.**

**`turns.ts:603` already excludes that improvisation by name**, written for F-005 AC-40:
***"`no_match` is a lie (the task WAS matched)."*** And **AC-14 says no AC turns red on it.**

*Product: **this is L-015's shape, one round later.** §7 landed in revision 3 and §8 in
revision 4; each was reviewed alone. Composed, **§7 signposts the trash at the moment the
user has just been speaking — routing voice users INTO §8's dead end rather than away from
it.***

### C3 — **The assistant's read is the read that purges, and the third door** · 2 lenses
`AC-5, AC-12, AC-14` — architect F1, dev-api F1.

AC-5 states the assistant's read is *this* read; AC-12 puts the **removal write** on that
read. **They compose into: asking the assistant about the trash hard-removes rows.**

*Either a fixture that asks the assistant anything about the trash **purges before its own
assertion**, or architecture exempts the turn caller and **"the removal write happens on the
trash read" is false for one of its two callers.*** AC-12 still says *"exactly two doors"* —
**and its own sub-bullet says that phrasing exists because "exactly two" is what an
implementer greps against.**

### C4 — **Restore is the third write and the only one with no failed or offline post-state** · 2 lenses
`AC-9, AC-15` — dev-mobile F2, design F2.

The read, the destroy and the empty each have both. **AC-15 and AC-16 both enumerate the
failure answers as "AC-2's read, AC-11's and AC-17's writes" — so the hole reads as a complete
answer.** And **`## Impact` §11's *"this feature's three writes"* names two.**

*The cheapest copy on the phone is `undoLastAction`'s branch, which announces `UNDO_FAILED` —
**wording that names undo, not restore** — and **checks connectivity nowhere**, so restore is
the one act here that will be attempted offline.*

### C5 — **AC-17's confirmed set and destroyed set are not bound** · 4 lenses
`AC-17` — dev-mobile F3, dev-api F4, tester-web F2, product F3.

The confirmation names **what the client last read**; the act takes **every deleted row at
act time**. *A task deleted between the read and the confirm — by the other client, or by a
turn — **is destroyed without being named.*** **AC-11 pinned its set against exactly this;
AC-17 inherited only the post-state rules.**

*And separately (tester-web): AC-17 imports AC-11's content rule — **row counts per entry** —
then enumerates **entry counts**. The two readings differ by the scale of the largest
irreversible act in the product.*

### C6 — **A restore can resurrect an EXPIRED row, and AC-12 says "without exception"** · architect F2, dev-api adjacent
`AC-9, AC-12`. Verified in shipped code: `app.ts:610-617` adds any deleted parent
**unconditionally**, then clears `deleted_at` on every member.

**AC-6's closed-membership fix closed the halves about *destroying* and *emptying* across
entries. This third half was about *resurrecting*, and it did not close.**

### C7 — **`## Impact` §1's criterion admits write-guard sites its table lacks** · 2 lenses
`AC-5` — dev-api F3, architect F4. *The two new doors are writes on deleted rows, and §1 is
the section that tells their implementer what not to widen* — **so `app.ts:524`, whose
widening would turn the shipped soft-delete route into a hard-delete route, is not in it.**

---

## Seen by one lens

- **AC-7's orphan clause has no data source** (dev-web F1). The client has only `parent_id`.
  *Live, deleted and gone are indistinguishable, and **an implementation that renders nothing
  for all three passes every fixture built on a live parent.*** **The clause added to fix
  round-1's F1 cannot be rendered.**
- **"Restore" is a forbidden word** (design F4). `§ Buttons` binds this concept to **put
  back** and lists *restore* among the words never used for it. **The spec uses `restor*` 57
  times; `put back` appears 3 times, none in an AC body.**
- **The restore notice is a seventh member of a closed six-member union** (dev-mobile F1),
  in a catalogue `platform/mobile.md` calls *"closed and structurally asserted"*. **§4 calls
  it "only a new member"; §9's list omits it.**
- **The ten-second notice group is unbuilt in both clients** (dev-web F3) — the shipped
  `CarriedNotices.tsx` has no timer and **its header states that absence as the requirement.**
- **AC-17's *"expired or not"* cannot fail at any product door** (tester-mobile F3) — and
  **reading the trash to observe it is what destroys the expired rows** (tester-api F2).
- **The mobile tier the round-1 fix added is wrong three ways** (tester-mobile F1, F2):
  thirteen ACs carry `(mobile)` not twelve, AC-8 and AC-16's 4.1.3 are in **neither** group,
  AC-12 (`api` only) sits in the mobile list, **and model-testable rules are routed to the
  device debt group** — *the seam exists and a test already uses it.*
- **AC-14 is `(api)`-tagged, so the sentence the user hears is verified at no tier that
  renders it** (tester-web F3).
- **The dead end is 180 seconds wide, not absolute** (dev-api F2) — the voice undo already
  un-deletes inside ADR-004's idle window. ***An owner weighing whether the dead end is
  acceptable is weighing the wrong shape.***

---

## The routed question — all nine answered, and they agree

**Every lens judged the dead end ACCEPTABLE.** Nobody asked the owner to reverse it.

- **product:** *"acceptable — keeping the only irreversible act away from an interpreted
  intent is right. **What is not acceptable is how the product currently falls into it.**"*
- **design:** *"**the dead end's cost is not the missing action — it is the missing
  sentence.** Fix C1 and the price the owner named is the price the user actually pays."*
- **architect:** *"costs no contract and creates no inconsistency… **the one architectural
  cost is C3, and it is a cost of the read rather than of the dead end.**"*
- **dev-web:** *"acceptable, and the reason is that it stays cheap — reversing it later is
  **one additive branch on each client and no contract change.**"*
- **dev-mobile:** *"**the price is not symmetric across clients and was taken with the web
  number in view.** On web the answer and the trash are co-visible; on the phone they are
  never on screen together — three taps and a held thought, not a broken path. **Acceptable.**"*
- **tester-mobile:** *"acceptable. **What is not acceptable is that it is invisible to the
  suite.**"*

**The consensus is not "the decision was wrong". It is "the decision is not yet sayable".**

---

## What the round affirmed

- **56 of 56 round-1 fixes hold**, across nine independent re-reads.
- **Every store measurement reproduces exactly**, re-derived by five lenses.
- **All 14 rows of `## Impact` §1 verified against the working tree** — file, line and
  description. *Every one real and correctly described.*
- **AC-6's closed membership is stated once and all four referrers cite it** — verified by
  reading, and by grep.
- **AC-12's reachability-not-storage promise is still un-misreadable.**
- **AC-16's *"2.2.1 is not engaged"* is correct** — the criterion's own exception covers
  limits beyond 20 hours.
- **AC-17's 3-names-plus-count exceeds the comparables** — Gmail's *Empty Trash now* and
  Apple Reminders' *Delete All* name nothing at all.
- **No migration is owed. No new entity, field or endpoint that does not exist.**
