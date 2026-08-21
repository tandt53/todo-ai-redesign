# Owner decision — 2026-08-19 — § CarriedNotice placement, a timer on the undo offer, and a trash

**Raised by:** the owner, looking at the running iOS build. The trigger was a
screenshot of `CN-UNDONE` (*"Buy milk" is back on the list.*) docked under the top
bar, with the question *"sai ở đâu — design hay FE dev?"*

**Answer to that question, recorded because it is the more reusable half:
neither.** `docs/design/_shared/components.md § CarriedNotice ## Placement` specifies the
region docked below the top bar and outside the surface stack, and mobile renders it
at the frame (`AssistantScreen`, not `ShellHost`) for exactly the reason design
gives — S3 Lists and S4 Settings slide over the content and under this region, so a
region inside the shell would be invisible on Settings and AC-47's *"visible wherever
the user is"* would be met at three of five surfaces. The absence of a timer is
AC-47, AC-43 and AC-33's 2.2.1, tightened deliberately in revision 4. Design built
what the spec required and the implementers built what design published. **What
changed is the requirement, and only the owner can change it.**

---

## 1. The region moves to the bottom of the frame

**Chosen.** No AC constrains the edge — AC-47 requires *visible wherever the user
is*, which the bottom satisfies as well as the top.

**One constraint travels with it:** on Talk the composer sits at the bottom, and the
keyboard rises over it. The region docks **above the composer**, not against the
screen edge, and moves with the keyboard. Design owns the exact rule; this note only
records that "bottom" cannot mean "absolutely bottom" on the surface where the app's
primary input lives.

The strip-order rule (`§ CarriedNotice → § InlineRetryBanner → § OfflineBanner →
§ SaveNotice → content`) was written as *outermost first* from the top. Inverted, the
principle is unchanged and the rendering is: **a strip that is not about the surface
it appears on stays furthest from the surface's content.**

## 2. Both undo rows self-dismiss after 10s; the value-carrying rows never do

**Chosen.** The family stops having one lifetime rule, and **the split is by what the
row carries, not by which row it is:**

| Row | Carries | Lifetime |
|---|---|---|
| `CN-FAILED`, `CN-OFFLINE`, `CN-DELETED` | **text the user typed** that the app could not store | **never self-dismisses** — AC-47 and AC-2 unchanged |
| `CN-UNDO`, `CN-UNDONE` | nothing the user typed | **10s, then gone** |

Stating the split by *carried content* rather than by row id is what stops the next
row added to this family inheriting the wrong rule by default. `carriedRows()`
already builds `CN-UNDONE` with `blocks: []` and `action: null`, so the boundary is
already visible in the code and only needs naming in the spec.

**AC-43's ender list gains a fifth ender** — elapse — and its *"and by nothing else"*
must name it, exactly as revision 4 had to name the reload.

## 3. Delete stays, on the row and in the detail

**Chosen**, over a recommendation to move it off the row. The recommendation was
made when §4 was still undecided and the offer was the only remedy; §4 removes the
premise, so the recommendation lapses rather than being overruled.

## 4. The app gets a trash — and this is what makes §2 safe

**Chosen: a *Recently deleted* collection.** The owner asked what other products do,
and the comparison is the reason this is a requirement rather than a nicety:

| App | Delete | Net behind it |
|---|---|---|
| Apple Reminders | yes | *Recently Deleted*, **30 days**, then permanent |
| TickTick | yes | Trash |
| Things 3 (Mac) | yes | Trash, emptied by hand |
| Things 3 (iOS) | yes | **none** — permanent, *"which is why deletions are a multi-step process"* |
| Todoist | yes | no trash; daily backups (paid) |

**No product on that list drops delete, and only one has no net — and it pays for it
by making delete deliberate.** With §2's timer and a one-tap row delete, this app
would have had the least safety of any of them. §4 is what settles that, and it
settles it in the direction the market is in rather than by making the product
harder to use.

**It also disposes of the accessibility objection §2 would otherwise create.** AC-33
declares WCAG 2.1 AA and names **2.2.1 Timing Adjustable**; a ten-second limit on the
*only* remedy for a destructive action is exactly what that criterion governs, and
revision 4 had already removed the reading that a focus-extended timer would satisfy
it. **Once the trash exists, the offer is a shortcut rather than the remedy** — an
equivalent, untimed path to the same outcome remains available, so nothing is lost by
elapse and the criterion is not engaged in the way it would have been. *This
reasoning depends on §4 actually shipping; it is not available to §2 alone.*

**OQ13 closes** — the depth-of-recovery question, open since revision 4 — with:
*recovery is the trash, for its retention period; the undo offer is a shortcut to it.*

### What already exists, measured rather than assumed

**Deletion has been soft since F-001.** Verified on 2026-08-19 by reading the API:
`deleted_at` and `delete_gesture_id` are stored fields (`api/types.ts`),
`DELETE /tasks/{id}` sets `deleted_at` (`api-contracts.md` names it *"delete (soft:
`deleted_at`)"*), `GET /tasks` filters `deleted_at === null` (`app.ts:422`),
`POST /tasks/{id}/restore` clears it and replays the whole delete gesture
(`app.ts:562-618`, ADR-012), and **the live store already holds 53 soft-deleted
rows** (`api/types.ts:19`). **The data for a trash is already there and has been all
along; nothing is being recovered from nothing.**

### What is genuinely missing, and is therefore the feature

1. **A way to list deleted rows.** Every read path filters them out; none returns them.
2. **A retention rule and a purge.** Nothing has ever removed a soft-deleted row, so
   today they accumulate forever — which is not a trash, it is a leak that happens to
   be recoverable. A stated retention (Apple's 30 days is the reference point) turns
   one into the other.
3. **Permanent deletion** — *delete forever* on one row, and *empty trash*. This is
   the one genuinely irreversible act in the product, and it is the only place a
   confirmation is warranted.
4. **The surface** — a fifth entry in the lists menu, peer to `Done`.

### The structural rule this must not break

`ADR-009 § Amendment 2` models tasks on **two axes** — a date axis (Today · Upcoming ·
undated) and a filing axis (Inbox · lists) — with `Done` the gate that empties both.
**The trash is on neither axis.** It is a lifecycle state like `Done`, not a container
like `Inbox`, and a deleted task must appear in **no** collection, **no** count, and
**no** assistant query while it is in the trash. Building it as a fifth *filing*
destination would reintroduce exactly the category error the four-buckets decision
fixed.

## 5. Scope: this is F-006, and §2's timer waits for it

**The trash is a new feature.** F-005 is under an amend-only constraint (48 ACs,
nothing added) and its Gate 1 is closed; adding a trash to it reopens a gate the owner
deliberately shut. So:

- **F-005 amendment** — §1 placement, §2's lifetime split, AC-43's fifth ender,
  AC-47's rule restated, AC-33's 2.2.1 sentence updated to cite §4's reasoning. Amends
  existing ACs only; adds none.
- **F-006 — Recently deleted** — a new feature, its own spec, its own Gate 1.

**And the ordering is a requirement, not a preference: §2's timer on `CN-UNDO` does
not ship before F-006.** Between the two there is a window in which the app has a
one-tap delete, a ten-second window, and no net — the exact configuration §4 was
chosen to avoid. §1 (placement) and the `CN-UNDONE` half of §2 have no such
dependency and may ship immediately, because a report that carries nothing takes
nothing with it when it goes.

---

## Provenance

Owner answers in this session, in order: *"layout này nên ở phía dưới màn hình… nên
chỉ hiển thị trong khoảng 10s"* · *"các app todo khác có delete và thùng rác ko?"* ·
*"ok, vậy giữ delete. 3. undo cũng có timer"* · *"app phải có thùng rác"*.

---

## 6. The trash keeps a deleted task for 30 days, and that promises REACHABILITY

*(Added 2026-08-21, after F-006's spec was written and its OQ1 put the question with
measurements. Recorded here rather than in a new file because it is the last open
piece of the same decision — §4's trash is what §2's timer depends on, and a trash
without a retention rule is not a trash.)*

**Chosen: 30 days, reachability-scoped.** After 30 days a deleted task can no longer
be recovered. The row is actually removed **when someone opens the trash**, not by a
clock.

**The distinction the owner was asked to make, because the two are not the same
promise:**

| | What it promises | What it needs |
|---|---|---|
| **reachability** *(chosen)* | after 30 days you cannot get it back | nothing new — the predicate is evaluated at the two doors that already reach a deleted row |
| storage | after 30 days it is gone from disk | a background job **this app does not have**, and which F-006 puts out of scope |

**The cost, stated rather than buried:** an account nobody opens the trash on keeps
its deleted rows on disk past 30 days. The promise made to the user is still true —
they cannot reach them — but "deleted after 30 days" is not literally true of storage.
**If this ever needs to be a storage guarantee (a data-retention obligation, a
privacy commitment), it becomes a scheduler and that is a different piece of work.**

**Measured on the live store, 2026-08-21, which is why this was free to decide now:**
57 soft-deleted rows of 839, across 20 accounts, and **the oldest soft-delete is five
days old**. At any value from 7 days upward, today's purge removes nothing. Raising
the number later costs nothing; lowering it destroys rows. So it starts where the
closest comparable product starts.

**Common practice:** Apple Reminders keeps *Recently Deleted* for 30 days and then
deletes permanently. TickTick and Things 3 on Mac keep a trash until it is emptied by
hand. Todoist has no trash and sells daily backups.

**What follows automatically:** F-006's AC-3 (every entry states when it goes) and
AC-12 (the retention clock) now have their number, **OQ1 closes**, and Gate 1 can read
a spec with the number in it rather than spending findings on its absence.

---

## 7. When the undo offer elapses, it names the trash

*(Added 2026-08-21, from F-006's Gate 1. The product lens found that the trash has **one**
inbound path and the spec declines three others in three separate `## Impact` entries —
each locally defensible, and no AC owning the sum. Recorded here because it closes the last
gap in §2's timer.)*

**Chosen: option A.** When `CN-UNDO` reaches its ten seconds and goes, **what replaces it
names the trash as where the task went.**

**Why this and not the cheaper answers.** §2's timer and §4's trash were chosen together,
and F-005 AC-33 declares the timer WCAG 2.2.1-conformant **because an equivalent untimed
path to the same outcome exists**. That argument has a hole the product lens named
precisely: after the offer elapses, the user's only route to that path is a Lists-menu row
that **carries no count** (AC-1) and — as of this gate — **carries no mark either** (OQ3,
answered by the design lens: every accent is already assigned, so a mark is a change to the
design system rather than a pick from it).

**A net the user cannot find at the moment they need it does not discharge the dependency.**
Option B (leave all four paths as written) was defensible and is being declined
deliberately rather than by omission — which was the product lens's actual complaint: not
that B is wrong, but that it had been *accumulated* across three `## Impact` entries rather
than chosen once.

**What follows automatically, and is not a separate decision:**

- **F-005 AC-43 gains a clause.** The elapse is no longer silent: it is the moment the
  offer hands off. Wording is design's; that the handoff happens is the AC's.
- **F-005 AC-33's 2.2.1 argument gets its last leg.** It currently says the timer is
  conformant because an untimed path exists. It can now say the user is *told about* that
  path at the moment the timed one ends — which is the difference between a path existing
  and a path being available.
- **F-006 records the inbound path as satisfied by F-005 AC-43 and does not settle it
  inside `## Impact`.** That section answering it three times is what produced the finding.
- **Design owes the copy**, and it joins `§ CarriedNotice`'s existing revision (T-179)
  rather than starting its own.

**Common practice, stated because it does not support this choice and the record should say
so.** Gmail and Apple Reminders both let the undo toast vanish silently and say nothing
about the trash. Asana's 2026 rework went the other way, toward signposted central
recovery. **The tie-breaker here is not the market — it is that this product's own
accessibility claim leans on the path being reachable, and theirs do not.**

---

## 8. The assistant may READ the trash. It still may not write to it.

*(Added 2026-08-21, answering F-006's OQ4. The product lens found that the assistant was
excluded from *reading* the trash on a rationale that only justifies excluding it from
*writing* — AC-14 argued from F-005 AC-36's closed **permission** list, AC-4 from the
handle list's **addressing** mechanism, and AC-15 then presented the total absence of a
voice path as an accessibility strength.)*

**Chosen: the assistant can read.** On a product whose stated purpose is *"the user talks
to an AI assistant to create, edit, and delete todos"*, the safety net behind delete having
**no voice at all** — including read-only — was a scope decision no source had made, and it
was being presented as derived.

*"What happened to the dentist task?"* becomes answerable.

**The line, stated so it cannot drift:**

| | |
|---|---|
| **Read — permitted** | the assistant can say what is in the trash and that a task went there |
| **Address — unchanged** | a deleted task stays out of the interpreter's handle list (AC-4). It is not a handle for an edit, and *"delete the dentist task"* must not resolve to a row already deleted |
| **Write — unchanged** | restore and permanent deletion stay hand-only (AC-14, AC-15). **This half was never in question** and the owner's decision does not touch it |

**The consequence, named once and not re-argued.** The assistant can now tell the user
where a task went **and cannot act on it** — the user is told *"it is in the trash"* and
must then go to the trash by hand. That is a real dead end, and it is the deliberate price
of keeping the only irreversible act in the product away from an interpreted intent.
**Routed to the round-2 lenses to press on rather than settled here**, because whether the
dead end is acceptable is exactly the sort of thing a tester and a product lens see
differently and a spec author sees not at all.

**What follows automatically:**

- **AC-14 splits.** The write refusal is inherited from F-005 AC-36 and stays. The **read**
  permission is this feature's own decision with its own reason — which is what the finding
  asked for, in either direction.
- **AC-4 is unchanged and must be seen to be unchanged.** Its clause is about the
  **handle list**, not about reading. A revision that widens AC-4 to admit reading would
  make a deleted task addressable, which is not what was decided.
- **AC-15's framing changes.** It may no longer present the absence of a voice path as an
  accessibility strength, because there is now a voice path.
- **OQ4 closes.**
