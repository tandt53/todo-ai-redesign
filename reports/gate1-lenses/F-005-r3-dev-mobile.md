# Gate 1 round 3 — F-005 — dev lens (mobile), targeted re-review

Persisted per **L-009**. **HIGH 4 · MEDIUM 1 · LOW 0.** All ten round-2 findings
landed, nine cleanly. **Every finding below is new damage from revision 3** — three of
four HIGHs are collisions between the owner's offline answer and text the same revision
wrote elsewhere: **L-015's shape arriving inside one revision rather than across two.**

Dispositions verified against the files: F1 (both doors + single installer + one case
per door), F2 (receiver obligation in AC-26, AC-2's mobile bullet and API Touch Points),
F3 (**all four blocks** — AC-33 `(web, mobile)`, F-003 AC-9/AC-12 named, `announce.ts`
widened **not bypassed**, ids owed to F-003, `assistant-undo-button` ruled out, offline
"it cannot run at all"), F4, F5 (`pushLocalTasks` verified at `controller.ts:727-739`),
F6, **F7 verified against the file** (`uc-coverage-map.md:244-248` D8 definition **is**
still stale while rows 74/100 carry "closed 2026-08-18"; §7 now says so and §9 routes
it), F8, F9 (`deps.now` verified injectable/stored/defaulted, returns a **string**),
F10.

## HIGH

**F1 — AC-2's third state is unscoped, and the client guard has three arms.** The guard
is `task.local === true || this.state.offline || !this.onlineNow()`
(`controller.ts:602,619,631`). **Every diagnostic sentence in the spec says
"server-owned" (lines 52, 341, 664); the rule does not.** Refuse on the whole guard and
a task created offline can no longer be ticked or renamed offline — the local-first path
the same sub-bullet cites approvingly becomes create-only, on the client where offline
is the ordinary case. **Worse, the first arm fires while the app is ONLINE** (an unsynced
local row whose replay 5xx'd stays `local: true`), so the stated reason is *a lie the
user can disprove by looking at the connection*. `## Test strategy`'s per-client case is
written from the unscoped rule, **so mobile QA files a bug against the correct
behaviour.** *Directive:* scope to server-owned rows; restate "no queue, no durable
store, no replay" as "no **new** queue for edits" — as written it denies a store and a
replay that **ship today** and that `## Out of Scope` itself relies on existing.

**F2 — `## Out of Scope` forbids exactly the change AC-14 requires**, both added in
revision 3. One section says "no widening of `pushLocalTasks`'s replay literal"; AC-14
says "the replay carries the step's `parent_id` and its position" and names that same
literal as carrying neither today. Read one, AC-14's clause is unbuilt and the
undefined-position window stays open; read the other, the implementer believes they
violated an owner decision. **Reviewer C13 checks fields, not consistency between
sections.**

**F3 — AC-2's mobile bullet routes the value to `§ SaveNotice`, whose Lifetime rule 3
clears on leaving the surface.** The only text forbidding that lifetime is inside AC-47,
which is `(web)`. **On the phone there is no split**: `PathSwitch` between Talk and Tasks
is one tap and is the app's primary navigation. Built to the catalogue as written, a
value refused offline **is cleared by the next tap to Talk** — the silent loss AC-2's
governing sentence forbids, one navigation later, on the single most common gesture.
`## Test strategy`'s AC-47 case uses the detail's close, **which does not exist on
mobile**, so no case covers the mobile equivalent.

**F4 — AC-38's offline clause: neither value the phone needs has a stated source.**
(i) "What the client already holds" must include which reminders are unacknowledged —
`reminder_shown_at` is in `## Data` but **is never named as carried on the wire**, and
`## Data`'s preamble defers wire shape to architecture; **AC-25 made exactly this an
explicit wire statement for `series_live` and AC-38 did not.** Without it every passed
reminder re-surfaces on every offline foreground — dozens of times a day, which AC-38's
own "does not reappear on every launch" forbids. (ii) An acknowledgement made offline has
no holder and no durability, on a client whose only durable store saves `local === true`
rows — while AC-2, two hundred lines earlier, says there is no queue and no durable
store. **Building the holder means building the queue the owner declined on cost,
arriving through a side door**, with no answer for the app being killed while offline —
the phone's ordinary end of a session.

## MEDIUM

**F5 — AC-33's `(mobile)` list is one item short.** It enumerates four obligations that
put affordances on the phone and scopes the `announce.ts` widening to "a row-level undo
offer that is not a `Message`". **AC-2's offline refusal is a fifth** — AC-2 carries
`(mobile)`, and AC-33's own 4.1.3 rule lists it among the four announcements it was
never updated for. An implementer widening the path for the undo offer alone leaves **the
one announcement AC-33 itself calls "the one that fires during an outage when a
screen-reader user has least other information"** with no path.

## The constraint

No finding needs a new AC. **But F3 is the shape the owner asked to be told about:**
AC-2's mobile obligation was closed by pointing at a `(web)` AC's rules, and **the
pointer does not carry the rule across the tag.** That is the one place a clause was used
where retagging was the honest amendment.

## Checked, nothing found

AC-19's mobile cascade clause · AC-25's `series_live` and its explicit exclusion of
`series_id` · AC-26's per-occurrence idempotence · AC-39's negative case, mobile fixture
and F-003 id routing · AC-42 · AC-43's mobile bullet (all four round-2 blocks answered,
**with a named code path rather than a named criterion**) · AC-44's seam claims
re-verified · **AC-13's replay leak traced end to end**: `createLocalTask` marking the row
all-day plus AC-13's server-side absent-flag rule means the dropped `due_all_day` **does
not** produce a wrong outcome — the leak is real and the AC's outcome survives it, which
is why F2 is AC-14's problem and not AC-13's · §1's fifteenth-list entry, §7's five-row
table and §9's seven routing additions, all confirmed against the cited files.
